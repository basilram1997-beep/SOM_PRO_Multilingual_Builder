#!/usr/bin/env sh
set -eu

COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.production.yml}
BACKUP_DIR=${BACKUP_DIR:-deploy/backup/postgres}
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/backup-crypto.sh"
mkdir -p "$BACKUP_DIR"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
tmp_sql=$(mktemp "${TMPDIR:-/tmp}/sompro-postgres-$TIMESTAMP.XXXXXX.sql")
encrypted_file="$BACKUP_DIR/sompro-postgres-$TIMESTAMP.sql.enc"
manifest_file="$BACKUP_DIR/sompro-postgres-$TIMESTAMP.manifest.json"

cleanup() {
  rm -f "$tmp_sql"
}
trap cleanup EXIT INT TERM

echo "Creating encrypted PostgreSQL backup..."
docker compose -f "$COMPOSE_FILE" exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl' > "$tmp_sql"
plaintext_sha256=$(sha256_file "$tmp_sql")
encrypt_backup_file "$tmp_sql" "$encrypted_file"
completed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
write_backup_manifest "$manifest_file" "$encrypted_file" "postgresql_dump" "$plaintext_sha256" "$started_at" "$completed_at"
rm -f "$tmp_sql"
echo "Encrypted backup saved: $encrypted_file"
echo "Backup manifest saved: $manifest_file"
