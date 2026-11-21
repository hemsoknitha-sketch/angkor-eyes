#!/usr/bin/env bash
# ANGKOR EYES — restore.sh
# Restores a Postgres dump (from scripts/backup.sh) into the compose DB.
#   ./scripts/restore.sh backups/angkor-eyes-2026-11-21T030000Z.dump.gz
#
# ⚠️  DESTRUCTIVE on the target database: it drops and recreates the DB.
# Take a fresh backup first (./scripts/backup.sh) unless you are restoring
# into a scratch database. Test-restores monthly — see docs/operations.md §1.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DUMP="${1:-}"
[ -n "$DUMP" ] || { echo "Usage: $0 <dump-file.sql.gz | .dump.gz>" >&2; exit 1; }
[ -f "$DUMP" ] || { echo "ERROR: dump file not found: $DUMP" >&2; exit 1; }

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

DB="${POSTGRES_DB:-angkor_eyes}"
USER="${POSTGRES_USER:-angkor}"

# Refuse to run unless the postgres container exists.
docker compose ps postgres --format json 2>/dev/null | grep -q postgres \
  || { echo "ERROR: postgres container is not running. Start it first: docker compose up -d postgres" >&2; exit 1; }

echo "WARNING: this will DROP and recreate database '$DB' from '$DUMP'."
echo "Take a fresh backup first if this is not a scratch database."
read -r -p "Type the database name to confirm: " CONFIRM
[ "$CONFIRM" = "$DB" ] || { echo "Aborted (confirmation did not match)." >&2; exit 1; }

echo "restore: stopping backend and bot (they must not write mid-restore)…"
docker compose stop backend bot 2>/dev/null || true

echo "restore: dropping and recreating database '$DB'…"
docker compose exec -T postgres psql -U "$USER" -d postgres -c "DROP DATABASE IF EXISTS \"$DB\";"
docker compose exec -T postgres psql -U "$USER" -d postgres -c "CREATE DATABASE \"$DB\";"
docker compose exec -T postgres psql -U "$USER" -d "$DB" -c "CREATE EXTENSION IF NOT EXISTS vector;"

echo "restore: restoring dump…"
case "$DUMP" in
  *.dump.gz) gunzip -c "$DUMP" | docker compose exec -T postgres pg_restore -U "$USER" -d "$DB" --no-owner --role="$USER" || true ;;
  *.sql.gz)  gunzip -c "$DUMP" | docker compose exec -T postgres psql -U "$USER" -d "$DB" ;;
  *.dump)    docker compose exec -T postgres pg_restore -U "$USER" -d "$DB" --no-owner --role="$USER" < "$DUMP" || true ;;
  *.sql)     docker compose exec -T postgres psql -U "$USER" -d "$DB" < "$DUMP" ;;
  *) echo "ERROR: unknown dump extension (want .dump.gz / .sql.gz / .dump / .sql)" >&2; exit 1 ;;
esac

echo "restore: verifying…"
docker compose exec -T postgres psql -U "$USER" -d "$DB" -c "SELECT count(*) AS tasks FROM tasks;" 2>/dev/null \
  || echo "WARNING: could not count tasks — the dump may predate the tasks table or the restore may have failed. Check the output above." >&2

echo "restore: restarting backend and bot…"
docker compose start backend bot 2>/dev/null || docker compose up -d backend bot

echo "restore ok: '$DB' restored from $DUMP"
echo "Next: check 'docker compose logs backend' and run the monthly test-restore checks in docs/operations.md §1."
