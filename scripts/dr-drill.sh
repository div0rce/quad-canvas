#!/usr/bin/env bash
# Quad — backup/restore drill (LG-8). Proves a Postgres logical backup restores with no data loss:
# seed a representative chain (a tenant + its canvas), pg_dump the database, restore the dump into a
# fresh database, then for EVERY table (discovered from the schema, not hardcoded) assert the content
# checksum matches between source and restore. Targets the local compose Postgres by default (override
# PSQL_EXEC / PG_USER / PG_DB). Exits non-zero on any mismatch. Idempotent + self-cleaning (a trap
# tears the drill DB + seed down even if an earlier step fails under `set -e`).
#
#   docker compose up -d postgres   # the dev datastore
#   pnpm dr:drill
set -euo pipefail

PSQL_EXEC_DEFAULT="docker compose exec -T postgres"
read -r -a PSQL_EXEC <<<"${PSQL_EXEC:-$PSQL_EXEC_DEFAULT}"
PG_USER="${PG_USER:-quad}"
SRC_DB="${PG_DB:-quad}"
DRILL_DB="quad_drill_restore"
MARKER="drill_marker"
MARKER_CANVAS="${MARKER}_canvas"
BACKUP="$(mktemp -t quad-drill.XXXXXX)"

psql_q() { "${PSQL_EXEC[@]}" psql -v ON_ERROR_STOP=1 -U "$PG_USER" "$@"; }
# A content fingerprint of one table: md5 over its rows' text, order-independent (each row sorted in).
checksum() { psql_q -tA -d "$1" -c "SELECT COALESCE(md5(string_agg(r::text, '' ORDER BY r::text)), 'empty') FROM \"$2\" r;" | tr -d '[:space:]'; }

cleanup() {
  rm -f "$BACKUP"
  psql_q -d postgres -c "DROP DATABASE IF EXISTS $DRILL_DB;" >/dev/null 2>&1 || true
  psql_q -d "$SRC_DB" -c "DELETE FROM \"Canvas\" WHERE id='$MARKER_CANVAS';" >/dev/null 2>&1 || true
  psql_q -d "$SRC_DB" -c "DELETE FROM \"Tenant\" WHERE id='$MARKER';" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "1) seed a representative chain (tenant + canvas) in '$SRC_DB'"
psql_q -d "$SRC_DB" -c \
  "INSERT INTO \"Tenant\"(id,slug,\"publicTitle\",status,\"updatedAt\") VALUES ('$MARKER','$MARKER','Drill','active',now()) ON CONFLICT (id) DO NOTHING; \
   INSERT INTO \"Canvas\"(id,\"tenantId\",\"termLabel\",status,width,height,\"updatedAt\") VALUES ('$MARKER_CANVAS','$MARKER','DRILL','archived',10,10,now()) ON CONFLICT (id) DO NOTHING;" >/dev/null

echo "2) back up '$SRC_DB' with pg_dump"
"${PSQL_EXEC[@]}" pg_dump -U "$PG_USER" -d "$SRC_DB" >"$BACKUP"
echo "   backup: $(wc -c <"$BACKUP" | tr -d '[:space:]') bytes"

echo "3) restore into a fresh '$DRILL_DB'"
psql_q -d postgres -c "DROP DATABASE IF EXISTS $DRILL_DB;" >/dev/null
psql_q -d postgres -c "CREATE DATABASE $DRILL_DB;" >/dev/null
"${PSQL_EXEC[@]}" psql -q -v ON_ERROR_STOP=1 -U "$PG_USER" -d "$DRILL_DB" <"$BACKUP" >/dev/null

echo "4) verify a content checksum per table (every public table, discovered from the schema)"
TABLES="$(psql_q -tA -d "$SRC_DB" -c "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename;")"
fail=0
for t in $TABLES; do
  src="$(checksum "$SRC_DB" "$t")"
  dst="$(checksum "$DRILL_DB" "$t")"
  if [ "$src" = "$dst" ]; then
    echo "   ok   $t"
  else
    echo "   FAIL $t: source=$src restored=$dst"
    fail=1
  fi
done
marker="$(psql_q -tA -d "$DRILL_DB" -c "SELECT count(*) FROM \"Canvas\" WHERE id='$MARKER_CANVAS';" | tr -d '[:space:]')"
if [ "$marker" = "1" ]; then echo "   ok   seeded chain present in restore"; else echo "   FAIL seeded chain missing in restore"; fail=1; fi

if [ "$fail" = "0" ]; then echo "DR DRILL PASSED"; else echo "DR DRILL FAILED"; exit 1; fi
