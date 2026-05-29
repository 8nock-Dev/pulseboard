const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

// ─── GET /api/status/:userId ──────────────────────────────
// Public endpoint — no auth required
// Used by the public status page at /status/:userId
router.get('/:userId', async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT id, name FROM users WHERE id = $1',
      [req.params.userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Status page not found' });
    }

    const monitorsResult = await pool.query(
      `SELECT 
          id, name, url, current_status, last_checked_at, uptime_percentage
        FROM monitors
        WHERE user_id = $1 AND is_active = true
        ORDER BY created_at ASC`,
      [req.params.userId]
    );

    const incidentsResult = await pool.query(
      `SELECT 
          i.started_at, i.resolved_at, i.duration_minutes, i.is_resolved,
          m.name AS monitor_name
        FROM incidents i
        JOIN monitors m ON m.id = i.monitor_id
        WHERE m.user_id = $1
        ORDER BY i.started_at DESC
        LIMIT 15`,
      [req.params.userId]
    );

    const monitors = monitorsResult.rows;
    const allUp = monitors.every(m => m.current_status === 'up');
    const anyDown = monitors.some(m => m.current_status === 'down');

    res.json({
      owner: userResult.rows[0].name,
      overall_status: anyDown ? 'degraded' : allUp ? 'operational' : 'pending',
      monitors,
      incidents: incidentsResult.rows,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Status/page]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
