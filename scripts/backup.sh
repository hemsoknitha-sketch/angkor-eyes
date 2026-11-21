#!/usr/bin/env bash
# ANGKOR EYES — backup.sh
# Daily Postgres dump (custom format, gzipped) to BACKUP_DIR and,
# if BACKUP_S3_URI is set, to S3/R2. Deletes dumps older than
# BACKUP_RETENTION_DAYS. Run daily via cron:
#   0 3 * * * /path/to/angkor-eyes/scripts/backup.sh >> /var/log/angkor-backup.log 2>&1
# See docs/operations.md §1.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Load .env if present (values only; never echo them).
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
DB="${POSTGRES_DB:-angkor_eyes}"
USER="${POSTGRES_USER:-angkor}"
TS="$(date -u +%Y-%m-%dT%H%M%SZ)"
FILE="angkor-eyes-${TS}.dump.gz"
DEST="${BACKUP_DIR}/${FILE}"

mkdir -p "$BACKUP_DIR"

# Prefer pg_dump inside the compose postgres container (no local client needed).
if docker compose ps postgres --format json 2>/dev/null | grep -q postgres; then
  echo "backup: dumping via compose postgres container…"
  docker compose exec -T postgres pg_dump -U "$USER" -d "$DB" -Fc | gzip > "$DEST"
elif command -v pg_dump >/dev/null 2>&1; then
  echo "backup: dumping via local pg_dump…"
  pg_dump -h "${POSTGRES_HOST:-localhost}" -U "$USER" -d "$DB" -Fc | gzip > "$DEST"
else
  echo "ERROR: no running postgres container and no local pg_dump found." >&2
  exit 1
fi

echo "backup ok: $DEST ($(du -h "$DEST" | cut -f1))"

# Optional off-site copy.
if [ -n "${BACKUP_S3_URI:-}" ]; then
  if command -v aws >/dev/null 2>&1; then
    aws s3 cp "$DEST" "${BACKUP_S3_URI%/}/${FILE}" && echo "backup ok: uploaded to ${BACKUP_S3_URI%/}/${FILE}"
  else
    echo "WARNING: BACKUP_S3_URI is set but 'aws' CLI is missing — off-site copy skipped." >&2
  fi
fi

# Retention: delete dumps older than RETENTION_DAYS.
find "$BACKUP_DIR" -name 'angkor-eyes-*.dump.gz' -type f -mtime "+$RETENTION_DAYS" -delete
echo "backup: retention applied (>${RETENTION_DAYS}d deleted)."
