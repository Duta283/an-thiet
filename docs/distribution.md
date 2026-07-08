# Phát hành pilot Quận 7 — quy trình 2 kênh song song

Kênh A (ngay tuần này) đưa app vào tay đội seed không chờ review store; kênh B nộp store song song vì review mất vài ngày. Cả hai dùng chung cấu hình đã có sẵn trong repo (`eas.json`, `app.config.ts`).

## Chuẩn bị chung (1 lần, ~30 phút)

1. Tài khoản Expo (miễn phí) + cài CLI: `npm i -g eas-cli && eas login`.
2. Trong `mobile/`: `eas init` — lấy `EAS_PROJECT_ID`, export biến này khi chạy các lệnh bên dưới (hoặc để eas tự ghi vào app.json extra).
3. **Backend staging: ĐÃ LIVE** tại `https://an-thiet-production.up.railway.app` (Railway, theo `docs/deploy-railway.md`) — `eas.json` profile preview đã trỏ sẵn. Phương án VPS tự quản vẫn còn trong `docs/deploy-staging.md` nếu sau này cần.
4. Firebase: bật Email/Password; điền `FIREBASE_CONFIG` (web app) vào `mobile/src/config.ts`; set `APP_GOONG_MAPTILES_KEY` khi build/update.

## Kênh A — nội bộ ngay tuần này (EAS Update / Expo Go)

```bash
cd mobile
APP_API_BASE=https://<staging-domain> APP_AUTH_MODE=firebase \
APP_GOONG_MAPTILES_KEY=<key> EAS_PROJECT_ID=<id> \
npm run update:preview -- --message "pilot seed build"
```

- Đội seed cài **Expo Go**, quét QR từ trang project trên expo.dev (channel `preview`) — không cần cài chứng chỉ, không chờ review.
- **iPhone (thiết bị chính của team): dùng được ngay kênh này** — Expo Go trên App Store, mở link/QR bằng Camera. KHÔNG cần Apple Developer $99 cho kênh A; chỉ cần khi lên TestFlight (kênh B). Dev local với iPhone thật: cùng WiFi máy dev, `npm start` rồi quét QR, API_BASE trỏ IP LAN máy dev.
- Push code mới = chạy lại đúng lệnh trên; máy đội seed tự nhận bản mới khi mở app.
- App đã được thiết kế chạy được trong Expo Go từ đầu (bản đồ Goong qua WebView, không native module ngoài Expo SDK) — đây là lý do quyết định WebView ở v0.2.
- Giới hạn chấp nhận được ở kênh này: cần app Expo Go, không có icon/splash riêng.

## Kênh B — TestFlight / Play internal (nộp song song, dùng khi mở rộng)

```bash
cd mobile
npm run build:prod          # EAS build cloud, cả 2 nền tảng
npm run submit:ios          # → TestFlight (cần Apple Developer $99/năm)
npm run submit:android      # → Play internal testing (cần Play Console $25 1 lần)
```

- iOS: thêm tester nội bộ trong App Store Connect (internal tester không cần Apple review; external cần review vài ngày).
- Android: track `internal` phát hành gần như tức thì cho tester theo email.
- `autoIncrement: true` đã bật — không phải tự quản version code.
- Bản store nhận OTA update qua channel `production` (`eas update --channel production`) cho sửa lỗi JS nhỏ, không cần build lại.

## Checklist trước khi phát cho đội seed

- [ ] `GET /admin/metrics` trả số 0 sạch sẽ (chưa có event) — xác nhận analytics nối đúng DB staging
- [ ] Đăng ký tài khoản mới trên máy thật → xuất hiện trong bảng `users` (auto-provision)
- [ ] Search "bún" ra kết quả seed; mở bản đồ thấy marker Quận 7
- [ ] Check-in thử tại 1 quán seed (đứng xa sẽ fail — đúng thiết kế)
- [ ] Sau 1 ngày dùng thử: `GET /admin/metrics` có DAU ≥ 1, searches > 0 — cụm analytics chạy với dữ liệu thật

## Chưa làm ở bước này (chủ động hoãn, không phải quên)

- Icon/splash chính thức — cần asset từ designer; placeholder Expo đủ cho nội bộ.
- Env `development` build (dev client) — chỉ cần khi bắt đầu dùng native module ngoài Expo SDK (vd MapLibre).
- Store listing công khai (screenshot, mô tả, privacy policy URL) — làm khi pilot mở rộng ngoài nội bộ.
