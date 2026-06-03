const express = require('express');
const router = express.Router({ mergeParams: true });
const { requireAuth } = require('../middleware/auth');
const { pool } = require('../db/client');

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const { id: albumId } = req.params;

    const { rows: membership } = await pool.query(
      'SELECT 1 FROM album_members WHERE album_id = $1 AND user_id = $2',
      [albumId, req.user.id]
    );
    if (!membership[0]) return res.status(403).json({ error: 'Forbidden' });

    const { rows } = await pool.query(
      `SELECT u.id, u.display_name, u.avatar_url, am.role, am.joined_at
       FROM users u
       JOIN album_members am ON am.user_id = u.id
       WHERE am.album_id = $1
       ORDER BY am.joined_at ASC`,
      [albumId]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;
