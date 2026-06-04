# Cloudflare R2 Setup — Local Dev

**Date:** 2026-06-04  
**Scope:** Configure Cloudflare R2 for local development environment  
**Approach:** Dashboard-only (no CLI tools required)

## Context

The backend already has full R2 integration in place:
- `backend/src/services/r2.ts` — R2 client using `@aws-sdk/client-s3`
- Presigned URL upload flow (`POST /photos/presign`)
- Server-side thumbnail generation via `sharp`
- Schema tracks `r2Key` and `thumbnailKey` per photo

No code changes are needed. This setup only requires obtaining credentials and populating `.env`.

## Steps

### 1. Create Cloudflare Account & Enable R2

- Sign up at cloudflare.com (free)
- Navigate to **R2 Object Storage** in the sidebar
- Enable R2 (requires a credit card on file; free tier: 10 GB storage, 1M Class A ops/month)

### 2. Create Bucket

- Click **Create bucket**
- Name: `family-album` (matches `R2_BUCKET` default in `.env.example`)
- Location: Automatic
- Leave public access **off** — photos are served via presigned URLs, not public bucket URLs

### 3. Create R2 API Token

- From the R2 overview page, click **Manage R2 API Tokens** → **Create API Token**
- Token name: `family-guy-local` (or any label)
- Permissions: **Object Read & Write**
- Bucket scope: restrict to `family-album` only
- Save the generated **Access Key ID** and **Secret Access Key** immediately (shown once)

### 4. Get Account ID & Construct Endpoint

- Account ID is visible in the right sidebar of the Cloudflare Dashboard home
- R2 endpoint format: `https://<account-id>.r2.cloudflarestorage.com`

### 5. Populate `.env`

Copy `backend/.env.example` to `backend/.env` and fill in:

```env
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<from step 3>
R2_SECRET_ACCESS_KEY=<from step 3>
R2_BUCKET=family-album
R2_PUBLIC_URL=http://localhost:3000/photos
```

> `R2_PUBLIC_URL` is used to construct photo view URLs. For local dev, the placeholder above is sufficient — uploads and downloads work through the backend API regardless.

## Verification

After filling in `.env`, start the backend and attempt a photo upload from the mobile app (or via `curl` against `POST /photos/presign`). A successful presigned URL response confirms R2 connectivity.

## Free Tier Limits (for reference)

| Resource | Free allowance |
|----------|---------------|
| Storage | 10 GB/month |
| Class A ops (PUT, POST) | 1,000,000/month |
| Class B ops (GET) | 10,000,000/month |
| Egress | Free (no egress fees) |

Sufficient for local development and early testing.
