#!/usr/bin/env bash
set -euo pipefail

service=${1:?usage: cloudrun.sh SERVICE TAG}
tag=${2:?usage: cloudrun.sh SERVICE TAG}

: "${GCP_PROJECT_ID:?GCP_PROJECT_ID is required}"
: "${GCP_REGION:?GCP_REGION is required}"
: "${CLOUD_RUN_RUNTIME_SA:?CLOUD_RUN_RUNTIME_SA is required}"
: "${IMAGE_DIGEST_REF:?IMAGE_DIGEST_REF is required}"

if [[ ! "$IMAGE_DIGEST_REF" =~ @sha256:[a-f0-9]{64}$ ]]; then
  echo "IMAGE_DIGEST_REF must be an immutable registry digest" >&2
  exit 1
fi

access_flag=--no-allow-unauthenticated
if [[ "${CLOUD_RUN_PUBLIC_ACCESS:-0}" == "1" ]]; then
  access_flag=--allow-unauthenticated
fi

gcloud run deploy "$service" \
  --project="$GCP_PROJECT_ID" \
  --region="$GCP_REGION" \
  --platform=managed \
  --image="$IMAGE_DIGEST_REF" \
  --service-account="$CLOUD_RUN_RUNTIME_SA" \
  --port=8080 \
  --cpu=1 \
  --memory=512Mi \
  --concurrency=80 \
  --timeout=300 \
  --min=0 \
  --max=2 \
  --execution-environment=gen2 \
  --ingress=all \
  --set-env-vars=TRUST_PROXY=1 \
  --set-secrets=GEMINI_API_KEY=gemini-api-key:latest,DEEPGRAM_API_KEY=deepgram-api-key:latest,GROQ_API_KEY=groq-api-key:latest \
  --no-traffic \
  --tag="$tag" \
  "$access_flag" \
  --quiet >&2

scripts/deploy/tag-url.sh "$service" "$tag"
