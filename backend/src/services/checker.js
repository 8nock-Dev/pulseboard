const { pool } = require('../config/db');
const { sendAlert } = require('./alerting');
const { emitToUser } = require('./events');
const { safeRequest } = require('../security/safeHttp');

async function performRequest(monitor) {
  const startedAt = Date.now();
  try {
    const response = await safeRequest({
      method: 'GET',
      url: monitor.url,
      timeout: Math.min(Number(monitor.timeout_seconds) || 10, 30) * 1000,
      headers: { 'User-Agent': 'PulseBoard-Monitor/1.0' },
    });
    const isUp = response.status === monitor.expected_status_code;
    return {
      status: isUp ? 'up' : 'down',
      responseTimeMs: Date.now() - startedAt,
      statusCode: response.status,
      errorMessage: isUp ? null : `Expected HTTP ${monitor.expected_status_code}, received ${response.status}`,
    };
  } catch (error) {
    const timedOut = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT' || error.message.includes('timeout');
    return {
      status: timedOut ? 'timeout' : 'down',
      responseTimeMs: Date.now() - startedAt,
      statusCode: null,
      errorMessage: timedOut ? `Request timed out after ${monitor.timeout_seconds}s` : error.message,
    };
  }
}

async function recordResult(monitor, result) {
  const client = await pool.connect();
  const normalizedStatus = result.status === 'timeout' ? 'down' : result.status;
  let transition = null;
  let uptimePercentage = 100;

  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO checks (monitor_id, status, response_time_ms, status_code, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
      [monitor.id, result.status, result.responseTimeMs, result.statusCode, result.errorMessage]
    );

    const state = await client.query('SELECT current_status FROM monitors WHERE id = $1 FOR UPDATE', [monitor.id]);
    if (!state.rows.length) {
      await client.query('ROLLBACK');
      return { transition: null, uptimePercentage };
    }
    const previousStatus = state.rows[0].current_status;
    const uptime = await client.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'up') AS up_count, COUNT(*) AS total_count
       FROM checks WHERE monitor_id = $1 AND checked_at > NOW() - INTERVAL '30 days'`,
      [monitor.id]
    );
    const upCount = Number(uptime.rows[0].up_count);
    const totalCount = Number(uptime.rows[0].total_count);
    uptimePercentage = totalCount ? Number(((upCount / totalCount) * 100).toFixed(2)) : 100;

    await client.query(
      `UPDATE monitors SET current_status = $1, last_checked_at = NOW(), uptime_percentage = $2 WHERE id = $3`,
      [normalizedStatus, uptimePercentage, monitor.id]
    );

    if (previousStatus !== 'down' && normalizedStatus === 'down') {
      await client.query(
        `INSERT INTO incidents (monitor_id, root_cause) VALUES ($1, $2)
         ON CONFLICT (monitor_id) WHERE is_resolved = false DO NOTHING`,
        [monitor.id, result.errorMessage]
      );
      transition = 'down';
    } else if (previousStatus === 'down' && normalizedStatus === 'up') {
      await client.query(
        `UPDATE incidents SET is_resolved = true, resolved_at = NOW(),
          duration_minutes = EXTRACT(EPOCH FROM (NOW() - started_at)) / 60
         WHERE monitor_id = $1 AND is_resolved = false`,
        [monitor.id]
      );
      transition = 'up';
    }
    await client.query('COMMIT');
    return { transition, uptimePercentage };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function checkMonitor(monitor) {
  const result = await performRequest(monitor);
  const { transition, uptimePercentage } = await recordResult(monitor, result);

  if (transition) {
    await sendAlert(monitor, transition, result.errorMessage).catch((error) =>
      console.error(`[Alert failed] ${error.message}`)
    );
  }

  await emitToUser(monitor.user_id, {
    type: 'monitor_update', monitorId: monitor.id,
    status: result.status === 'timeout' ? 'down' : result.status,
    responseTimeMs: result.responseTimeMs, statusCode: result.statusCode,
    uptimePercentage, lastCheckedAt: new Date().toISOString(),
  });
  return result;
}

module.exports = { checkMonitor, performRequest, recordResult };
