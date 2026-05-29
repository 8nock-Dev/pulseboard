const axios = require('axios');
const { pool } = require('../config/db');
const { sendAlert } = require('./alerting');
const { emitToUser } = require('./events');

/**
 * Performs a single check against a monitor's URL,
 * records the result, manages incidents, and emits SSE events.
 *
 * @param {Object} monitor - Monitor row from the database
 * @returns {Object} Check result
 */
async function checkMonitor(monitor) {
  const startTime = Date.now();
  let status = 'up';
  let responseTimeMs = null;
  let statusCode = null;
  let errorMessage = null;

  // ─── Perform the HTTP check ───────────────────────────
  try {
    const response = await axios({
      method: 'GET',
      url: monitor.url,
      timeout: monitor.timeout_seconds * 1000,
      validateStatus: () => true, // Never throw on HTTP status
      headers: {
        'User-Agent': 'PulseBoard-Monitor/1.0',
      },
      maxRedirects: 5,
    });

    responseTimeMs = Date.now() - startTime;
    statusCode = response.status;

    if (response.status !== monitor.expected_status_code) {
      status = 'down';
      errorMessage = `Expected HTTP ${monitor.expected_status_code}, received ${response.status}`;
    }
  } catch (err) {
    responseTimeMs = Date.now() - startTime;

    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || err.message.includes('timeout')) {
      status = 'timeout';
      errorMessage = `Request timed out after ${monitor.timeout_seconds}s`;
    } else if (err.code === 'ENOTFOUND') {
      status = 'down';
      errorMessage = `DNS resolution failed: ${err.hostname || monitor.url}`;
    } else if (err.code === 'ECONNREFUSED') {
      status = 'down';
      errorMessage = 'Connection refused';
    } else {
      status = 'down';
      errorMessage = err.message;
    }
  }

  // Normalize timeout → down for status tracking
  const normalizedStatus = status === 'timeout' ? 'down' : status;

  // ─── Record check result ──────────────────────────────
  await pool.query(
    `INSERT INTO checks (monitor_id, status, response_time_ms, status_code, error_message)
     VALUES ($1, $2, $3, $4, $5)`,
    [monitor.id, status, responseTimeMs, statusCode, errorMessage]
  );

  // ─── Recalculate uptime (last 30 days) ───────────────
  const uptimeResult = await pool.query(
    `SELECT
        COUNT(*) FILTER (WHERE status = 'up') AS up_count,
        COUNT(*) AS total_count
      FROM checks
      WHERE monitor_id = $1
        AND checked_at > NOW() - INTERVAL '30 days'`,
    [monitor.id]
  );

  const { up_count, total_count } = uptimeResult.rows[0];
  const uptimePercentage = total_count > 0
    ? ((parseInt(up_count) / parseInt(total_count)) * 100).toFixed(2)
    : '100.00';

  const previousStatus = monitor.current_status;

  // ─── Update monitor state ─────────────────────────────
  await pool.query(
    `UPDATE monitors SET
        current_status    = $1,
        last_checked_at   = NOW(),
        uptime_percentage = $2
      WHERE id = $3`,
    [normalizedStatus, uptimePercentage, monitor.id]
  );

  // ─── Incident management ──────────────────────────────
  if (previousStatus !== 'down' && normalizedStatus === 'down') {
    // Service just went DOWN — open a new incident
    await pool.query(
      'INSERT INTO incidents (monitor_id, root_cause) VALUES ($1, $2)',
      [monitor.id, errorMessage]
    );
    await sendAlert(monitor, 'down', errorMessage).catch(err =>
      console.error(`[Alert failed] ${err.message}`)
    );
    console.log(`[DOWN] ${monitor.name} | ${errorMessage}`);
  } else if (previousStatus === 'down' && normalizedStatus === 'up') {
    // Service just RECOVERED — resolve open incidents
    await pool.query(
      `UPDATE incidents SET
          is_resolved      = true,
          resolved_at      = NOW(),
          duration_minutes = EXTRACT(EPOCH FROM (NOW() - started_at)) / 60
        WHERE monitor_id = $1 AND is_resolved = false`,
      [monitor.id]
    );
    await sendAlert(monitor, 'up', null).catch(err =>
      console.error(`[Alert failed] ${err.message}`)
    );
    console.log(`[UP] ${monitor.name} recovered | Response: ${responseTimeMs}ms`);
  }

  // ─── Emit real-time update via SSE ────────────────────
  emitToUser(monitor.user_id, {
    type: 'monitor_update',
    monitorId: monitor.id,
    status: normalizedStatus,
    responseTimeMs,
    statusCode,
    uptimePercentage: parseFloat(uptimePercentage),
    lastCheckedAt: new Date().toISOString(),
  });

  return { status, responseTimeMs, statusCode, errorMessage };
}

module.exports = { checkMonitor };
