import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireMemoryWriteAccess } from '../middleware/writeAuth.js';

const router = Router();
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 50;

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

function summariesTableExists(db) {
  return Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'message_summaries'").get()
  );
}

function ensureReviewStatusColumn(db) {
  const cols = db.prepare("PRAGMA table_info(message_summaries)").all();
  if (!cols.some(c => c.name === 'review_status')) {
    db.prepare("ALTER TABLE message_summaries ADD COLUMN review_status TEXT NOT NULL DEFAULT 'pending'").run();
  }
}

function getUtcOffsetString(tz) {
  try {
    const now = new Date();
    const utcStr = now.toLocaleString('en-US', { timeZone: 'UTC' });
    const tzStr = now.toLocaleString('en-US', { timeZone: tz });
    const diffMinutes = (new Date(tzStr) - new Date(utcStr)) / 60000;
    const sign = diffMinutes >= 0 ? '+' : '-';
    const absMinutes = Math.abs(diffMinutes);
    const hours = Math.floor(absMinutes / 60);
    const mins = absMinutes % 60;
    const result = `${sign}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    if (!/^[+-]\d{2}:\d{2}$/.test(result)) return '+00:00';
    return result;
  } catch {
    return '+00:00';
  }
}

function buildWhere(query) {
  const where = [];
  const params = {};

  if (query.includeHidden === '1') {
    where.push('COALESCE(hidden, 0) = 1');
  } else {
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

  if (query.threadId) {
    where.push('thread_id = @threadId');
    params.threadId = String(query.threadId);
  }

  if (query.excludeThreadId) {
    where.push('(thread_id IS NULL OR thread_id != @excludeThreadId)');
    params.excludeThreadId = String(query.excludeThreadId);
  }

  if (query.startUtc) {
    where.push('created >= @startUtc');
    params.startUtc = String(query.startUtc);
  }

  if (query.endUtc) {
    where.push('created < @endUtc');
    params.endUtc = String(query.endUtc);
  }

  if (!query.startUtc && !query.endUtc && query.date) {
    where.push("date(replace(substr(created, 1, 19), 'T', ' ')) = @date");
    params.date = String(query.date);
  }

  if (query.favorite === '1') {
    where.push('COALESCE(favorite, 0) = 1');
  }

  if (query.q) {
    where.push("(content LIKE @q COLLATE NOCASE OR IFNULL(raw_json, '') LIKE @q COLLATE NOCASE)");
    params.q = `%${String(query.q).trim()}%`;
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

function sessionsTableExists(db) {
  return Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'raw_message_sessions'").get()
  );
}

router.get('/sessions', (req, res) => {
  try {
    const db = getDb();
    if (!rawMessagesTableExists(db)) {
      return res.json({ sessions: [] });
    }

    const hasMeta = sessionsTableExists(db);
    const channelFilter = req.query.channel;

    let whereParts = [];
    let params = {};
    if (channelFilter) {
      whereParts.push('channel = @channel');
      params.channel = String(channelFilter);
    }
    if (req.query.threadId) {
      whereParts.push('thread_id = @threadId');
      params.threadId = String(req.query.threadId);
    }
    if (req.query.excludeThreadId) {
      whereParts.push('(thread_id IS NULL OR thread_id != @excludeThreadId)');
      params.excludeThreadId = String(req.query.excludeThreadId);
    }
    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const liveStats = db.prepare(`
      SELECT
        session,
        COUNT(*) AS message_count,
        SUM(CASE WHEN COALESCE(hidden, 0) = 0 THEN 1 ELSE 0 END) AS visible_count,
        MIN(created) AS first_created,
        MAX(created) AS last_created,
        MAX(channel) AS channel,
        MAX(thread_id) AS thread_id,
        MAX(agent) AS agent,
        MAX(source) AS source
      FROM raw_messages
      ${whereClause}
      GROUP BY session
      ORDER BY MIN(created) DESC
    `).all(params);

    let metaMap = {};
    if (hasMeta) {
      const metaRows = db.prepare('SELECT * FROM raw_message_sessions').all();
      for (const row of metaRows) {
        metaMap[row.session] = row;
      }
    }

    const sessions = liveStats.map(s => ({
      session: s.session,
      title: metaMap[s.session]?.title || s.session,
      channel: s.channel,
      thread_id: s.thread_id,
      agent: s.agent,
      source: s.source,
      message_count: s.message_count,
      visible_count: s.visible_count,
      first_created: s.first_created,
      last_created: s.last_created,
      imported_at: metaMap[s.session]?.imported_at || null,
      note: metaMap[s.session]?.note || null,
    }));

    res.json({ sessions });
  } catch (err) {
    console.error('Error fetching sessions:', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

router.get('/sessions/:session', (req, res) => {
  try {
    const db = getDb();
    if (!rawMessagesTableExists(db)) {
      return res.status(404).json({ error: 'raw_messages table does not exist' });
    }

    const session = req.params.session;
    const stats = db.prepare(`
      SELECT
        COUNT(*) AS message_count,
        SUM(CASE WHEN COALESCE(hidden, 0) = 0 THEN 1 ELSE 0 END) AS visible_count,
        SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) AS user_count,
        SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) AS assistant_count,
        SUM(CASE WHEN COALESCE(hidden, 0) = 1 THEN 1 ELSE 0 END) AS hidden_count,
        MIN(created) AS first_created,
        MAX(created) AS last_created,
        MAX(channel) AS channel,
        MAX(agent) AS agent,
        MAX(source) AS source
      FROM raw_messages
      WHERE session = ?
    `).get(session);

    if (!stats || stats.message_count === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    let meta = null;
    if (sessionsTableExists(db)) {
      meta = db.prepare('SELECT * FROM raw_message_sessions WHERE session = ?').get(session);
    }

    res.json({
      session,
      title: meta?.title || session,
      ...stats,
      imported_at: meta?.imported_at || null,
      note: meta?.note || null,
    });
  } catch (err) {
    console.error('Error fetching session detail:', err);
    res.status(500).json({ error: 'Failed to fetch session detail' });
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

    const tz = req.query.tz;
    const offset = tz ? getUtcOffsetString(tz) : '+00:00';
    const dateExpr = `date(replace(substr(created, 1, 19), 'T', ' '), '${offset}')`;

    const where = ['created IS NOT NULL', "created != ''"];
    const params = {};
    if (req.query.channel) {
      where.push('channel = @channel');
      params.channel = String(req.query.channel);
    }
    if (req.query.agent) {
      where.push('agent = @agent');
      params.agent = String(req.query.agent);
    }
    if (req.query.threadId) {
      where.push('thread_id = @threadId');
      params.threadId = String(req.query.threadId);
    }
    if (req.query.excludeThreadId) {
      where.push('(thread_id IS NULL OR thread_id != @excludeThreadId)');
      params.excludeThreadId = String(req.query.excludeThreadId);
    }
    if (req.query.includeHidden === '1') {
      where.push('COALESCE(hidden, 0) = 1');
    } else {
      where.push('COALESCE(hidden, 0) = 0');
    }

    const rows = db
      .prepare(
        `
        SELECT ${dateExpr} AS date, COUNT(*) AS total
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

router.get('/summaries', (req, res) => {
  try {
    const db = getDb();
    if (!summariesTableExists(db)) {
      return res.json({ summaries: [] });
    }
    ensureReviewStatusColumn(db);

    const where = [];
    const params = {};
    if (req.query.channel) {
      where.push('channel = @channel');
      params.channel = String(req.query.channel);
    }
    if (req.query.threadId) {
      where.push('thread_id = @threadId');
      params.threadId = String(req.query.threadId);
    }
    if (req.query.kind) {
      where.push('summary_kind = @kind');
      params.kind = String(req.query.kind);
    }
    if (req.query.current === '1') {
      where.push('COALESCE(is_current, 0) = 1');
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const summaries = db.prepare(`
      SELECT
        id,
        summary_key,
        job_type,
        channel,
        thread_id,
        scope,
        summary_kind,
        start_message_id,
        end_message_id,
        start_created,
        end_created,
        message_count,
        source_summary_ids,
        original_summary,
        revised_summary,
        model,
        prompt_version,
        is_current,
        review_status,
        created_at,
        updated_at
      FROM message_summaries
      ${whereClause}
      ORDER BY
        CASE WHEN summary_kind = 'rolling' THEN 0 ELSE 1 END,
        COALESCE(is_current, 0) DESC,
        start_created DESC,
        id DESC
    `).all(params);

    res.json({ summaries });
  } catch (err) {
    console.error('Error fetching raw message summaries:', err);
    res.status(500).json({ error: 'Failed to fetch summaries' });
  }
});

router.get('/summaries/pending-count', (req, res) => {
  try {
    const db = getDb();
    if (!summariesTableExists(db)) {
      return res.json({ count: 0 });
    }
    ensureReviewStatusColumn(db);
    const row = db.prepare("SELECT COUNT(*) as count FROM message_summaries WHERE review_status = 'pending'").get();
    res.json({ count: row.count });
  } catch (err) {
    console.error('Error fetching pending count:', err);
    res.status(500).json({ error: 'Failed to fetch pending count' });
  }
});

router.patch('/summaries/:id/approve', requireMemoryWriteAccess, (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid summary id' });
    }
    const db = getDb();
    if (!summariesTableExists(db)) {
      return res.status(404).json({ error: 'message_summaries table does not exist' });
    }
    ensureReviewStatusColumn(db);
    db.prepare("UPDATE message_summaries SET review_status = 'approved', updated_at = ? WHERE id = ?")
      .run(nowIso(), id);
    const summary = db.prepare('SELECT * FROM message_summaries WHERE id = ?').get(id);
    res.json({ ok: true, summary });
  } catch (err) {
    console.error('Error approving summary:', err);
    res.status(500).json({ error: 'Failed to approve summary' });
  }
});

router.patch('/summaries/:id', requireMemoryWriteAccess, (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid summary id' });
    }

    const db = getDb();
    if (!summariesTableExists(db)) {
      return res.status(404).json({ error: 'message_summaries table does not exist' });
    }

    const existing = db.prepare('SELECT id FROM message_summaries WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Summary not found' });
    }

    const revisedSummary = typeof req.body?.revised_summary === 'string'
      ? req.body.revised_summary
      : null;

    db.prepare('UPDATE message_summaries SET revised_summary = ?, review_status = ?, updated_at = ? WHERE id = ?')
      .run(revisedSummary, 'revised', nowIso(), id);

    const summary = db.prepare('SELECT * FROM message_summaries WHERE id = ?').get(id);
    res.json({ ok: true, summary });
  } catch (err) {
    console.error('Error updating summary:', err);
    res.status(500).json({ error: 'Failed to update summary' });
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
