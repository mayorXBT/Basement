#!/usr/bin/env bash
set -euo pipefail

service=${1:?usage: tag-url.sh SERVICE TAG}
tag=${2:?usage: tag-url.sh SERVICE TAG}
: "${GCP_PROJECT_ID:?GCP_PROJECT_ID is required}"
: "${GCP_REGION:?GCP_REGION is required}"

url=$(gcloud run services describe "$service" \
  --project="$GCP_PROJECT_ID" \
  --region="$GCP_REGION" \
  --format="value(status.traffic[?tag='$tag'].url)")

if [[ -z "$url" ]]; then
  echo "Cloud Run did not report a URL for tag $tag" >&2
  exit 1
fi

printf '%s\n' "$url"
