#!/usr/bin/env sh
set -eu

COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.production.yml}
BACKUP_FILE=${1:-}

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Usage: CONFIRM_RESTORE=yes $0 path/to/backup.sql" >&2
  exit 1
fi

if [ "${CONFIRM_RESTORE:-no}" != "yes" ]; then
  echo "Restore is destructive. Re-run with CONFIRM_RESTORE=yes after taking a fresh backup." >&2
  exit 1
fi

echo "Restoring PostgreSQL backup: $BACKUP_FILE"
cat "$BACKUP_FILE" | docker compose -f "$COMPOSE_FILE" exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
echo "Restore completed. Review application logs before allowing users back in."
