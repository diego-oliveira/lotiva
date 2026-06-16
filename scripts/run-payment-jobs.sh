#!/usr/bin/env sh
set -eu

MODE="${1:-events}"
ENV_FILE="${ENV_FILE:-.env.production}"
APP_URL="${PAYMENT_JOB_URL:-http://127.0.0.1:3000}"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

if [ -z "${CRON_SECRET:-}" ]; then
  echo "CRON_SECRET nao esta configurado." >&2
  exit 1
fi

case "$MODE" in
  events|daily) ;;
  *)
    echo "Modo invalido. Use events ou daily." >&2
    exit 1
    ;;
esac

curl --fail --silent --show-error \
  --request POST \
  --header "Authorization: Bearer ${CRON_SECRET}" \
  "${APP_URL}/api/jobs/payments?mode=${MODE}"
echo
