#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.prod.yml}"
BACKUP_FILE="${1:-}"
CONFIRMATION="${2:-}"

fail() {
  printf 'Erro: %s\n' "$1" >&2
  exit 1
}

[[ -n "$BACKUP_FILE" ]] || fail "Uso: ./scripts/restore-database.sh ARQUIVO.dump --yes"
[[ "$CONFIRMATION" == "--yes" ]] || fail "A restauracao substitui a base atual. Confirme com --yes."
[[ -f "$BACKUP_FILE" ]] || fail "Backup nao encontrado: $BACKUP_FILE"
[[ -f "$ENV_FILE" ]] || fail "Arquivo de ambiente nao encontrado: $ENV_FILE"
[[ -f "$COMPOSE_FILE" ]] || fail "Arquivo do Docker Compose nao encontrado: $COMPOSE_FILE"
command -v docker >/dev/null 2>&1 || fail "docker nao esta instalado."

BACKUP_FILE="$(cd "$(dirname "$BACKUP_FILE")" && pwd)/$(basename "$BACKUP_FILE")"
CHECKSUM_FILE="$BACKUP_FILE.sha256"

if [[ -f "$CHECKSUM_FILE" ]]; then
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "$(dirname "$BACKUP_FILE")" && sha256sum -c "$(basename "$CHECKSUM_FILE")")
  elif command -v shasum >/dev/null 2>&1; then
    (cd "$(dirname "$BACKUP_FILE")" && shasum -a 256 -c "$(basename "$CHECKSUM_FILE")")
  else
    fail "Nenhum utilitario SHA-256 foi encontrado."
  fi
fi

cd "$ROOT_DIR"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  pg_restore --list < "$BACKUP_FILE" >/dev/null

printf 'Criando backup de seguranca do estado atual.\n'
ENV_FILE="$ENV_FILE" \
COMPOSE_FILE="$COMPOSE_FILE" \
BACKUP_DIR="${PRE_RESTORE_BACKUP_DIR:-/var/backups/lotiva/database}" \
  "$ROOT_DIR/scripts/backup-database.sh"

printf 'Restaurando %s. A aplicacao ficara temporariamente indisponivel.\n' "$BACKUP_FILE"
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" stop app

restart_app() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d app >/dev/null
}
trap restart_app EXIT

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" dropdb \
    --if-exists \
    --force \
    --username="$POSTGRES_USER" \
    "$POSTGRES_DB" &&
    PGPASSWORD="$POSTGRES_PASSWORD" createdb \
    --username="$POSTGRES_USER" \
    "$POSTGRES_DB"'

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" exec pg_restore \
    --exit-on-error \
    --no-owner \
    --no-acl \
    --username="$POSTGRES_USER" \
    --dbname="$POSTGRES_DB"' < "$BACKUP_FILE"

restart_app
trap - EXIT

printf 'Restauracao concluida.\n'
