const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { pool } = require('../db/client');
const { getPresignedPutUrl } = require('../services/r2');
const { generateThumbnail } = require('../services/thumbnail');
const { sendPush } = require('../services/apns');

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
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(album_id)) return res.status(400).json({ error: 'album_id must be a valid UUID' });
    if (!(await requireMember(album_id, req.user.id))) return res.status(403).json({ error: 'Forbidden' });

    const { url, key } = await getPresignedPutUrl();
    res.json({ url, key });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { album_id, r2_key, taken_at, caption, local_asset_id } = req.body;
    if (!album_id || !r2_key || !taken_at) return res.status(400).json({ error: 'album_id, r2_key, taken_at required' });
    if (!(await requireMember(album_id, req.user.id))) return res.status(403).json({ error: 'Forbidden' });

    if (local_asset_id) {
      const { rows: existing } = await pool.query(
        'SELECT * FROM photos WHERE album_id = $1 AND local_asset_id = $2',
        [album_id, local_asset_id]
      );
      if (existing[0]) return res.status(200).json(existing[0]);
    }

    const thumbnailKey = await generateThumbnail(r2_key);

    const { rows } = await pool.query(
      `INSERT INTO photos (album_id, uploaded_by, r2_key, thumbnail_key, taken_at, caption, local_asset_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [album_id, req.user.id, r2_key, thumbnailKey, taken_at, caption || null, local_asset_id || null]
    );
    const photo = rows[0];

    const { rows: members } = await pool.query(
      `SELECT u.apns_token FROM users u
       JOIN album_members am ON am.user_id = u.id
       WHERE am.album_id = $1 AND u.apns_token IS NOT NULL AND u.id != $2`,
      [album_id, req.user.id]
    );
    const tokens = members.map(m => m.apns_token);
    sendPush(tokens, 'New photo added', `${req.user.display_name} added a new photo`, { photoId: photo.id }).catch(console.error);

    res.status(201).json(photo);
  } catch (err) { next(err); }
});

module.exports = router;
