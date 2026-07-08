-- Kết luận Spike 1 (03/07/2026): điều khoản Threads CẤM lưu trữ nội dung.
-- Từ nay: post Threads chỉ lưu source_url + credit; caption/nội dung
-- lấy qua oEmbed TẠI THỜI ĐIỂM HIỂN THỊ, không lưu vào DB.
-- TikTok oEmbed được phép nhúng — caption trích dẫn giữ nguyên.

-- 1. Xoá caption Threads đã lưu (dữ liệu vi phạm — xoá luôn, không giữ bản sao)
UPDATE contents SET caption = NULL WHERE source_platform = 'threads';

-- 2. Chặn tái phạm ở tầng DB
ALTER TABLE contents ADD CONSTRAINT chk_threads_no_stored_content
  CHECK (NOT (source_platform = 'threads' AND caption IS NOT NULL));
