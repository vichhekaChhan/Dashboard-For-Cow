const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const verifyToken = require('./verifyToken');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many login attempts, please try again later'
});

module.exports = function(pool) {
  const router = express.Router();

  router.post('/register', async (req, res) => {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required' });
    }

    try {
      const userExists = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
      if (userExists.rows.length > 0) {
        return res.status(400).json({ error: 'Username or email already exists' });
      }

      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);
      
      const newRole = role === 'admin' ? 'admin' : 'viewer';

      const result = await pool.query(
        'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
        [username, email, password_hash, newRole]
      );

      res.status(201).json({ message: 'User registered successfully', user: result.rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Server error during registration' });
    }
  });

  router.post('/login', loginLimiter, async (req, res) => {
    const { username, password } = req.body; // Can accept username or email

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
      const result = await pool.query('SELECT * FROM users WHERE username = $1 OR email = $1', [username]);
      const user = result.rows[0];

      if (!user) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '8h' }
      );

      // Also set as httpOnly cookie for better security as requested by user option
      res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 });

      res.json({
        message: 'Logged in successfully',
        token,
        user: { id: user.id, username: user.username, email: user.email, role: user.role }
      });
    } catch (err) {
      res.status(500).json({ error: 'Server error during login' });
    }
  });

  router.get('/me', verifyToken, async (req, res) => {
    try {
      const result = await pool.query('SELECT id, username, email, role, created_at FROM users WHERE id = $1', [req.user.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({ user: result.rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
};