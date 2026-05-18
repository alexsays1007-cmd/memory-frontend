import { Router } from 'express';
import { getDb } from '../db/index.js';
import { requireMemoryWriteAccess } from '../middleware/writeAuth.js';

const router = Router();

function nowIso() {
  return new Date().toISOString();
}

// Sources that are sync'd from external and should not be edited/deleted in frontend
const PROTECTED_SOURCES = ['cyberboss_diary_md'];

router.get('/dates', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare(
      'SELECT DISTINCT date FROM diary WHERE COALESCE(deleted, 0) = 0 ORDER BY date DESC'
    );
    const rows = stmt.all();
    res.json({ dates: rows.map(r => r.date) });
  } catch (err) {
    console.error('Error fetching diary dates:', err);
    res.status(500).json({ error: 'Failed to fetch diary dates' });
  }
});

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date parameter is required' });
    }

    const stmt = db.prepare(
      'SELECT * FROM diary WHERE date = ? AND COALESCE(deleted, 0) = 0 ORDER BY created ASC'
    );
    const data = stmt.all(date);

    res.json({ date, data });
  } catch (err) {
    console.error('Error fetching diary entries:', err);
    res.status(500).json({ error: 'Failed to fetch diary entries' });
  }
});

// Edit diary entry content
router.patch('/:id', requireMemoryWriteAccess, (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid diary entry id' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT * FROM diary WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Diary entry not found' });
    }

    if (PROTECTED_SOURCES.includes(existing.source)) {
      return res.status(403).json({ error: 'Cannot edit entries from synced sources' });
    }

    const { content } = req.body || {};
    if (typeof content !== 'string' || content.trim() === '') {
      return res.status(400).json({ error: 'Content is required' });
    }

    db.prepare(
      'UPDATE diary SET content = ?, updated = ? WHERE id = ?'
    ).run(content, nowIso(), id);

    const entry = db.prepare('SELECT * FROM diary WHERE id = ?').get(id);
    res.json({ ok: true, entry });
  } catch (err) {
    console.error('Error updating diary entry:', err);
    res.status(500).json({ error: 'Failed to update diary entry' });
  }
});

// Soft delete diary entry
router.post('/:id/hide', requireMemoryWriteAccess, (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid diary entry id' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT * FROM diary WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Diary entry not found' });
    }

    if (PROTECTED_SOURCES.includes(existing.source)) {
      return res.status(403).json({ error: 'Cannot delete entries from synced sources' });
    }

    db.prepare(
      'UPDATE diary SET deleted = 1, deleted_at = ?, updated = ? WHERE id = ?'
    ).run(nowIso(), nowIso(), id);

    res.json({ ok: true, id, deleted: 1 });
  } catch (err) {
    console.error('Error hiding diary entry:', err);
    res.status(500).json({ error: 'Failed to hide diary entry' });
  }
});

// Restore soft-deleted diary entry
router.post('/:id/restore', requireMemoryWriteAccess, (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid diary entry id' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT * FROM diary WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Diary entry not found' });
    }

    db.prepare(
      'UPDATE diary SET deleted = 0, deleted_at = NULL, updated = ? WHERE id = ?'
    ).run(nowIso(), id);

    const entry = db.prepare('SELECT * FROM diary WHERE id = ?').get(id);
    res.json({ ok: true, entry });
  } catch (err) {
    console.error('Error restoring diary entry:', err);
    res.status(500).json({ error: 'Failed to restore diary entry' });
  }
});

export default router;
