-- Trình tự nguồn ảnh (doc 05 đính chính 14/07): ảnh từ nội dung TikTok
-- lên app TRƯỚC — mỗi content tiktok giữ thumbnail riêng (URL hotlink oEmbed,
-- reindex hằng ngày tự làm mới vì link TikTok CDN có hạn dùng).
ALTER TABLE contents ADD COLUMN IF NOT EXISTS thumbnail_url text;
