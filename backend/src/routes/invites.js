const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { pool } = require('../db/client');
const { generateQRCode } = require('../services/qrcode');
const { randomBytes } = require('crypto');

function generateToken() {
  return randomBytes(16).toString('base64url');
}

router.post('/albums/:albumId/invites', requireAuth, async (req, res, next) => {
  try {
    const { albumId } = req.params;
    const { expires_in_days, max_uses } = req.body;

    const { rows: membership } = await pool.query(
      'SELECT 1 FROM album_members WHERE album_id = $1 AND user_id = $2',
      [albumId, req.user.id]
    );
    if (!membership[0]) return res.status(403).json({ error: 'Forbidden' });

    const token = generateToken();
    const expiresAt = expires_in_days
      ? new Date(Date.now() + expires_in_days * 86400000).toISOString()
      : null;

    await pool.query(
      `INSERT INTO invites (album_id, token, created_by, expires_at, max_uses) VALUES ($1, $2, $3, $4, $5)`,
      [albumId, token, req.user.id, expiresAt, max_uses ?? null]
    );

    const deepLink = `familyguy://join/${token}`;
    const qrCode = await generateQRCode(deepLink);

    res.status(201).json({ token, deep_link: deepLink, qr_code: qrCode, expires_at: expiresAt });
  } catch (err) { next(err); }
});

router.get('/invites/:token', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*, a.name AS album_name FROM invites i JOIN albums a ON a.id = i.album_id WHERE i.token = $1`,
      [req.params.token]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });

    const invite = rows[0];
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) return res.status(410).json({ error: 'Invite expired' });
    if (invite.max_uses && invite.use_count >= invite.max_uses) return res.status(410).json({ error: 'Invite limit reached' });

    res.json({ album_id: invite.album_id, album_name: invite.album_name, expires_at: invite.expires_at });
  } catch (err) { next(err); }
});

router.post('/invites/:token/join', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM invites WHERE token = $1', [req.params.token]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });

    const invite = rows[0];
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) return res.status(410).json({ error: 'Invite expired' });
    if (invite.max_uses && invite.use_count >= invite.max_uses) return res.status(410).json({ error: 'Invite limit reached' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rowCount } = await client.query(
        `INSERT INTO album_members (album_id, user_id, role) VALUES ($1, $2, 'member')
         ON CONFLICT (album_id, user_id) DO NOTHING`,
        [invite.album_id, req.user.id]
      );
      if (rowCount > 0) {
        await client.query('UPDATE invites SET use_count = use_count + 1 WHERE id = $1', [invite.id]);
      }
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    res.json({ album_id: invite.album_id });
  } catch (err) { next(err); }
});

module.exports = router;
