# Deploy staging lên Railway

Thay thế phương án VPS (`deploy-staging.md`) nếu team chọn Railway. Lưu ý cốt lõi: **Railway KHÔNG đọc docker-compose** — `docker-compose.prod.yml` và `Caddyfile` bị bỏ qua hoàn toàn; mỗi thành phần là 1 service tạo riêng trong cùng project. Cần 3 service:

## Service 1 — Postgres (BẪY #1: PostGIS)

Postgres mặc định của Railway **không có PostGIS** — backend sẽ chết ngay ở `CREATE EXTENSION postgis`. Hai cách:

- Cách A (khuyến nghị): New Service → Docker Image → `postgis/postgis:16-3.4`. Gắn **Volume** vào `/var/lib/postgresql/data` (không volume = mất sạch dữ liệu mỗi lần redeploy). Set env: `POSTGRES_USER=anthiet`, `POSTGRES_PASSWORD=<sinh ngẫu nhiên>`, `POSTGRES_DB=anthiet`.
- Cách B: template "PostGIS" có sẵn trên Railway marketplace.

Schema KHÔNG tự chạy (không có cơ chế initdb mount như compose) — chạy tay sau khi service lên:

```bash
# lấy connection string từ tab Connect của service Postgres
psql "<DATABASE_URL public>" < db/init.sql
```

## Service 2 — Typesense

New Service → Docker Image → `typesense/typesense:27.1`. Gắn Volume vào **Mount Path `/data`** — thao tác từ CANVAS (chuột phải vào service → Attach Volume, hoặc Ctrl+K gõ "volume"), KHÔNG nằm trong tab Settings. Thiếu volume là container exit ngay vì data-dir không tồn tại. Custom Start Command (Settings → Deploy):

```
/opt/typesense-server --data-dir /data --api-key=<key thật> --enable-cors --thread-pool-size=8
```

(BẪY #6 — gặp thực tế 07/2026: thiếu `--thread-pool-size` là Typesense crash ngay sau khi Online với `what(): Resource temporarily unavailable` + stack trace ThreadPool/std::thread. Nguyên nhân: mặc định nó tạo thread theo số CPU của MÁY CHỦ vật lý (rất lớn) trong khi container plan trial bị giới hạn thread → EAGAIN → abort. 8 thread là đủ cho pilot; tăng khi lên plan cao hơn.)

(BẪY #4 — đã kiểm chứng thực tế trên Railway 07/2026: Start Command THAY THẾ CẢ ENTRYPOINT, từ đầu tiên phải là đường dẫn binary `/opt/typesense-server`. Điền chỉ tham số `--data-dir ...` → lỗi "The executable '--data-dir' could not be found". Điền `sh -c "mkdir ..."` cũng fail — image không dùng được shell kiểu đó, và volume đã lo thư mục nên không cần mkdir. Nhớ bấm nút "Apply N changes"/Deploy ở góc trên trái — Railway xếp hàng thay đổi, chưa bấm là chưa có hiệu lực.)

Set env `TYPESENSE_API_KEY` của service backend = đúng key trong start command. Service này chỉ cần private networking, không cần public domain.

Triệu chứng nhận biết khi sai: deploy log chỉ có `Starting Container` rồi exit / build FAILED ở bước Create container; backend gọi `/admin/search/reindex` trả 500. Sửa xong log phải có banner Typesense + `Node started`.

## Service 3 — Backend API

New Service → GitHub Repo → chọn repo `an-thiet`, **Root Directory = `backend`** (BẪY #2: quên set là Railway build từ gốc repo và fail vì không thấy package.json). Railway tự phát hiện `backend/Dockerfile`.

Env vars (tham chiếu `.env.staging.example`, bỏ `DOMAIN` — không dùng Caddy):

```
DATABASE_URL   = postgres://anthiet:<password>@<postgres>.railway.internal:5432/anthiet
TYPESENSE_HOST = <typesense>.railway.internal
TYPESENSE_PORT = 8108
TYPESENSE_API_KEY = <như service 2>
ADMIN_KEY      = <sinh ngẫu nhiên>
AUTH_MODE      = firebase
FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
PORT           = 3000
```

(BẪY #3: dùng hostname `*.railway.internal` — private networking giữa các service trong cùng project; đừng trỏ DATABASE_URL qua public URL vừa chậm vừa tốn egress.)

(BẪY #5 — đã gặp thực tế 07/2026: private networking Railway chạy **IPv6**, còn Typesense chỉ bind IPv4 → backend gọi `typesense.railway.internal` bị `ECONNREFUSED` retry liên tục dù service Online. Postgres không bị vì image postgis bind cả IPv6. Cách xử lý cho Typesense: Generate Domain public (port 8108) cho service typesense, rồi ở backend set `TYPESENSE_HOST=<domain public>`, `TYPESENSE_PORT=443`, `TYPESENSE_PROTOCOL=https` — code đã hỗ trợ biến protocol. Typesense public vẫn được bảo vệ bằng api-key, nhưng nên dùng key mạnh và xoay key nếu từng lộ.)

Settings → Networking → Generate Domain → được `https://<app>.up.railway.app` (TLS sẵn, không cần Caddy). Settings → Healthcheck path: `/health`.

## Sau khi 3 service chạy — giống runbook VPS bước 3

```bash
psql "<DATABASE_URL public>" < db/init.sql        # nếu chưa chạy
API=https://<app>.up.railway.app ADMIN_KEY=<key> ./seed/seed.sh
curl -X POST https://<app>.up.railway.app/admin/search/reindex -H "x-admin-key: <key>"
curl "https://<app>.up.railway.app/search?q=bún"   # phải có kết quả
```

Rồi điền domain vào `mobile/eas.json` (APP_API_BASE, profile preview).

## Auto-deploy & backup

- Đúng như PO ghi: mỗi push lên nhánh đã chọn → Railway tự build lại **service Backend** (chỉ service gắn GitHub; Postgres/Typesense image không tự đổi). Sửa schema = tự chạy migration tay trước khi push code phụ thuộc nó.
- Backup: volume Railway sống qua redeploy nhưng vẫn cần pg_dump định kỳ ra ngoài (chạy từ máy dev qua DATABASE_URL public, lệnh như runbook VPS mục 4).
- Chi phí: plan Hobby ~$5/tháng + usage — ngang VPS nhỏ, đổi lại không phải tự quản server.
