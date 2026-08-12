#!/usr/bin/env sh
set -eu

COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.production.yml}
BACKUP_FILE=${1:-}
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$SCRIPT_DIR/backup-crypto.sh"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Usage: CONFIRM_RESTORE=yes SOM_BACKUP_PASSPHRASE=... $0 path/to/backup.sql.enc" >&2
  exit 1
fi

if [ "${CONFIRM_RESTORE:-no}" != "yes" ]; then
  echo "Restore is destructive. Re-run with CONFIRM_RESTORE=yes after taking a fresh backup." >&2
  exit 1
fi

case "$BACKUP_FILE" in
  *.enc)
    tmp_sql=$(mktemp "${TMPDIR:-/tmp}/sompro-restore.XXXXXX.sql")
    cleanup() {
      rm -f "$tmp_sql"
    }
    trap cleanup EXIT INT TERM
    decrypt_backup_file "$BACKUP_FILE" "$tmp_sql"
    ;;
  *.sql)
    if [ "${ALLOW_PLAINTEXT_RESTORE:-no}" != "yes" ]; then
      echo "Plaintext restore files are blocked. Use encrypted .enc backups or set ALLOW_PLAINTEXT_RESTORE=yes only for isolated tests." >&2
      exit 1
    fi
    tmp_sql="$BACKUP_FILE"
    ;;
  *)
    echo "Unsupported backup extension. Expected .sql.enc." >&2
    exit 1
    ;;
esac

echo "Restoring PostgreSQL backup: $BACKUP_FILE"
cat "$tmp_sql" | docker compose -f "$COMPOSE_FILE" exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
echo "Restore completed. Review application logs before allowing users back in."
