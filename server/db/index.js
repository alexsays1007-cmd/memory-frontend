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
    db = new Database(dbPath, { readonly: true });
    db.pragma('journal_mode = WAL');
  }
  return db;
}

export function getDbInfo() {
  const instance = getDb();
  return {
    path: dbPath,
    readonly: true,
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
