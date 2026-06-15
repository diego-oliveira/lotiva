#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
DEPLOY_REMOTE="${DEPLOY_REMOTE:-origin}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"

cd "$ROOT_DIR"

log() {
  printf '\n==> %s\n' "$1"
}

fail() {
  printf '\nErro: %s\n' "$1" >&2
  exit 1
}

command -v git >/dev/null 2>&1 || fail "git nao esta instalado."
command -v docker >/dev/null 2>&1 || fail "docker nao esta instalado."
docker compose version >/dev/null 2>&1 || fail "Docker Compose nao esta disponivel."

[[ -f "$ENV_FILE" ]] || fail "Arquivo $ENV_FILE nao encontrado."
[[ -f "$COMPOSE_FILE" ]] || fail "Arquivo $COMPOSE_FILE nao encontrado."

if [[ -n "$(git status --porcelain)" ]]; then
  fail "Existem alteracoes locais. Revise git status antes de executar o deploy."
fi

log "Atualizando $DEPLOY_REMOTE/$DEPLOY_BRANCH"
git fetch "$DEPLOY_REMOTE" "$DEPLOY_BRANCH"
git pull --ff-only "$DEPLOY_REMOTE" "$DEPLOY_BRANCH"

log "Reconstruindo e atualizando os containers"
docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  up -d --build --remove-orphans

log "Status dos containers"
docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  ps

if [[ "${1:-}" == "--prune" ]]; then
  log "Removendo imagens Docker nao utilizadas"
  docker image prune -f
fi

printf '\nDeploy concluido.\n'
printf 'Logs: docker compose --env-file %s -f %s logs -f app\n' "$ENV_FILE" "$COMPOSE_FILE"
