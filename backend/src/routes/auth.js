const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool } = require('../db/client');
const { verifyAppleToken } = require('../services/appleAuth');
const { verifyGoogleToken } = require('../services/googleAuth');

function signJwt(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '30d' });
}

async function upsertUser({ column, sub, displayName, avatarUrl, apnsToken }) {
  const { rows } = await pool.query(
    `INSERT INTO users (${column}, display_name, avatar_url, apns_token)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (${column}) DO UPDATE
       SET display_name = COALESCE(EXCLUDED.display_name, users.display_name),
           avatar_url   = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
           apns_token   = COALESCE(EXCLUDED.apns_token, users.apns_token)
     RETURNING *`,
    [sub, displayName, avatarUrl || null, apnsToken || null]
  );
  return rows[0];
}

router.post('/apple', async (req, res, next) => {
  try {
    const { idToken, apnsToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'idToken required' });

    const { sub, name } = await verifyAppleToken(idToken);
    const user = await upsertUser({ column: 'apple_sub', sub, displayName: name || 'Family Member', apnsToken });

    res.json({ token: signJwt(user.id), user });
  } catch (err) {
    next(err);
  }
});

router.post('/google', async (req, res, next) => {
  try {
    const { idToken, apnsToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'idToken required' });

    const { sub, name, picture } = await verifyGoogleToken(idToken);
    const user = await upsertUser({ column: 'google_sub', sub, displayName: name || 'Family Member', avatarUrl: picture, apnsToken });

    res.json({ token: signJwt(user.id), user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
