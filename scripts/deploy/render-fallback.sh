#!/usr/bin/env bash
set -euo pipefail

: "${RENDER_DEPLOY_HOOK_URL:?RENDER_DEPLOY_HOOK_URL is required}"

curl --fail --silent --show-error --request POST "$RENDER_DEPLOY_HOOK_URL" >/dev/null
echo "Render deploy hook accepted the request."
