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
 * The mapping is a dict of {id: {id, message, parent, children}}.
 * We traverse from root following children to build linear message list.
 */
function walkMapping(mapping) {
  // Find root: node with no parent or parent not in mapping
  let rootId = null;
  for (const [id, node] of Object.entries(mapping)) {
    if (!node.parent || !mapping[node.parent]) {
      rootId = id;
      break;
    }
  }
  if (!rootId) return [];

  const messages = [];
  const queue = [rootId];

  while (queue.length > 0) {
    const nodeId = queue.shift();
    const node = mapping[nodeId];
    if (!node) continue;

    if (node.message) {
      messages.push(node.message);
    }

    // Follow children (take last child for main branch if multiple)
    const children = node.children || [];
    if (children.length > 0) {
      // Push last child (main conversation branch)
      queue.push(children[children.length - 1]);
    }
  }

  return messages;
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
  const messages = walkMapping(mapping);
  const convTitle = titleOverride || conv.title || 'Untitled';
  const convId = conv.conversation_id || '';
  const session = sessionOverride || `chatgpt-${convId}`;
  const defaultModel = conv.default_model_slug || '';

  const records = [];
  let lineNum = 0;

  for (const msg of messages) {
    const role = msg.author?.role;
    if (!role || role === 'system' || role === 'tool') continue;

    const text = extractText(msg);
    if (!text) continue;

    // Skip hidden system context messages
    const meta = msg.metadata || {};
    if (meta.is_visually_hidden_from_conversation) continue;
    if (msg.content?.content_type === 'user_editable_context') continue;
    if (msg.content?.content_type === 'model_editable_context') continue;

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

      // Batch insert
      const insert = db.prepare(`
        INSERT INTO raw_messages (
          session, line_num, role, content, created, agent, channel,
          direction, content_type, kind, visibility, source, raw_json,
          favorite, hidden
        ) VALUES (
          @session, @line_num, @role, @content, @created, @agent, @channel,
          @direction, @content_type, @kind, @visibility, @source, @raw_json,
          @favorite, @hidden
        )
      `);

      for (const record of records) {
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
    });

    importTx();

    const userCount = records.filter(r => r.role === 'user').length;
    const assistantCount = records.filter(r => r.role === 'assistant').length;

    res.json({
      ok: true,
      session,
      title,
      imported: records.length,
      userCount,
      assistantCount,
      earliest: records[0].created,
      latest: records[records.length - 1].created,
    });
  } catch (err) {
    console.error('Error executing import:', err);
    res.status(500).json({ error: 'Failed to import: ' + err.message });
  }
});

export default router;
