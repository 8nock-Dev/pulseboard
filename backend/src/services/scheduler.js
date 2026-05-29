const cron = require('node-cron');
const { pool } = require('../config/db');
const { checkMonitor } = require('./checker');

// Map of monitorId -> cron.ScheduledTask
const activeTasks = new Map();

/**
 * Converts an interval in minutes to a cron expression.
 */
function intervalToCron(minutes) {
  const m = Number(minutes);
  if (m === 1)  return '* * * * *';
  if (m === 5)  return '*/5 * * * *';
  if (m === 10) return '*/10 * * * *';
  if (m === 15) return '*/15 * * * *';
  if (m === 30) return '*/30 * * * *';
  if (m === 60) return '0 * * * *';
  return `*/${m} * * * *`;
}

/**
 * Schedules a monitor for periodic checks.
 * If it was already scheduled, the old task is replaced.
 */
function scheduleMonitor(monitor) {
  // Clear existing task if any
  if (activeTasks.has(monitor.id)) {
    activeTasks.get(monitor.id).stop();
    activeTasks.delete(monitor.id);
  }

  const cronExpr = intervalToCron(monitor.interval_minutes);

  const task = cron.schedule(cronExpr, async () => {
    try {
      // Fetch the latest monitor state from DB (in case it was updated or deleted)
      const result = await pool.query(
        'SELECT * FROM monitors WHERE id = $1 AND is_active = true',
        [monitor.id]
      );

      if (result.rows.length === 0) {
        // Monitor was deactivated or deleted — stop the task
        unscheduleMonitor(monitor.id);
        return;
      }

      await checkMonitor(result.rows[0]);
    } catch (err) {
      console.error(`[Scheduler] Check failed for monitor ${monitor.id}:`, err.message);
    }
  });

  activeTasks.set(monitor.id, task);
  console.log(`[Scheduler] Scheduled: "${monitor.name}" every ${monitor.interval_minutes}m (${cronExpr})`);
}

/**
 * Stops and removes a monitor's scheduled task.
 */
function unscheduleMonitor(monitorId) {
  if (activeTasks.has(monitorId)) {
    activeTasks.get(monitorId).stop();
    activeTasks.delete(monitorId);
    console.log(`[Scheduler] Unscheduled monitor: ${monitorId}`);
  }
}

/**
 * Called at startup — loads all active monitors and schedules them.
 */
async function initScheduler() {
  try {
    const result = await pool.query(
      'SELECT * FROM monitors WHERE is_active = true'
    );

    for (const monitor of result.rows) {
      scheduleMonitor(monitor);
    }

    console.log(`[Scheduler] Initialized with ${result.rows.length} active monitors`);
  } catch (err) {
    console.error('[Scheduler] Initialization failed:', err.message);
    throw err;
  }
}

module.exports = { scheduleMonitor, unscheduleMonitor, initScheduler };
