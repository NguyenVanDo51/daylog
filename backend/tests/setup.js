const { pool } = require('../src/db/client');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const TABLES = ['invites', 'milestones', 'photos', 'album_members', 'albums', 'users'];

beforeEach(async () => {
  for (const table of TABLES) {
    await pool.query(`TRUNCATE ${table} CASCADE`);
  }
});

afterAll(async () => {
  await pool.end();
});

async function createTestUser(overrides = {}) {
  const { rows } = await pool.query(
    `INSERT INTO users (apple_sub, display_name, avatar_url)
     VALUES ($1, $2, $3) RETURNING *`,
    [overrides.apple_sub || uuidv4(), overrides.display_name || 'Test User', overrides.avatar_url || null]
  );
  return rows[0];
}

function authHeader(user) {
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'test-secret');
  return { Authorization: `Bearer ${token}` };
}

async function createTestAlbum(userId, overrides = {}) {
  const { rows } = await pool.query(
    `INSERT INTO albums (name, created_by, child_birthdate) VALUES ($1, $2, $3) RETURNING *`,
    [overrides.name || 'Test Album', userId, overrides.child_birthdate || '2024-01-15']
  );
  const album = rows[0];
  await pool.query(
    `INSERT INTO album_members (album_id, user_id, role) VALUES ($1, $2, 'admin')`,
    [album.id, userId]
  );
  return album;
}

module.exports = { createTestUser, createTestAlbum, authHeader };
