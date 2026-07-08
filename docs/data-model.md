# Data Model v1 — Ăn Thiệt (Sprint 0)

Bám mục 2.1 tài liệu định hướng. Schema là nền tảng — thay đổi sau này tốn kém, cần review kỹ ở buổi kỹ thuật đầu tiên.

## ERD

```
users ──< contents >── restaurants
  │          │              │
  │          └──< verifications
  ├──< follows >── users (đồ thị có hướng)
  └──< saved_items >── restaurants
```

## Các quyết định thiết kế quan trọng

**1. Verification tách riêng khỏi Content (1-n).**
Một content có thể có nhiều verification (GPS + EXIF cùng lúc), và thêm phương thức mới (QR hoá đơn, Incognia) không cần đổi schema Content. `raw_evidence` (jsonb) lưu bằng chứng thô phục vụ audit chống gian lận. Content "verified" = tồn tại ≥1 verification `passed` (view `content_verified`).

**2. Post tổng hợp bị ràng buộc ở tầng DB.**
CHECK `chk_aggregated_source`: origin `aggregated` bắt buộc có `source_url + source_author + source_platform`; origin `user_generated` không được có nguồn ngoài. Điều này enforce yêu cầu "hiển thị khác biệt rõ + trích dẫn nguồn" bằng schema, không chỉ bằng quy ước.

**3. Post tổng hợp không gắn user (`user_id` NULL).**
Credit thuộc về tác giả gốc trên nền tảng gốc (`source_author`), không phải admin nạp liệu. Tránh việc trust score của admin bị ảnh hưởng bởi nội dung seed.

**4. `location` là generated column PostGIS.**
Client chỉ gửi lat/lng; DB tự sinh `geography(Point)` + GIST index. Geo-query (`ST_DWithin`) nhanh và không thể lệch giữa lat/lng và location.

**5. Một loại tài khoản duy nhất.**
Không có role "reviewer" cứng — phân biệt bằng hành vi (trust_score, số nội dung verified). `is_admin` chỉ dành cho vận hành nội bộ.

**6. Trust score lưu trên users, recompute batch.**
v0 tính bằng SQL đơn giản + 1 vòng lặp follower (không đệ quy). Recompute qua `POST /admin/trust/recompute` sau mỗi đợt seed; khi có pilot data thì chuyển cron. Công thức (mục 4.2):

```
trust = 0.4×(verified/tổng) + 0.3×log(follower đáng tin +1)[chuẩn hoá trần 100]
      + 0.2×(tuổi tk, trần 365 ngày) + 0.1×(1 − tỷ lệ bị report/ẩn)
```

Chỉ dùng xếp hạng hiển thị — không có điểm sao.

## Ngưỡng verification v0 (chỉnh sau spike GPS)

| Tham số | Giá trị | Ghi chú |
|---|---|---|
| GPS accuracy tối đa | 50m | tệ hơn → failed |
| Khoảng cách tối đa | 100m + accuracy | haversine tới toạ độ quán |
| Impossible travel | >120 km/h | so với check-in passed gần nhất |
| EXIF: tuổi ảnh | ≤2h | app tự chụp trong luồng check-in |
| EXIF: khoảng cách | ≤150m | |
| Tự ẩn khi report | ≥3 lượt | chờ admin duyệt |

## API map nhanh

| Endpoint | Auth | Mô tả |
|---|---|---|
| GET /search | — | Search cấu trúc (Typesense): q, area, cuisine, occasion, priceMax, geo |
| GET /restaurants | — | Danh sách + geo-query PostGIS |
| GET /restaurants/:id | — | Chi tiết + đếm nội dung verified |
| GET /restaurants/:id/contents | — | Nội dung (verified xếp trước, post tổng hợp kèm nguồn) |
| POST /contents, /contents/:id/report | x-user-id | Đăng / report nội dung |
| POST /verifications/checkin | x-user-id | Check-in GPS + EXIF v0 |
| GET /users/:id, /users/:id/trust | — | Profile, trust breakdown |
| POST /follows, DELETE /follows/:id | x-user-id | Follow graph |
| POST/GET /saved | x-user-id | Quán để dành |
| POST /admin/seed | x-admin-key | Seed tool (idempotent) |
| POST /admin/search/reindex | x-admin-key | Đồng bộ Typesense từ Postgres |
| POST /admin/trust/recompute | x-admin-key | Recompute trust toàn bộ |
