const jwt = require('jsonwebtoken');
const { pool } = require('../db/client');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice(7);
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: 'Server misconfigured' });
    const payload = jwt.verify(token, secret);
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [payload.userId]);
    if (!rows[0]) return res.status(401).json({ error: 'Unauthorized' });
    req.user = rows[0];
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = { requireAuth };
