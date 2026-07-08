-- Event tracking cho pilot (chỉ số mục 8 concept gốc).
-- Tự log vào Postgres — đủ ở quy mô pilot Quận 7, không cần dịch vụ ngoài.
-- DB mới không cần chạy — init.sql đã bao gồm.
CREATE TABLE IF NOT EXISTS events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  anon_id    text,            -- thiết bị chưa đăng nhập (uuid client tự sinh)
  name       text NOT NULL,   -- app_session_start / search / checkin_completed / follow / screen_view
  properties jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_name_time ON events (name, created_at);
CREATE INDEX IF NOT EXISTS idx_events_user_time ON events (user_id, created_at);
