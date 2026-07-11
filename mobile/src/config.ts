import Constants from 'expo-constants';

/**
 * Cấu hình runtime — bản build/update EAS nhận giá trị từ app.config.ts
 * (extra, set qua env trong eas.json); local dev dùng fallback bên dưới.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as {
  apiBase?: string | null;
  authMode?: string | null;
  goongMaptilesKey?: string | null;
};

/**
 * API backend (fallback local dev). Team test chính trên iPhone:
 * - iPhone thật (Expo Go, cùng WiFi máy dev): http://<IP LAN máy dev>:3000
 * - iOS simulator: http://localhost:3000
 * - Android emulator: http://10.0.2.2:3000
 * Bản phát cho đội seed KHÔNG dùng fallback này — nhận staging URL
 * qua eas.json (APP_API_BASE).
 */
export const API_BASE = extra.apiBase ?? 'http://localhost:3000';

/**
 * Goong Maptiles key (https://goong.io) — key MAPTILES, không phải REST key.
 * TODO: chuyển vào env trước khi commit key thật.
 */
export const GOONG_MAPTILES_KEY =
  extra.goongMaptilesKey ?? 'YOUR_GOONG_MAPTILES_KEY';

/**
 * Auth mode — phải khớp AUTH_MODE của backend:
 * - 'firebase': đăng nhập Firebase, gửi Bearer ID token (production/staging)
 * - 'dev': gửi header x-user-id = DEV_USER_ID (chỉ local, không traffic thật)
 */
export const AUTH_MODE: 'firebase' | 'dev' =
  extra.authMode === 'firebase' ? 'firebase' : 'dev';

/** Chỉ dùng khi AUTH_MODE='dev' — uuid từ bảng users sau khi seed */
export const DEV_USER_ID = 'PASTE_SEEDED_USER_UUID';

/** Firebase web config (Project settings > General > Your apps) */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCZf1x7G7OlBxZmA5mqSd8lzOuBTB5monQ',
  authDomain: 'an-thiet.firebaseapp.com',
  projectId: 'an-thiet',
  storageBucket: 'an-thiet.firebasestorage.app',
  messagingSenderId: '427925396388',
  appId: '1:427925396388:web:58e2f10ffff4f6fb91ff31',
};

/** Tâm mặc định: Quận 7, TP.HCM (khu vực pilot) */
export const DEFAULT_CENTER = { lat: 10.7379, lng: 106.7215 };
export const PILOT_AREA = 'quan-7';
