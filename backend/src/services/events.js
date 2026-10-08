const { pool } = require('../config/db');

const clients = new Map();
let listener;

function addClient(userId, res) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);
}

function removeClient(userId, res) {
  clients.get(userId)?.delete(res);
  if (clients.get(userId)?.size === 0) clients.delete(userId);
}

function broadcast(userId, payload) {
  const message = `data: ${JSON.stringify(payload)}\n\n`;
  clients.get(userId)?.forEach((response) => {
    try { response.write(message); } catch { removeClient(userId, response); }
  });
}

async function initEvents() {
  listener = await pool.connect();
  await listener.query('LISTEN pulseboard_events');
  listener.on('notification', (notification) => {
    try {
      const { userId, payload } = JSON.parse(notification.payload);
      broadcast(userId, payload);
    } catch (error) { console.error('[Events]', error.message); }
  });
  listener.on('error', (error) => console.error('[Events listener]', error.message));
}

async function emitToUser(userId, payload) {
  const message = JSON.stringify({ userId, payload });
  if (Buffer.byteLength(message) > 7900) throw new Error('Event payload is too large');
  await pool.query('SELECT pg_notify($1, $2)', ['pulseboard_events', message]);
}

async function stopEvents() {
  clients.forEach((responses) => responses.forEach((response) => response.end()));
  clients.clear();
  if (listener) {
    await listener.query('UNLISTEN pulseboard_events').catch(() => {});
    listener.release();
    listener = null;
  }
}

module.exports = { addClient, removeClient, emitToUser, initEvents, stopEvents };
