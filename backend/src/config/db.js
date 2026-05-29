const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

async function initDb() {
  const client = await pool.connect();
  try {
    // Run migrations
    const migrationPath = path.join(__dirname, '../../migrations/001_initial.sql');
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      await client.query(sql);
      console.log('[DB] Migrations applied successfully');
    }
    console.log('[DB] Connected to PostgreSQL');
  } catch (err) {
    console.error('[DB] Initialization failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, initDb };
