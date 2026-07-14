export interface Restaurant {
  id: string;
  name: string;
  address: string | null;
  area: string;
  cuisineTypes: string[];
  priceMin: number | null;
  priceMax: number | null;
  lat: number;
  lng: number;
  thumbnailUrl?: string | null;
  distanceM?: number;
  contentCount?: number;
  verifiedContentCount?: number;
}

/** Doc trả về từ Typesense (snake_case theo index) */
export interface SearchHit {
  id: string;
  name: string;
  address: string;
  area: string;
  cuisine_types: string[];
  occasions: string[];
  price_min: number;
  price_max: number;
  verified_count: number;
  content_count: number;
  thumbnail_url?: string;
  location: [number, number];
}

export interface ContentItem {
  id: string;
  restaurantId: string;
  userId: string | null;
  userDisplayName: string | null;
  mediaType: 'video' | 'image' | 'text';
  caption: string | null;
  origin: 'user_generated' | 'aggregated';
  sourcePlatform: 'tiktok' | 'threads' | null;
  sourceUrl: string | null;
  sourceAuthor: string | null;
  occasions: string[];
  createdAt: string;
  isVerified: boolean;
}

export interface CheckinResult {
  contentId: string;
  isVerified: boolean;
  verifications: {
    method: 'gps' | 'exif' | 'qr';
    result: 'passed' | 'failed' | 'pending';
    confidence: number | null;
  }[];
}

export interface TrustBreakdown {
  userId: string;
  trustScore: number;
  components: {
    verifiedRatio: number;
    trustedFollowers: number;
    accountAgeDays: number;
    reportedRatio: number;
  };
}

export interface Profile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  trustScore: number;
  createdAt: string;
  followerCount: number;
  followingCount: number;
  verifiedContentCount: number;
}

export interface SavedRow {
  id: string;
  listName: string;
  createdAt: string;
  restaurantId: string;
  name: string;
  area: string;
  thumbnailUrl?: string | null;
  cuisineTypes: string[];
  lat: number;
  lng: number;
}

export interface OembedResult {
  provider: 'tiktok' | 'threads';
  authorName: string | null;
  text: string | null;
  html: string | null;
  thumbnailUrl: string | null;
}
