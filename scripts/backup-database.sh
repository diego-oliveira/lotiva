#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/lotiva/database}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="$BACKUP_DIR/lotiva-$TIMESTAMP.dump"
TEMP_FILE="$BACKUP_FILE.tmp"
CHECKSUM_FILE="$BACKUP_FILE.sha256"
LOCK_DIR="${BACKUP_LOCK_DIR:-/tmp/lotiva-database-backup.lock}"

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1"
}

fail() {
  log "ERRO: $1" >&2
  exit 1
}

command -v docker >/dev/null 2>&1 || fail "docker nao esta instalado."
if command -v sha256sum >/dev/null 2>&1; then
  CHECKSUM_COMMAND=(sha256sum)
elif command -v shasum >/dev/null 2>&1; then
  CHECKSUM_COMMAND=(shasum -a 256)
else
  fail "Nenhum utilitario SHA-256 foi encontrado."
fi
[[ -f "$ENV_FILE" ]] || fail "Arquivo de ambiente nao encontrado: $ENV_FILE"
[[ -f "$COMPOSE_FILE" ]] || fail "Arquivo do Docker Compose nao encontrado: $COMPOSE_FILE"
[[ "$BACKUP_RETENTION_DAYS" =~ ^[0-9]+$ ]] || fail "BACKUP_RETENTION_DAYS deve ser um numero inteiro."

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
umask 077

mkdir "$LOCK_DIR" 2>/dev/null || fail "Ja existe um backup em execucao."

cleanup() {
  rm -f "$TEMP_FILE"
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT

cd "$ROOT_DIR"

if ! docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps --status running postgres \
  | grep -q postgres; then
  fail "O container PostgreSQL nao esta em execucao."
fi

log "Iniciando backup para $BACKUP_FILE"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_dump \
    --format=custom \
    --compress=9 \
    --no-owner \
    --no-acl \
    --username="$POSTGRES_USER" \
    "$POSTGRES_DB"' > "$TEMP_FILE"

[[ -s "$TEMP_FILE" ]] || fail "O arquivo de backup foi criado vazio."

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  pg_restore --list < "$TEMP_FILE" >/dev/null

mv "$TEMP_FILE" "$BACKUP_FILE"
(
  cd "$BACKUP_DIR"
  "${CHECKSUM_COMMAND[@]}" "$(basename "$BACKUP_FILE")" > "$(basename "$CHECKSUM_FILE")"
)

find "$BACKUP_DIR" -type f \
  \( -name 'lotiva-*.dump' -o -name 'lotiva-*.dump.sha256' \) \
  -mtime "+$BACKUP_RETENTION_DAYS" -delete

log "Backup concluido: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
