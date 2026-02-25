#!/bin/bash
# SQLite backup script for Retention Center
DB_PATH="/opt/retention-center/prod.db"
BACKUP_DIR="/opt/retention-center/backups"
RETENTION_DAYS=7
LOG="/var/log/rc-backup.log"

mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/rc-$(date +%Y%m%d-%H%M%S).db"

echo "[$(date)] Starting backup..." >> "$LOG"
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'" 2>> "$LOG"
gzip "$BACKUP_FILE" 2>> "$LOG"
echo "[$(date)] Backup created: ${BACKUP_FILE}.gz" >> "$LOG"

# Cleanup old backups
find "$BACKUP_DIR" -name "rc-*.db.gz" -mtime +$RETENTION_DAYS -delete
echo "[$(date)] Cleanup complete" >> "$LOG"
