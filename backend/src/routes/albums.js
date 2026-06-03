const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { pool } = require('../db/client');

router.use(requireAuth);

router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { name, child_birthdate } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });

    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO albums (name, child_birthdate, created_by) VALUES ($1, $2, $3)
       RETURNING id, name, child_birthdate::text, cover_photo_id, created_by, created_at`,
      [name, child_birthdate || null, req.user.id]
    );
    const album = rows[0];
    await client.query(
      `INSERT INTO album_members (album_id, user_id, role) VALUES ($1, $2, 'admin')`,
      [album.id, req.user.id]
    );
    await client.query('COMMIT');
    res.status(201).json(album);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.name, a.child_birthdate::text, a.cover_photo_id, a.created_by, a.created_at
       FROM albums a
       JOIN album_members am ON am.album_id = a.id
       WHERE am.user_id = $1
       ORDER BY a.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows: members } = await pool.query(
      `SELECT * FROM album_members WHERE album_id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!members[0]) return res.status(403).json({ error: 'Forbidden' });

    const { rows } = await pool.query(
      `SELECT a.id, a.name, a.child_birthdate::text, a.cover_photo_id, a.created_by, a.created_at,
              COUNT(am.id)::int AS member_count
       FROM albums a
       JOIN album_members am ON am.album_id = a.id
       WHERE a.id = $1
       GROUP BY a.id`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { rows: members } = await pool.query(
      `SELECT * FROM album_members WHERE album_id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!members[0]) return res.status(403).json({ error: 'Forbidden' });

    const { name, child_birthdate, cover_photo_id } = req.body;

    if (cover_photo_id) {
      const { rows: photos } = await pool.query(
        `SELECT id FROM photos WHERE id = $1 AND album_id = $2`,
        [cover_photo_id, req.params.id]
      );
      if (!photos[0]) return res.status(400).json({ error: 'cover_photo_id does not belong to this album' });
    }

    const { rows } = await pool.query(
      `UPDATE albums SET
         name = COALESCE($1, name),
         child_birthdate = COALESCE($2, child_birthdate),
         cover_photo_id = COALESCE($3, cover_photo_id)
       WHERE id = $4
       RETURNING id, name, child_birthdate::text, cover_photo_id, created_by, created_at`,
      [name || null, child_birthdate || null, cover_photo_id || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
