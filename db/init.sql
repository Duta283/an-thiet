-- =============================================================
-- Ăn Thiệt — Schema v1 (Sprint 0)
-- Theo Định hướng kỹ thuật mục 2.1 — 6 entity cốt lõi.
-- Verification tách riêng khỏi Content để mở rộng phương thức sau.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid

-- ------------------------------------------------------------
-- User: 1 loại tài khoản, phân quyền theo hành vi (không role cứng)
-- ------------------------------------------------------------
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name  text NOT NULL,
  avatar_url    text,
  firebase_uid  text UNIQUE,  -- map Firebase Auth (null với user seed nội bộ)
  is_admin      boolean NOT NULL DEFAULT false,
  trust_score   real NOT NULL DEFAULT 0, -- 0..1, tính bởi TrustService (mục 4.2)
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Restaurant: seed từ Google Places / tự nhập, không phụ thuộc user tạo
-- ------------------------------------------------------------
CREATE TABLE restaurants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  address       text,
  area          text NOT NULL,                 -- vd: 'quan-7' (pilot)
  cuisine_types text[] NOT NULL DEFAULT '{}',  -- loại món (facet search)
  price_min     integer,                       -- VND
  price_max     integer,                       -- VND
  lat           double precision NOT NULL,
  lng           double precision NOT NULL,
  location      geography(Point, 4326) GENERATED ALWAYS AS
                  (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) STORED,
  source        text NOT NULL DEFAULT 'manual'
                  CHECK (source IN ('manual', 'google_places')),
  source_ref    text,                          -- vd: google place_id
  thumbnail_url text,                          -- ảnh card từ TikTok oEmbed (reindex tự cập nhật)
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_restaurants_location ON restaurants USING GIST (location);
CREATE INDEX idx_restaurants_area ON restaurants (area);

-- ------------------------------------------------------------
-- Content/Post: nội dung tổng hợp (aggregated) BẮT BUỘC có nguồn +
-- credit tác giả, hiển thị khác biệt rõ với nội dung đã xác thực.
-- ------------------------------------------------------------
CREATE TABLE contents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES users(id) ON DELETE SET NULL, -- null với post tổng hợp do admin nạp
  media_type      text NOT NULL CHECK (media_type IN ('video', 'image', 'text')),
  caption         text,
  origin          text NOT NULL CHECK (origin IN ('user_generated', 'aggregated')),
  source_platform text CHECK (source_platform IN ('tiktok', 'threads')),
  source_url      text,   -- link-out về post gốc (oEmbed/trích dẫn — chờ kết quả Spike 1)
  source_author   text,   -- credit tác giả gốc
  occasions       text[] NOT NULL DEFAULT '{}', -- dịp: 'hen-ho', 'gia-dinh', 'an-khuya'...
  report_count    integer NOT NULL DEFAULT 0,
  is_hidden       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- Post tổng hợp phải có đủ nguồn gốc; post user không được giả nguồn
  CONSTRAINT chk_aggregated_source CHECK (
    (origin = 'aggregated' AND source_url IS NOT NULL AND source_author IS NOT NULL AND source_platform IS NOT NULL)
    OR
    (origin = 'user_generated' AND source_url IS NULL AND source_platform IS NULL)
  ),
  -- Spike 1: Threads cấm lưu trữ nội dung — caption Threads lấy qua oEmbed
  -- lúc hiển thị, KHÔNG lưu. TikTok được phép nhúng nên caption giữ được.
  CONSTRAINT chk_threads_no_stored_content CHECK (
    NOT (source_platform = 'threads' AND caption IS NOT NULL)
  )
);

CREATE INDEX idx_contents_restaurant ON contents (restaurant_id);
CREATE INDEX idx_contents_user ON contents (user_id);

-- ------------------------------------------------------------
-- Verification: tách riêng để cắm thêm phương thức (Incognia...) sau.
-- Post tổng hợp KHÔNG BAO GIỜ có verification (enforce ở tầng service).
-- ------------------------------------------------------------
CREATE TABLE verifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id   uuid NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  method       text NOT NULL CHECK (method IN ('gps', 'exif', 'qr')),
  result       text NOT NULL CHECK (result IN ('passed', 'failed', 'pending')),
  confidence   real,          -- 0..1
  raw_evidence jsonb,         -- toạ độ, accuracy, exif, ocr raw... để audit/debug
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_verifications_content ON verifications (content_id);
CREATE INDEX idx_verifications_result ON verifications (content_id, result);

-- ------------------------------------------------------------
-- Follow/TrustEdge: đồ thị có hướng — nền tảng trust score & feed
-- ------------------------------------------------------------
CREATE TABLE follows (
  follower_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followed_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id),
  CHECK (follower_id <> followed_id)
);

CREATE INDEX idx_follows_followed ON follows (followed_id);

-- ------------------------------------------------------------
-- SavedList: "Quán để dành" — giữ đơn giản ở MVP
-- ------------------------------------------------------------
CREATE TABLE saved_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  list_name     text NOT NULL DEFAULT 'Để dành',
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, restaurant_id, list_name)
);

CREATE INDEX idx_saved_user ON saved_items (user_id);

-- View tiện dụng: trạng thái verified của content
CREATE VIEW content_verified AS
SELECT c.id AS content_id,
       EXISTS (
         SELECT 1 FROM verifications v
         WHERE v.content_id = c.id AND v.result = 'passed'
       ) AS is_verified
FROM contents c;

-- ------------------------------------------------------------
-- Events: tracking pilot (mục 8 concept) — log thẳng Postgres,
-- đủ ở quy mô pilot; xuất sang công cụ chuyên dụng khi scale.
-- ------------------------------------------------------------
CREATE TABLE events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  anon_id    text,
  name       text NOT NULL,
  properties jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_name_time ON events (name, created_at);
CREATE INDEX idx_events_user_time ON events (user_id, created_at);
