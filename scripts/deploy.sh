#!/usr/bin/env bash
#
# Deploy app.brianjordans.com: build the container image, push it to ECR, and
# roll the Fargate service onto it. Repository, cluster, and service are
# resolved from stack outputs so nothing drifts apart.
#
# Infrastructure changes go through `cdk deploy`; this script only ships the
# application.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FOUNDATION_STACK="BrianJordansConsoleFoundation"
SERVICE_STACK="BrianJordansConsole"
REGION="${AWS_REGION:-us-east-1}"

stack_output() {
  aws cloudformation describe-stacks \
    --stack-name "$1" \
    --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue" \
    --output text 2>/dev/null
}

require() {
  if [[ -z "$1" || "$1" == "None" ]]; then
    echo "ERROR: $2" >&2
    exit 1
  fi
}

command -v docker >/dev/null 2>&1 || {
  echo "ERROR: docker is required to build the console image." >&2
  exit 1
}

echo "==> Resolving stack outputs"
REPOSITORY_URI="$(stack_output "$FOUNDATION_STACK" RepositoryUri)"
require "$REPOSITORY_URI" "could not resolve the ECR repository. Deploy $FOUNDATION_STACK first."

CLUSTER="$(stack_output "$SERVICE_STACK" ClusterName)"
SERVICE="$(stack_output "$SERVICE_STACK" ServiceName)"
LB_DNS="$(stack_output "$SERVICE_STACK" LoadBalancerDns)"

REGISTRY="${REPOSITORY_URI%%/*}"
GIT_SHA="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo "nogit")"
TAG="${GIT_SHA}-$(date -u +%Y%m%d%H%M%S)"

echo "==> Building image ${REPOSITORY_URI}:${TAG}"
# The task definition pins linux/amd64, so build for it explicitly rather than
# inheriting the host architecture. Provenance attestations are disabled
# because they push extra untagged manifests that the ECR lifecycle rules would
# then have to reason about.
docker build \
  --platform linux/amd64 \
  --provenance=false \
  --sbom=false \
  -t "${REPOSITORY_URI}:${TAG}" \
  -t "${REPOSITORY_URI}:latest" \
  "$REPO_ROOT"

echo "==> Signing in to ECR"
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"

echo "==> Pushing image"
docker push "${REPOSITORY_URI}:${TAG}"
docker push "${REPOSITORY_URI}:latest"

if [[ -z "$CLUSTER" || "$CLUSTER" == "None" ]]; then
  echo "==> $SERVICE_STACK is not deployed yet; image is pushed and ready."
  echo "    Run 'npm run deploy:infra' in infra/ next."
  exit 0
fi

echo "==> Rolling service $SERVICE on cluster $CLUSTER"
aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --force-new-deployment \
  --region "$REGION" \
  --no-cli-pager \
  --query 'service.deployments[0].id' \
  --output text

echo "==> Waiting for the service to reach a steady state (this takes a few minutes)"
if ! aws ecs wait services-stable \
  --cluster "$CLUSTER" \
  --services "$SERVICE" \
  --region "$REGION"; then
  echo "ERROR: the service did not stabilize. Recent events:" >&2
  aws ecs describe-services \
    --cluster "$CLUSTER" \
    --services "$SERVICE" \
    --region "$REGION" \
    --query 'services[0].events[0:10].message' \
    --output text >&2
  exit 1
fi

echo "==> Verifying health through the load balancer"
# Resolve the public hostname to the load balancer directly, so this check
# works both before and after DNS is cut over.
LB_IP="$(getent hosts "$LB_DNS" | awk '{print $1}' | head -1)"
require "$LB_IP" "could not resolve $LB_DNS"

HEALTH_STATUS="$(curl -s -o /dev/null -w '%{http_code}' \
  --resolve "app.brianjordans.com:443:${LB_IP}" \
  "https://app.brianjordans.com/healthz")"

if [[ "$HEALTH_STATUS" != "200" ]]; then
  echo "ERROR: /healthz returned $HEALTH_STATUS through the load balancer" >&2
  exit 1
fi

# An unauthenticated request for an app route must never receive the bundle.
GATE_STATUS="$(curl -s -o /dev/null -w '%{http_code}' \
  --resolve "app.brianjordans.com:443:${LB_IP}" \
  "https://app.brianjordans.com/dashboard")"

if [[ "$GATE_STATUS" != "302" ]]; then
  echo "ERROR: /dashboard returned $GATE_STATUS unauthenticated; expected a 302 to /login" >&2
  exit 1
fi

echo "==> Deploy complete: ${REPOSITORY_URI}:${TAG} is live and the auth gate is enforcing"
