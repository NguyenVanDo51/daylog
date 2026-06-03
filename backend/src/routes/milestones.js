const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { pool } = require('../db/client');
const { sendPush } = require('../services/apns');

router.use(requireAuth);

router.post('/albums/:albumId/milestones', async (req, res, next) => {
  try {
    const { albumId } = req.params;
    const { title, note, occurred_at, cover_photo_id } = req.body;
    if (!title || !occurred_at) return res.status(400).json({ error: 'title and occurred_at required' });

    const { rows: membership } = await pool.query(
      'SELECT 1 FROM album_members WHERE album_id = $1 AND user_id = $2',
      [albumId, req.user.id]
    );
    if (!membership[0]) return res.status(403).json({ error: 'Forbidden' });

    const { rows } = await pool.query(
      `INSERT INTO milestones (album_id, created_by, title, note, occurred_at, cover_photo_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [albumId, req.user.id, title, note || null, occurred_at, cover_photo_id || null]
    );
    const milestone = rows[0];

    const { rows: members } = await pool.query(
      `SELECT u.apns_token FROM users u
       JOIN album_members am ON am.user_id = u.id
       WHERE am.album_id = $1 AND u.apns_token IS NOT NULL AND u.id != $2`,
      [albumId, req.user.id]
    );
    const tokens = members.map(m => m.apns_token);
    sendPush(tokens, 'New milestone!', `${req.user.display_name} added: ${title}`, { milestoneId: milestone.id }).catch(console.error);

    res.status(201).json(milestone);
  } catch (err) { next(err); }
});

router.get('/albums/:albumId/milestones', async (req, res, next) => {
  try {
    const { rows: membership } = await pool.query(
      'SELECT 1 FROM album_members WHERE album_id = $1 AND user_id = $2',
      [req.params.albumId, req.user.id]
    );
    if (!membership[0]) return res.status(403).json({ error: 'Forbidden' });

    const { rows } = await pool.query(
      'SELECT * FROM milestones WHERE album_id = $1 ORDER BY occurred_at DESC',
      [req.params.albumId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.patch('/milestones/:id', async (req, res, next) => {
  try {
    const { rows: existing } = await pool.query(
      `SELECT m.* FROM milestones m
       JOIN album_members am ON am.album_id = m.album_id
       WHERE m.id = $1 AND am.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!existing[0]) return res.status(403).json({ error: 'Forbidden' });

    const { title, note, occurred_at, cover_photo_id } = req.body;
    const { rows } = await pool.query(
      `UPDATE milestones SET
         title = COALESCE($1, title),
         note = COALESCE($2, note),
         occurred_at = COALESCE($3, occurred_at),
         cover_photo_id = COALESCE($4, cover_photo_id)
       WHERE id = $5 RETURNING *`,
      [title || null, note || null, occurred_at || null, cover_photo_id || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/milestones/:id', async (req, res, next) => {
  try {
    const { rows: existing } = await pool.query(
      `SELECT m.* FROM milestones m
       JOIN album_members am ON am.album_id = m.album_id
       WHERE m.id = $1 AND am.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!existing[0]) return res.status(403).json({ error: 'Forbidden' });

    await pool.query('DELETE FROM milestones WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
