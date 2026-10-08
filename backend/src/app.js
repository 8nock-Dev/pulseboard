require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const { initDb, pool } = require('./config/db');
const { initScheduler, stopScheduler } = require('./services/scheduler');
const { initEvents, stopEvents } = require('./services/events');

const authRoutes     = require('./routes/auth');
const monitorRoutes  = require('./routes/monitors');
const incidentRoutes = require('./routes/incidents');
const statusRoutes   = require('./routes/status');
const sseRoutes      = require('./routes/sse');

const app = express();

// ─── Middleware ───────────────────────────────────────────
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));

// ─── Request logger (dev only) ────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ─── Routes ───────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/monitors',  monitorRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/status',    statusRoutes);
app.use('/api/events',    sseRoutes);

// ─── Health check ─────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 catch-all ────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ─── Global error handler ─────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Unhandled error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Startup ──────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
let server;

async function start() {
  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.includes('change_this')) {
      throw new Error('JWT_SECRET must be a non-default value of at least 32 characters');
    }
    await initDb();
    await initEvents();
    await initScheduler();
    server = app.listen(PORT, () => {
      console.log(`\n🚀 PulseBoard backend running on http://localhost:${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}\n`);
    });
  } catch (err) {
    console.error('Startup failed:', err.message);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`[Shutdown] ${signal} received`);
  stopScheduler();
  await stopEvents();
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
  process.exit(0);
}

process.once('SIGTERM', () => shutdown('SIGTERM').catch((error) => { console.error(error); process.exit(1); }));
process.once('SIGINT', () => shutdown('SIGINT').catch((error) => { console.error(error); process.exit(1); }));

start();

module.exports = app;
