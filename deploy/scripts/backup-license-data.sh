#!/usr/bin/env sh
set -eu

COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.production.yml}
BACKUP_DIR=${BACKUP_DIR:-deploy/backup/license-server}
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/backup-crypto.sh"
mkdir -p "$BACKUP_DIR"

started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
tmp_archive=$(mktemp "${TMPDIR:-/tmp}/sompro-license-data-$TIMESTAMP.XXXXXX.tar.gz")
encrypted_file="$BACKUP_DIR/sompro-license-data-$TIMESTAMP.tar.gz.enc"
manifest_file="$BACKUP_DIR/sompro-license-data-$TIMESTAMP.manifest.json"

cleanup() {
  rm -f "$tmp_archive"
}
trap cleanup EXIT INT TERM

echo "Creating encrypted License Server JSON data backup..."
docker compose -f "$COMPOSE_FILE" exec -T license-server sh -c 'tar -czf - -C /app/apps/license-server data' > "$tmp_archive"
plaintext_sha256=$(sha256_file "$tmp_archive")
encrypt_backup_file "$tmp_archive" "$encrypted_file"
completed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
write_backup_manifest "$manifest_file" "$encrypted_file" "license_server_data" "$plaintext_sha256" "$started_at" "$completed_at"
rm -f "$tmp_archive"
echo "Encrypted backup saved: $encrypted_file"
echo "Backup manifest saved: $manifest_file"
