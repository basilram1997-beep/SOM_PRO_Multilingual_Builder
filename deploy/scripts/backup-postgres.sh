#!/usr/bin/env sh
set -eu

COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.production.yml}
BACKUP_DIR=${BACKUP_DIR:-deploy/backup/postgres}
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

echo "Creating PostgreSQL backup..."
docker compose -f "$COMPOSE_FILE" exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl' > "$BACKUP_DIR/sompro-postgres-$TIMESTAMP.sql"
echo "Backup saved: $BACKUP_DIR/sompro-postgres-$TIMESTAMP.sql"
