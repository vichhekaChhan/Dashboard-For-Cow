const express = require('express');

module.exports = function(pool, io) {
  const router = express.Router();

  // POST Endpoint for ingestion
  router.post('/weight-log', async (req, res) => {
    const { device_id, weight_kg, timestamp } = req.body;

    if (!device_id || weight_kg === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const ts = timestamp || new Date().toISOString();

    const query = `
      INSERT INTO weight_readings (device_id, weight_kg, timestamp) 
      VALUES ($1, $2, $3) 
      RETURNING id, device_id, weight_kg, timestamp
    `;
    
    try {
      const result = await pool.query(query, [device_id, weight_kg, ts]);
      const newWeight = result.rows[0];
      
      // Broadcast to frontend
      io.emit('new_weight', newWeight);
      
      res.status(201).json({ message: 'Data logged successfully', data: newWeight });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET Endpoint for historical records
  router.get('/weight-log', async (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 50;
    try {
      const query = `
        SELECT id, device_id, weight_kg, timestamp 
        FROM weight_readings 
        ORDER BY timestamp DESC 
        LIMIT $1
      `;
      const result = await pool.query(query, [limit]);
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
