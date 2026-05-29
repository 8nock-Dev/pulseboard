const express = require('express');
const { authenticateSSE } = require('../middleware/auth');
const { addClient, removeClient } = require('../services/events');

const router = express.Router();

// ─── GET /api/events ──────────────────────────────────────
// SSE endpoint for real-time monitor status updates
// Uses token as query param since EventSource can't set headers
router.get('/', authenticateSSE, (req, res) => {
  const userId = req.user.userId;

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  // Initial connection confirmation
  res.write(`data: ${JSON.stringify({ type: 'connected', userId })}\n\n`);

  // Register this client
  addClient(userId, res);

  // Keepalive heartbeat every 25 seconds to prevent timeouts
  const heartbeat = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(userId, res);
    console.log(`[SSE] Client disconnected: ${userId}`);
  });
});

module.exports = router;
