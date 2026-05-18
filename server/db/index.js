import Database from 'better-sqlite3';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveDbPath(inputPath) {
  if (!inputPath) {
    return path.resolve(__dirname, '../../memories.db');
  }

  if (inputPath === '~') {
    return os.homedir();
  }

  if (inputPath.startsWith('~/') || inputPath.startsWith('~\\')) {
    return path.join(os.homedir(), inputPath.slice(2));
  }

  return path.resolve(inputPath);
}

const dbPath = resolveDbPath(process.env.DB_PATH);

let db;

function tableExists(instance, table) {
  return Boolean(
    instance.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)
  );
}

export function getDb() {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    ensureMigrations(db);
  }
  return db;
}

function columnExists(instance, table, column) {
  return instance.prepare(`PRAGMA table_info(${table})`).all().some(row => row.name === column);
}

function addColumnIfMissing(instance, table, column, definition) {
  if (!columnExists(instance, table, column)) {
    instance.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

function ensureMigrations(instance) {
  addColumnIfMissing(instance, 'memories', 'deleted', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(instance, 'memories', 'deleted_at', 'TEXT');
  addColumnIfMissing(instance, 'memories', 'deleted_by', 'TEXT');
  addColumnIfMissing(instance, 'memories', 'updated', 'TEXT');
  instance.prepare('CREATE INDEX IF NOT EXISTS idx_memories_deleted ON memories(deleted)').run();

  // Diary soft-delete columns
  addColumnIfMissing(instance, 'diary', 'deleted', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(instance, 'diary', 'deleted_at', 'TEXT');
  instance.prepare('CREATE INDEX IF NOT EXISTS idx_diary_deleted ON diary(deleted)').run();

  if (tableExists(instance, 'raw_messages')) {
    addColumnIfMissing(instance, 'raw_messages', 'favorite', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfMissing(instance, 'raw_messages', 'hidden', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfMissing(instance, 'raw_messages', 'updated', 'TEXT');
    instance.prepare('CREATE INDEX IF NOT EXISTS idx_raw_messages_created ON raw_messages(created)').run();
    instance.prepare('CREATE INDEX IF NOT EXISTS idx_raw_messages_channel ON raw_messages(channel)').run();
    instance.prepare('CREATE INDEX IF NOT EXISTS idx_raw_messages_role ON raw_messages(role)').run();
    instance.prepare('CREATE INDEX IF NOT EXISTS idx_raw_messages_session ON raw_messages(session)').run();
    instance.prepare('CREATE INDEX IF NOT EXISTS idx_raw_messages_favorite ON raw_messages(favorite)').run();
    instance.prepare('CREATE INDEX IF NOT EXISTS idx_raw_messages_hidden ON raw_messages(hidden)').run();
  }
}

export function getDbInfo() {
  const instance = getDb();
  const rawMessagesCount = tableExists(instance, 'raw_messages')
    ? instance.prepare('SELECT COUNT(*) AS total FROM raw_messages').get().total
    : 0;
  return {
    path: dbPath,
    readonly: false,
    memoryCount: instance.prepare('SELECT COUNT(*) AS total FROM memories').get().total,
    diaryCount: instance.prepare('SELECT COUNT(*) AS total FROM diary').get().total,
    consciousnessCount: instance.prepare('SELECT COUNT(*) AS total FROM consciousness_log').get().total,
    rawMessagesCount,
  };
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
