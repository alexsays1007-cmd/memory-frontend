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
}

export function getDbInfo() {
  const instance = getDb();
  return {
    path: dbPath,
    readonly: false,
    memoryCount: instance.prepare('SELECT COUNT(*) AS total FROM memories').get().total,
    diaryCount: instance.prepare('SELECT COUNT(*) AS total FROM diary').get().total,
    consciousnessCount: instance.prepare('SELECT COUNT(*) AS total FROM consciousness_log').get().total,
  };
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
