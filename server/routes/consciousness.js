import { Router } from 'express';
import { getDb } from '../db/index.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { action_type, date_from, date_to, sort } = req.query;

    let where = [];
    let params = {};

    if (action_type) {
      where.push('action_type = @action_type');
      params.action_type = action_type;
    }

    if (date_from) {
      where.push('created_at >= @date_from');
      params.date_from = date_from;
    }

    if (date_to) {
      where.push('created_at <= @date_to');
      params.date_to = date_to + ' 23:59:59';
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const orderClause = sort === 'asc' ? 'ORDER BY created_at ASC' : 'ORDER BY created_at DESC';

    const countStmt = db.prepare(`SELECT COUNT(*) as total FROM consciousness_log ${whereClause}`);
    const { total } = countStmt.get(params);

    const stmt = db.prepare(`SELECT * FROM consciousness_log ${whereClause} ${orderClause}`);
    const data = stmt.all(params);

    res.json({ data, total });
  } catch (err) {
    console.error('Error fetching consciousness log:', err);
    res.status(500).json({ error: 'Failed to fetch consciousness log' });
  }
});

router.get('/action-types', (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('SELECT DISTINCT action_type FROM consciousness_log WHERE action_type IS NOT NULL');
    const rows = stmt.all();
    res.json({ action_types: rows.map(r => r.action_type).sort() });
  } catch (err) {
    console.error('Error fetching action types:', err);
    res.status(500).json({ error: 'Failed to fetch action types' });
  }
});

export default router;
