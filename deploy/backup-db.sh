#!/usr/bin/env bash
# ZoloFund — daily MySQL backup (INFRA-05).
#
# Install:
#   chmod +x /home/loantrack/deploy/backup-db.sh
#   crontab -e
#   # Add:
#   0 2 * * * /home/loantrack/deploy/backup-db.sh >> /var/log/zolofund-backup.log 2>&1
#
# Reads creds from /etc/zolofund/backup.env which must contain:
#   DB_HOST=localhost
#   DB_USER=loantrack_backup
#   DB_PASS=...
#   DB_NAME=zolofund
#   BACKUP_DIR=/var/backups/zolofund
#   RETENTION_DAYS=30
#   # Optional offsite sync:
#   # RCLONE_REMOTE=b2:zolofund-backups

set -euo pipefail

CONF=/etc/zolofund/backup.env
if [ ! -f "$CONF" ]; then
  echo "[backup] config not found: $CONF" >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$CONF"

: "${DB_HOST:=localhost}"
: "${DB_USER:?DB_USER not set}"
: "${DB_PASS:?DB_PASS not set}"
: "${DB_NAME:?DB_NAME not set}"
: "${BACKUP_DIR:=/var/backups/zolofund}"
: "${RETENTION_DAYS:=30}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP=$(date +%Y%m%d-%H%M%S)
FILE="$BACKUP_DIR/zolofund-$STAMP.sql.gz"
TMP="$FILE.tmp"

echo "[backup $(date -Iseconds)] start -> $FILE"

# --single-transaction: consistent snapshot w/o locking InnoDB tables.
# --quick + --routines + --triggers: standard prod-safe dump options.
MYSQL_PWD="$DB_PASS" mysqldump \
  -h "$DB_HOST" -u "$DB_USER" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --events \
  --default-character-set=utf8mb4 \
  "$DB_NAME" \
  | gzip -9 > "$TMP"

mv "$TMP" "$FILE"
SIZE=$(du -h "$FILE" | awk '{print $1}')
echo "[backup $(date -Iseconds)] done size=$SIZE"

# Retention: drop dumps older than RETENTION_DAYS.
find "$BACKUP_DIR" -maxdepth 1 -name 'zolofund-*.sql.gz' -mtime +"$RETENTION_DAYS" -print -delete \
  || echo "[backup] retention prune failed (non-fatal)"

# Optional offsite copy via rclone (Backblaze B2 / S3 / etc.).
if [ -n "${RCLONE_REMOTE:-}" ]; then
  if command -v rclone >/dev/null 2>&1; then
    rclone copy --quiet "$FILE" "$RCLONE_REMOTE/$(date +%Y/%m)/" \
      && echo "[backup] offsite uploaded to $RCLONE_REMOTE" \
      || echo "[backup] offsite upload FAILED — investigate"
  fi
fi

echo "[backup $(date -Iseconds)] complete"
