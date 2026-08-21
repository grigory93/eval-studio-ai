#!/usr/bin/env bash
set -euo pipefail

# Deployment script for Google Cloud Agent Platform / Agent Runtime using agents-cli

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-}"
LOCATION="${GOOGLE_CLOUD_LOCATION:-us-central1}"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: GOOGLE_CLOUD_PROJECT environment variable is not set."
  exit 1
fi

echo "==> Deploying EvalStudio internal ADK agents to Google Cloud Agent Platform..."
agents-cli deploy agent-runtime \
  --project="$PROJECT_ID" \
  --region="$LOCATION" \
  --service-account="evalstudio-sa@${PROJECT_ID}.iam.gserviceaccount.com"

echo "==> ADK Agent Runtime deployment complete!"
