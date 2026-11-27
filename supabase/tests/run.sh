#!/usr/bin/env bash
# ทดสอบสิทธิ์ (RLS) ของ migration บน Postgres ในเครื่อง — ไม่แตะ Supabase จริง
# ต้องมี Postgres 15+ และตั้ง PGHOST/PGUSER ให้ต่อได้ เช่น PGHOST=/var/run/postgresql PGUSER=postgres
set -euo pipefail
cd "$(dirname "$0")"
DB=nommae_rls_test
dropdb --if-exists "$DB" && createdb "$DB"
psql -d "$DB" -q -v ON_ERROR_STOP=1 -f stubs.sql -f ../migrations/0001_init.sql 2>&1 | grep -v 'wal_level\|HINT' || true
out=$(psql -d "$DB" -f test.sql 2>&1 | sed 's/^psql:test.sql:[0-9]*: NOTICE:  //')
echo "$out" | grep -E '^(PASS|FAIL)|ERROR'
dropdb "$DB"
if echo "$out" | grep -qE 'FAIL|ERROR'; then echo "มีข้อที่ไม่ผ่าน"; exit 1; fi
echo "ผ่านทั้งหมด $(echo "$out" | grep -c '^PASS') ข้อ"
