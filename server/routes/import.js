import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireMemoryWriteAccess } from '../middleware/writeAuth.js';

const router = Router();

function nowIso() {
  return new Date().toISOString();
}

function ensureSessionsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS raw_message_sessions (
      session      TEXT PRIMARY KEY,
      title        TEXT,
      source       TEXT,
      channel      TEXT,
      agent        TEXT,
      imported_at  TEXT,
      message_count INTEGER DEFAULT 0,
      first_created TEXT,
      last_created  TEXT,
      note         TEXT
    )
  `);
}

function ensureRawMessagesTable(db) {
  return Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'raw_messages'").get()
  );
}

/**
 * Walk ChatGPT mapping tree in conversation order.
 * Traces from current_node back to root to get the active branch,
 * then returns messages in chronological order (root → current).
 * This correctly handles forked conversations.
 */
function walkMapping(mapping, currentNode) {
  // Strategy: trace from current_node up to root via parent links
  let startId = currentNode;

  // If no current_node provided, find the deepest leaf by following last children
  if (!startId || !mapping[startId]) {
    let rootId = null;
    for (const [id, node] of Object.entries(mapping)) {
      if (!node.parent || !mapping[node.parent]) {
        rootId = id;
        break;
      }
    }
    if (!rootId) return [];

    // Walk down taking last child to find a leaf
    startId = rootId;
    while (true) {
      const node = mapping[startId];
      const children = node?.children || [];
      if (children.length === 0) break;
      startId = children[children.length - 1];
    }
  }

  // Trace from startId back to root
  const path = [];
  const visited = new Set();
  let nodeId = startId;

  while (nodeId && mapping[nodeId] && !visited.has(nodeId)) {
    visited.add(nodeId);
    const node = mapping[nodeId];
    if (node.message) {
      path.push(node.message);
    }
    nodeId = node.parent;
  }

  // Reverse: root first, current_node last
  path.reverse();
  return path;
}

/**
 * Extract text content from a ChatGPT message.
 */
function extractText(message) {
  const content = message?.content;
  if (!content) return '';
  const parts = content.parts || [];
  const textParts = parts.filter(p => typeof p === 'string');
  return textParts.join('\n').trim();
}

/**
 * Convert unix timestamp to UTC ISO string.
 */
function unixToIso(ts) {
  if (!ts) return null;
  return new Date(ts * 1000).toISOString();
}

/**
 * Parse a single ChatGPT conversation object into raw_messages records.
 */
function parseConversation(conv, sessionOverride, titleOverride) {
  const mapping = conv.mapping || {};
  const currentNode = conv.current_node || '';
  const messages = walkMapping(mapping, currentNode);
  const convTitle = titleOverride || conv.title || 'Untitled';
  const convId = conv.conversation_id || '';
  const session = sessionOverride || `chatgpt-${convId}`;
  const defaultModel = conv.default_model_slug || '';

  const records = [];
  let lineNum = 0;

  for (const msg of messages) {
    const role = msg.author?.role;
    if (!role || role === 'system' || role === 'tool') continue;

    // Skip hidden system context and non-chat content types
    const meta = msg.metadata || {};
    const contentType = msg.content?.content_type || '';
    if (meta.is_visually_hidden_from_conversation) continue;
    if (['user_editable_context', 'model_editable_context', 'code',
         'tether_browsing_display', 'tether_quote', 'execution_output',
         'system_error'].includes(contentType)) continue;
    // Skip ChatGPT internal channels (commentary = code execution, multimodal_text = tool output)
    const msgChannel = msg.channel || '';
    if (['commentary', 'multimodal_text'].includes(msgChannel)) continue;

    const text = extractText(msg);
    if (!text) continue;

    const created = unixToIso(msg.create_time);
    if (!created) continue;

    const modelSlug = meta.model_slug || defaultModel || 'unknown';

    lineNum++;
    records.push({
      session,
      line_num: lineNum,
      role: role === 'assistant' ? 'assistant' : 'user',
      content: text,
      created,
      agent: modelSlug,
      channel: 'chatgpt',
      message_id: msg.id || null,
      direction: role === 'user' ? 'inbound' : 'outbound',
      content_type: 'text',
      kind: 'chat',
      visibility: 'visible',
      source: 'chatgpt_import',
      raw_json: JSON.stringify(msg),
      favorite: 0,
      hidden: 0,
    });
  }

  return { session, title: convTitle, records, defaultModel };
}

/**
 * POST /api/import/preview
 * Body: { conversation: <single conversation object> }
 * Returns: preview of what would be imported (first 10 messages + stats)
 */
router.post('/preview', (req, res) => {
  try {
    const { conversation, session: sessionOverride, title: titleOverride } = req.body;
    if (!conversation || !conversation.mapping) {
      return res.status(400).json({ error: 'Invalid conversation data. Expected object with mapping field.' });
    }

    const { session, title, records, defaultModel } = parseConversation(
      conversation, sessionOverride, titleOverride
    );

    const userCount = records.filter(r => r.role === 'user').length;
    const assistantCount = records.filter(r => r.role === 'assistant').length;
    const models = [...new Set(records.filter(r => r.role === 'assistant').map(r => r.agent))];
    const earliest = records.length > 0 ? records[0].created : null;
    const latest = records.length > 0 ? records[records.length - 1].created : null;

    // Check if session already exists
    const db = getDb();
    let sessionExists = false;
    let existingCount = 0;
    if (ensureRawMessagesTable(db)) {
      const row = db.prepare('SELECT COUNT(*) AS cnt FROM raw_messages WHERE session = ?').get(session);
      if (row && row.cnt > 0) {
        sessionExists = true;
        existingCount = row.cnt;
      }
    }

    const preview = records.slice(0, 10).map(r => ({
      line_num: r.line_num,
      role: r.role,
      content: r.content.length > 200 ? r.content.slice(0, 200) + '...' : r.content,
      created: r.created,
      agent: r.agent,
    }));

    res.json({
      session,
      title,
      defaultModel,
      total: records.length,
      userCount,
      assistantCount,
      models,
      earliest,
      latest,
      sessionExists,
      existingCount,
      preview,
    });
  } catch (err) {
    console.error('Error previewing import:', err);
    res.status(500).json({ error: 'Failed to preview import: ' + err.message });
  }
});

/**
 * POST /api/import/execute
 * Body: { conversation, session?, title?, replace?: boolean }
 * Actually imports the conversation into the database.
 */
router.post('/execute', requireMemoryWriteAccess, (req, res) => {
  try {
    const {
      conversation,
      session: sessionOverride,
      title: titleOverride,
      replace = false,
    } = req.body;

    if (!conversation || !conversation.mapping) {
      return res.status(400).json({ error: 'Invalid conversation data.' });
    }

    const db = getDb();
    if (!ensureRawMessagesTable(db)) {
      return res.status(500).json({ error: 'raw_messages table does not exist.' });
    }

    ensureSessionsTable(db);

    const { session, title, records } = parseConversation(
      conversation, sessionOverride, titleOverride
    );

    if (records.length === 0) {
      return res.status(400).json({ error: 'No importable messages found in this conversation.' });
    }

    // Check existing session
    const existing = db.prepare('SELECT COUNT(*) AS cnt FROM raw_messages WHERE session = ?').get(session);
    if (existing.cnt > 0 && !replace) {
      return res.status(409).json({
        error: `Session "${session}" already exists with ${existing.cnt} records. Send replace: true to overwrite.`,
        sessionExists: true,
        existingCount: existing.cnt,
      });
    }

    // Backup-like safety: use transaction
    const importTx = db.transaction(() => {
      // Delete old data if replacing
      if (existing.cnt > 0 && replace) {
        db.prepare('DELETE FROM raw_messages WHERE session = ?').run(session);
        db.prepare('DELETE FROM raw_message_sessions WHERE session = ?').run(session);
      }

      // Collect existing message_ids from other chatgpt sessions for cross-session dedup
      const existingMsgIds = new Set();
      const rows = db.prepare(
        "SELECT message_id FROM raw_messages WHERE channel = 'chatgpt' AND message_id IS NOT NULL AND session != ?"
      ).all(session);
      for (const row of rows) {
        existingMsgIds.add(row.message_id);
      }

      // Batch insert with dedup
      const insert = db.prepare(`
        INSERT INTO raw_messages (
          session, line_num, role, content, created, agent, channel, message_id,
          direction, content_type, kind, visibility, source, raw_json,
          favorite, hidden
        ) VALUES (
          @session, @line_num, @role, @content, @created, @agent, @channel, @message_id,
          @direction, @content_type, @kind, @visibility, @source, @raw_json,
          @favorite, @hidden
        )
      `);

      let dupCount = 0;
      for (const record of records) {
        // If this message_id exists in another session, mark hidden
        if (record.message_id && existingMsgIds.has(record.message_id)) {
          record.hidden = 1;
          record.visibility = 'hidden';
          dupCount++;
        }
        insert.run(record);
      }

      // Upsert session metadata
      const earliest = records[0].created;
      const latest = records[records.length - 1].created;
      const models = [...new Set(records.filter(r => r.role === 'assistant').map(r => r.agent))];

      db.prepare(`
        INSERT OR REPLACE INTO raw_message_sessions
        (session, title, source, channel, agent, imported_at, message_count, first_created, last_created, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        session,
        title,
        'chatgpt_import',
        'chatgpt',
        models.join(', '),
        nowIso(),
        records.length,
        earliest,
        latest,
        `Imported from ChatGPT export. Models: ${models.join(', ')}`
      );

      return dupCount;
    });

    const dupCount = importTx();

    const userCount = records.filter(r => r.role === 'user').length;
    const assistantCount = records.filter(r => r.role === 'assistant').length;

    res.json({
      ok: true,
      session,
      title,
      imported: records.length,
      userCount,
      assistantCount,
      duplicatesHidden: dupCount,
      earliest: records[0].created,
      latest: records[records.length - 1].created,
    });
  } catch (err) {
    console.error('Error executing import:', err);
    res.status(500).json({ error: 'Failed to import: ' + err.message });
  }
});

export default router;
