#!/usr/bin/env sh
set -eu

BACKUP_ROOT=${BACKUP_ROOT:-deploy/backup}
KEEP_DAYS=${KEEP_DAYS:-30}

if [ "${CONFIRM_ROTATE:-no}" != "yes" ]; then
  echo "This removes backups older than $KEEP_DAYS days under $BACKUP_ROOT."
  echo "Re-run with CONFIRM_ROTATE=yes to continue."
  exit 1
fi

if [ ! -d "$BACKUP_ROOT" ]; then
  echo "Backup root does not exist: $BACKUP_ROOT"
  exit 0
fi

find "$BACKUP_ROOT" -type f \( -name '*.sql' -o -name '*.tar.gz' \) -mtime +"$KEEP_DAYS" -print -delete
echo "Rotation completed."
