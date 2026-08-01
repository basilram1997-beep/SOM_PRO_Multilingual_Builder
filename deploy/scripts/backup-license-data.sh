#!/usr/bin/env sh
set -eu

COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.production.yml}
BACKUP_DIR=${BACKUP_DIR:-deploy/backup/license-server}
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"

echo "Creating License Server JSON data backup..."
docker compose -f "$COMPOSE_FILE" exec -T license-server sh -c 'tar -czf - -C /app/apps/license-server data' > "$BACKUP_DIR/sompro-license-data-$TIMESTAMP.tar.gz"
echo "Backup saved: $BACKUP_DIR/sompro-license-data-$TIMESTAMP.tar.gz"
