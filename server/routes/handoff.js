import { Router } from 'express';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { requireMemoryWriteAccess } from '../middleware/writeAuth.js';

const router = Router();

function getHandoffPath() {
  return process.env.HANDOFF_PATH || path.join(process.env.HOME || '/home/claude', 'handoff.md');
}

function getBackupDir(handoffPath = getHandoffPath()) {
  return process.env.HANDOFF_BACKUP_DIR || path.join(path.dirname(handoffPath), 'handoff-backups');
}

function findGitRoot(startPath) {
  let current = fs.existsSync(startPath) && fs.statSync(startPath).isDirectory()
    ? startPath
    : path.dirname(startPath);

  while (current && current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, '.git'))) {
      return current;
    }
    current = path.dirname(current);
  }

  return null;
}

function formatStamp(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function readHandoffFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const stat = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  return {
    content,
    updatedAt: stat.mtime.toISOString(),
    size: stat.size,
  };
}

function backupCurrentHandoff(handoffPath) {
  if (!fs.existsSync(handoffPath)) {
    return null;
  }

  const backupDir = getBackupDir(handoffPath);
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });

  let backupPath = path.join(backupDir, `handoff.backup-${formatStamp()}.md`);
  let suffix = 1;
  while (fs.existsSync(backupPath)) {
    backupPath = path.join(backupDir, `handoff.backup-${formatStamp()}-${suffix}.md`);
    suffix += 1;
  }

  fs.copyFileSync(handoffPath, backupPath);
  fs.chmodSync(backupPath, 0o600);
  return backupPath;
}

function writeFileAtomic(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const tempPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tempPath, content, { encoding: 'utf-8', mode: 0o600 });
  fs.renameSync(tempPath, filePath);
  fs.chmodSync(filePath, 0o600);
}

function getPreviousCandidates(handoffPath) {
  const backupDir = getBackupDir(handoffPath);
  const candidates = [];

  if (fs.existsSync(backupDir)) {
    for (const name of fs.readdirSync(backupDir)) {
      if (/^handoff\.backup-\d{8}-\d{6}(?:-\d+)?\.md$/.test(name)) {
        candidates.push(path.join(backupDir, name));
      }
    }
  }

  const handoffDir = path.dirname(handoffPath);
  const currentRealPath = fs.existsSync(handoffPath) ? fs.realpathSync(handoffPath) : path.resolve(handoffPath);

  if (fs.existsSync(handoffDir)) {
    for (const name of fs.readdirSync(handoffDir)) {
      if (!/^handoff.*\.md$/i.test(name) || name === path.basename(handoffPath)) {
        continue;
      }

      const candidatePath = path.join(handoffDir, name);
      const candidateRealPath = fs.realpathSync(candidatePath);
      if (candidateRealPath !== currentRealPath) {
        candidates.push(candidatePath);
      }
    }
  }

  return candidates
    .filter(filePath => fs.existsSync(filePath) && fs.statSync(filePath).isFile())
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function getGitPreviousHandoff(handoffPath) {
  try {
    const configuredRoot = process.env.HANDOFF_GIT_ROOT;
    const gitRoot = configuredRoot || findGitRoot(handoffPath);
    if (!gitRoot) {
      return null;
    }

    const relativePath = path
      .relative(gitRoot, handoffPath)
      .split(path.sep)
      .join('/');

    if (!relativePath || relativePath.startsWith('..')) {
      return null;
    }

    const status = execFileSync(
      'git',
      ['-C', gitRoot, 'status', '--porcelain', '--', relativePath],
      { encoding: 'utf-8' }
    ).trim();

    // If the working tree has a newer handoff than git, the previous version is HEAD.
    // If the working tree matches git, the previous version is the commit before HEAD.
    const ref = status ? 'HEAD' : 'HEAD~1';
    const spec = `${ref}:${relativePath}`;

    const content = execFileSync(
      'git',
      ['-C', gitRoot, 'show', spec],
      { encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 }
    );

    const updatedAt = execFileSync(
      'git',
      ['-C', gitRoot, 'log', '-1', '--format=%cI', ref, '--', relativePath],
      { encoding: 'utf-8' }
    ).trim();

    return {
      content,
      updatedAt,
      size: Buffer.byteLength(content, 'utf-8'),
      source: 'git',
      ref,
    };
  } catch {
    return null;
  }
}

router.get('/current', (req, res) => {
  try {
    const handoffPath = getHandoffPath();
    const handoff = readHandoffFile(handoffPath);

    if (!handoff) {
      return res.status(404).json({ error: 'Handoff file not found' });
    }

    return res.json(handoff);
  } catch (err) {
    console.error('Error reading current handoff:', err);
    return res.status(500).json({ error: 'Failed to read current handoff' });
  }
});

router.get('/previous', (req, res) => {
  try {
    const handoffPath = getHandoffPath();
    const gitPrevious = getGitPreviousHandoff(handoffPath);
    if (gitPrevious) {
      return res.json(gitPrevious);
    }

    const [previousPath] = getPreviousCandidates(handoffPath);

    if (!previousPath) {
      return res.status(404).json({ error: 'Previous handoff file not found' });
    }

    return res.json({
      ...readHandoffFile(previousPath),
      source: 'backup',
    });
  } catch (err) {
    console.error('Error reading previous handoff:', err);
    return res.status(500).json({ error: 'Failed to read previous handoff' });
  }
});

router.put('/current', requireMemoryWriteAccess, (req, res) => {
  try {
    const { content } = req.body || {};

    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Content must be a string' });
    }

    const handoffPath = getHandoffPath();
    const backupPath = backupCurrentHandoff(handoffPath);
    writeFileAtomic(handoffPath, content);

    const handoff = readHandoffFile(handoffPath);
    return res.json({
      ok: true,
      ...handoff,
      backupCreated: Boolean(backupPath),
      backupName: backupPath ? path.basename(backupPath) : null,
    });
  } catch (err) {
    console.error('Error writing current handoff:', err);
    return res.status(500).json({ error: 'Failed to write current handoff' });
  }
});

export default router;
