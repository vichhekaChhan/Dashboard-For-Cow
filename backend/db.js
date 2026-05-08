const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://walkuser:walkpassword@localhost:5432/walkscale',
});

// Initialize database schema
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS weight_readings (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(100) NOT NULL,
        weight_kg NUMERIC(10, 2) NOT NULL,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('Database initialized: weight_readings table is ready.');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};

initDB();

module.exports = pool;