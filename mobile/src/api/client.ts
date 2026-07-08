import { API_BASE, AUTH_MODE, DEV_USER_ID } from '../config';
import type {
  CheckinResult,
  ContentItem,
  OembedResult,
  Profile,
  Restaurant,
  SavedRow,
  SearchHit,
  TrustBreakdown,
} from './types';

/** AuthContext đăng ký hàm lấy Firebase ID token (luôn tươi, tự refresh) */
let authTokenGetter: (() => Promise<string | null>) | null = null;
export function setAuthTokenGetter(fn: () => Promise<string | null>) {
  authTokenGetter = fn;
}

/** Token hiện tại hoặc null — không throw (dùng cho analytics) */
export async function getAuthTokenSafe(): Promise<string | null> {
  try {
    return authTokenGetter ? await authTokenGetter() : null;
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  auth = false,
): Promise<T> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (auth) {
    if (AUTH_MODE === 'firebase') {
      const token = authTokenGetter ? await authTokenGetter() : null;
      if (!token) throw new Error('Chưa đăng nhập');
      headers['authorization'] = `Bearer ${token}`;
    } else {
      headers['x-user-id'] = DEV_USER_ID; // chỉ local — backend AUTH_MODE=dev
    }
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  /** Danh tính hiện tại — auto-provision user backend ở lần gọi đầu */
  me() {
    return request<{
      id: string;
      displayName: string;
      avatarUrl: string | null;
      trustScore: number;
      isAdmin: boolean;
      createdAt: string;
    }>('/auth/me', {}, true);
  },

  search(params: {
    q?: string;
    occasion?: string;
    cuisine?: string;
    priceMax?: number;
    lat?: number;
    lng?: number;
    radiusKm?: number;
  }) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    });
    return request<{ found: number; hits: SearchHit[] }>(`/search?${qs}`);
  },

  nearbyRestaurants(lat: number, lng: number, radius = 3000) {
    return request<Restaurant[]>(
      `/restaurants?lat=${lat}&lng=${lng}&radius=${radius}`,
    );
  },

  restaurantDetail(id: string) {
    return request<Restaurant>(`/restaurants/${id}`);
  },

  restaurantContents(id: string) {
    return request<ContentItem[]>(`/restaurants/${id}/contents`);
  },

  /** Nội dung post tổng hợp lấy tươi từ nền tảng gốc (Spike 1: Threads không lưu DB) */
  oembed(contentId: string) {
    return request<OembedResult>(`/contents/${contentId}/oembed`);
  },

  checkin(body: {
    restaurantId: string;
    lat: number;
    lng: number;
    accuracy: number;
    caption?: string;
    occasions?: string[];
    mediaType?: 'video' | 'image' | 'text';
    /** EXIF từ ảnh chụp trong luồng check-in (Bước 8 test local) */
    exif?: { lat: number; lng: number; takenAt: string };
  }) {
    return request<CheckinResult>(
      '/verifications/checkin',
      { method: 'POST', body: JSON.stringify(body) },
      true,
    );
  },

  profile(userId: string) {
    return request<Profile>(`/users/${userId}`);
  },

  trust(userId: string) {
    return request<TrustBreakdown>(`/users/${userId}/trust`);
  },

  savedList() {
    return request<SavedRow[]>('/saved', {}, true);
  },

  saveRestaurant(restaurantId: string, listName?: string) {
    return request(
      '/saved',
      { method: 'POST', body: JSON.stringify({ restaurantId, listName }) },
      true,
    );
  },
};
