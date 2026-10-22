#!/usr/bin/env bash
set -euo pipefail

service=${1:?usage: rollback.sh SERVICE}
: "${GCP_PROJECT_ID:?GCP_PROJECT_ID is required}"
: "${GCP_REGION:?GCP_REGION is required}"

last_good=$(gcloud run services describe "$service" \
  --project="$GCP_PROJECT_ID" --region="$GCP_REGION" \
  --format="value(status.traffic[?tag='last-good'].revisionName)")

if [[ -z "$last_good" ]]; then
  echo "No last-good revision exists; refusing to guess a rollback target" >&2
  exit 1
fi

gcloud run services update-traffic "$service" \
  --project="$GCP_PROJECT_ID" --region="$GCP_REGION" \
  --to-tags=last-good=100 --quiet

printf 'Rolled %s back to %s.\n' "$service" "$last_good"
