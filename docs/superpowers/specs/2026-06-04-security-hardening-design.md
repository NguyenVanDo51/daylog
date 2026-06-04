# Security Hardening — Design Spec

**Date:** 2026-06-04  
**Scope:** Backend (Express/Node) + Mobile (Expo)  
**Approach:** Big Bang — fix all 14 issues in one PR  
**Status:** Approved

---

## Background

Family Guy is a private family photo album app. Backend is Express/Node on Fly.io with PostgreSQL (Drizzle ORM) and Cloudflare R2 for photo storage. Mobile is Expo/React Native. Auth uses Apple/Google Sign-In with JWT. No real users yet (development stage).

A security audit identified 14 issues across four categories.

---

## Section 1: Authorization

### Issue 1 — Reactions endpoints bypass album membership check

**Severity:** Critical  
**Files:** `backend/src/routes/reactions.ts`

`GET/POST/DELETE /photos/:photoId/reactions` only call `requireAuth`. Any authenticated user who knows a `photoId` can view, add, or delete reactions on photos in any family's album.

**Fix:** In all three reaction handlers, after extracting `photoId`, join `photos` → `albumMembers` to verify `req.user.id` is a member of the photo's album. Return 403 if not.

```
// pseudocode
const membership = await db.select(...)
  .from(photos)
  .innerJoin(albumMembers, eq(albumMembers.albumId, photos.albumId))
  .where(and(eq(photos.id, photoId), eq(albumMembers.userId, userId)))
  .limit(1);
if (!membership[0]) return res.status(403).json({ error: 'Forbidden' });
```

---

### Issue 2 — r2_key not verified as belonging to the uploading user

**Severity:** Critical  
**Files:** `backend/src/routes/photos.ts`, `backend/src/services/r2.ts`, `backend/src/db/schema.ts`

`POST /photos` accepts a `r2_key` from the client body without verifying the key was issued to that user via the presign endpoint. A user who discovers another user's R2 key can register it as their own photo.

**Fix:** Add a `presign_tokens` table that records keys issued to each user. On presign, insert the key. On `POST /photos`, verify the provided `r2_key` exists in `presign_tokens` with `user_id = req.user.id`, then delete the entry. If not found, return 400. Table approach (vs column on `users`) is preferred to support concurrent multi-photo uploads.

Schema addition:
```sql
CREATE TABLE presign_tokens (
  key TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Drizzle migration required.

---

### Issue 3 — Role column exists but is never enforced

**Severity:** High  
**Files:** `backend/src/routes/albums.ts`, `backend/src/routes/milestones.ts`

`albumMembers.role` has values `admin/member` but no route checks it. Any member can rename the album or delete milestones — actions that should be admin-only.

**Fix:** Add helper `requireAlbumAdmin(albumId, userId)` that checks `role = 'admin'` in `albumMembers`. Apply to:
- `PATCH /albums/:id` — admin only
- `DELETE /milestones/:id` — admin only

`POST /milestones` and `PATCH /milestones/:id` remain member-accessible.

---

## Section 2: Input Validation

### Issue 4 — UUID params not validated on most routes

**Severity:** High  
**Files:** `backend/src/routes/members.ts`, `backend/src/routes/reactions.ts`, `backend/src/routes/timeline.ts`, `backend/src/routes/milestones.ts`

`photos.ts` has a `UUID_RE` regex but it is not applied consistently. Non-UUID strings passed as `:albumId` or `:photoId` cause ugly Postgres errors rather than clean 400 responses.

**Fix:** Extract `UUID_RE` and a `isValidUUID` helper into `backend/src/lib/validation.ts`. Apply at the top of every handler that receives a UUID param, returning 400 if invalid.

---

### Issue 5 — cover_photo_id in milestone PATCH not validated

**Severity:** Medium  
**Files:** `backend/src/routes/milestones.ts`

`PATCH /milestones/:id` accepts `cover_photo_id` but does not verify it belongs to the milestone's album. `PATCH /albums/:id` does this correctly (checks `photos.albumId`).

**Fix:** Before updating, query `photos` where `id = cover_photo_id AND album_id = milestone.albumId`. Return 400 if not found.

---

### Issue 6 — Invite params not validated

**Severity:** Medium  
**Files:** `backend/src/routes/invites.ts`

`expires_in_days` and `max_uses` are not validated. Sending `expires_in_days: 0` or `max_uses: -1` creates unusable invites silently.

**Fix:** If `expires_in_days` is provided, validate it is an integer ≥ 1. If `max_uses` is provided, validate it is an integer ≥ 1. Return 400 otherwise.

---

### Issue 7 — taken_at date not validated

**Severity:** Medium  
**Files:** `backend/src/routes/photos.ts`

`new Date("garbage")` creates an `Invalid Date` object. PostgreSQL will reject it but the error message is not user-friendly.

**Fix:** After parsing, check `isNaN(new Date(taken_at).getTime())` and return 400 with `taken_at must be a valid ISO date`.

---

## Section 3: API Hardening

### Issue 8 — No Helmet security headers

**Severity:** Medium  
**Files:** `backend/src/app.ts`

No HTTP security headers are set (HSTS, X-Content-Type-Options, X-Frame-Options, etc.).

**Fix:** `npm install helmet`. Add `app.use(helmet())` before all routes in `app.ts`.

---

### Issue 9 — No rate limiting

**Severity:** Medium  
**Files:** `backend/src/app.ts`, route files

All routes are unthrottled. Auth endpoints can be hammered; presign can generate unlimited R2 URLs.

**Fix:** `npm install express-rate-limit`. Apply rate limiters:

| Route group | Limit | Window |
|---|---|---|
| `POST /auth/*` | 10 req | 1 min per IP |
| `POST /photos/presign` | 30 req | 1 min per authenticated user |
| `GET /invites/:token` | 5 req | 1 min per IP |
| All others | 100 req | 1 min per IP |

---

### Issue 10 — No request body size limit

**Severity:** Low  
**Files:** `backend/src/app.ts`

`express.json()` has no size limit, allowing arbitrarily large JSON bodies.

**Fix:** Change to `express.json({ limit: '100kb' })`.

---

### Issue 11 — Invite GET is unauthenticated

**Severity:** Low  
**Files:** `backend/src/routes/invites.ts`

`GET /invites/:token` returns album name without authentication. This is intentional for UX (deeplink landing before login), but combined with no rate limiting it enables token enumeration.

**Fix:** Rate limiting from Issue 9 mitigates this. No auth change needed — keep unauthenticated for deeplink UX. Response shape is already minimal (only `album_name`, `expires_at`).

---

### Issue 12 — JWT lifetime 30 days, no revocation

**Severity:** Medium  
**Files:** `backend/src/routes/auth.ts`

JWT expiry is 30 days with no logout/revocation mechanism. Compromised tokens remain valid for the full 30-day window.

**Fix (minimal, no Redis):**
1. Reduce JWT lifetime from `30d` to `7d`.
2. Add `POST /auth/logout` endpoint (requires auth) that sets `apnsToken = NULL` on the user record — this revokes push notifications and signals logout. JWT itself remains valid until expiry (full blacklisting deferred post-MVP).

---

## Section 4: Error Handling & CORS

### Issue 13 — Global error handler leaks internal messages

**Severity:** Medium  
**Files:** `backend/src/app.ts`

```ts
res.status(status).json({ error: err.message || 'Internal server error' });
```

Unhandled 5xx errors expose raw Postgres error messages, library stack details, etc.

**Fix:** Only forward `err.message` when `status < 500` (i.e., client errors that we explicitly set). For `status >= 500`, always return `'Internal server error'` and log the actual error server-side via `console.error`.

```ts
app.use((err: HttpError, _req, res, _next) => {
  const status = err.status || 500;
  const message = status < 500 ? (err.message || 'Error') : 'Internal server error';
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
});
```

---

### Issue 14 — No CORS configuration

**Severity:** Low  
**Files:** `backend/src/app.ts`

No explicit CORS policy. Safe for mobile-only now, but required before any web client is added.

**Fix:** `npm install cors @types/cors`. Add explicit CORS:
```ts
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
}));
```
Add `ALLOWED_ORIGINS` to fly.toml secrets.

---

## Dependencies to Add

```
helmet
express-rate-limit
cors
@types/cors
```

No new mobile dependencies.

---

## Database Migration

One new migration required for the `presign_tokens` table (Issue 2). Run `drizzle-kit generate` and `drizzle-kit migrate`.

---

## Testing

- Existing integration tests must still pass.
- Add tests for: 403 on reactions from non-member, 400 on invalid UUID params, 400 on invalid `taken_at`, rate limiting (mock `rateLimit`), 403 on non-admin PATCH album / DELETE milestone.
- New route `POST /auth/logout` needs a test.

---

## Out of Scope (Post-MVP)

- Full JWT blacklist / token rotation (requires Redis or DB token store)
- Persistent audit log
- Content-Type enforcement on R2 uploads (verify actual file type, not just trust client)
