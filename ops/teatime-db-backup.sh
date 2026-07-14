#!/usr/bin/env bash
set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/opt/teatime-ops}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.production.yml}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/teatime}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

umask 077
mkdir -p "$BACKUP_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
temporary_file="$BACKUP_DIR/.teatime_ops_${timestamp}.sql.gz"
final_file="$BACKUP_DIR/teatime_ops_${timestamp}.sql.gz"

cd "$COMPOSE_DIR"
docker compose -f "$COMPOSE_FILE" exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip -9 >"$temporary_file"

test -s "$temporary_file"
mv "$temporary_file" "$final_file"
find "$BACKUP_DIR" -type f -name 'teatime_ops_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
