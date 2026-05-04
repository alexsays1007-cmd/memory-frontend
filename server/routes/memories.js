import { Router } from 'express';
import { getDb } from '../db/index.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { tag, agent, channel, q, sort } = req.query;

    let where = [];
    let params = {};

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

router.get('/tags', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT DISTINCT tags FROM memories WHERE tags IS NOT NULL AND tags != ""');
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
    const stmt = db.prepare('SELECT DISTINCT agent FROM memories WHERE agent IS NOT NULL AND agent != ""');
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
    const stmt = db.prepare('SELECT DISTINCT channel FROM memories WHERE channel IS NOT NULL AND channel != ""');
    const rows = stmt.all();
    res.json({ channels: rows.map(r => r.channel).sort() });
  } catch (err) {
    console.error('Error fetching channels:', err);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

export default router;
