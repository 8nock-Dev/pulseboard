require('dotenv').config();
const { initDb, pool } = require('./db');

initDb()
  .then(() => pool.end())
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
