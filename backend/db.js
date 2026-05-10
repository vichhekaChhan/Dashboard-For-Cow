const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://walkuser:walkpassword@localhost:5432/walkscale',
});

// Initialize database schema
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'viewer',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cows (
        cow_tag VARCHAR(50) PRIMARY KEY,
        cow_name VARCHAR(100),
        breed VARCHAR(100),
        gender VARCHAR(20),
        birth_date DATE
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS weight_records (
        record_id SERIAL PRIMARY KEY,
        cow_tag VARCHAR(50) REFERENCES cows(cow_tag) ON DELETE CASCADE,
        weight_kg NUMERIC(6,2),
        recorded_date DATE DEFAULT CURRENT_DATE,
        recorded_time TIME DEFAULT CURRENT_TIME
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS feeding_schedule (
        feeding_id SERIAL PRIMARY KEY,
        cow_tag VARCHAR(50) REFERENCES cows(cow_tag) ON DELETE CASCADE,
        feeding_time TIME,
        feed_type VARCHAR(100),
        feed_amount_kg NUMERIC(5,2)
      );
    `);
    
    console.log('Database initialized: users, cows, weight_records, and feeding_schedule tables are ready.');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};

initDB();

module.exports = pool;

module.exports = pool;