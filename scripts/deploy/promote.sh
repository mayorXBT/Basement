#!/usr/bin/env bash
set -euo pipefail

service=${1:?usage: promote.sh SERVICE CANDIDATE_TAG}
candidate_tag=${2:?usage: promote.sh SERVICE CANDIDATE_TAG}
: "${GCP_PROJECT_ID:?GCP_PROJECT_ID is required}"
: "${GCP_REGION:?GCP_REGION is required}"

describe() {
  gcloud run services describe "$service" --project="$GCP_PROJECT_ID" --region="$GCP_REGION" "$@"
}

candidate_revision=$(describe --format="value(status.traffic[?tag='$candidate_tag'].revisionName)")
current_revision=$(describe --format="value(status.traffic[?percent=100].revisionName)" | head -n 1)

if [[ -z "$candidate_revision" ]]; then
  echo "No revision is tagged $candidate_tag" >&2
  exit 1
fi

if [[ -n "$current_revision" && "$current_revision" != "$candidate_revision" ]]; then
  gcloud run services update-traffic "$service" \
    --project="$GCP_PROJECT_ID" --region="$GCP_REGION" \
    --update-tags="last-good=$current_revision" --quiet >&2
fi

gcloud run services update-traffic "$service" \
  --project="$GCP_PROJECT_ID" --region="$GCP_REGION" \
  --to-revisions="$candidate_revision=100" --quiet >&2

if [[ -z "$current_revision" || "$current_revision" == "$candidate_revision" ]]; then
  gcloud run services update-traffic "$service" \
    --project="$GCP_PROJECT_ID" --region="$GCP_REGION" \
    --update-tags="last-good=$candidate_revision" --quiet >&2
fi

printf 'Promoted %s to 100%%; rollback tag is last-good.\n' "$candidate_revision"
