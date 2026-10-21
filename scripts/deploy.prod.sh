#!/bin/bash
# Build locally; this script performs SSH only when the operator explicitly runs a deploy.
set -euo pipefail
cd "$(dirname "$0")/.."
SERVER="${SERVER:-ptdevs@167.86.125.164}"
SSH_KEY="${SSH_KEY-$HOME/.ssh/police}"
REMOTE_DIR="${REMOTE_DIR:-/home/ptdevs/internal/chibi-town}"
ENV_FILE="${ENV_FILE:-deploy/.env.prod}"
PROJECT_NAME="${PROJECT_NAME:-chibi-town-prod}"
BUILD_ONLY=false
BUILD_WEB=false
BUILD_API=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --web-only) BUILD_WEB=true; shift ;;
    --api-only) BUILD_API=true; shift ;;
    --build-only) BUILD_ONLY=true; shift ;;
    --server) SERVER="$2"; shift 2 ;;
    --help) echo 'Usage: scripts/deploy.prod.sh [--web-only|--api-only] [--build-only] [--server user@host]'; exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done
if [[ "$BUILD_WEB" == false && "$BUILD_API" == false ]]; then BUILD_WEB=true; BUILD_API=true; fi
if [[ "$BUILD_ONLY" == false && ! -f "$ENV_FILE" ]]; then echo "Missing $ENV_FILE"; exit 1; fi
[[ "$REMOTE_DIR" =~ ^/[a-zA-Z0-9_./-]+$ && "$PROJECT_NAME" =~ ^[a-zA-Z0-9_-]+$ ]] || { echo 'Invalid remote directory/project'; exit 1; }
SSH_OPTS=(-o ServerAliveInterval=15)
[[ -n "$SSH_KEY" ]] && SSH_OPTS+=(-i "$SSH_KEY")
# Only public build settings leave the env parser. Never source or print backend secrets.
public_setting() {
  if [[ -f "$ENV_FILE" ]]; then
    node --env-file="$ENV_FILE" -e 'process.stdout.write(process.env[process.argv[1]] ?? process.argv[2])' "$1" "$2"
  else
    node -e 'process.stdout.write(process.env[process.argv[1]] ?? process.argv[2])' "$1" "$2"
  fi
}
docker info >/dev/null
pnpm check
FILES=()
SERVICES=()
PREVIOUS_IMAGES=()
STAMP=$(date -u +%Y%m%d%H%M%S)
if [[ "$BUILD_API" == true ]]; then
  PREVIOUS_IMAGE=$(docker image inspect --format '{{.Id}}' chibi-town-api:latest 2>/dev/null || true)
  [[ -z "$PREVIOUS_IMAGE" ]] || PREVIOUS_IMAGES+=("$PREVIOUS_IMAGE")
  [[ -z "$PREVIOUS_IMAGE" ]] || docker tag "$PREVIOUS_IMAGE" "chibi-town-api:rollback-$STAMP"
  docker build --platform linux/amd64 --label com.chibi-town.app=farm -f apps/api/Dockerfile -t chibi-town-api:latest .
  docker save chibi-town-api:latest | gzip > chibi-town-api.tar.gz
  FILES+=(chibi-town-api.tar.gz)
  SERVICES+=(api worker)
fi
if [[ "$BUILD_WEB" == true ]]; then
  PREVIOUS_IMAGE=$(docker image inspect --format '{{.Id}}' chibi-town-web:latest 2>/dev/null || true)
  [[ -z "$PREVIOUS_IMAGE" ]] || PREVIOUS_IMAGES+=("$PREVIOUS_IMAGE")
  [[ -z "$PREVIOUS_IMAGE" ]] || docker tag "$PREVIOUS_IMAGE" "chibi-town-web:rollback-$STAMP"
  docker build --platform linux/amd64 --label com.chibi-town.app=farm -f apps/game/Dockerfile -t chibi-town-web:latest \
    --build-arg "NEXT_PUBLIC_BASE_PATH=$(public_setting NEXT_PUBLIC_BASE_PATH '')" \
    --build-arg "NEXT_PUBLIC_API_URL=$(public_setting NEXT_PUBLIC_API_URL /api)" \
    --build-arg "NEXT_PUBLIC_SITE_URL=$(public_setting NEXT_PUBLIC_SITE_URL '')" .
  docker save chibi-town-web:latest | gzip > chibi-town-web.tar.gz
  FILES+=(chibi-town-web.tar.gz)
  SERVICES+=(web)
fi
if [[ "$BUILD_ONLY" == true ]]; then
  bash scripts/prune-farm-images.sh "${PREVIOUS_IMAGES[@]}"
  echo "Built: ${FILES[*]}"
  exit 0
fi
ssh "${SSH_OPTS[@]}" "$SERVER" "umask 077; mkdir -p '$REMOTE_DIR'; touch '$REMOTE_DIR/.env.prod.upload'; chmod 600 '$REMOTE_DIR/.env.prod.upload'"
scp "${SSH_OPTS[@]}" "${FILES[@]}" "$SERVER:$REMOTE_DIR/"
scp "${SSH_OPTS[@]}" scripts/prune-farm-images.sh "$SERVER:$REMOTE_DIR/prune-farm-images.sh"
scp "${SSH_OPTS[@]}" deploy/docker-compose.sso.yml "$SERVER:$REMOTE_DIR/docker-compose.sso.yml"
scp "${SSH_OPTS[@]}" deploy/docker-compose.prod.yml "$SERVER:$REMOTE_DIR/docker-compose.yml"
# Temporary upload stays private even when replacing an existing permissive env file.
scp "${SSH_OPTS[@]}" "$ENV_FILE" "$SERVER:$REMOTE_DIR/.env.prod.upload"
USE_SSO_NETWORK=false
[[ -z "$(public_setting SSO_NETWORK '')" ]] || USE_SSO_NETWORK=true
printf -v REMOTE_COMMAND '%q ' bash -s -- "$REMOTE_DIR" "$PROJECT_NAME" "$STAMP" "${FILES[*]}" "${SERVICES[*]}" "$USE_SSO_NETWORK"
ssh "${SSH_OPTS[@]}" "$SERVER" "$REMOTE_COMMAND" <<'REMOTE'
set -euo pipefail
cd "$1"
chmod 600 .env.prod.upload
[[ ! -f .env.prod ]] || install -m 600 .env.prod ".env.prod.backup-$3"
mv .env.prod.upload .env.prod
PREVIOUS_IMAGES=()
for file in $4; do
  image=${file%.tar.gz}
  PREVIOUS_IMAGE=$(docker image inspect --format '{{.Id}}' "$image:latest" 2>/dev/null || true)
  [[ -z "$PREVIOUS_IMAGE" ]] || PREVIOUS_IMAGES+=("$PREVIOUS_IMAGE")
  docker image inspect "$image:latest" >/dev/null 2>&1 && docker tag "$image:latest" "$image:rollback-$3" || true
done
for file in $4; do docker load < "$file"; rm -f "$file"; done
# Compose dependencies include private Postgres/Redis; keep volumes.
COMPOSE=(-f docker-compose.yml)
[[ "$6" == false ]] || COMPOSE+=(-f docker-compose.sso.yml)
# Compose --wait rejects a service with healthcheck disabled on some server versions.
# Wait for HTTP services and their healthy dependencies before starting the worker.
WAIT_SERVICES=()
START_WORKER=false
for service in $5; do
  if [[ "$service" == worker ]]; then START_WORKER=true; else WAIT_SERVICES+=("$service"); fi
done
docker compose "${COMPOSE[@]}" --env-file .env.prod -p "$2" up -d --wait "${WAIT_SERVICES[@]}"
if [[ "$START_WORKER" == true ]]; then
  docker compose "${COMPOSE[@]}" --env-file .env.prod -p "$2" up -d --no-build worker
  WORKER_ID=$(docker compose "${COMPOSE[@]}" --env-file .env.prod -p "$2" ps -q worker)
  [[ -n "$WORKER_ID" && "$(docker inspect --format '{{.State.Running}}' "$WORKER_ID")" == true ]]
fi
docker compose "${COMPOSE[@]}" --env-file .env.prod -p "$2" ps
bash prune-farm-images.sh "${PREVIOUS_IMAGES[@]}"
REMOTE
rm -f "${FILES[@]}"
bash scripts/prune-farm-images.sh "${PREVIOUS_IMAGES[@]}"
echo 'Farm production deploy complete.'
