const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { pool } = require('../db/client');
const { getPresignedPutUrl } = require('../services/r2');

router.use(requireAuth);

async function requireMember(albumId, userId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM album_members WHERE album_id = $1 AND user_id = $2',
    [albumId, userId]
  );
  return rows.length > 0;
}

router.post('/presign', async (req, res, next) => {
  try {
    const { album_id } = req.body;
    if (!album_id) return res.status(400).json({ error: 'album_id required' });
    if (!(await requireMember(album_id, req.user.id))) return res.status(403).json({ error: 'Forbidden' });

    const { url, key } = await getPresignedPutUrl();
    res.json({ url, key });
  } catch (err) { next(err); }
});

module.exports = router;
