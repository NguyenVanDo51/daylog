# Family Album Backend API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Express.js REST API that powers the family album app — auth, photo upload via Cloudflare R2, timeline, milestones, family invites, and APNs push notifications.

**Architecture:** Single Express.js monolith with PostgreSQL for metadata and Cloudflare R2 for photo/thumbnail storage. Photos upload directly from the client to R2 via presigned URLs; the API handles only metadata and business logic. External services (Apple auth, Google auth, APNs) are isolated in service modules so they can be mocked in tests.

**Tech Stack:** Node.js 20, Express.js, PostgreSQL 15, `pg`, `jsonwebtoken`, `apple-signin-auth`, `google-auth-library`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `sharp`, `qrcode`, `@parse/node-apn`, `uuid`, Jest, Supertest

---

## File Structure

```
backend/
  src/
    app.js                       - Express app factory (middleware + routes), exported for testing
    index.js                     - HTTP server entry point
    db/
      client.js                  - pg Pool singleton
      migrate.js                 - migration runner (node src/db/migrate.js)
      migrations/
        001_initial_schema.sql   - all tables + indexes
    middleware/
      auth.js                    - JWT verification, attaches req.user
    routes/
      auth.js                    - POST /auth/apple, POST /auth/google
      albums.js                  - CRUD /albums
      photos.js                  - POST /photos/presign, POST /photos, GET /albums/:id/photos
      timeline.js                - GET /albums/:id/timeline
      milestones.js              - CRUD /albums/:id/milestones
      invites.js                 - POST /albums/:id/invites, GET /invites/:token, POST /invites/:token/join
      members.js                 - GET /albums/:id/members
    services/
      appleAuth.js               - verifyAppleToken(idToken) → { sub, name, email }
      googleAuth.js              - verifyGoogleToken(idToken) → { sub, name, picture }
      r2.js                      - getPresignedPutUrl(key) → url, getObjectUrl(key) → url
      thumbnail.js               - generateThumbnail(r2Key) → thumbnailKey
      apns.js                    - sendPush(apnsTokens, title, body, data) → void
      qrcode.js                  - generateQRCode(text) → dataUrl (base64 PNG)
  tests/
    setup.js                     - DB bootstrap/teardown, createTestUser(), createTestAlbum()
    auth.test.js
    albums.test.js
    photos.test.js
    timeline.test.js
    milestones.test.js
    invites.test.js
    members.test.js
  .env.example
  package.json
  jest.config.js
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `backend/package.json`
- Create: `backend/.env.example`
- Create: `backend/jest.config.js`
- Create: `backend/src/app.js`
- Create: `backend/src/index.js`
- Create: `backend/src/db/client.js`

- [ ] **Step 1: Create the backend directory and package.json**

```bash
mkdir -p backend/src/db/migrations backend/src/middleware backend/src/routes backend/src/services backend/tests
cd backend
npm init -y
npm install express pg jsonwebtoken apple-signin-auth google-auth-library \
  @aws-sdk/client-s3 @aws-sdk/s3-request-presigner sharp qrcode @parse/node-apn uuid dotenv
npm install --save-dev jest supertest nodemon
```

- [ ] **Step 2: Create `.env.example`**

```
DATABASE_URL=postgres://localhost:5432/familyguy
DATABASE_URL_TEST=postgres://localhost:5432/familyguy_test
JWT_SECRET=changeme

# Cloudflare R2
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=family-album
R2_PUBLIC_URL=https://your-r2-public-url.com

# Apple
APPLE_CLIENT_ID=com.yourcompany.familyguy

# Google
GOOGLE_CLIENT_ID=

# APNs
APNS_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
APNS_KEY_ID=
APNS_TEAM_ID=
APNS_BUNDLE_ID=com.yourcompany.familyguy
```

- [ ] **Step 3: Create `jest.config.js`**

```javascript
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./tests/setup.js'],
  testTimeout: 15000,
};
```

- [ ] **Step 4: Add scripts to `package.json`**

```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "migrate": "node src/db/migrate.js",
    "test": "NODE_ENV=test jest --runInBand --forceExit"
  }
}
```

- [ ] **Step 5: Create `src/db/client.js`**

```javascript
const { Pool } = require('pg');
require('dotenv').config();

const isTest = process.env.NODE_ENV === 'test';
const pool = new Pool({
  connectionString: isTest ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL,
});

module.exports = { pool };
```

- [ ] **Step 6: Create `src/app.js`**

```javascript
const express = require('express');
const app = express();

app.use(express.json());

app.use('/auth', require('./routes/auth'));
app.use('/albums', require('./routes/albums'));
app.use('/photos', require('./routes/photos'));
app.use('/milestones', require('./routes/milestones'));
app.use('/invites', require('./routes/invites'));

app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

module.exports = app;
```

- [ ] **Step 7: Create `src/index.js`**

```javascript
require('dotenv').config();
const app = require('./app');
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API running on port ${port}`));
```

- [ ] **Step 8: Verify app starts**

```bash
cp .env.example .env
# Fill in DATABASE_URL with a local postgres URL
node src/index.js
```

Expected: `API running on port 3000`

- [ ] **Step 9: Commit**

```bash
git add backend/
git commit -m "feat: scaffold backend Express.js project"
```

---

## Task 2: Database Schema

**Files:**
- Create: `backend/src/db/migrations/001_initial_schema.sql`
- Create: `backend/src/db/migrate.js`

- [ ] **Step 1: Create `src/db/migrations/001_initial_schema.sql`**

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE member_role AS ENUM ('admin', 'member');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  apple_sub VARCHAR UNIQUE,
  google_sub VARCHAR UNIQUE,
  display_name VARCHAR NOT NULL,
  avatar_url TEXT,
  apns_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE albums (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR NOT NULL,
  child_birthdate DATE,
  cover_photo_id UUID,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE album_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  role member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(album_id, user_id)
);

CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  r2_key TEXT NOT NULL,
  thumbnail_key TEXT,
  taken_at TIMESTAMPTZ NOT NULL,
  caption TEXT,
  local_asset_id VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  title VARCHAR NOT NULL,
  note TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  cover_photo_id UUID REFERENCES photos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  album_id UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  token VARCHAR NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ,
  max_uses INT,
  use_count INT NOT NULL DEFAULT 0
);

ALTER TABLE albums
  ADD CONSTRAINT fk_cover_photo FOREIGN KEY (cover_photo_id) REFERENCES photos(id) ON DELETE SET NULL;

CREATE INDEX idx_photos_album_taken_at ON photos(album_id, taken_at DESC);
CREATE INDEX idx_milestones_album_occurred_at ON milestones(album_id, occurred_at DESC);
CREATE INDEX idx_photos_local_asset ON photos(album_id, local_asset_id) WHERE local_asset_id IS NOT NULL;
```

- [ ] **Step 2: Create `src/db/migrate.js`**

```javascript
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./client');

async function migrate() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`Running migration: ${file}`);
    await pool.query(sql);
    console.log(`  ✓ ${file}`);
  }
  await pool.end();
}

migrate().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 3: Create both databases and run migrations**

```bash
createdb familyguy
createdb familyguy_test
npm run migrate
DATABASE_URL_TEST=postgres://localhost:5432/familyguy_test NODE_ENV=test npm run migrate
```

Expected: each migration file logged with ✓

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/
git commit -m "feat: add database schema and migration runner"
```

---

## Task 3: Test Setup

**Files:**
- Create: `backend/tests/setup.js`

- [ ] **Step 1: Create `tests/setup.js`**

```javascript
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
```

- [ ] **Step 2: Update `jest.config.js` to point to setup file**

```javascript
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./tests/setup.js'],
  testTimeout: 15000,
};
```

- [ ] **Step 3: Verify test setup runs**

```bash
npm test -- --testPathPattern=nonexistent
```

Expected: `Test Suites: 0 passed` (no errors means DB connection works)

- [ ] **Step 4: Commit**

```bash
git add backend/tests/setup.js backend/jest.config.js
git commit -m "feat: add test helpers and database cleanup"
```

---

## Task 4: Auth Services

**Files:**
- Create: `backend/src/services/appleAuth.js`
- Create: `backend/src/services/googleAuth.js`

- [ ] **Step 1: Create `src/services/appleAuth.js`**

```javascript
const appleSignin = require('apple-signin-auth');

async function verifyAppleToken(idToken) {
  const payload = await appleSignin.verifyIdToken(idToken, {
    audience: process.env.APPLE_CLIENT_ID,
    ignoreExpiration: false,
  });
  return {
    sub: payload.sub,
    name: payload.name || null,
    email: payload.email || null,
  };
}

module.exports = { verifyAppleToken };
```

- [ ] **Step 2: Create `src/services/googleAuth.js`**

```javascript
const { OAuth2Client } = require('google-auth-library');

async function verifyGoogleToken(idToken) {
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  return {
    sub: payload.sub,
    name: payload.name || null,
    picture: payload.picture || null,
  };
}

module.exports = { verifyGoogleToken };
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/services/
git commit -m "feat: add Apple and Google token verification services"
```

---

## Task 5: Auth Endpoints

**Files:**
- Create: `backend/src/routes/auth.js`
- Create: `backend/tests/auth.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/auth.test.js
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/db/client');

jest.mock('../src/services/appleAuth');
jest.mock('../src/services/googleAuth');

const { verifyAppleToken } = require('../src/services/appleAuth');
const { verifyGoogleToken } = require('../src/services/googleAuth');

describe('POST /auth/apple', () => {
  it('creates a new user and returns a JWT', async () => {
    verifyAppleToken.mockResolvedValue({ sub: 'apple-sub-123', name: 'Jane Doe', email: 'jane@example.com' });

    const res = await request(app)
      .post('/auth/apple')
      .send({ idToken: 'fake-apple-token', apnsToken: 'device-token-abc' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.display_name).toBe('Jane Doe');

    const { rows } = await pool.query(`SELECT * FROM users WHERE apple_sub = 'apple-sub-123'`);
    expect(rows).toHaveLength(1);
    expect(rows[0].apns_token).toBe('device-token-abc');
  });

  it('returns existing user on second sign-in', async () => {
    verifyAppleToken.mockResolvedValue({ sub: 'apple-sub-123', name: 'Jane Doe', email: null });

    await request(app).post('/auth/apple').send({ idToken: 'token' });
    const res = await request(app).post('/auth/apple').send({ idToken: 'token' });

    expect(res.status).toBe(200);
    const { rows } = await pool.query(`SELECT * FROM users WHERE apple_sub = 'apple-sub-123'`);
    expect(rows).toHaveLength(1);
  });

  it('returns 400 when idToken is missing', async () => {
    const res = await request(app).post('/auth/apple').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/google', () => {
  it('creates a new user and returns a JWT', async () => {
    verifyGoogleToken.mockResolvedValue({ sub: 'google-sub-456', name: 'John Smith', picture: 'https://example.com/photo.jpg' });

    const res = await request(app)
      .post('/auth/google')
      .send({ idToken: 'fake-google-token', apnsToken: 'device-token-xyz' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.display_name).toBe('John Smith');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern=auth
```

Expected: FAIL — `Cannot find module '../src/routes/auth'`

- [ ] **Step 3: Create `src/routes/auth.js`**

```javascript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=auth
```

Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/auth.js backend/tests/auth.test.js
git commit -m "feat: add Apple and Google auth endpoints"
```

---

## Task 6: Auth Middleware

**Files:**
- Create: `backend/src/middleware/auth.js`

- [ ] **Step 1: Write the failing test (inline in albums.test.js — middleware is tested via protected routes)**

```javascript
// tests/albums.test.js (first block only, rest in Task 7)
const request = require('supertest');
const app = require('../src/app');

describe('Auth middleware', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/albums');
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    const res = await request(app)
      .get('/albums')
      .set('Authorization', 'Bearer bad-token');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --testPathPattern=albums
```

Expected: FAIL — route returns 404 (albums route not wired yet) or no auth check

- [ ] **Step 3: Create `src/middleware/auth.js`**

```javascript
const jwt = require('jsonwebtoken');
const { pool } = require('../db/client');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'test-secret');
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [payload.userId]);
    if (!rows[0]) return res.status(401).json({ error: 'Unauthorized' });
    req.user = rows[0];
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = { requireAuth };
```

- [ ] **Step 4: Create stub `src/routes/albums.js`** (full implementation in Task 7)

```javascript
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', (req, res) => res.json([]));

module.exports = router;
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=albums
```

Expected: PASS — 2 tests

- [ ] **Step 6: Commit**

```bash
git add backend/src/middleware/auth.js backend/src/routes/albums.js backend/tests/albums.test.js
git commit -m "feat: add JWT auth middleware"
```

---

## Task 7: Albums CRUD

**Files:**
- Modify: `backend/src/routes/albums.js`
- Modify: `backend/tests/albums.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `tests/albums.test.js`:

```javascript
const { createTestUser, createTestAlbum, authHeader } = require('./setup');

describe('Albums CRUD', () => {
  let user, headers;

  beforeEach(async () => {
    user = await createTestUser();
    headers = authHeader(user);
  });

  it('POST /albums creates an album and adds creator as admin member', async () => {
    const res = await request(app)
      .post('/albums')
      .set(headers)
      .send({ name: "Emma's Album", child_birthdate: '2024-03-01' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Emma's Album");
    expect(res.body.child_birthdate).toBe('2024-03-01');
  });

  it('GET /albums returns albums the user is a member of', async () => {
    await createTestAlbum(user.id, { name: 'Album A' });
    await createTestAlbum(user.id, { name: 'Album B' });

    const res = await request(app).get('/albums').set(headers);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('GET /albums/:id returns album with member count', async () => {
    const album = await createTestAlbum(user.id);

    const res = await request(app).get(`/albums/${album.id}`).set(headers);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(album.id);
    expect(res.body.member_count).toBe(1);
  });

  it('GET /albums/:id returns 403 for non-member', async () => {
    const other = await createTestUser({ apple_sub: 'other-sub' });
    const album = await createTestAlbum(other.id);

    const res = await request(app).get(`/albums/${album.id}`).set(headers);

    expect(res.status).toBe(403);
  });

  it('PATCH /albums/:id updates name and child_birthdate', async () => {
    const album = await createTestAlbum(user.id);

    const res = await request(app)
      .patch(`/albums/${album.id}`)
      .set(headers)
      .send({ name: 'New Name', child_birthdate: '2024-06-15' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test -- --testPathPattern=albums
```

Expected: FAIL — routes not implemented

- [ ] **Step 3: Implement `src/routes/albums.js`**

```javascript
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { pool } = require('../db/client');

router.use(requireAuth);

router.post('/', async (req, res, next) => {
  try {
    const { name, child_birthdate } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });

    const { rows } = await pool.query(
      `INSERT INTO albums (name, child_birthdate, created_by) VALUES ($1, $2, $3) RETURNING *`,
      [name, child_birthdate || null, req.user.id]
    );
    const album = rows[0];
    await pool.query(
      `INSERT INTO album_members (album_id, user_id, role) VALUES ($1, $2, 'admin')`,
      [album.id, req.user.id]
    );
    res.status(201).json(album);
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.* FROM albums a
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
      `SELECT a.*, COUNT(am.id)::int AS member_count
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
    const { rows } = await pool.query(
      `UPDATE albums SET
         name = COALESCE($1, name),
         child_birthdate = COALESCE($2, child_birthdate),
         cover_photo_id = COALESCE($3, cover_photo_id)
       WHERE id = $4 RETURNING *`,
      [name || null, child_birthdate || null, cover_photo_id || null, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=albums
```

Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/albums.js backend/tests/albums.test.js
git commit -m "feat: add albums CRUD endpoints"
```

---

## Task 8: R2 Service + Presigned URL Endpoint

**Files:**
- Create: `backend/src/services/r2.js`
- Create: `backend/src/routes/photos.js`
- Create: `backend/tests/photos.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/photos.test.js
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/db/client');
const { createTestUser, createTestAlbum, authHeader } = require('./setup');

jest.mock('../src/services/r2');
jest.mock('../src/services/thumbnail');
jest.mock('../src/services/apns');

const { getPresignedPutUrl } = require('../src/services/r2');
const { generateThumbnail } = require('../src/services/thumbnail');
const { sendPush } = require('../src/services/apns');

describe('POST /photos/presign', () => {
  let user, album, headers;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
    getPresignedPutUrl.mockResolvedValue({ url: 'https://r2.example.com/presigned', key: 'photos/abc.webp' });
  });

  it('returns a presigned URL and r2 key', async () => {
    const res = await request(app)
      .post('/photos/presign')
      .set(headers)
      .send({ album_id: album.id });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://r2.example.com/presigned');
    expect(res.body.key).toBe('photos/abc.webp');
  });

  it('returns 403 when user is not album member', async () => {
    const other = await createTestUser({ apple_sub: 'other' });
    const otherAlbum = await createTestAlbum(other.id);

    const res = await request(app)
      .post('/photos/presign')
      .set(headers)
      .send({ album_id: otherAlbum.id });

    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- --testPathPattern=photos
```

Expected: FAIL — routes not found

- [ ] **Step 3: Create `src/services/r2.js`**

```javascript
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET;

async function getPresignedPutUrl() {
  const key = `photos/${uuidv4()}.webp`;
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: 'image/webp' });
  const url = await getSignedUrl(r2, command, { expiresIn: 3600 });
  return { url, key };
}

async function getObjectBuffer(key) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const response = await r2.send(command);
  const chunks = [];
  for await (const chunk of response.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function putObject(key, buffer, contentType = 'image/webp') {
  await r2.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType }));
}

module.exports = { getPresignedPutUrl, getObjectBuffer, putObject };
```

- [ ] **Step 4: Create stub `src/routes/photos.js`** (presign only for now)

```javascript
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
```

Wire in `app.js`:
```javascript
app.use('/photos', require('./routes/photos'));
```

- [ ] **Step 5: Run tests to verify presign tests pass**

```bash
npm test -- --testPathPattern=photos
```

Expected: PASS — 2 tests

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/r2.js backend/src/routes/photos.js backend/tests/photos.test.js backend/src/app.js
git commit -m "feat: add R2 presigned URL service and endpoint"
```

---

## Task 9: Photo Registration + Thumbnail Generation

**Files:**
- Create: `backend/src/services/thumbnail.js`
- Create: `backend/src/services/apns.js`
- Modify: `backend/src/routes/photos.js`
- Modify: `backend/tests/photos.test.js`

- [ ] **Step 1: Write failing tests**

Add to `tests/photos.test.js`:

```javascript
describe('POST /photos', () => {
  let user, album, headers;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
    generateThumbnail.mockResolvedValue('thumbnails/abc-thumb.webp');
    sendPush.mockResolvedValue();
  });

  it('registers a photo and returns it with thumbnail_key', async () => {
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({
        album_id: album.id,
        r2_key: 'photos/abc.webp',
        taken_at: '2024-06-01T10:00:00Z',
        caption: 'First smile!',
        local_asset_id: 'ios-asset-uuid-123',
      });

    expect(res.status).toBe(201);
    expect(res.body.r2_key).toBe('photos/abc.webp');
    expect(res.body.thumbnail_key).toBe('thumbnails/abc-thumb.webp');
    expect(generateThumbnail).toHaveBeenCalledWith('photos/abc.webp');
  });

  it('is idempotent — same local_asset_id returns existing photo', async () => {
    const payload = { album_id: album.id, r2_key: 'photos/abc.webp', taken_at: '2024-06-01T10:00:00Z', local_asset_id: 'same-asset' };
    await request(app).post('/photos').set(headers).send(payload);
    const res = await request(app).post('/photos').set(headers).send(payload);

    expect(res.status).toBe(200);
    const { pool: db } = require('../src/db/client');
    const { rows } = await db.query('SELECT * FROM photos WHERE local_asset_id = $1', ['same-asset']);
    expect(rows).toHaveLength(1);
  });

  it('sends push notification to all album members', async () => {
    const member = await createTestUser({ apple_sub: 'member-sub' });
    await pool.query(
      `INSERT INTO album_members (album_id, user_id, role) VALUES ($1, $2, 'member')`,
      [album.id, member.id]
    );
    await pool.query(`UPDATE users SET apns_token = 'token-abc' WHERE id = $1`, [member.id]);

    await request(app)
      .post('/photos')
      .set(headers)
      .send({ album_id: album.id, r2_key: 'photos/x.webp', taken_at: '2024-06-01T10:00:00Z' });

    expect(sendPush).toHaveBeenCalledWith(
      ['token-abc'],
      expect.any(String),
      expect.any(String),
      expect.any(Object)
    );
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test -- --testPathPattern=photos
```

Expected: FAIL

- [ ] **Step 3: Create `src/services/thumbnail.js`**

```javascript
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const { getObjectBuffer, putObject } = require('./r2');

async function generateThumbnail(r2Key) {
  const buffer = await getObjectBuffer(r2Key);
  const thumb = await sharp(buffer)
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const thumbKey = `thumbnails/${uuidv4()}.webp`;
  await putObject(thumbKey, thumb);
  return thumbKey;
}

module.exports = { generateThumbnail };
```

- [ ] **Step 4: Create `src/services/apns.js`**

```javascript
const apn = require('@parse/node-apn');

let provider;

function getProvider() {
  if (!provider) {
    provider = new apn.Provider({
      token: {
        key: (process.env.APNS_KEY || '').replace(/\\n/g, '\n'),
        keyId: process.env.APNS_KEY_ID,
        teamId: process.env.APNS_TEAM_ID,
      },
      production: process.env.NODE_ENV === 'production',
    });
  }
  return provider;
}

async function sendPush(apnsTokens, title, body, data = {}) {
  if (!apnsTokens.length) return;
  const note = new apn.Notification();
  note.alert = { title, body };
  note.payload = data;
  note.topic = process.env.APNS_BUNDLE_ID;
  note.expiry = Math.floor(Date.now() / 1000) + 3600;
  await getProvider().send(note, apnsTokens);
}

module.exports = { sendPush };
```

- [ ] **Step 5: Add photo registration to `src/routes/photos.js`**

```javascript
const { generateThumbnail } = require('../services/thumbnail');
const { sendPush } = require('../services/apns');

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
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=photos
```

Expected: PASS — 5 tests

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/thumbnail.js backend/src/services/apns.js backend/src/routes/photos.js backend/tests/photos.test.js
git commit -m "feat: add photo registration with thumbnail generation and push notifications"
```

---

## Task 10: Timeline Endpoint

**Files:**
- Create: `backend/src/routes/timeline.js`
- Create: `backend/tests/timeline.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/timeline.test.js
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/db/client');
const { createTestUser, createTestAlbum, authHeader } = require('./setup');

async function insertPhoto(albumId, userId, takenAt) {
  const { rows } = await pool.query(
    `INSERT INTO photos (album_id, uploaded_by, r2_key, taken_at) VALUES ($1, $2, $3, $4) RETURNING *`,
    [albumId, userId, 'photos/test.webp', takenAt]
  );
  return rows[0];
}

async function insertMilestone(albumId, userId, occurredAt) {
  const { rows } = await pool.query(
    `INSERT INTO milestones (album_id, created_by, title, occurred_at) VALUES ($1, $2, $3, $4) RETURNING *`,
    [albumId, userId, 'First smile', occurredAt]
  );
  return rows[0];
}

describe('GET /albums/:id/timeline', () => {
  let user, album, headers;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id, { child_birthdate: '2024-01-01' });
    headers = authHeader(user);
  });

  it('returns photos and milestones merged in descending order', async () => {
    await insertPhoto(album.id, user.id, '2024-04-01T10:00:00Z');
    await insertMilestone(album.id, user.id, '2024-03-15T00:00:00Z');
    await insertPhoto(album.id, user.id, '2024-02-01T10:00:00Z');

    const res = await request(app).get(`/albums/${album.id}/timeline`).set(headers);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.items[0].type).toBe('photo');
    expect(res.body.items[1].type).toBe('milestone');
    expect(res.body.items[2].type).toBe('photo');
  });

  it('paginates with cursor', async () => {
    for (let i = 1; i <= 5; i++) {
      await insertPhoto(album.id, user.id, `2024-0${i}-01T10:00:00Z`);
    }

    const first = await request(app).get(`/albums/${album.id}/timeline?limit=3`).set(headers);
    expect(first.body.items).toHaveLength(3);
    expect(first.body.next_cursor).toBeDefined();

    const second = await request(app).get(`/albums/${album.id}/timeline?limit=3&cursor=${first.body.next_cursor}`).set(headers);
    expect(second.body.items).toHaveLength(2);
    expect(second.body.next_cursor).toBeNull();
  });

  it('returns 403 for non-members', async () => {
    const other = await createTestUser({ apple_sub: 'stranger' });
    const res = await request(app).get(`/albums/${album.id}/timeline`).set(authHeader(other));
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- --testPathPattern=timeline
```

Expected: FAIL — route not found

- [ ] **Step 3: Create `src/routes/timeline.js`**

```javascript
const express = require('express');
const router = express.Router({ mergeParams: true });
const { requireAuth } = require('../middleware/auth');
const { pool } = require('../db/client');

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const { id: albumId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const cursor = req.query.cursor ? JSON.parse(Buffer.from(req.query.cursor, 'base64').toString()) : null;

    const { rows: membership } = await pool.query(
      'SELECT 1 FROM album_members WHERE album_id = $1 AND user_id = $2',
      [albumId, req.user.id]
    );
    if (!membership[0]) return res.status(403).json({ error: 'Forbidden' });

    const cursorClause = cursor
      ? `AND (date_trunc('millisecond', event_time) < $3 OR (date_trunc('millisecond', event_time) = $3 AND id < $4))`
      : '';
    const params = cursor ? [albumId, limit + 1, cursor.event_time, cursor.id] : [albumId, limit + 1];

    const { rows } = await pool.query(`
      SELECT id, 'photo' AS type, taken_at AS event_time, r2_key, thumbnail_key, caption, uploaded_by AS user_id, local_asset_id, NULL AS title, NULL AS note
      FROM photos
      WHERE album_id = $1 ${cursorClause}

      UNION ALL

      SELECT id, 'milestone' AS type, occurred_at AS event_time, NULL, NULL, NULL, created_by AS user_id, NULL, title, note
      FROM milestones
      WHERE album_id = $1 ${cursorClause}

      ORDER BY event_time DESC, id DESC
      LIMIT $2
    `, params);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? Buffer.from(JSON.stringify({ event_time: items[items.length - 1].event_time, id: items[items.length - 1].id })).toString('base64')
      : null;

    res.json({ items, next_cursor: nextCursor });
  } catch (err) { next(err); }
});

module.exports = router;
```

Wire in `app.js`:
```javascript
app.use('/albums/:id/timeline', require('./routes/timeline'));
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=timeline
```

Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/timeline.js backend/tests/timeline.test.js backend/src/app.js
git commit -m "feat: add cursor-paginated timeline endpoint merging photos and milestones"
```

---

## Task 11: Milestones CRUD

**Files:**
- Create: `backend/src/routes/milestones.js`
- Create: `backend/tests/milestones.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/milestones.test.js
const request = require('supertest');
const app = require('../src/app');
const { createTestUser, createTestAlbum, authHeader } = require('./setup');

jest.mock('../src/services/apns');
const { sendPush } = require('../src/services/apns');

describe('Milestones', () => {
  let user, album, headers;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
    sendPush.mockResolvedValue();
  });

  it('POST /albums/:id/milestones creates a milestone', async () => {
    const res = await request(app)
      .post(`/albums/${album.id}/milestones`)
      .set(headers)
      .send({ title: 'First steps', note: 'She walked!', occurred_at: '2024-09-15T00:00:00Z' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('First steps');
    expect(res.body.note).toBe('She walked!');
  });

  it('GET /albums/:id/milestones returns all milestones sorted by occurred_at desc', async () => {
    await request(app).post(`/albums/${album.id}/milestones`).set(headers)
      .send({ title: 'First smile', occurred_at: '2024-03-01T00:00:00Z' });
    await request(app).post(`/albums/${album.id}/milestones`).set(headers)
      .send({ title: 'First steps', occurred_at: '2024-09-01T00:00:00Z' });

    const res = await request(app).get(`/albums/${album.id}/milestones`).set(headers);

    expect(res.status).toBe(200);
    expect(res.body[0].title).toBe('First steps');
    expect(res.body[1].title).toBe('First smile');
  });

  it('PATCH /milestones/:id updates a milestone', async () => {
    const created = await request(app)
      .post(`/albums/${album.id}/milestones`)
      .set(headers)
      .send({ title: 'First smile', occurred_at: '2024-03-01T00:00:00Z' });

    const res = await request(app)
      .patch(`/milestones/${created.body.id}`)
      .set(headers)
      .send({ note: 'So cute!' });

    expect(res.status).toBe(200);
    expect(res.body.note).toBe('So cute!');
  });

  it('DELETE /milestones/:id deletes a milestone', async () => {
    const created = await request(app)
      .post(`/albums/${album.id}/milestones`)
      .set(headers)
      .send({ title: 'First smile', occurred_at: '2024-03-01T00:00:00Z' });

    const res = await request(app).delete(`/milestones/${created.body.id}`).set(headers);
    expect(res.status).toBe(204);
  });

  it('sends push notification when milestone is created', async () => {
    await request(app)
      .post(`/albums/${album.id}/milestones`)
      .set(headers)
      .send({ title: 'First smile', occurred_at: '2024-03-01T00:00:00Z' });

    expect(sendPush).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test -- --testPathPattern=milestones
```

Expected: FAIL

- [ ] **Step 3: Create `src/routes/milestones.js`**

```javascript
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
```

Wire in `app.js`:
```javascript
app.use('/', require('./routes/milestones'));
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=milestones
```

Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/milestones.js backend/tests/milestones.test.js backend/src/app.js
git commit -m "feat: add milestones CRUD with push notifications"
```

---

## Task 12: Invites + QR Code

**Files:**
- Create: `backend/src/services/qrcode.js`
- Create: `backend/src/routes/invites.js`
- Create: `backend/tests/invites.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/invites.test.js
const request = require('supertest');
const app = require('../src/app');
const { createTestUser, createTestAlbum, authHeader } = require('./setup');

describe('Invites', () => {
  let user, album, headers;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
  });

  it('POST /albums/:id/invites returns a token and QR code', async () => {
    const res = await request(app)
      .post(`/albums/${album.id}/invites`)
      .set(headers)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.deep_link).toMatch(/^familyguy:\/\/join\//);
    expect(res.body.qr_code).toMatch(/^data:image\/png;base64,/);
  });

  it('GET /invites/:token returns album info for valid token', async () => {
    const invite = await request(app).post(`/albums/${album.id}/invites`).set(headers).send({});
    const { token } = invite.body;

    const res = await request(app).get(`/invites/${token}`);

    expect(res.status).toBe(200);
    expect(res.body.album_id).toBe(album.id);
    expect(res.body.album_name).toBeDefined();
  });

  it('GET /invites/:token returns 410 for expired token', async () => {
    const { pool } = require('../src/db/client');
    const { rows } = await pool.query(
      `INSERT INTO invites (album_id, token, created_by, expires_at) VALUES ($1, $2, $3, $4) RETURNING *`,
      [album.id, 'expired-token', user.id, new Date(Date.now() - 1000).toISOString()]
    );

    const res = await request(app).get(`/invites/expired-token`);
    expect(res.status).toBe(410);
  });

  it('POST /invites/:token/join adds user to album', async () => {
    const inviter = await request(app).post(`/albums/${album.id}/invites`).set(headers).send({});
    const { token } = inviter.body;

    const newUser = await createTestUser({ apple_sub: 'new-member' });
    const res = await request(app)
      .post(`/invites/${token}/join`)
      .set(authHeader(newUser));

    expect(res.status).toBe(200);
    expect(res.body.album_id).toBe(album.id);

    const { pool } = require('../src/db/client');
    const { rows } = await pool.query(
      'SELECT * FROM album_members WHERE album_id = $1 AND user_id = $2',
      [album.id, newUser.id]
    );
    expect(rows).toHaveLength(1);
  });

  it('POST /invites/:token/join is idempotent — rejoining returns 200', async () => {
    const inviter = await request(app).post(`/albums/${album.id}/invites`).set(headers).send({});
    const newUser = await createTestUser({ apple_sub: 'new-member' });
    await request(app).post(`/invites/${inviter.body.token}/join`).set(authHeader(newUser));
    const res = await request(app).post(`/invites/${inviter.body.token}/join`).set(authHeader(newUser));
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test -- --testPathPattern=invites
```

Expected: FAIL

- [ ] **Step 3: Create `src/services/qrcode.js`**

```javascript
const QRCode = require('qrcode');

async function generateQRCode(text) {
  return QRCode.toDataURL(text, { type: 'image/png', width: 300 });
}

module.exports = { generateQRCode };
```

- [ ] **Step 4: Create `src/routes/invites.js`**

```javascript
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { pool } = require('../db/client');
const { generateQRCode } = require('../services/qrcode');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

function generateToken() {
  return crypto.randomBytes(6).toString('base64url');
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
      [albumId, token, req.user.id, expiresAt, max_uses || null]
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

    await pool.query(
      `INSERT INTO album_members (album_id, user_id, role) VALUES ($1, $2, 'member')
       ON CONFLICT (album_id, user_id) DO NOTHING`,
      [invite.album_id, req.user.id]
    );
    await pool.query('UPDATE invites SET use_count = use_count + 1 WHERE id = $1', [invite.id]);

    res.json({ album_id: invite.album_id });
  } catch (err) { next(err); }
});

module.exports = router;
```

Wire in `app.js`:
```javascript
app.use('/', require('./routes/invites'));
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=invites
```

Expected: PASS — 5 tests

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/qrcode.js backend/src/routes/invites.js backend/tests/invites.test.js backend/src/app.js
git commit -m "feat: add invite link and QR code generation with join flow"
```

---

## Task 13: Members Endpoint

**Files:**
- Create: `backend/src/routes/members.js`
- Create: `backend/tests/members.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
// tests/members.test.js
const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/db/client');
const { createTestUser, createTestAlbum, authHeader } = require('./setup');

describe('GET /albums/:id/members', () => {
  let user, album, headers;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
  });

  it('returns list of album members with role', async () => {
    const member = await createTestUser({ apple_sub: 'member-sub', display_name: 'Grandma' });
    await pool.query(
      `INSERT INTO album_members (album_id, user_id, role) VALUES ($1, $2, 'member')`,
      [album.id, member.id]
    );

    const res = await request(app).get(`/albums/${album.id}/members`).set(headers);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const names = res.body.map(m => m.display_name);
    expect(names).toContain('Grandma');
    expect(res.body[0].role).toBeDefined();
  });

  it('returns 403 for non-members', async () => {
    const stranger = await createTestUser({ apple_sub: 'stranger' });
    const res = await request(app).get(`/albums/${album.id}/members`).set(authHeader(stranger));
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test -- --testPathPattern=members
```

Expected: FAIL

- [ ] **Step 3: Create `src/routes/members.js`**

```javascript
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
```

Wire in `app.js`:
```javascript
app.use('/albums/:id/members', require('./routes/members'));
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=members
```

Expected: PASS — 2 tests

- [ ] **Step 5: Run the full test suite**

```bash
npm test
```

Expected: PASS — all tests across all files

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/members.js backend/tests/members.test.js backend/src/app.js
git commit -m "feat: add members list endpoint"
```

---

## Task 14: Full Test Run + Smoke Test

- [ ] **Step 1: Run the full test suite**

```bash
cd backend && npm test
```

Expected: all tests pass, no failures

- [ ] **Step 2: Start the API and smoke-test auth**

```bash
npm run migrate  # ensure prod DB is migrated
npm run dev
```

In another terminal:
```bash
# Should return 401
curl -s http://localhost:3000/albums | jq

# Should return 400 (missing idToken)
curl -s -X POST http://localhost:3000/auth/apple -H 'Content-Type: application/json' -d '{}' | jq
```

Expected:
```json
{ "error": "Unauthorized" }
{ "error": "idToken required" }
```

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "chore: backend API complete — all tests passing"
```

---

## API Summary

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /auth/apple | No | Sign in with Apple |
| POST | /auth/google | No | Sign in with Google |
| POST | /albums | Yes | Create album |
| GET | /albums | Yes | List user's albums |
| GET | /albums/:id | Yes | Get single album |
| PATCH | /albums/:id | Yes | Update album |
| GET | /albums/:id/timeline | Yes | Paginated timeline |
| GET | /albums/:id/milestones | Yes | List milestones |
| POST | /albums/:id/milestones | Yes | Create milestone |
| PATCH | /milestones/:id | Yes | Update milestone |
| DELETE | /milestones/:id | Yes | Delete milestone |
| POST | /photos/presign | Yes | Get R2 presigned upload URL |
| POST | /photos | Yes | Register photo after upload |
| POST | /albums/:id/invites | Yes | Generate invite link + QR |
| GET | /invites/:token | No | Validate invite token |
| POST | /invites/:token/join | Yes | Join album via invite |
| GET | /albums/:id/members | Yes | List album members |
