#!/usr/bin/env bash
set -euo pipefail

# Deployment script for Google Cloud Run with Vertex AI Application Default Credentials (ADC)
# Requires IAM Service Account with roles/aiplatform.user

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-}"
LOCATION="${GOOGLE_CLOUD_LOCATION:-us-central1}"
SERVICE_NAME="eval-studio-ai"
IMAGE_TAG="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: GOOGLE_CLOUD_PROJECT environment variable is not set."
  exit 1
fi

echo "==> Building container image with Google Cloud Build..."
gcloud builds submit --tag "$IMAGE_TAG" .

echo "==> Deploying to Google Cloud Run in region $LOCATION..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_TAG" \
  --platform managed \
  --region "$LOCATION" \
  --service-account "evalstudio-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --set-env-vars GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT="$PROJECT_ID",GOOGLE_CLOUD_LOCATION="$LOCATION" \
  --allow-unauthenticated

echo "==> Deployment to Cloud Run completed successfully!"
