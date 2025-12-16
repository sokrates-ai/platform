#!/usr/bin/env bash

set -euo pipefail

API_BASE=${API_BASE:-http://localhost:1338}
ENDPOINT="${API_BASE%/}/api/v1/invlectrooms"
TARGET_URL=${1:-https://rooms.test/example}

payload=$(printf '{"url": "%s"}' "$TARGET_URL")

echo "POST ${ENDPOINT}"
echo "Payload: ${payload}"

curl_opts=(
  -sS
  -X POST
  -H "Content-Type: application/json"
  -d "${payload}"
  "${ENDPOINT}"
)

if command -v jq >/dev/null 2>&1; then
  curl "${curl_opts[@]}" | jq
else
  curl "${curl_opts[@]}"
fi
