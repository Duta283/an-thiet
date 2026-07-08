# Ăn Thiệt — tìm quán ăn thật

Monorepo Sprint 0, bám theo *Định hướng kỹ thuật & Lộ trình phát triển* (PO, 03/07/2026).

Khác biệt hoá của sản phẩm: **lớp tìm kiếm có cấu trúc trên nội dung xác thực** — không điểm sao, không quảng cáo trả phí, xếp hạng theo độ tin cậy.

## Cấu trúc

```
an-thiet/
├── docker-compose.yml        # Local dev: PostGIS + Typesense
├── docker-compose.prod.yml   # Staging/prod VPS: + API container + Caddy TLS
├── Caddyfile                 # Reverse proxy + TLS tự động
├── .env.staging.example      # Secrets staging (copy → .env trên VPS, không commit)
├── db/init.sql               # Schema v1 — 6 entity (mục 2.1) + events
├── backend/             # NestJS API (unit test: npm test)
├── mobile/              # App React Native (Expo) — search, bản đồ Goong, check-in
├── seed/                # Seed tool: dữ liệu pilot Quận 7 + script nạp
└── docs/                # Data model, quyết định kỹ thuật, quy trình phát hành
```

## Chạy local

```bash
# 1. Hạ tầng (Postgres/PostGIS + Typesense)
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env
npm install
npm run start:dev

# 3. Seed dữ liệu Quận 7 (terminal khác, từ thư mục gốc)
ADMIN_KEY=change_me_admin_key ./seed/seed.sh

# 4. Mobile app (Expo)
cd mobile
npm install
# Sửa src/config.ts: API_BASE (IP máy dev), GOONG_MAPTILES_KEY, DEV_USER_ID (uuid từ seed)
npm start   # quét QR bằng Expo Go
```

## Test

```bash
cd backend && npm test   # 34 test: verification + auth guard + analytics
```

## Analytics pilot (chỉ số mục 8 concept gốc)

Event log thẳng vào Postgres (bảng `events`) — đủ cho quy mô pilot Quận 7, không thêm dịch vụ ngoài, và tính được mọi chỉ số bằng SQL. DB đang chạy schema cũ: chạy `db/migrations/003_events.sql`.

| Event | Nguồn track | Lý do |
|---|---|---|
| `search` | server (SearchController) | server-truth, không rớt event do client |
| `checkin_completed` (+isVerified) | server (VerificationService) | như trên |
| `follow` | server (SocialService) | như trên |
| `app_session_start` | mobile (batch 10s, retry khi offline) | chỉ client biết phiên mở app; phiên mới sau 30 phút background |

Dashboard: `GET /admin/metrics` (x-admin-key) → DAU/WAU, searches/checkins/follows 7 ngày, % nội dung verified, follows trung bình/user, retention D7 (bản xấp xỉ v0 — cohort chuẩn hoá lại khi có đủ dữ liệu). Session ẩn danh trước đăng nhập vẫn được ghi qua `x-anon-id`.

## Auth (Sprint 4 — đã chuyển sang Firebase Auth)

Backend chạy 2 chế độ qua env `AUTH_MODE`:

| Mode | Cơ chế | Dùng khi |
|---|---|---|
| `dev` (mặc định) | header `x-user-id` | local / demo nội bộ, KHÔNG bao giờ bật với traffic thật |
| `firebase` | `Authorization: Bearer <Firebase ID token>` | staging / production |

Bật auth thật:

1. Tạo project Firebase, bật Email/Password trong Authentication.
2. Backend `.env`: `AUTH_MODE=firebase` + 3 biến service account (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`).
3. DB đang chạy schema cũ: chạy `db/migrations/002_add_firebase_uid.sql` (DB mới không cần — init.sql đã gồm).
4. Mobile `src/config.ts`: `AUTH_MODE = 'firebase'` + điền `FIREBASE_CONFIG` (web app config).

User mới được auto-provision ở backend ngay lần gọi API đầu (map qua `users.firebase_uid`) — không có endpoint đăng ký riêng. Controllers không đổi khi thêm phương thức đăng nhập mới (OTP điện thoại, Google) vì backend chỉ verify ID token.

## Thử nhanh API

```bash
# Search có cấu trúc: món + khu vực + giá + dịp
curl "localhost:3000/search?q=bún&area=quan-7&priceMax=80000"
curl "localhost:3000/search?occasion=an-khuya&lat=10.74&lng=106.72&radiusKm=5"

# Quán quanh vị trí (PostGIS)
curl "localhost:3000/restaurants?lat=10.7286&lng=106.7189&radius=3000"

# Chi tiết quán + nội dung (post tổng hợp hiển thị kèm nguồn + credit)
curl "localhost:3000/restaurants/<id>"
curl "localhost:3000/restaurants/<id>/contents"

# Check-in xác thực (GPS + EXIF) — dev auth bằng header x-user-id
curl -X POST localhost:3000/verifications/checkin \
  -H "content-type: application/json" -H "x-user-id: <uuid user>" \
  -d '{"restaurantId":"<id>","lat":10.7286,"lng":106.7189,"accuracy":12,
       "caption":"Ăn thiệt tại quán","exif":{"lat":10.7286,"lng":106.7190,"takenAt":"2026-07-03T12:00:00Z"}}'

# Trust score (breakdown diễn giải được)
curl "localhost:3000/users/<id>/trust"
```

## Staging (pilot Quận 7)

Backend: `https://an-thiet-production.up.railway.app` (Railway — runbook `docs/deploy-railway.md`). Mobile channel preview (`eas.json`) đã trỏ sẵn domain này. Đội seed: Expo Go + QR channel preview.

## Trạng thái theo roadmap (mục 5)

| Sprint | Hạng mục | Trạng thái |
|---|---|---|
| 0 | Schema DB v1, hạ tầng, chốt stack | ✅ repo này |
| 1-2 | Search cấu trúc + CRUD quán qua admin tool | ✅ API xong (map UI ở mobile) |
| 3 | Nội dung tổng hợp TikTok/Threads có trích dẫn | ✅ API + seed (chờ Spike 1 để nhúng oEmbed) |
| 4 | Auth, profile, Quán để dành | ✅ Firebase Auth (email/password) + auto-provision; giữ AUTH_MODE=dev cho local |
| 5 | Check-in GPS + EXIF, badge Verified | ✅ v0 (Play Integrity: TODO sau Spike 2) |
| 6 | Follow, trust score v0 | ✅ v0 |
| — | Mobile app React Native | ✅ v0 Expo: search + bản đồ Goong (WebView) + trang quán + check-in + profile |

## Việc cần làm trước khi build sâu (mục 6-7 tài liệu PO)

1. ~~Spike 1 — pháp lý TikTok/Threads~~ **ĐÃ CÓ KẾT LUẬN (03/07/2026) và ĐÃ TRIỂN KHAI:** TikTok oEmbed được phép nhúng (caption trích dẫn giữ trong DB). Threads CẤM lưu trữ nội dung → DB chỉ giữ `source_url` + credit (CHECK constraint `chk_threads_no_stored_content` + migration 004 xoá caption cũ), nội dung lấy tươi qua `GET /contents/:id/oembed` (cache in-memory TTL 24h). Threads oEmbed dùng endpoint tokenless `graph.threads.net/v1.0/oembed` — PO đã test thực tế trả 200, không cần Meta App/token.
2. **Spike 2 — chống giả GPS Android:** v0 đã có accuracy-radius + impossible-travel; trường `integrityToken` đã nhận sẵn, cần verify Play Integrity server-side.
3. OCR hoá đơn (QR) để giai đoạn 2 — endpoint placeholder trả 400 kèm giải thích.

## Changelog theo đánh giá Sprint 0 của PO (03/07/2026)

- ✅ Unit test `verification.service.spec.ts` — 15 test: haversine, ngưỡng accuracy/khoảng cách, impossible travel, EXIF, GPS-fail-EXIF-pass. Lưới an toàn khi chỉnh ngưỡng sau Spike 2.
- ✅ Filter giá chặn cả `price_max` (search Typesense + geo-query PostGIS) — quán trần giá cao không còn lọt filter giá thấp.
- ✅ App React Native (Expo) khởi động song song 2 spike đúng quyết định mục 4. Bản đồ Goong chạy qua WebView (goong-js) để demo được ngay trong Expo Go; chuyển @maplibre/maplibre-react-native khi polish — API không đổi.
- ✅ Khớp code với "06_Hướng dẫn Test Local qua Expo Go" (PO): seed trả về + in UUID user test (Bước 4→6); CheckinScreen thêm chụp ảnh trong luồng (expo-image-picker, exif:true, không cho chọn từ thư viện — đúng mục 4.1) gửi kèm EXIF geotag (Bước 8); `seed/README.md` lưu ý URL seed là placeholder — thay link post công khai thật để test oEmbed, và cách sửa toạ độ quán để test check-in pass.
- ✅ Tuân thủ Spike 1 (Threads): migration `004_threads_compliance.sql` (xoá caption Threads đã lưu + CHECK chặn tái phạm), seed tool ép caption=null với Threads (có unit test), endpoint oEmbed lúc hiển thị cho cả 2 nền tảng, mobile tự fetch khi caption null kèm fallback link-out. Test trên iPhone: kênh A (Expo Go) chạy iOS ngay, không cần Apple Developer.
- ✅ Backend staging deploy được 1 lệnh: `Dockerfile` multi-stage (non-root, healthcheck) + `docker-compose.prod.yml` (Caddy TLS tự động, volume Postgres persistent, secrets chỉ qua `.env` trên VPS) + endpoint `/health` + runbook `docs/deploy-staging.md` gồm init/migrations → seed → reindex đúng thứ tự và hướng dẫn backup pg_dump (cron + khôi phục).
- ✅ Distribution sẵn sàng: `eas.json` (channel preview/production), `app.config.ts` (API_BASE/AUTH_MODE/Goong key theo env build, OTA qua EAS Update) — quy trình 2 kênh song song trong `docs/distribution.md`: Expo Go/EAS Update cho đội seed ngay tuần này, TestFlight/Play internal nộp song song.
- ✅ Event tracking trước pilot (yêu cầu PO 03/07): bảng `events` + track server-side search/checkin/follow, mobile gửi app_session_start, `GET /admin/metrics` cho chỉ số mục 8 — đóng khoảng trống "launch xong mới gắn tracking thì mất dữ liệu tuần đầu".
- ✅ Auth thật: Firebase Auth thay dev-auth — backend verify ID token (firebase-admin) + auto-provision user, mobile có màn hình đăng nhập/đăng ký + AuthContext, token tự refresh. Chọn Firebase (thay vì Supabase) vì hỗ trợ RN/Expo tốt và thêm OTP số điện thoại sau này không đổi kiến trúc. Dev-auth chỉ còn là chế độ local (`AUTH_MODE=dev`).
