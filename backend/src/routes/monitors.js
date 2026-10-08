const express = require('express');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { scheduleMonitor, unscheduleMonitor } = require('../services/scheduler');
const { assertSafeUrl } = require('../security/urlSafety');

const router = express.Router();
router.use(authenticate);

// ─── GET /api/monitors ────────────────────────────────────
// All monitors for authenticated user
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
          m.*,
          (
            SELECT COUNT(*) FROM incidents i 
            WHERE i.monitor_id = m.id AND i.is_resolved = false
          ) AS open_incidents
        FROM monitors m
        WHERE m.user_id = $1
        ORDER BY m.created_at ASC`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[Monitors/list]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/monitors/:id ────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM monitors WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Monitor not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Monitors/get]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/monitors/:id/checks ─────────────────────────
router.get('/:id/checks', async (req, res) => {
  try {
    const monitor = await pool.query(
      'SELECT id FROM monitors WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );
    if (monitor.rows.length === 0) return res.status(404).json({ error: 'Monitor not found' });

    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const result = await pool.query(
      'SELECT * FROM checks WHERE monitor_id = $1 ORDER BY checked_at DESC LIMIT $2',
      [req.params.id, limit]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[Monitors/checks]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/monitors/:id/daily-uptime ───────────────────
// Returns daily uptime % for the last 90 days (for the uptime bar)
router.get('/:id/daily-uptime', async (req, res) => {
  try {
    const monitor = await pool.query(
      'SELECT id FROM monitors WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );
    if (monitor.rows.length === 0) return res.status(404).json({ error: 'Monitor not found' });

    const result = await pool.query(
      `SELECT
          DATE(checked_at AT TIME ZONE 'UTC') AS day,
          COUNT(*) FILTER (WHERE status = 'up') AS up_count,
          COUNT(*) AS total_count,
          ROUND(COUNT(*) FILTER (WHERE status = 'up') * 100.0 / NULLIF(COUNT(*), 0), 2) AS uptime_pct,
          ROUND(AVG(response_time_ms) FILTER (WHERE status = 'up'), 0) AS avg_response_ms
        FROM checks
        WHERE monitor_id = $1
          AND checked_at >= NOW() - INTERVAL '90 days'
        GROUP BY day
        ORDER BY day ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[Monitors/daily-uptime]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/monitors/:id/incidents ──────────────────────
router.get('/:id/incidents', async (req, res) => {
  try {
    const monitor = await pool.query(
      'SELECT id FROM monitors WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.userId]
    );
    if (monitor.rows.length === 0) return res.status(404).json({ error: 'Monitor not found' });

    const result = await pool.query(
      `SELECT * FROM incidents WHERE monitor_id = $1 ORDER BY started_at DESC LIMIT 20`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[Monitors/incidents]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/monitors ───────────────────────────────────
router.post('/', async (req, res) => {
  const {
    name, url, type = 'http',
    interval_minutes = 5,
    timeout_seconds = 10,
    expected_status_code = 200,
    notify_email,
    notify_webhook,
    public_visible = false,
    public_name,
  } = req.body;

  if (!name || !url) {
    return res.status(400).json({ error: 'Name and URL are required' });
  }

  try {
    await assertSafeUrl(url);
    if (notify_webhook) await assertSafeUrl(notify_webhook);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const validIntervals = [1, 5, 10, 15, 30, 60];
  if (!validIntervals.includes(Number(interval_minutes))) {
    return res.status(400).json({ error: `interval_minutes must be one of: ${validIntervals.join(', ')}` });
  }

  try {
    const result = await pool.query(
      `INSERT INTO monitors 
          (user_id, name, url, type, interval_minutes, timeout_seconds, expected_status_code,
           notify_email, notify_webhook, public_visible, public_name, next_check_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING *`,
      [req.user.userId, name.trim(), url.trim(), type, interval_minutes, timeout_seconds,
        expected_status_code, notify_email || null, notify_webhook || null,
        Boolean(public_visible), public_name?.trim() || null]
    );

    const monitor = result.rows[0];

    // Schedule the monitor for periodic checks
    await scheduleMonitor(monitor);

    res.status(201).json(monitor);
  } catch (err) {
    console.error('[Monitors/create]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/monitors/:id ────────────────────────────────
router.put('/:id', async (req, res) => {
  const {
    name, url, type, interval_minutes, timeout_seconds,
    expected_status_code, is_active, notify_email, notify_webhook,
    public_visible, public_name,
  } = req.body;

  try {
    if (url) await assertSafeUrl(url);
    if (notify_webhook) await assertSafeUrl(notify_webhook);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  if (interval_minutes !== undefined && ![1, 5, 10, 15, 30, 60].includes(Number(interval_minutes))) {
    return res.status(400).json({ error: 'Invalid interval_minutes' });
  }
  if (timeout_seconds !== undefined && (Number(timeout_seconds) < 1 || Number(timeout_seconds) > 30)) {
    return res.status(400).json({ error: 'timeout_seconds must be between 1 and 30' });
  }

  try {
    const result = await pool.query(
      `UPDATE monitors SET
          name                 = COALESCE($1, name),
          url                  = COALESCE($2, url),
          type                 = COALESCE($3, type),
          interval_minutes     = COALESCE($4, interval_minutes),
          timeout_seconds      = COALESCE($5, timeout_seconds),
          expected_status_code = COALESCE($6, expected_status_code),
          is_active            = COALESCE($7, is_active),
          notify_email         = $8,
          notify_webhook       = $9,
          public_visible       = COALESCE($10, public_visible),
          public_name          = $11,
          updated_at           = NOW()
        WHERE id = $12 AND user_id = $13
        RETURNING *`,
      [name, url, type, interval_minutes, timeout_seconds, expected_status_code,
        is_active, notify_email || null, notify_webhook || null,
        public_visible === undefined ? null : Boolean(public_visible), public_name?.trim() || null,
        req.params.id, req.user.userId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Monitor not found' });

    const monitor = result.rows[0];
    await unscheduleMonitor(monitor.id);
    if (monitor.is_active) await scheduleMonitor(monitor);

    res.json(monitor);
  } catch (err) {
    console.error('[Monitors/update]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/monitors/:id ─────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM monitors WHERE id = $1 AND user_id = $2 RETURNING id, name',
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Monitor not found' });

    await unscheduleMonitor(req.params.id);
    console.log(`[Monitor deleted] ${result.rows[0].name}`);
    res.json({ message: 'Monitor deleted successfully' });
  } catch (err) {
    console.error('[Monitors/delete]', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
