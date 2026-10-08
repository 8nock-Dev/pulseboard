const { pool } = require('../config/db');
const { checkMonitor } = require('./checker');

const POLL_MS = 15000;
let pollTimer;
let polling = false;
let lastCleanupAt = 0;

async function cleanupHistory() {
  if (Date.now() - lastCleanupAt < 24 * 60 * 60 * 1000) return;
  await pool.query("DELETE FROM checks WHERE checked_at < NOW() - INTERVAL '90 days'");
  await pool.query("DELETE FROM incidents WHERE is_resolved = true AND resolved_at < NOW() - INTERVAL '365 days'");
  lastCleanupAt = Date.now();
}

async function claimDueMonitors(limit = 20) {
  const { rows } = await pool.query(
    `WITH due AS (
       SELECT id
       FROM monitors
       WHERE is_active = true AND COALESCE(next_check_at, NOW()) <= NOW()
       ORDER BY next_check_at NULLS FIRST
       FOR UPDATE SKIP LOCKED
       LIMIT $1
     )
     UPDATE monitors m
     SET next_check_at = NOW() + make_interval(mins => m.interval_minutes)
     FROM due
     WHERE m.id = due.id
     RETURNING m.*`,
    [limit]
  );
  return rows;
}

async function poll() {
  if (polling) return;
  polling = true;
  try {
    const monitors = await claimDueMonitors();
    const results = await Promise.allSettled(monitors.map((monitor) => checkMonitor(monitor)));
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`[Scheduler] Check failed for ${monitors[index].id}:`, result.reason?.message || result.reason);
      }
    });
    await cleanupHistory();
  } catch (error) {
    console.error('[Scheduler] Poll failed:', error.message);
  } finally {
    polling = false;
  }
}

async function scheduleMonitor(monitor) {
  await pool.query('UPDATE monitors SET next_check_at = NOW() WHERE id = $1', [monitor.id]);
}

async function unscheduleMonitor(monitorId) {
  await pool.query('UPDATE monitors SET next_check_at = NULL WHERE id = $1', [monitorId]);
}

async function initScheduler() {
  await poll();
  pollTimer = setInterval(poll, POLL_MS);
  pollTimer.unref?.();
  console.log(`[Scheduler] Durable database poller started (${POLL_MS / 1000}s interval)`);
}

function stopScheduler() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

module.exports = { claimDueMonitors, cleanupHistory, poll, scheduleMonitor, unscheduleMonitor, initScheduler, stopScheduler };
