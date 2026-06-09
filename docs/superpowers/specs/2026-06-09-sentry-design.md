# Sentry Integration Design

**Date:** 2026-06-09
**Scope:** Mobile (Expo React Native) + Backend (Express.js on VPS)
**Goal:** End-to-end production tracing — link a failing mobile request to its backend span, with user identity, so bugs can be investigated by user, route, and DB query.

---

## Architecture

Two Sentry projects (one per platform), linked by distributed tracing:

```
Mobile (Expo RN)                    Backend (Express / VPS)
──────────────────                  ──────────────────────────
@sentry/react-native                @sentry/node

Sentry.init()                       Sentry.init()
  └─ Axios sends                      └─ reads sentry-trace header
     sentry-trace header  ──────────►    creates child span
     on every API call                   instruments pg queries

Sentry.setUser({ id })              Sentry.setUser({ id })  ← from JWT

screen nav breadcrumbs              auto: HTTP req/res spans
JS crash traces                     auto: pg query spans
unhandled promise rejections        unhandled rejections / 500s
```

**Environment variables:**
- Mobile: `SENTRY_DSN` — baked into the app at EAS build time via `app.json`
- Backend: `SENTRY_DSN` — set in `.env` / systemd on the VPS

---

## Mobile (`mobile/`)

### Installation
```bash
npx expo install @sentry/react-native
```
The Expo config plugin is added to `app.json` — it handles native wiring and source map uploads automatically at EAS build time.

### Init — `app/_layout.tsx`
`Sentry.init()` runs before the component tree renders. Key config:
- `dsn`: from `Constants.expoConfig.extra.sentryDsn`
- `tracesSampleRate: 0.2` — 20% of sessions traced
- `tracePropagationTargets`: matches the API base URL so Axios injects `sentry-trace` on every request
- `integrations`: `Sentry.reactNativeTracingIntegration()` for navigation + Axios breadcrumbs

### User identity
In the existing auth bootstrap in `_layout.tsx`, after a successful `/users/me` call:
```ts
Sentry.setUser({ id: user.id });
```
On 401 / logout:
```ts
Sentry.setUser(null);
```

---

## Backend (`backend/src/`)

### Installation
```bash
npm install @sentry/node
```

### Init — `index.ts` (top of file, before all other imports)
`Sentry.init()` must be the first thing to run so it can instrument `pg` and Express automatically.
- `dsn`: from `process.env.SENTRY_DSN`
- `tracesSampleRate: 0.2`
- pg query spans are **automatic** — no explicit integration needed, as long as `Sentry.init()` runs before `pg` is imported

### Express wiring — `app.ts`
`Sentry.setupExpressErrorHandler(app)` added after all routes, before the existing custom error handler. This captures all unhandled exceptions and 5xx responses.

The existing `console.error(err)` in the error handler stays unchanged.

### User identity middleware
A small middleware inserted after the auth middleware sets user context per request:
```ts
Sentry.setUser({ id: req.user.id });
```
Applied only to authenticated routes. Public routes (e.g. `/health`, `/auth/*`) are skipped.

### 4xx vs 5xx
4xx errors (`err.status < 500`) are intentional responses — not sent to Sentry. Only 5xx and unhandled exceptions are captured. This matches the existing error handler logic.

---

## Source Maps

**Mobile:** Handled automatically by the Expo Sentry config plugin at EAS build time. No manual step needed.

**Backend:** TypeScript compiles to `dist/`. A `sentry-cli` source map upload step runs after `tsc` in the VPS deploy script:
```bash
tsc && sentry-cli sourcemaps inject dist/ && sentry-cli sourcemaps upload dist/
```
Requires `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` set on the VPS.

---

## Sampling

| | Rate | Rationale |
|---|---|---|
| Errors (`sampleRate`) | 1.0 | Always capture all errors |
| Traces (`tracesSampleRate`) | 0.2 | 20% keeps well under free tier (10k traces/month) |

---

## Verification (removed after confirming)

**Backend:** Temporary `GET /debug-sentry` route that throws intentionally. Removed once a trace appears in the Sentry dashboard.

**Mobile:** Dev-only button that calls `Sentry.captureException(new Error('test'))`. Removed once confirmed.

---

## Files Changed

| File | Change |
|---|---|
| `mobile/app.json` | Add Sentry Expo plugin + `extra.sentryDsn` |
| `mobile/app/_layout.tsx` | `Sentry.init()` + `setUser` / `setUser(null)` |
| `backend/src/index.ts` | `Sentry.init()` at top (before other imports) |
| `backend/src/app.ts` | `setupExpressErrorHandler` + user identity middleware |
| `backend/src/routes/` | Temporary `/debug-sentry` route (removed post-verify) |
| `backend/.env.example` | Add `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` |
| `fly.toml` | **Deleted** (deploying on VPS) |

---

## Out of Scope

- Pino / structured request logging (future addition)
- Sentry performance dashboards / alerting rules (configure in Sentry UI after integration)
- Staging environment DSN (use the same project with `environment: 'staging'` tag if needed later)
