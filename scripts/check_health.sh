#!/usr/bin/env bash
# Post-deploy health check for the Yuma Skincare shop.
#
# Usage:   scripts/check_health.sh [BASE_URL] [RETRIES] [DELAY_SECONDS]
# Example: scripts/check_health.sh http://localhost:3000
#          scripts/check_health.sh https://shop.example.com 30 10
#
# Checks /health, /api/products and the home page. Retries so it can be used
# right after a deploy while the new containers are still starting.
# Exit code 0 = healthy, 1 = unhealthy, 2 = bad usage.

set -u

BASE_URL="${1:-${BASE_URL:-http://localhost:3000}}"
BASE_URL="${BASE_URL%/}"
RETRIES="${2:-${RETRIES:-10}}"
DELAY="${3:-${DELAY:-3}}"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required but not installed" >&2
  exit 2
fi
case "$RETRIES$DELAY" in
  *[!0-9]*) echo "RETRIES and DELAY must be whole numbers" >&2; exit 2 ;;
esac

# Prints the HTTP status code (000 if the connection failed).
status_of() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$BASE_URL$1" || true
}

check_once() {
  local code body
  code="$(status_of /health)"
  if [ "$code" != "200" ]; then
    echo "  /health returned HTTP $code"
    return 1
  fi
  body="$(curl -s --max-time 5 "$BASE_URL/health" || true)"
  case "$body" in
    *'"status":"ok"'*) ;;
    *) echo "  /health body did not contain status ok: $body"; return 1 ;;
  esac
  code="$(status_of /api/products)"
  if [ "$code" != "200" ]; then
    echo "  /api/products returned HTTP $code"
    return 1
  fi
  code="$(status_of /)"
  if [ "$code" != "200" ]; then
    echo "  / returned HTTP $code"
    return 1
  fi
  return 0
}

echo "Checking $BASE_URL (up to $RETRIES attempts, ${DELAY}s apart)"
attempt=1
while [ "$attempt" -le "$RETRIES" ]; do
  if check_once; then
    echo "HEALTHY after $attempt attempt(s): $BASE_URL"
    exit 0
  fi
  echo "Attempt $attempt/$RETRIES failed"
  attempt=$((attempt + 1))
  [ "$attempt" -le "$RETRIES" ] && sleep "$DELAY"
done

echo "UNHEALTHY: $BASE_URL did not pass after $RETRIES attempts" >&2
exit 1
