const express = require('express');
const verifyToken = require('./verifyToken');

module.exports = function(pool, io) {
  const router = express.Router();

  // --- API Directory (Easy Navigation) ---
  router.get('/', (req, res) => {
    res.json({
      message: 'WalkScale API Directory',
      endpoints: {
        auth: {
          register: 'POST /api/auth/register',
          login: 'POST /api/auth/login'
        },
        cows: {
          create: 'POST /api/cows',
          getAll: 'GET /api/cows'
        },
        weight_records: {
          create: 'POST /api/weight-records (accepts cow_tag, weight_kg)',
          getAll: 'GET /api/weight-records?limit=50'
        },
        feeding_schedule: {
          create: 'POST /api/feeding-schedule (accepts cow_tag, feeding_time, feed_type, feed_amount_kg)',
          getAll: 'GET /api/feeding-schedule'
        }
      }
    });
  });

  // --- Cows CRUD ---
  
  router.post('/cows', async (req, res) => {
    const { cow_tag, cow_name, breed, gender, birth_date } = req.body;
    if (!cow_tag) return res.status(400).json({ error: 'Missing cow_tag' });

    try {
      const result = await pool.query(
        `INSERT INTO cows (cow_tag, cow_name, breed, gender, birth_date) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (cow_tag) DO UPDATE SET 
           cow_name = EXCLUDED.cow_name, 
           breed = EXCLUDED.breed, 
           gender = EXCLUDED.gender, 
           birth_date = EXCLUDED.birth_date 
         RETURNING *`,
        [cow_tag, cow_name, breed, gender, birth_date]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/cows', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM cows ORDER BY cow_tag ASC');
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // --- Helper: Calculate Age in Months ---
  function calculateAgeMonths(birthDate, recordDate = new Date()) {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const date = new Date(recordDate);
    return (date.getFullYear() - birth.getFullYear()) * 12 + (date.getMonth() - birth.getMonth());
  }

  // --- Helper: Calculate Health Status ---
  function calculateHealthStatus(weight, ageMonths, gender) {
    if (ageMonths === null) return 'Unknown'; // Can't calculate without age

    let under, over;

    if (ageMonths < 9) { // ~6 months category (0-8 months)
      under = 65; over = 110;
    } else if (ageMonths < 15) { // ~12 months category (9-14 months)
      under = 110; over = 190;
    } else if (ageMonths < 21) { // ~18 months category (15-20 months)
      under = 170; over = 280;
    } else if (ageMonths < 27) { // ~24 months category (21-26 months)
      under = 240; over = 380;
    } else {
      // Adult (over 27 months)
      const isMale = gender && (gender.toLowerCase() === 'male' || gender.toLowerCase() === 'bull');
      if (isMale) {
        under = 350; over = 650;
      } else {
        under = 280; over = 450;
      }
    }

    if (weight < under) return 'Underweight';
    if (weight > over) return 'Overweight';
    return 'Healthy';
  }

  // --- Weight Records ---

  router.post('/weight-records', async (req, res) => {
    const { cow_tag, weight_kg } = req.body;
    if (!cow_tag || weight_kg === undefined) return res.status(400).json({ error: 'Missing cow_tag or weight_kg' });

    try {
      // Ensure cow exists and get its info
      let cowResult = await pool.query('SELECT * FROM cows WHERE cow_tag = $1', [cow_tag]);
      if (cowResult.rows.length === 0) {
        cowResult = await pool.query('INSERT INTO cows (cow_tag) VALUES ($1) RETURNING *', [cow_tag]);
      }
      
      const cowInfo = cowResult.rows[0];

      const result = await pool.query(
        'INSERT INTO weight_records (cow_tag, weight_kg, recorded_date, recorded_time) VALUES ($1, $2, CURRENT_DATE, CURRENT_TIME) RETURNING *',
        [cow_tag, weight_kg]
      );
      
      const newWeight = result.rows[0];
      
      // Calculate age and health classification based on standard table
      const ageMonths = calculateAgeMonths(cowInfo.birth_date, new Date());
      const healthStatus = calculateHealthStatus(
        weight_kg, 
        ageMonths, 
        cowInfo.gender
      );

      const bc_payload = { ...newWeight, age_months: ageMonths, health_status: healthStatus };
      
      // Broadcast to frontend
      io.emit('new_weight_record', bc_payload);
      
      res.status(201).json({ message: 'Weight logged successfully', data: bc_payload });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/weight-records', async (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 50;
    try {
      const result = await pool.query(`
        SELECT w.*, c.cow_name, c.birth_date, c.gender
        FROM weight_records w
        LEFT JOIN cows c ON w.cow_tag = c.cow_tag
        ORDER BY w.recorded_date DESC, w.recorded_time DESC 
        LIMIT $1
      `, [limit]);
      
      // Map results to add dynamic age and health_status
      const recordsWithStatus = result.rows.map(row => {
         const recordDateTime = new Date(`${row.recorded_date.toISOString().split('T')[0]}T${row.recorded_time}`);
         row.age_months = calculateAgeMonths(row.birth_date, recordDateTime);
         row.health_status = calculateHealthStatus(row.weight_kg, row.age_months, row.gender);
         return row;
      });

      res.json(recordsWithStatus);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Feeding Schedule ---

  router.post('/feeding-schedule', async (req, res) => {
    const { cow_tag, feeding_time, feed_type, feed_amount_kg } = req.body;
    try {
      const result = await pool.query(
        'INSERT INTO feeding_schedule (cow_tag, feeding_time, feed_type, feed_amount_kg) VALUES ($1, $2, $3, $4) RETURNING *',
        [cow_tag, feeding_time, feed_type, feed_amount_kg]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/feeding-schedule', async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM feeding_schedule ORDER BY feeding_time ASC');
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
