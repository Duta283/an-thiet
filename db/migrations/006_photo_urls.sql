-- Photo pipeline (kế hoạch 14/07): ảnh check-in lưu Cloudflare R2,
-- DB chỉ giữ danh sách URL public.
ALTER TABLE contents ADD COLUMN IF NOT EXISTS photo_urls text[] NOT NULL DEFAULT '{}';
