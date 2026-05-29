require('dotenv').config();

const express = require('express');
const cors = require('cors');

const { initDb } = require('./config/db');
const { initScheduler } = require('./services/scheduler');

const authRoutes     = require('./routes/auth');
const monitorRoutes  = require('./routes/monitors');
const incidentRoutes = require('./routes/incidents');
const statusRoutes   = require('./routes/status');
const sseRoutes      = require('./routes/sse');

const app = express();

// ─── Middleware ───────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

async function start() {
  try {
    await initDb();
    await initScheduler();
    app.listen(PORT, () => {
      console.log(`\n🚀 PulseBoard backend running on http://localhost:${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}\n`);
    });
  } catch (err) {
    console.error('Startup failed:', err.message);
    process.exit(1);
  }
}

start();

module.exports = app;
