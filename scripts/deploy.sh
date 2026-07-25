#!/usr/bin/env bash
#
# Deploy app.brianjordans.com: build, upload to S3, and purge every CloudFront
# edge cache of the previous version. Bucket and distribution are resolved from
# the BrianJordansConsole stack outputs so the two never drift apart.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONSOLE_DIR="$REPO_ROOT/app"
STACK="BrianJordansConsole"
DOMAIN="https://app.brianjordans.com"

stack_output() {
  aws cloudformation describe-stacks \
    --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
    --output text
}

echo "==> Resolving $STACK outputs"
BUCKET="$(stack_output ConsoleBucketName)"
DISTRIBUTION_ID="$(stack_output ConsoleDistributionId)"

if [[ -z "$BUCKET" || -z "$DISTRIBUTION_ID" || "$BUCKET" == "None" ]]; then
  echo "ERROR: could not resolve bucket/distribution from $STACK. Deploy the stack first." >&2
  exit 1
fi

echo "==> Building console"
cd "$CONSOLE_DIR"
npm run build

echo "==> Uploading to s3://$BUCKET"
# Hashed assets: immutable, cached for a year at browsers and edges.
aws s3 sync dist/ "s3://$BUCKET/" \
  --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html"

# The console shell is authenticated content, so it is never stored by a
# browser or a shared cache.
aws s3 cp dist/index.html "s3://$BUCKET/index.html" \
  --cache-control "no-store, no-cache, must-revalidate" \
  --content-type "text/html"

echo "==> Invalidating CloudFront distribution $DISTRIBUTION_ID (all paths)"
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)

echo "==> Waiting for invalidation $INVALIDATION_ID to complete at all edge locations"
aws cloudfront wait invalidation-completed \
  --distribution-id "$DISTRIBUTION_ID" \
  --id "$INVALIDATION_ID"

echo "==> Verifying live console serves the new bundle"
EXPECTED_JS=$(basename "$(ls "$CONSOLE_DIR"/dist/assets/index-*.js)")
LIVE_HTML=$(curl -sf "$DOMAIN/?deploy-check=$(date +%s)")
if ! grep -q "$EXPECTED_JS" <<<"$LIVE_HTML"; then
  echo "ERROR: live console does not reference expected bundle $EXPECTED_JS" >&2
  exit 1
fi

echo "==> Deploy complete: $DOMAIN is serving $EXPECTED_JS"
