const axios = require('axios');
const { sendEmail } = require('../config/mailer');

const APP_URL = process.env.APP_URL || 'http://localhost:5173';

function buildDownEmailHtml(monitor, errorMessage) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .card { background: white; border-radius: 8px; max-width: 520px; margin: 0 auto; overflow: hidden; }
    .header { background: #DC2626; padding: 24px; }
    .header h1 { color: white; margin: 0; font-size: 20px; font-weight: 600; }
    .body { padding: 24px; }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #9CA3AF; font-weight: 600; }
    .value { font-size: 15px; color: #111827; margin: 4px 0 16px; }
    .badge { display: inline-block; background: #FEE2E2; color: #DC2626; border-radius: 4px; padding: 4px 10px; font-size: 13px; font-weight: 600; }
    .footer { padding: 16px 24px; background: #F9FAFB; border-top: 1px solid #E5E7EB; }
    .btn { display: inline-block; background: #111827; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 500; }
    .time { color: #6B7280; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>🔴 Service is Down</h1>
    </div>
    <div class="body">
      <p class="label">Monitor</p>
      <p class="value"><strong>${monitor.name}</strong></p>
      <p class="label">URL</p>
      <p class="value"><a href="${monitor.url}">${monitor.url}</a></p>
      <p class="label">Status</p>
      <p class="value"><span class="badge">DOWN</span></p>
      <p class="label">Error</p>
      <p class="value">${errorMessage || 'Service is unreachable'}</p>
      <p class="time">Detected at ${new Date().toUTCString()}</p>
    </div>
    <div class="footer">
      <a href="${APP_URL}" class="btn">View on PulseBoard →</a>
    </div>
  </div>
</body>
</html>`;
}

function buildUpEmailHtml(monitor) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .card { background: white; border-radius: 8px; max-width: 520px; margin: 0 auto; overflow: hidden; }
    .header { background: #16A34A; padding: 24px; }
    .header h1 { color: white; margin: 0; font-size: 20px; font-weight: 600; }
    .body { padding: 24px; }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #9CA3AF; font-weight: 600; }
    .value { font-size: 15px; color: #111827; margin: 4px 0 16px; }
    .badge { display: inline-block; background: #DCFCE7; color: #16A34A; border-radius: 4px; padding: 4px 10px; font-size: 13px; font-weight: 600; }
    .footer { padding: 16px 24px; background: #F9FAFB; border-top: 1px solid #E5E7EB; }
    .btn { display: inline-block; background: #111827; color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 500; }
    .time { color: #6B7280; font-size: 13px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>✅ Service Recovered</h1>
    </div>
    <div class="body">
      <p class="label">Monitor</p>
      <p class="value"><strong>${monitor.name}</strong></p>
      <p class="label">URL</p>
      <p class="value"><a href="${monitor.url}">${monitor.url}</a></p>
      <p class="label">Status</p>
      <p class="value"><span class="badge">OPERATIONAL</span></p>
      <p class="time">Recovered at ${new Date().toUTCString()}</p>
    </div>
    <div class="footer">
      <a href="${APP_URL}" class="btn">View on PulseBoard →</a>
    </div>
  </div>
</body>
</html>`;
}

async function sendAlert(monitor, status, errorMessage) {
  const isDown = status === 'down';
  const subject = isDown
    ? `🔴 [PulseBoard] ${monitor.name} is DOWN`
    : `✅ [PulseBoard] ${monitor.name} has recovered`;

  const html = isDown ? buildDownEmailHtml(monitor, errorMessage) : buildUpEmailHtml(monitor);

  // Email alert
  if (monitor.notify_email) {
    await sendEmail({ to: monitor.notify_email, subject, html });
  }

  // Webhook alert (Slack, Discord, custom endpoint, etc.)
  if (monitor.notify_webhook) {
    try {
      const payload = {
        monitor_id: monitor.id,
        monitor_name: monitor.name,
        url: monitor.url,
        status,
        error: errorMessage || null,
        timestamp: new Date().toISOString(),
        dashboard_url: APP_URL,
      };

      // Slack-compatible payload
      const slackPayload = {
        text: isDown
          ? `🔴 *${monitor.name}* is DOWN\n${errorMessage || 'Service unreachable'}\n<${monitor.url}>`
          : `✅ *${monitor.name}* has recovered\n<${monitor.url}>`,
        ...payload,
      };

      await axios.post(monitor.notify_webhook, slackPayload, { timeout: 10000 });
    } catch (err) {
      console.error(`[Webhook alert failed] ${err.message}`);
    }
  }
}

module.exports = { sendAlert };
