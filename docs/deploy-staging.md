# Runbook: deploy backend staging (VPS)

Mắt xích cuối để kênh A (Expo Go cho đội seed) chạy được. Một VPS 2GB RAM là đủ cho pilot Quận 7. Thứ tự các bước khớp với mục "Chuẩn bị chung" trong `distribution.md`.

## 1. Chuẩn bị VPS (1 lần)

```bash
# Ubuntu 22/24: cài Docker
curl -fsSL https://get.docker.com | sh

# DNS: trỏ A record staging-api.anthiet.vn → IP VPS (làm TRƯỚC khi up, Caddy cần để xin TLS)
```

## 2. Deploy

```bash
git clone <repo> && cd an-thiet
cp .env.staging.example .env
nano .env        # điền đủ: DOMAIN, 3 secret sinh ngẫu nhiên, 3 biến Firebase

docker compose -f docker-compose.prod.yml up -d --build

# Kiểm tra: tất cả container Up/healthy
docker compose -f docker-compose.prod.yml ps
curl -s https://$DOMAIN/health   # → {"ok":true,"db":true,...}
```

## 3. Sau khi container chạy — ĐỦ 3 BƯỚC, ĐÚNG THỨ TỰ

**Bước 3.1 — Schema.** Volume mới: `db/init.sql` đã tự chạy khi Postgres khởi tạo, bỏ qua. **Chỉ khi** tái dùng volume cũ (dựng từ bản trước khi có auth/analytics) mới chạy migrations:

```bash
docker exec -i anthiet-db psql -U anthiet anthiet < db/migrations/002_add_firebase_uid.sql
docker exec -i anthiet-db psql -U anthiet anthiet < db/migrations/003_events.sql
docker exec -i anthiet-db psql -U anthiet anthiet < db/migrations/004_threads_compliance.sql
```

**Bước 3.2 — Seed Quận 7:**

```bash
API=https://<DOMAIN> ADMIN_KEY=<ADMIN_KEY trong .env> ./seed/seed.sh
```

**Bước 3.3 — Reindex search (QUAN TRỌNG — quên bước này là search trả rỗng):**

```bash
curl -X POST https://<DOMAIN>/admin/search/reindex -H "x-admin-key: <ADMIN_KEY>"
# → {"indexed":5} (khớp số quán đã seed)
```

Lưu ý: `seed.sh` đã tự gọi reindex, nhưng nếu Typesense khởi động chậm hơn seed thì reindex trong seed fail im lặng (có ghi trong response `errors`) — bước 3.3 là chốt chặn. Xác nhận cuối: `curl "https://<DOMAIN>/search?q=bún"` phải ra kết quả.

## 4. Backup — bắt buộc trước khi đội seed bắt đầu

Volume `anthiet_pgdata` là persistent (sống qua `compose down`, chỉ mất khi `down -v` — đừng chạy lệnh đó). Nhưng persistent ≠ backup: VPS chết là dữ liệu check-in thật của pilot mất luôn, không dựng lại được.

```bash
# Backup thủ công (chạy được ngay, không cần dừng gì)
mkdir -p ~/backups
docker exec anthiet-db pg_dump -U anthiet anthiet | gzip > ~/backups/anthiet-$(date +%F-%H%M).sql.gz

# Tự động hằng đêm 2h + giữ 14 bản gần nhất: crontab -e, thêm dòng
0 2 * * * docker exec anthiet-db pg_dump -U anthiet anthiet | gzip > $HOME/backups/anthiet-$(date +\%F).sql.gz && ls -t $HOME/backups/*.gz | tail -n +15 | xargs -r rm

# Khôi phục (vd sang VPS mới, sau khi up db)
gunzip -c anthiet-<ngày>.sql.gz | docker exec -i anthiet-db psql -U anthiet anthiet
```

Nên định kỳ copy file backup ra khỏi VPS (`scp`/rclone về máy khác) — backup nằm cùng VPS với DB thì cháy chung.

Typesense KHÔNG cần backup — dựng lại toàn bộ từ Postgres bằng bước 3.3.

## 5. Cập nhật code sau này

```bash
cd an-thiet && git pull
docker compose -f docker-compose.prod.yml up -d --build api   # chỉ build lại API, DB không đụng
curl -s https://<DOMAIN>/health
```

Đổi schema kèm theo → chạy file migration mới tương ứng (bước 3.1) trước khi build API.

## 6. Checklist bàn giao cho đội seed

- [ ] `https://<DOMAIN>/health` → `{"ok":true,"db":true}`
- [ ] `GET /search?q=bún` có kết quả
- [ ] Đăng ký tài khoản thật qua app → có row mới trong `users` (`docker exec anthiet-db psql -U anthiet anthiet -c "select display_name, firebase_uid is not null as fb from users"`)
- [ ] `GET /admin/metrics` trả JSON hợp lệ
- [ ] Cron backup đã đặt, file backup đầu tiên tồn tại
- [ ] Cập nhật domain thật vào `mobile/eas.json` (profile preview, APP_API_BASE) trước khi `npm run update:preview`
