import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthTokenSafe } from './api/client';
import { API_BASE, AUTH_MODE, DEV_USER_ID } from './config';

/**
 * Analytics client v0 — batch gửi về POST /events (log Postgres).
 * Chỉ gửi event phía client (app_session_start, screen_view);
 * search/checkin/follow do backend tự track.
 *
 * Nguyên tắc: tracking không được làm hỏng UX — mọi lỗi nuốt im lặng,
 * event giữ trong queue thử lại lần flush sau.
 */

const FLUSH_INTERVAL_MS = 10_000;
const MAX_BATCH = 20;
const ANON_KEY = 'anthiet_anon_id';

interface QueuedEvent {
  name: 'app_session_start' | 'screen_view';
  properties?: Record<string, unknown>;
}

let queue: QueuedEvent[] = [];
let anonId: string | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function randomId(): string {
  return 'anon-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function getAnonId(): Promise<string> {
  if (anonId) return anonId;
  try {
    const stored = await AsyncStorage.getItem(ANON_KEY);
    anonId = stored ?? randomId();
    if (!stored) await AsyncStorage.setItem(ANON_KEY, anonId);
  } catch {
    anonId = randomId();
  }
  return anonId;
}

export function track(
  name: QueuedEvent['name'],
  properties?: Record<string, unknown>,
): void {
  queue.push({ name, properties });
  if (queue.length >= MAX_BATCH) void flush();
}

export async function flush(): Promise<void> {
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  try {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-anon-id': await getAnonId(),
    };
    if (AUTH_MODE === 'firebase') {
      const token = await getAuthTokenSafe();
      if (token) headers['authorization'] = `Bearer ${token}`;
    } else {
      headers['x-user-id'] = DEV_USER_ID;
    }
    const res = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ events: batch }),
    });
    if (!res.ok) throw new Error(String(res.status));
  } catch {
    // giữ lại thử lần sau — không làm phiền người dùng
    queue = [...batch, ...queue].slice(0, 200);
  }
}

/** Gọi 1 lần khi app mount */
export function initAnalytics(): void {
  if (timer) return;
  timer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
  track('app_session_start');
  void flush();
}

/** Gọi khi app quay lại foreground sau khi rời đi đủ lâu → phiên mới */
export function trackSessionResume(backgroundMs: number): void {
  const NEW_SESSION_AFTER_MS = 30 * 60_000; // chuẩn phổ biến: 30 phút
  if (backgroundMs >= NEW_SESSION_AFTER_MS) {
    track('app_session_start', { resumed: true });
    void flush();
  }
}
