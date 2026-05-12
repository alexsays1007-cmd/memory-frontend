import { Router } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb } from '../db/index.js';
import { requireMemoryWriteAccess } from '../middleware/writeAuth.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultAdminScript = path.resolve(__dirname, '../scripts/memory_admin.py');

function nowIso() {
  return new Date().toISOString();
}

function runMemoryAdmin(command, payload) {
  const python = process.env.MEMORY_ADMIN_PYTHON || '/home/claude/mcp-memory/venv/bin/python';
  const script = process.env.MEMORY_ADMIN_SCRIPT || defaultAdminScript;
  const dbPath = process.env.DB_PATH || process.env.MCP_MEMORY_DB;
  const mcpDir = process.env.MCP_MEMORY_DIR || '/home/claude/mcp-memory';

  return new Promise((resolve, reject) => {
    const args = [script, command];
    if (dbPath) {
      args.push('--db', dbPath);
    }
    args.push('--mcp-dir', mcpDir);

    const child = spawn(python, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        MCP_MEMORY_DB: dbPath || process.env.MCP_MEMORY_DB || '',
        MCP_MEMORY_DIR: mcpDir,
      },
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', code => {
      let parsed = null;
      try {
        parsed = JSON.parse(stdout || '{}');
      } catch {
        parsed = null;
      }
      if (code !== 0 || !parsed?.ok) {
        const error = new Error(parsed?.error || stderr || `memory admin failed with code ${code}`);
        error.status = parsed?.error?.includes('not found') ? 404 : 500;
        reject(error);
        return;
      }
      resolve(parsed);
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { tag, agent, channel, q, sort, includeDeleted } = req.query;

    let where = [];
    let params = {};

    if (includeDeleted !== '1') {
      where.push('COALESCE(deleted, 0) = 0');
    }

    if (tag) {
      where.push('tags LIKE @tag');
      params.tag = `%${tag}%`;
    }

    if (agent) {
      where.push('agent = @agent');
      params.agent = agent;
    }

    if (channel) {
      where.push('channel = @channel');
      params.channel = channel;
    }

    if (q) {
      where.push('(content LIKE @q OR tags LIKE @q)');
      params.q = `%${q}%`;
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const orderClause = sort === 'asc' ? 'ORDER BY created ASC' : 'ORDER BY created DESC';

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM memories ${whereClause}`);
    const { total } = countStmt.get(params);

    const stmt = db.prepare(`SELECT * FROM memories ${whereClause} ${orderClause}`);
    const data = stmt.all(params);

    res.json({ data, total });
  } catch (err) {
    console.error('Error fetching memories:', err);
    res.status(500).json({ error: 'Failed to fetch memories' });
  }
});

router.patch('/:id', requireMemoryWriteAccess, async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    const { content, tags } = req.body || {};

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid memory id' });
    }
    if (typeof content !== 'string' || content.trim() === '') {
      return res.status(400).json({ error: 'Content is required' });
    }
    if (tags !== undefined && typeof tags !== 'string') {
      return res.status(400).json({ error: 'Tags must be a string' });
    }

    const result = await runMemoryAdmin('update-memory', { id, content, tags });
    const db = getDb();
    const memory = db.prepare('SELECT * FROM memories WHERE id = ?').get(id);
    res.json({ ok: true, memory, vectorRefreshed: result.vectorRefreshed });
  } catch (err) {
    console.error('Error updating memory:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to update memory' });
  }
});

router.post('/:id/hide', requireMemoryWriteAccess, (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid memory id' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM memories WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    db.prepare(
      "UPDATE memories SET deleted = 1, deleted_at = ?, deleted_by = ?, updated = ? WHERE id = ?"
    ).run(nowIso(), 'velvy', nowIso(), id);

    res.json({ ok: true, id, deleted: 1 });
  } catch (err) {
    console.error('Error hiding memory:', err);
    res.status(500).json({ error: 'Failed to hide memory' });
  }
});

router.post('/:id/restore', requireMemoryWriteAccess, (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid memory id' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM memories WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Memory not found' });
    }

    db.prepare(
      'UPDATE memories SET deleted = 0, deleted_at = NULL, deleted_by = NULL, updated = ? WHERE id = ?'
    ).run(nowIso(), id);

    const memory = db.prepare('SELECT * FROM memories WHERE id = ?').get(id);
    res.json({ ok: true, memory });
  } catch (err) {
    console.error('Error restoring memory:', err);
    res.status(500).json({ error: 'Failed to restore memory' });
  }
});

router.get('/tags', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT DISTINCT tags FROM memories WHERE tags IS NOT NULL AND tags != "" AND COALESCE(deleted, 0) = 0');
    const rows = stmt.all();

    const tags = new Set();
    rows.forEach(row => {
      row.tags.split(',').forEach(tag => {
        const trimmed = tag.trim();
        if (trimmed) tags.add(trimmed);
      });
    });

    res.json({ tags: Array.from(tags).sort() });
  } catch (err) {
    console.error('Error fetching tags:', err);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

router.get('/agents', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT DISTINCT agent FROM memories WHERE agent IS NOT NULL AND agent != "" AND COALESCE(deleted, 0) = 0');
    const rows = stmt.all();
    res.json({ agents: rows.map(r => r.agent).sort() });
  } catch (err) {
    console.error('Error fetching agents:', err);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

router.get('/channels', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT DISTINCT channel FROM memories WHERE channel IS NOT NULL AND channel != "" AND COALESCE(deleted, 0) = 0');
    const rows = stmt.all();
    res.json({ channels: rows.map(r => r.channel).sort() });
  } catch (err) {
    console.error('Error fetching channels:', err);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

export default router;
