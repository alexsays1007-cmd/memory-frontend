import { Router } from 'express';
import { getDb } from '../db/index.js';

const router = Router();

router.get('/dates', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT DISTINCT date FROM diary ORDER BY date DESC');
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

    const stmt = db.prepare('SELECT * FROM diary WHERE date = ? ORDER BY created ASC');
    const data = stmt.all(date);

    res.json({ date, data });
  } catch (err) {
    console.error('Error fetching diary entries:', err);
    res.status(500).json({ error: 'Failed to fetch diary entries' });
  }
});

export default router;
