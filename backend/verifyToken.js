const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(403).json({ error: 'No token provided, authorization denied.' });
  }

  const token = authHeader.split(' ')[1]; // Format: Bearer <token>
  if (!token) {
    return res.status(403).json({ error: 'Token format is incorrect.' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token.' });
    }
    
    req.user = decoded;
    next();
  });
};

module.exports = verifyToken;