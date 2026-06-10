# Deploy Backend lên VPS (Docker + PostgreSQL + GitHub Actions)

Hướng dẫn deploy backend Daylog lên VPS, cài PostgreSQL trên cùng máy, và auto-deploy khi merge vào `main`.

**Stack:** Node 20 · Express · PostgreSQL 16 · Drizzle · Docker Compose · Nginx · GitHub Actions

**Env:** Lưu trên GitHub (Variables + Secrets) → workflow tự ghi file `.env` trên VPS mỗi lần deploy.

**Domain production (`getdaylog.com`):**

| Subdomain | URL |
|-----------|-----|
| API (VPS + Nginx) | `https://api.getdaylog.com` |
| Web landing | `https://getdaylog.com` |
| CDN R2 | `https://cdn.getdaylog.com` |

> Không dùng `daylog.app` hay placeholder khác — domain thật là **`getdaylog.com`**.

---

## Mục lục

1. [Kiến trúc](#1-kiến-trúc)
2. [Yêu cầu VPS](#2-yêu-cầu-vps)
3. [Setup VPS lần đầu](#3-setup-vps-lần-đầu)
4. [Clone repo trên VPS](#4-clone-repo-trên-vps)
5. [Cấu hình GitHub Variables & Secrets](#5-cấu-hình-github-variables--secrets)
   - [5.5 Cloudflare R2 & `cdn.getdaylog.com`](#55-cấu-hình-cloudflare-r2--cdngetdaylogcom)
6. [Tạo SSH key cho GitHub Actions](#6-tạo-ssh-key-cho-github-actions)
7. [Thêm GitHub Actions workflow](#7-thêm-github-actions-workflow)
8. [Cấu hình Nginx + SSL](#8-cấu-hình-nginx--ssl)
9. [Deploy lần đầu (manual)](#9-deploy-lần-đầu-manual)
10. [Auto-deploy khi merge main](#10-auto-deploy-khi-merge-main)
11. [Cập nhật Mobile / Web](#11-cập-nhật-mobile--web)
12. [Bảo trì](#12-bảo-trì)
13. [Troubleshooting](#13-troubleshooting)

**Database:** [database-vps.md](./database-vps.md) — TablePlus, backup, reset schema, migration.

---

## 1. Kiến trúc

```
Merge PR → main
    ↓
GitHub Actions (deploy-backend.yml)
    ↓ SSH
VPS /opt/daylog
    ├── docker-compose.yml
    ├── .env          ← sinh từ GitHub Variables/Secrets
    ├── postgres:16   ← DB trên VPS
    └── api (Node)    ← port 8080, chỉ localhost
         ↑
    Nginx + SSL (api.getdaylog.com)
         ↑
    Mobile App / Web

Cloudflare R2 (ảnh/media)
    └── cdn.getdaylog.com  ← R2_PUBLIC_URL, custom domain trên Cloudflare
```

**Serve ảnh hiện tại:** Mobile load qua API proxy (`/photos/:id/thumb`, `/photos/:id/full`).  
**CDN (`cdn.getdaylog.com`):** Lưu trữ file trên R2; `R2_PUBLIC_URL` dùng khi cần URL trực tiếp dạng `https://cdn.getdaylog.com/photos/<uuid>.webp`.

File `docker-compose.yml` ở root repo đã cấu hình sẵn 3 service:

| Service | Mô tả |
|---------|--------|
| `postgres` | PostgreSQL 16, data persist trong volume `pgdata` |
| `api` | Backend build từ `backend/Dockerfile`, port `8080` |
| `migrate` | Chạy `drizzle-kit migrate` (profile `migrate`, không chạy tự động) |

> **Lưu ý port 8080:** Trong `docker-compose.yml`, API bind `127.0.0.1:8080:8080` — chỉ truy cập được từ **trong VPS** (`curl http://127.0.0.1:8080/health`). Không mở `:8080` ra internet; client bên ngoài luôn gọi qua **Nginx** (`https://api.getdaylog.com`).

---

## 2. Yêu cầu VPS

| RAM | Khuyến nghị |
|-----|-------------|
| 1 GB | Chạy được MVP, **bắt buộc thêm swap 2 GB** và tune Postgres (xem mục 3) |
| 2 GB | Production nhỏ — **nên dùng** |
| 4 GB | Thoải mái khi traffic tăng |

**OS:** Ubuntu 22.04 hoặc 24.04  
**Domain:** `getdaylog.com` — cấu hình DNS (xem bảng dưới)

### DNS cho `getdaylog.com`

| Type | Name | Value | Dùng cho |
|------|------|-------|----------|
| A | `api` | IP VPS | Backend API (`api.getdaylog.com`) |
| A hoặc CNAME | `@` | IP VPS hoặc Vercel | Landing web (`getdaylog.com`) |
| CNAME | `www` | Vercel / IP web | Landing web (`www.getdaylog.com`) |
| CNAME | `cdn` | *(Cloudflare tự thêm)* | Ảnh/media R2 (`cdn.getdaylog.com`) — xem [mục 5.5](#55-cấu-hình-cloudflare-r2--cdngetdaylogcom) |

> Backend deploy trên VPS chỉ cần record **`api`** trỏ về IP VPS. Record **`cdn`** do Cloudflare tự tạo khi connect custom domain R2 (domain `getdaylog.com` phải dùng Cloudflare DNS).

---

## 3. Setup VPS lần đầu

SSH vào VPS với quyền root:

```bash
ssh root@YOUR_VPS_IP
```

### 3.1 Cập nhật hệ thống & cài package

```bash
apt update && apt upgrade -y
apt install -y git nginx certbot python3-certbot-nginx ufw
```

### 3.2 Cài Docker

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable docker
```

### 3.3 Thêm swap (bắt buộc nếu VPS 1 GB RAM)

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### 3.4 Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

### 3.5 Tạo user deploy

```bash
adduser deploy
usermod -aG docker deploy
```

### 3.6 Tạo thư mục app

```bash
mkdir -p /opt/daylog
chown deploy:deploy /opt/daylog
```

---

## 4. Clone repo trên VPS

Đăng nhập bằng user `deploy`:

```bash
su - deploy
cd /opt/daylog
git clone https://github.com/YOUR_USER/daylog.git .
```

> **Lưu ý:** File `.env` **không** cần tạo thủ công trên VPS — GitHub Actions sẽ ghi mỗi lần deploy.  
> Lần deploy đầu tiên vẫn cần workflow đã được merge vào `main`, hoặc tạo `.env` tạm thủ công (xem mục 9).

---

## 5. Cấu hình GitHub Variables & Secrets

Vào repo GitHub → **Settings → Secrets and variables → Actions**.

GitHub có 2 loại:

| Loại | Dùng cho | Truy cập trong workflow |
|------|----------|-------------------------|
| **Variables** | Config không nhạy cảm (URL, tên bucket, version…) | `${{ vars.TEN_BIEN }}` |
| **Secrets** | Mật khẩu, API key, JWT, private key… | `${{ secrets.TEN_BIEN }}` |

> Variables **không được mã hóa** và có thể đọc bởi admin repo. Mọi giá trị nhạy cảm phải để trong **Secrets**.

### 5.1 Tạo Environment `production` (khuyến nghị)

**Settings → Environments → New environment → `production`**

Thêm Variables và Secrets vào environment `production` thay vì repo-level — dễ quản lý và bật protection rule sau này.

### 5.2 Bảng biến cần khai báo

#### Repository / Environment **Variables** (`vars`)

| Variable | Ví dụ | Mô tả |
|----------|-------|-------|
| `NODE_ENV` | `production` | Môi trường Node |
| `PORT` | `8080` | Port API trong container |
| `ALLOWED_ORIGINS` | `https://getdaylog.com,https://www.getdaylog.com` | CORS, phân cách bằng dấu phẩy |
| `R2_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` | Cloudflare R2 |
| `R2_BUCKET` | `family-album` | Tên bucket R2 |
| `R2_PUBLIC_URL` | `https://cdn.getdaylog.com` | Base URL CDN — ghép `${R2_PUBLIC_URL}/${r2Key}` (xem [5.5](#55-cấu-hình-cloudflare-r2--cdngetdaylogcom)) |
| `APPLE_CLIENT_ID` | `com.yourcompany.daylog` | Apple Sign In |
| `GOOGLE_CLIENT_ID` | `xxx.apps.googleusercontent.com` | Google Sign In |
| `APNS_KEY_ID` | `ABC123` | APNs key ID |
| `APNS_TEAM_ID` | `TEAM123` | Apple Team ID |
| `APNS_BUNDLE_ID` | `com.yourcompany.daylog` | iOS bundle ID |
| `SENTRY_ORG` | `your-org` | Sentry org slug |
| `SENTRY_PROJECT` | `daylog-backend` | Sentry project slug |
| `MIN_APP_VERSION` | `1.0.0` | Force-update gate |
| `LATEST_APP_VERSION` | `1.0.0` | Version mới nhất |
| `VPS_HOST` | `123.456.789.0` | IP hoặc domain VPS |
| `VPS_USER` | `deploy` | SSH user trên VPS |
| `VPS_PORT` | `22` | SSH port |
| `API_DOMAIN` | `api.getdaylog.com` | Domain API (dùng cho doc/checklist) |

#### Repository / Environment **Secrets** (`secrets`)

| Secret | Mô tả |
|--------|-------|
| `POSTGRES_PASSWORD` | Mật khẩu PostgreSQL (tự đặt, mạnh) |
| `JWT_SECRET` | Secret ký JWT (random string dài) |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |
| `APNS_KEY` | Apple push private key (giữ nguyên `\n` cho newline) |
| `SENTRY_DSN` | Sentry DSN backend |
| `SENTRY_AUTH_TOKEN` | Token upload source maps (tuỳ chọn) |
| `VPS_SSH_KEY` | Private key SSH (mục 6) |

### 5.3 Cách `DATABASE_URL` được build

Workflow tự ghép từ secret password — **không cần** khai báo `DATABASE_URL` riêng:

```
postgres://daylog:<POSTGRES_PASSWORD>@postgres:5432/daylog
```

Hostname `postgres` là tên service trong `docker-compose.yml` (Docker internal network).

### 5.4 Đổi env sau này

1. Sửa Variable/Secret trên GitHub  
2. Re-run workflow **Deploy Backend to VPS** (Actions tab → Run workflow)  
   hoặc push một commit nhỏ vào `backend/**` trên `main`

Workflow sẽ ghi đè file `/opt/daylog/.env` trên VPS.

### 5.5 Cấu hình Cloudflare R2 & `cdn.getdaylog.com`

Ảnh/video Daylog lưu trên **Cloudflare R2** (không nằm trên VPS). VPS chỉ chạy API + Postgres.

| Thành phần | Giá trị production |
|------------|-------------------|
| Bucket | `family-album` (khớp `R2_BUCKET`) |
| CDN domain | `https://cdn.getdaylog.com` |
| `R2_PUBLIC_URL` | `https://cdn.getdaylog.com` *(không có slash cuối)* |

**URL file sau khi upload:**

```
https://cdn.getdaylog.com/photos/<uuid>.webp
https://cdn.getdaylog.com/thumbnails/<uuid>.webp
```

> Mobile hiện load ảnh qua `https://api.getdaylog.com/photos/:id/thumb` (API proxy từ R2).  
> Setup CDN vẫn cần cho upload (presigned URL) và để sẵn `R2_PUBLIC_URL` khi chuyển serve trực tiếp từ CDN.

#### Bước 1 — Domain trên Cloudflare

`getdaylog.com` phải dùng **Cloudflare DNS** (nameserver Cloudflare).  
Nếu mua ở registrar khác → đổi NS về Cloudflare trước.

#### Bước 2 — Tạo bucket R2

1. [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2 Object Storage**
2. **Create bucket** → tên: `family-album`
3. Location: **Automatic**

#### Bước 3 — Tạo API token (upload/delete từ backend)

1. R2 → **Manage R2 API Tokens** → **Create API Token**
2. Permissions: **Object Read & Write**
3. Bucket scope: chỉ `family-album`
4. Lưu ngay **Access Key ID** + **Secret Access Key** (chỉ hiện 1 lần)

Ghi vào GitHub Secrets:

| Secret | Giá trị |
|--------|---------|
| `R2_ACCESS_KEY_ID` | Access Key ID |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key |

Lấy **Account ID** (sidebar dashboard) → GitHub Variable:

```
R2_ENDPOINT = https://<account-id>.r2.cloudflarestorage.com
R2_BUCKET   = family-album
```

#### Bước 4 — Gắn custom domain `cdn.getdaylog.com`

1. Vào bucket `family-album` → **Settings**
2. **Custom Domains** → **Connect Domain**
3. Nhập: `cdn.getdaylog.com`
4. Cloudflare tự thêm DNS record (CNAME) — **không** cần tạo record `cdn` thủ công

Đợi vài phút đến khi status **Active**.

#### Bước 5 — Bật public access cho bucket

Custom domain R2 phục vụ file **public read**. Cần bật:

1. Bucket `family-album` → **Settings**
2. **Public access** → **Allow Access** (hoặc **Enable**)
3. Xác nhận policy cho phép đọc object qua custom domain

> **Bảo mật:** Object key dạng UUID (`photos/<uuid>.webp`) khó đoán nhưng **không phải auth**. Ai có đúng URL vẫn xem được. Hiện app dùng API proxy có kiểm tra quyền album — an toàn hơn CDN public. Khi chuyển mobile sang CDN trực tiếp, cân nhắc signed URL hoặc giữ proxy.

#### Bước 6 — Set `R2_PUBLIC_URL` trên GitHub

Environment `production` → **Variables**:

```
R2_PUBLIC_URL = https://cdn.getdaylog.com
```

Re-run workflow deploy để ghi vào `.env` trên VPS.

> **Note — Bước 6 hoạt động như thế nào?**
>
> `R2_PUBLIC_URL` **không** cấu hình CDN trên Cloudflare — việc đó đã xong ở bước 4–5. Bước 6 chỉ **báo cho backend biết** base URL public của file trên R2.
>
> **Luồng dữ liệu:**
>
> ```
> GitHub Variable  R2_PUBLIC_URL=https://cdn.getdaylog.com
>        ↓  (mỗi lần deploy)
> GitHub Actions   ghi dòng R2_PUBLIC_URL=... vào /opt/daylog/.env trên VPS
>        ↓
> docker compose   service api đọc env_file: .env
>        ↓
> Backend process  process.env.R2_PUBLIC_URL có sẵn khi chạy
> ```
>
> **Backend dùng biến này để làm gì?**  
> Khi cần URL xem file trực tiếp (không qua API proxy), ghép:
>
> ```
> ${R2_PUBLIC_URL}/${r2Key}
> → https://cdn.getdaylog.com/photos/abc-123.webp
> ```
>
> Trong đó `r2Key` là path object lưu trên R2 (cột `r2_key` / `thumbnail_key` trong DB), ví dụ `photos/<uuid>.webp`.
>
> **Phân vai các biến R2:**
>
> | Biến | Ai dùng | Mục đích |
> |------|---------|----------|
> | `R2_ENDPOINT` + keys + `R2_BUCKET` | Backend (S3 SDK) | Upload / download / xóa file **nội bộ** qua API R2 |
> | `R2_PUBLIC_URL` | Backend (trả URL cho client) | URL **public** để browser/app mở trực tiếp qua CDN |
> | `cdn.getdaylog.com` (bước 4–5) | Cloudflare | Map domain → bucket, serve file qua CDN |
>
> **App hiện tại:** Mobile vẫn load ảnh qua `api.getdaylog.com/photos/:id/thumb` — backend đọc R2 rồi stream về (có kiểm tra quyền). `R2_PUBLIC_URL` đã set sẵn trên VPS để dùng sau khi refactor trả CDN URL, hoặc cho tính năng cần link public.
>
> **Tại sao phải re-run workflow?**  
> `.env` trên VPS **không** tự sync với GitHub. Sửa Variable trên GitHub → chạy lại workflow **Deploy Backend to VPS** (Actions → Run workflow) để ghi đè `.env`. Không cần SSH vào VPS sửa tay.

#### Bước 7 — Verify

Upload thử 1 file lên bucket (Dashboard → bucket → Upload, key ví dụ `photos/test.webp`):

```bash
curl -I https://cdn.getdaylog.com/photos/test.webp
# Kỳ vọng: HTTP/2 200

curl -I https://cdn.getdaylog.com/photos/khong-ton-tai.webp
# Kỳ vọng: 404
```

Verify backend kết nối R2 (presigned upload):

```bash
curl -s https://api.getdaylog.com/health
# Sau khi login app, thử upload ảnh — presign endpoint trả URL R2 hợp lệ
```

#### Tóm tắt biến R2 trên GitHub

| Biến | Loại | Ví dụ |
|------|------|-------|
| `R2_ENDPOINT` | Variable | `https://abc123.r2.cloudflarestorage.com` |
| `R2_BUCKET` | Variable | `family-album` |
| `R2_PUBLIC_URL` | Variable | `https://cdn.getdaylog.com` |
| `R2_ACCESS_KEY_ID` | Secret | *(từ API token)* |
| `R2_SECRET_ACCESS_KEY` | Secret | *(từ API token)* |

#### Free tier R2 (tham khảo)

| Resource | Free/tháng |
|----------|------------|
| Storage | 10 GB |
| Class A (PUT…) | 1M ops |
| Class B (GET…) | 10M ops |
| Egress | **Free** (qua Cloudflare CDN) |

---

## 6. Tạo SSH key cho GitHub Actions

Chạy trên **máy local** (không phải VPS):

```bash
ssh-keygen -t ed25519 -C "github-actions-daylog" -f ~/.ssh/daylog_deploy -N ""
```

- `daylog_deploy` → private key → paste vào GitHub Secret `VPS_SSH_KEY`
- `daylog_deploy.pub` → public key → thêm vào VPS

Trên **VPS** (user `deploy`):

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
# Paste nội dung file daylog_deploy.pub, lưu lại

chmod 600 ~/.ssh/authorized_keys
```

Test từ local:

```bash
ssh -i ~/.ssh/daylog_deploy deploy@YOUR_VPS_IP
```

---

## 7. Thêm GitHub Actions workflow

Tạo file `.github/workflows/deploy-backend.yml`:

```yaml
name: Deploy Backend to VPS

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - 'docker-compose.yml'
      - '.github/workflows/deploy-backend.yml'
  workflow_dispatch: # cho phép chạy tay từ Actions tab

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production

    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ vars.VPS_HOST }}
          username: ${{ vars.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ vars.VPS_PORT || 22 }}
          script: |
            set -e
            cd /opt/daylog

            echo "==> Pull latest code"
            git fetch origin main
            git reset --hard origin/main

            echo "==> Write .env from GitHub Variables/Secrets"
            cat > .env << 'ENVEOF'
            NODE_ENV=${{ vars.NODE_ENV }}
            PORT=${{ vars.PORT }}

            POSTGRES_PASSWORD=${{ secrets.POSTGRES_PASSWORD }}
            DATABASE_URL=postgres://daylog:${{ secrets.POSTGRES_PASSWORD }}@postgres:5432/daylog

            JWT_SECRET=${{ secrets.JWT_SECRET }}

            ALLOWED_ORIGINS=${{ vars.ALLOWED_ORIGINS }}

            R2_ENDPOINT=${{ vars.R2_ENDPOINT }}
            R2_ACCESS_KEY_ID=${{ secrets.R2_ACCESS_KEY_ID }}
            R2_SECRET_ACCESS_KEY=${{ secrets.R2_SECRET_ACCESS_KEY }}
            R2_BUCKET=${{ vars.R2_BUCKET }}
            R2_PUBLIC_URL=${{ vars.R2_PUBLIC_URL }}

            APPLE_CLIENT_ID=${{ vars.APPLE_CLIENT_ID }}
            GOOGLE_CLIENT_ID=${{ vars.GOOGLE_CLIENT_ID }}

            APNS_KEY=${{ secrets.APNS_KEY }}
            APNS_KEY_ID=${{ vars.APNS_KEY_ID }}
            APNS_TEAM_ID=${{ vars.APNS_TEAM_ID }}
            APNS_BUNDLE_ID=${{ vars.APNS_BUNDLE_ID }}

            SENTRY_DSN=${{ secrets.SENTRY_DSN }}
            SENTRY_AUTH_TOKEN=${{ secrets.SENTRY_AUTH_TOKEN }}
            SENTRY_ORG=${{ vars.SENTRY_ORG }}
            SENTRY_PROJECT=${{ vars.SENTRY_PROJECT }}

            MIN_APP_VERSION=${{ vars.MIN_APP_VERSION }}
            LATEST_APP_VERSION=${{ vars.LATEST_APP_VERSION }}
            ENVEOF

            chmod 600 .env

            echo "==> Start Postgres"
            docker compose up -d postgres

            echo "==> Run migrations"
            docker compose --profile migrate run --rm migrate

            echo "==> Build & start API"
            docker compose build api
            docker compose up -d --wait --wait-timeout 120 api

            echo "==> Health check"
            for i in $(seq 1 30); do
              if curl -sf http://127.0.0.1:8080/health >/dev/null; then
                echo " Health OK"
                break
              fi
              if [ "$i" -eq 30 ]; then
                echo "Health check failed after 60s"
                docker compose ps
                docker compose logs api --tail 80
                exit 1
              fi
              echo "  waiting for API... ($i/30)"
              sleep 2
            done

            echo "==> Cleanup"
            docker image prune -f

            echo "==> Done: $(git rev-parse --short HEAD)"
```

Commit và merge file này vào `main`.

### 7.1 Tune Postgres cho VPS 1 GB (tuỳ chọn)

Thêm vào service `postgres` trong `docker-compose.yml`:

```yaml
postgres:
  command: >
    postgres
    -c shared_buffers=64MB
    -c effective_cache_size=128MB
    -c maintenance_work_mem=32MB
    -c work_mem=4MB
```

### 7.2 Giới hạn RAM container API (tuỳ chọn, VPS 1 GB)

```yaml
api:
  deploy:
    resources:
      limits:
        memory: 384M
```

---

## 8. Cấu hình Nginx + SSL

**Domain API:** `api.getdaylog.com` — dùng đúng trong `server_name` và certbot (không phải `api.daylog.app`).

### 8.1 DNS & Cloudflare (trước khi cấu hình Nginx)

Record **`api`** trên Cloudflare:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `api` | IP VPS (`103.x.x.x`) | Proxied (đám mây cam) |

**SSL/TLS → Overview** trên Cloudflare:

| Giai đoạn | Mode khuyến nghị |
|-----------|------------------|
| Chưa chạy certbot (test tạm) | **Flexible** — Cloudflare → origin qua HTTP :80 |
| Sau `certbot --nginx` | **Full (strict)** — Cloudflare → origin qua HTTPS :443 |

> Nếu Cloudflare để **Full / Full (strict)** mà VPS **chưa có SSL** (chưa certbot), truy cập `https://api.getdaylog.com` sẽ báo lỗi **521** (Cloudflare không kết nối được origin trên :443).

Chạy trên VPS (root hoặc sudo):

```bash
nano /etc/nginx/sites-available/daylog-api
```

Nội dung:

```nginx
server {
    listen 80;
    server_name api.getdaylog.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }
}
```

Enable site, **tắt default site**, và lấy SSL:

```bash
ln -sf /etc/nginx/sites-available/daylog-api /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default   # bắt buộc — nếu giữ default, request qua IP hoặc Host không khớp → 404
nginx -t
systemctl reload nginx
```

Kiểm tra Nginx đã proxy đúng **trước** khi chạy certbot:

```bash
# API trực tiếp (Docker)
curl http://127.0.0.1:8080/health
# → {"ok":true}

# Qua Nginx — giả lập Host header của domain
curl -H "Host: api.getdaylog.com" http://127.0.0.1/health
# → {"ok":true}
```

> `curl http://<IP_VPS>/health` có thể vẫn **404** — đúng như thiết kế vì `server_name` chỉ nhận `api.getdaylog.com`. Luôn test bằng domain hoặc lệnh `-H "Host: ..."` ở trên.

Lấy SSL (Let's Encrypt):

```bash
certbot --nginx -d api.getdaylog.com
```

Certbot tự redirect HTTP → HTTPS và mở listener :443.

Sau certbot, đổi Cloudflare SSL mode sang **Full (strict)**, rồi verify:

```bash
# Từ máy local
curl https://api.getdaylog.com/health

# Kiểm tra auto-renew trên VPS
sudo certbot renew --dry-run
```

### Sửa nếu đã cấu hình nhầm `api.daylog.app`

```bash
sudo sed -i 's/api\.daylog\.app/api.getdaylog.com/g' /etc/nginx/sites-available/daylog-api
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.getdaylog.com
```

---

## 9. Deploy lần đầu (manual)

Thứ tự thực hiện lần đầu:

```
[ ] VPS setup (mục 3)
[ ] Clone repo vào /opt/daylog (mục 4)
[ ] Cloudflare R2 + cdn.getdaylog.com (mục 5.5)
[ ] Khai báo GitHub Variables + Secrets (mục 5)
[ ] Tạo SSH key (mục 6)
[ ] Merge deploy-backend.yml vào main (mục 7)
[ ] Cấu hình Nginx + SSL (mục 8)
[ ] Chạy workflow (Actions → Deploy Backend to VPS → Run workflow)
[ ] Verify health check
```

### Verify

```bash
# Trên VPS — API (Docker, chỉ localhost)
curl http://127.0.0.1:8080/health
# → {"ok":true}

# Trên VPS — qua Nginx
curl -H "Host: api.getdaylog.com" http://127.0.0.1/health
# → {"ok":true}

# Từ bên ngoài — luôn dùng domain, không dùng IP:8080
curl https://api.getdaylog.com/health
curl https://api.getdaylog.com/version
```

| Lệnh test | Kết quả mong đợi |
|-----------|------------------|
| `curl http://127.0.0.1:8080/health` (trên VPS) | `{"ok":true}` |
| `curl http://<IP>:8080/health` (từ ngoài) | Connection refused — **bình thường** |
| `curl http://<IP>/health` (từ ngoài) | 404 — **bình thường** nếu chưa xóa default hoặc gọi bằng IP thay vì domain |
| `curl https://api.getdaylog.com/health` | `{"ok":true}` |

```bash
# Xem logs
cd /opt/daylog
docker compose logs -f api
docker compose logs postgres
```

Kiểm tra DB: xem [database-vps.md](./database-vps.md).

### Deploy thủ công trên VPS (khi cần debug)

```bash
cd /opt/daylog
git pull origin main
docker compose up -d postgres
docker compose --profile migrate run --rm migrate
docker compose build api
docker compose up -d api
```

---

## 10. Auto-deploy khi merge main

Sau khi setup xong, mọi push vào `main` có thay đổi trong:

- `backend/**`
- `docker-compose.yml`
- `.github/workflows/deploy-backend.yml`

→ GitHub Actions tự:

1. SSH vào VPS  
2. `git reset --hard origin/main`  
3. Ghi `.env` từ Variables/Secrets  
4. Chạy migration  
5. Build & restart API  
6. Health check nội bộ  

**Đổi env:** sửa Variable/Secret trên GitHub → **Run workflow** (workflow_dispatch) — không cần commit code.

---

## 11. Cập nhật Mobile / Web

### Mobile (Expo)

Set biến production trong EAS:

```bash
cd mobile
eas secret:create --name EXPO_PUBLIC_API_URL --value https://api.getdaylog.com --scope project
```

Hoặc trong `eas.json` / `.env.production`:

```
EXPO_PUBLIC_API_URL=https://api.getdaylog.com
```

File tham chiếu: `mobile/src/constants/api.ts`

### Web (Vercel)

Thêm env trên Vercel dashboard nếu web gọi API trực tiếp.

---

## 12. Bảo trì

Backup, restore, reset schema, TablePlus, migration: **[database-vps.md](./database-vps.md)**.

### Xem tài nguyên

```bash
free -h
docker stats
df -h
```

### Update hệ điều hành

```bash
sudo apt update && sudo apt upgrade -y
sudo reboot   # nếu cần
# Docker containers tự restart nhờ restart: unless-stopped
```

---

## 13. Troubleshooting

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|-------------|------------------------|------------|
| Container `api` restart liên tục | Sai `DATABASE_URL` hoặc Postgres chưa ready | `docker compose logs api` |
| OOM / server treo | VPS 1 GB hết RAM | Thêm swap, tune Postgres, giới hạn RAM container |
| Migration fail | Schema conflict | [database-vps.md](./database-vps.md) — `docker compose logs migrate` |
| GitHub Actions exit **56** / health check fail | `curl` chạy ngay sau `up -d`, API chưa kịp listen | Workflow dùng `docker compose up -d --wait api` + retry; xem `docker compose logs api` |
| `502 Bad Gateway` | API không chạy | `docker compose ps`, `curl localhost:8080/health` |
| `curl <IP>:8080` → Connection refused | Port 8080 chỉ bind localhost | **Không sửa** — dùng `https://api.getdaylog.com`; hoặc đổi `docker-compose.yml` + mở UFW 8080 (không khuyến nghị production) |
| `curl <IP>/health` → 404 | Default Nginx site hoặc `server_name` không khớp IP | `rm -f /etc/nginx/sites-enabled/default`, enable `daylog-api`, test `curl -H "Host: api.getdaylog.com" http://127.0.0.1/health` |
| Cloudflare **521** | Origin không listen :443 (chưa SSL) hoặc sai IP DNS | Chạy `certbot --nginx -d api.getdaylog.com`; kiểm tra A record `api` → IP VPS; tạm **Flexible** nếu chưa certbot, sau đó **Full (strict)** |
| SSL lỗi | DNS chưa trỏ đúng | Kiểm tra A record, chạy lại `certbot` |
| SSH deploy fail | Sai key / user / firewall | Test `ssh -i key deploy@host`, mở port 22 |
| CORS error | Thiếu origin | Thêm domain vào `ALLOWED_ORIGINS` variable, re-run workflow |
| Auth Apple/Google fail | Sai client ID | Kiểm tra Variables `APPLE_CLIENT_ID`, `GOOGLE_CLIENT_ID` |
| Upload ảnh fail / presign lỗi | Sai R2 credentials hoặc bucket | Kiểm tra `R2_*` secrets/vars, test token trên Dashboard |
| `cdn.getdaylog.com` 403 | Chưa bật public access bucket | Bucket Settings → Allow public access (mục 5.5) |
| `cdn.getdaylog.com` DNS error | Custom domain chưa Active | R2 → bucket → Custom Domains, đợi DNS propagate |
| CDN 404 nhưng file có trên R2 | Sai object key | URL = `https://cdn.getdaylog.com/<key>` (vd. `photos/uuid.webp`) |

### Lệnh hữu ích

```bash
cd /opt/daylog

# Trạng thái containers
docker compose ps

# Restart API
docker compose restart api

# Rebuild from scratch
docker compose build --no-cache api
docker compose up -d api

# Xem .env (cẩn thận — có secrets)
cat .env
```

Database (psql, backup, reset): [database-vps.md](./database-vps.md).

---

## Checklist nhanh

- [ ] VPS 2 GB (hoặc 1 GB + swap 2 GB)
- [ ] Docker + Nginx + Certbot
- [ ] User `deploy` trong group `docker`
- [ ] Repo cloned tại `/opt/daylog`
- [ ] GitHub Environment `production` với đủ Variables + Secrets (mục 5)
- [ ] Cloudflare R2 bucket `family-album` + custom domain `cdn.getdaylog.com` (mục 5.5)
- [ ] `R2_PUBLIC_URL=https://cdn.getdaylog.com` trên GitHub Variables
- [ ] `curl -I https://cdn.getdaylog.com/photos/test.webp` → 200 (file test)
- [ ] SSH key: `VPS_SSH_KEY` secret + public key trên VPS
- [ ] `.github/workflows/deploy-backend.yml` merged vào `main`
- [ ] Nginx reverse proxy + HTTPS
- [ ] Đã xóa `/etc/nginx/sites-enabled/default`
- [ ] `certbot --nginx -d api.getdaylog.com` + `certbot renew --dry-run` OK
- [ ] Cloudflare: A record `api` → IP VPS (Proxied), SSL mode **Full (strict)**
- [ ] `curl https://api.getdaylog.com/health` → `{"ok":true}`
- [ ] Mobile `EXPO_PUBLIC_API_URL` trỏ đúng domain API
