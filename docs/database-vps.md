# PostgreSQL trên VPS — lệnh thường dùng

Tham chiếu nhanh cho database production Daylog trên VPS (`/opt/daylog`).  
Deploy lần đầu và kiến trúc: xem [deploy-vps.md](./deploy-vps.md).

**Stack:** PostgreSQL 16 · Docker Compose · Drizzle migrations

---

## Mục lục

1. [Thông tin kết nối](#1-thông-tin-kết-nối)
2. [Kết nối từ máy local (TablePlus)](#2-kết-nối-từ-máy-local-tableplus)
3. [Kiểm tra & truy vấn](#3-kiểm-tra--truy-vấn)
4. [Migration](#4-migration)
5. [Backup & restore](#5-backup--restore)
6. [Reset schema](#6-reset-schema)
7. [Reset hoàn toàn (xóa volume)](#7-reset-hoàn-toàn-xóa-volume)
8. [Cron backup (tuỳ chọn)](#8-cron-backup-tuỳ-chọn)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Thông tin kết nối

| Field | Giá trị |
|-------|---------|
| User | `daylog` |
| Database | `daylog` |
| Port (trên VPS) | `5432` (chỉ `127.0.0.1`, không expose internet) |
| Password | `POSTGRES_PASSWORD` — GitHub Secret hoặc `.env` trên VPS |
| Volume data | `pgdata` (Docker volume, thường tên `daylog_pgdata`) |

`DATABASE_URL` trong container API:

```
postgres://daylog:<POSTGRES_PASSWORD>@postgres:5432/daylog
```

Hostname `postgres` là tên service trong `docker-compose.yml` (Docker internal network).

Lấy mật khẩu trên VPS:

```bash
ssh deploy@<IP_VPS>
cd /opt/daylog
grep POSTGRES_PASSWORD .env
```

---

## 2. Kết nối từ máy local (TablePlus)

Postgres **không** mở port ra internet. Dùng **SSH tunnel** trong TablePlus.

### Tab Connection

| Field | Giá trị |
|-------|---------|
| Host | `127.0.0.1` |
| Port | `5432` |
| User | `daylog` |
| Password | `POSTGRES_PASSWORD` |
| Database | `daylog` |

### Tab Over SSH

Bật **Use SSH tunnel**:

| Field | Giá trị |
|-------|---------|
| Server | IP VPS hoặc `api.getdaylog.com` |
| Port | `22` |
| User | `deploy` (hoặc user SSH của bạn) |
| Authentication | Private Key hoặc Password |

### SSH tunnel thủ công (nếu TablePlus SSH lỗi)

Giữ terminal mở:

```powershell
ssh -L 5433:127.0.0.1:5432 deploy@<IP_VPS> -i C:\path\to\your-key.pem
```

TablePlus: Host `127.0.0.1`, Port `5433`, tắt SSH trong app.

---

## 3. Kiểm tra & truy vấn

Mọi lệnh dưới đây chạy trên VPS sau `cd /opt/daylog`.

```bash
# Trạng thái container Postgres
docker compose ps postgres

# Logs
docker compose logs -f postgres

# Liệt kê bảng
docker compose exec postgres psql -U daylog -d daylog -c '\dt'

# Vào shell psql tương tác
docker compose exec postgres psql -U daylog -d daylog
```

Ví dụ truy vấn nhanh trong psql:

```sql
SELECT email, created_at FROM waitlist ORDER BY created_at DESC LIMIT 10;
SELECT COUNT(*) FROM users;
```

---

## 4. Migration

Chạy migration thủ công (giống bước deploy):

```bash
cd /opt/daylog
docker compose up -d postgres
docker compose --profile migrate run --rm migrate
```

Xem log khi migration fail:

```bash
docker compose logs migrate
```

> GitHub Actions tự chạy migration mỗi lần deploy. Migration **không** reset dữ liệu — chỉ áp schema mới.

---

## 5. Backup & restore

> **Mặc định không tự động.** Lệnh backup chỉ chạy khi bạn SSH vào VPS và gõ tay. GitHub Actions deploy **không** backup DB. Muốn chạy hàng ngày → cấu hình cron ở [mục 8](#8-cron-backup-tuỳ-chọn).

Chạy trên VPS (`ssh deploy@<IP_VPS>`), trong thư mục `/opt/daylog`.

### Backup thủ công

```bash
cd /opt/daylog
mkdir -p ~/backups
docker compose exec postgres pg_dump -U daylog daylog > ~/backups/backup_$(date +%F).sql
```

File lưu tại `~/backups/` (vd. `/home/deploy/backups/backup_2026-06-10.sql`).

Kiểm tra:

```bash
ls -lh ~/backups/backup_*.sql
```

### Restore

```bash
cd /opt/daylog
cat ~/backups/backup_2026-06-09.sql | docker compose exec -T postgres psql -U daylog daylog
```

---

## 6. Reset schema

Xóa sạch toàn bộ bảng/dữ liệu, giữ Docker volume `pgdata`, chạy lại migration từ đầu.

> **Cảnh báo:** Mọi users, albums, metadata ảnh, waitlist… sẽ bị xóa. Ảnh trên **Cloudflare R2 không tự xóa** — chỉ mất liên kết trong DB. Phải chạy thủ công trên VPS; deploy GitHub Actions **không** reset DB.

Backup trước (khuyến nghị):

```bash
cd /opt/daylog
docker compose exec postgres pg_dump -U daylog daylog > ~/backups/backup_$(date +%F).sql
```

Reset:

```bash
cd /opt/daylog

# Dừng API để không còn connection tới DB
docker compose stop api

# Xóa toàn bộ schema và tạo lại
docker compose exec postgres psql -U daylog -d daylog -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO daylog;"

# Chạy lại migration từ đầu
docker compose --profile migrate run --rm migrate

# Khởi động lại API
docker compose up -d api
```

Kiểm tra sau reset:

```bash
docker compose exec postgres psql -U daylog -d daylog -c '\dt'
curl -sf http://127.0.0.1:8080/health
```

---

## 7. Reset hoàn toàn (xóa volume)

Chỉ khi DB corrupt hoặc cần factory reset cả data files của Postgres.

```bash
cd /opt/daylog
docker compose down
docker volume ls | grep pgdata          # thường là daylog_pgdata
docker volume rm daylog_pgdata
docker compose up -d postgres
docker compose --profile migrate run --rm migrate
docker compose up -d api
```

---

## 8. Cron backup (tuỳ chọn)

Chỉ chạy tự động **sau khi** bạn cấu hình cron trên VPS — không có sẵn khi deploy.

```bash
ssh deploy@<IP_VPS>
mkdir -p ~/backups
crontab -e
```

Thêm dòng (3h sáng mỗi ngày, **giữ 7 bản gần nhất** ≈ 1 tuần):

```cron
0 3 * * * cd /opt/daylog && docker compose exec -T postgres pg_dump -U daylog daylog > /home/deploy/backups/daylog_$(date +\%F).sql && ls -t /home/deploy/backups/daylog_*.sql 2>/dev/null | tail -n +8 | xargs -r rm --
```

Phần sau `&&` xóa file cũ hơn 7 bản (sắp xếp theo thời gian sửa đổi).

Đổi số bản giữ lại: `tail -n +8` = giữ 7, `+4` = giữ 3, `+6` = giữ 5 (`+N` = giữ **N − 1** bản).

Kiểm tra cron đã cài:

```bash
crontab -l
```

---

## 9. Troubleshooting

| Triệu chứng | Nguyên nhân | Cách xử lý |
|-------------|-------------|------------|
| `Connection refused` (TablePlus) | Postgres chưa chạy hoặc thiếu SSH tunnel | `docker compose ps`; kiểm tra tab Over SSH |
| `password authentication failed` | Sai `POSTGRES_PASSWORD` | `grep POSTGRES_PASSWORD .env` trên VPS |
| Container `api` restart liên tục | Sai `DATABASE_URL` hoặc Postgres chưa ready | `docker compose logs api` |
| Migration fail | Schema conflict | `docker compose logs migrate`, fix migration rồi chạy lại |
| Reset xong app không login được | Users đã bị xóa | Bình thường — đăng ký/đăng nhập lại trên app |
