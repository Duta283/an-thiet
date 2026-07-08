-- Sprint 4 (Auth thật): map tài khoản Firebase vào users.
-- DB mới không cần chạy file này — init.sql đã bao gồm.
ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid text UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users (firebase_uid);
