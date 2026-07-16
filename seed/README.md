# Seed data — lưu ý trước khi test theo hướng dẫn "Test Local qua Expo Go"

## URL trong quan7.json là PLACEHOLDER

`sourceUrl` của các post mẫu (`@foodreview.example`, `000000001`...) là link giả
để minh hoạ cấu trúc — **oEmbed sẽ fail với các link này** (app hiển thị fallback
"Không tải được nội dung — xem trực tiếp trên nền tảng gốc", không crash).

Muốn test Bước 8 (oEmbed hiển thị đúng): thay `sourceUrl` + `sourceAuthor` của
vài post trong `quan7.json` bằng **link post công khai thật** trên TikTok/Threads
(bất kỳ post đồ ăn nào cũng được ở bước test), rồi chạy lại `./seed/seed.sh` —
seed idempotent theo `sourceUrl` nên link mới sẽ được thêm, link cũ không trùng lặp.

Lưu ý tuân thủ khi thay link thật:
- Post TikTok: được kèm `caption` trích dẫn.
- Post Threads: KHÔNG điền `caption` (DB sẽ từ chối — CHECK constraint),
  nội dung tự lấy qua oEmbed lúc hiển thị.

## Toạ độ quán cũng là mẫu

Toạ độ các quán seed đặt quanh Quận 7 nhưng không phải vị trí quán thật.
Test check-in GPS pass: sửa `lat/lng` của 1 quán trong `quan7.json` thành
toạ độ nơi bạn đang đứng (lấy từ Google Maps), seed lại, rồi check-in quán đó.


## Trình tự nguồn quán & ảnh (doc 05 đính chính 14/07/2026)

1. **Bước 1 — bàn giấy, làm TRƯỚC**: curate 100 quán từ TikTok/Threads
   (Instagram CHỈ để tham khảo tìm tên quán — chưa được nhúng/lấy ảnh,
   chưa rà pháp lý). Nhập vào Google Sheet theo `tools/quan100-template.csv`
   → xuất CSV → `node tools/sheet-to-seed.js file.csv > seed/quan100.json`
   → seed + reindex. Ảnh quán tự lấy từ TikTok oEmbed khi reindex
   (cron hằng ngày tự làm mới — hotlink TikTok có hạn dùng).
2. **Bước 2 — thực địa, làm SAU**: đội seed đến từng quán đã có trên app,
   check-in GPS + chụp ảnh để XÁC THỰC (quán còn thật, đúng vị trí).
   Ảnh check-in là lớp bổ sung trong gallery, không phải nguồn ảnh đầu tiên.

Tool tự chặn vi phạm: platform ngoài tiktok/threads bị từ chối;
caption của nguồn Threads tự bị loại (Threads cấm lưu nội dung).
