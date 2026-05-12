import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireMemoryWriteAccess } from '../middleware/writeAuth.js';

const router = Router();
const MAX_PAGE_SIZE = 300;
const DEFAULT_PAGE_SIZE = 100;

function nowIso() {
  return new Date().toISOString();
}

function parsePositiveInt(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function rawMessagesTableExists(db) {
  return Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'raw_messages'").get()
  );
}

function buildWhere(query) {
  const where = [];
  const params = {};

  if (query.includeHidden !== '1') {
    where.push('COALESCE(hidden, 0) = 0');
  }

  if (query.channel) {
    where.push('channel = @channel');
    params.channel = String(query.channel);
  }

  if (query.agent) {
    where.push('agent = @agent');
    params.agent = String(query.agent);
  }

  if (query.role) {
    where.push('role = @role');
    params.role = String(query.role);
  }

  if (query.session) {
    where.push('session = @session');
    params.session = String(query.session);
  }

  if (query.date) {
    where.push('substr(created, 1, 10) = @date');
    params.date = String(query.date);
  }

  if (query.favorite === '1') {
    where.push('COALESCE(favorite, 0) = 1');
  }

  if (query.q) {
    where.push('(content LIKE @q OR IFNULL(raw_json, "") LIKE @q)');
    params.q = `%${String(query.q)}%`;
  }

  return {
    whereClause: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

router.get('/', (req, res) => {
  try {
    const db = getDb();
    if (!rawMessagesTableExists(db)) {
      return res.json({
        data: [],
        total: 0,
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        warning: 'raw_messages table does not exist',
      });
    }

    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const offset = (page - 1) * pageSize;
    const sort = req.query.sort === 'desc' ? 'DESC' : 'ASC';
    const { whereClause, params } = buildWhere(req.query);

    const { total } = db
      .prepare(`SELECT COUNT(*) AS total FROM raw_messages ${whereClause}`)
      .get(params);

    const data = db
      .prepare(
        `
        SELECT
          id,
          session,
          line_num,
          role,
          content,
          created,
          agent,
          channel,
          thread_id,
          message_id,
          direction,
          content_type,
          kind,
          visibility,
          attachment_path,
          attachment_name,
          attachment_mime,
          source,
          favorite,
          hidden,
          updated
        FROM raw_messages
        ${whereClause}
        ORDER BY created ${sort}, id ${sort}
        LIMIT @limit OFFSET @offset
        `
      )
      .all({ ...params, limit: pageSize, offset });

    res.json({ data, total, page, pageSize });
  } catch (err) {
    console.error('Error fetching raw messages:', err);
    res.status(500).json({ error: 'Failed to fetch raw messages' });
  }
});

router.get('/channels', (req, res) => {
  try {
    const db = getDb();
    if (!rawMessagesTableExists(db)) {
      return res.json({ channels: [] });
    }
    const rows = db
      .prepare('SELECT DISTINCT channel FROM raw_messages WHERE channel IS NOT NULL AND channel != "" ORDER BY channel ASC')
      .all();
    res.json({ channels: rows.map(row => row.channel) });
  } catch (err) {
    console.error('Error fetching raw message channels:', err);
    res.status(500).json({ error: 'Failed to fetch raw message channels' });
  }
});

router.get('/dates', (req, res) => {
  try {
    const db = getDb();
    if (!rawMessagesTableExists(db)) {
      return res.json({ dates: [] });
    }

    const where = ['created IS NOT NULL', 'created != ""'];
    const params = {};
    if (req.query.channel) {
      where.push('channel = @channel');
      params.channel = String(req.query.channel);
    }
    if (req.query.agent) {
      where.push('agent = @agent');
      params.agent = String(req.query.agent);
    }
    if (req.query.includeHidden !== '1') {
      where.push('COALESCE(hidden, 0) = 0');
    }

    const rows = db
      .prepare(
        `
        SELECT substr(created, 1, 10) AS date, COUNT(*) AS total
        FROM raw_messages
        WHERE ${where.join(' AND ')}
        GROUP BY date
        ORDER BY date DESC
        LIMIT 366
        `
      )
      .all(params);

    res.json({ dates: rows });
  } catch (err) {
    console.error('Error fetching raw message dates:', err);
    res.status(500).json({ error: 'Failed to fetch raw message dates' });
  }
});

router.patch('/:id/favorite', requireMemoryWriteAccess, (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid raw message id' });
    }

    const db = getDb();
    if (!rawMessagesTableExists(db)) {
      return res.status(404).json({ error: 'raw_messages table does not exist' });
    }

    const existing = db.prepare('SELECT id, favorite FROM raw_messages WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Raw message not found' });
    }

    const favorite = req.body?.favorite === undefined
      ? existing.favorite ? 0 : 1
      : req.body.favorite ? 1 : 0;

    db.prepare('UPDATE raw_messages SET favorite = ?, updated = ? WHERE id = ?')
      .run(favorite, nowIso(), id);

    const message = db.prepare('SELECT * FROM raw_messages WHERE id = ?').get(id);
    res.json({ ok: true, message });
  } catch (err) {
    console.error('Error updating raw message favorite:', err);
    res.status(500).json({ error: 'Failed to update favorite' });
  }
});

router.post('/:id/hide', requireMemoryWriteAccess, (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid raw message id' });
    }

    const db = getDb();
    if (!rawMessagesTableExists(db)) {
      return res.status(404).json({ error: 'raw_messages table does not exist' });
    }

    const existing = db.prepare('SELECT id FROM raw_messages WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Raw message not found' });
    }

    db.prepare('UPDATE raw_messages SET hidden = 1, updated = ? WHERE id = ?')
      .run(nowIso(), id);

    res.json({ ok: true, id, hidden: 1 });
  } catch (err) {
    console.error('Error hiding raw message:', err);
    res.status(500).json({ error: 'Failed to hide raw message' });
  }
});

router.post('/:id/restore', requireMemoryWriteAccess, (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid raw message id' });
    }

    const db = getDb();
    if (!rawMessagesTableExists(db)) {
      return res.status(404).json({ error: 'raw_messages table does not exist' });
    }

    const existing = db.prepare('SELECT id FROM raw_messages WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Raw message not found' });
    }

    db.prepare('UPDATE raw_messages SET hidden = 0, updated = ? WHERE id = ?')
      .run(nowIso(), id);

    const message = db.prepare('SELECT * FROM raw_messages WHERE id = ?').get(id);
    res.json({ ok: true, message });
  } catch (err) {
    console.error('Error restoring raw message:', err);
    res.status(500).json({ error: 'Failed to restore raw message' });
  }
});

export default router;
