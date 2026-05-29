const express = require('express');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ─── GET /api/incidents ───────────────────────────────────
// All incidents across all monitors for the authenticated user
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
          i.*,
          m.name AS monitor_name,
          m.url  AS monitor_url
        FROM incidents i
        JOIN monitors m ON m.id = i.monitor_id
        WHERE m.user_id = $1
        ORDER BY i.started_at DESC
        LIMIT 50`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[Incidents/list]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
