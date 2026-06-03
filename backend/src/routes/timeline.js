const express = require('express');
const router = express.Router({ mergeParams: true });
const { requireAuth } = require('../middleware/auth');
const { pool } = require('../db/client');

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const { id: albumId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const cursor = req.query.cursor
      ? JSON.parse(Buffer.from(req.query.cursor, 'base64').toString())
      : null;

    const { rows: membership } = await pool.query(
      'SELECT 1 FROM album_members WHERE album_id = $1 AND user_id = $2',
      [albumId, req.user.id]
    );
    if (!membership[0]) return res.status(403).json({ error: 'Forbidden' });

    const photoCursorClause = cursor
      ? `AND (taken_at < $3 OR (taken_at = $3 AND id < $4))`
      : '';
    const milestoneCursorClause = cursor
      ? `AND (occurred_at < $3 OR (occurred_at = $3 AND id < $4))`
      : '';
    const params = cursor
      ? [albumId, limit + 1, cursor.event_time, cursor.id]
      : [albumId, limit + 1];

    const { rows } = await pool.query(`
      SELECT id, 'photo' AS type, taken_at AS event_time,
             r2_key, thumbnail_key, caption, uploaded_by AS user_id,
             local_asset_id, NULL AS title, NULL AS note
      FROM photos
      WHERE album_id = $1 ${photoCursorClause}

      UNION ALL

      SELECT id, 'milestone' AS type, occurred_at AS event_time,
             NULL, NULL, NULL, created_by AS user_id,
             NULL, title, note
      FROM milestones
      WHERE album_id = $1 ${milestoneCursorClause}

      ORDER BY event_time DESC, id DESC
      LIMIT $2
    `, params);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? Buffer.from(JSON.stringify({
          event_time: items[items.length - 1].event_time,
          id: items[items.length - 1].id,
        })).toString('base64')
      : null;

    res.json({ items, next_cursor: nextCursor });
  } catch (err) { next(err); }
});

module.exports = router;
