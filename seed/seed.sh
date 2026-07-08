#!/usr/bin/env bash
# Seed dữ liệu pilot Quận 7 vào API đang chạy local.
# Usage: ADMIN_KEY=change_me_admin_key ./seed/seed.sh
set -euo pipefail
API="${API:-http://localhost:3000}"
KEY="${ADMIN_KEY:?Cần biến ADMIN_KEY}"

RESULT=$(curl -sS -X POST "$API/admin/seed" \
  -H "content-type: application/json" \
  -H "x-admin-key: $KEY" \
  -d @"$(dirname "$0")/quan7.json")
echo "$RESULT" | python3 -m json.tool

echo ""
echo "=== USER TEST (Bước 6 hướng dẫn Test Local) ==="
echo "Copy 1 UUID dưới đây vào mobile/src/config.ts → DEV_USER_ID:"
echo "$RESULT" | python3 -c "import json,sys; [print(f\"  {u['id']}  ({u['displayName']})\") for u in json.load(sys.stdin).get('users',[])]"
echo ""

echo "--- Recompute trust score ---"
curl -sS -X POST "$API/admin/trust/recompute" -H "x-admin-key: $KEY"
echo
