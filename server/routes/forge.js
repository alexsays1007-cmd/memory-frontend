import { Router } from 'express';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { requireMemoryWriteAccess } from '../middleware/writeAuth.js';

const router = Router();
const execFileAsync = promisify(execFile);

const LAB_ROOT = process.env.FORGE_LAB_ROOT || '/home/claude/forge-lab';
const CONFIG_PATH = `${LAB_ROOT}/forge_auto_config.json`;
const STATE_PATH = `${LAB_ROOT}/forge_auto_state.json`;
const LAST_RUN_PATH = `${LAB_ROOT}/manual-forge-last-run.json`;
const AUTO_SCRIPT = `${LAB_ROOT}/scripts/forge_auto_monitor.py`;
const PROMOTE_SCRIPT = `${LAB_ROOT}/scripts/manual_forge_promote.sh`;
const CUTOVER_SCRIPT = `${LAB_ROOT}/scripts/forge_cutover.sh`;

function readJson(path, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(path, data) {
  fs.writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function clampInt(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

async function runSafe(command, args = [], timeout = 120000) {
  const result = await execFileAsync(command, args, {
    cwd: '/home/claude',
    timeout,
    maxBuffer: 1024 * 1024,
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

async function serviceState() {
  try {
    const [timerActive, timerEnabled] = await Promise.all([
      execFileAsync('systemctl', ['is-active', 'forge-auto-monitor.timer']),
      execFileAsync('systemctl', ['is-enabled', 'forge-auto-monitor.timer']),
    ]);
    return {
      timerActive: timerActive.stdout.trim(),
      timerEnabled: timerEnabled.stdout.trim(),
    };
  } catch {
    return {
      timerActive: 'unknown',
      timerEnabled: 'unknown',
    };
  }
}

router.get('/status', async (req, res) => {
  try {
    res.json({
      config: readJson(CONFIG_PATH),
      state: readJson(STATE_PATH),
      service: await serviceState(),
      lastRun: readJson(LAST_RUN_PATH),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to read Forge status' });
  }
});

router.patch('/config', requireMemoryWriteAccess, async (req, res) => {
  try {
    const current = readJson(CONFIG_PATH);
    const next = {
      ...current,
      enabled: Boolean(req.body.enabled),
      notify_only: Boolean(req.body.notifyOnly),
      retain_tokens: clampInt(req.body.retainTokens, current.retain_tokens || 80000, 30000, 300000),
      warn_tokens: clampInt(req.body.warnTokens, current.warn_tokens || 120000, 50000, 800000),
      auto_tokens: clampInt(req.body.autoTokens, current.auto_tokens || 155000, 60000, 900000),
      cooldown_minutes: clampInt(req.body.cooldownMinutes, current.cooldown_minutes || 180, 15, 1440),
      telegram_notifications: req.body.telegramNotifications !== false,
    };
    writeJson(CONFIG_PATH, next);
    res.json({
      ok: true,
      config: readJson(CONFIG_PATH),
      state: readJson(STATE_PATH),
      service: await serviceState(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to save Forge config' });
  }
});

router.post('/run-check', requireMemoryWriteAccess, async (req, res) => {
  try {
    const run = await runSafe(AUTO_SCRIPT, [], 30000);
    res.json({
      ok: true,
      run,
      config: readJson(CONFIG_PATH),
      state: readJson(STATE_PATH),
      service: await serviceState(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Forge check failed' });
  }
});

router.post('/manual-cutover', requireMemoryWriteAccess, async (req, res) => {
  try {
    const retain = String(clampInt(req.body.retainTokens, 80000, 30000, 140000));
    await runSafe(PROMOTE_SCRIPT, ['--prepare', '--retain', retain], 180000);
    const lastRun = readJson(LAST_RUN_PATH);
    if (!lastRun.old_session_id || !lastRun.new_session_id) {
      return res.status(500).json({ error: 'Forge prepare did not produce old/new session ids' });
    }
    await runSafe(PROMOTE_SCRIPT, ['--promote', '--retain', retain, '--new-id', lastRun.new_session_id], 180000);
    const cutover = await runSafe(CUTOVER_SCRIPT, [
      'cutover',
      '--old',
      lastRun.old_session_id,
      '--new',
      lastRun.new_session_id,
      '--retain',
      retain,
    ], 120000);
    res.json({
      ok: true,
      cutover,
      lastRun: readJson(LAST_RUN_PATH),
      state: readJson(STATE_PATH),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Manual Forge cutover failed' });
  }
});

export default router;
