-- Doc 11 mục 1: thumbnail từ TikTok oEmbed cho card.
-- Chỉ lưu URL ảnh (con trỏ, không lưu media) — TikTok cho phép nhúng (Spike 1).
-- Giá trị được reindex tự cập nhật từ oEmbed, không nhập tay.
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS thumbnail_url text;
