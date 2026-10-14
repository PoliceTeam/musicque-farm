#!/bin/bash
set -e

# ===========================================
# Deploy Chibi Town — PRODUCTION
# Builds linux/amd64 images locally, uploads them and restarts the stack.
# ===========================================

SERVER="couponlinkh"
REMOTE_DIR="/root/apps/chibi-town"
ENV_FILE="deploy/.env.prod"
PROJECT_NAME="chibi-town-prod"
COMPOSE_FILE="deploy/docker-compose.prod.yml"
BUILD_ONLY=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --web-only)   BUILD_WEB=true; shift ;;
    --api-only)   BUILD_API=true; shift ;;
    --build-only) BUILD_ONLY=true; shift ;;
    --server)     SERVER="$2"; shift 2 ;;
    --)           shift ;;
    --help)
      echo "Usage: ./scripts/deploy.prod.sh [options]"
      echo ""
      echo "Options:"
      echo "  --web-only    Build and deploy the game web app only"
      echo "  --api-only    Build and deploy the API only"
      echo "  --build-only  Build the images and save the .tar.gz files, do not upload"
      echo "  --server      Override server (e.g. --server user@ip)"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$BUILD_WEB" && -z "$BUILD_API" ]]; then
  BUILD_WEB=true
  BUILD_API=true
fi
if [[ "$BUILD_ONLY" != true && ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE (copy deploy/.env.prod.example and fill it in)."
  exit 1
fi

echo "========================================"
echo "  PRODUCTION Deploy"
echo "  Server:  $SERVER"
echo "========================================"
echo ""

# Removes the given image IDs unless they are still the current tag or used by a container.
# Only images of this project are touched, so other projects on the server keep theirs.
remove_old_images() {
  for id in $1; do
    if docker images -q chibi-town-api:latest chibi-town-web:latest | grep -q "^$id$"; then continue; fi
    docker rmi "$id" >/dev/null 2>&1 && echo "  Removed old image $id" || true
  done
}

FILES=""
IMAGES=""
[[ "$BUILD_API" == true ]] && IMAGES="chibi-town-api:latest"
[[ "$BUILD_WEB" == true ]] && IMAGES="$IMAGES chibi-town-web:latest"
LOCAL_OLD=$(docker images -q $IMAGES 2>/dev/null | sort -u)

if [[ "$BUILD_API" == true ]]; then
  echo "==> Building API image..."
  docker build --platform linux/amd64 -f apps/api/Dockerfile -t chibi-town-api:latest .
  docker save chibi-town-api:latest | gzip > chibi-town-api.tar.gz
  FILES="chibi-town-api.tar.gz"
fi
if [[ "$BUILD_WEB" == true ]]; then
  echo "==> Building Web image..."
  docker build --platform linux/amd64 -f apps/game/Dockerfile -t chibi-town-web:latest .
  docker save chibi-town-web:latest | gzip > chibi-town-web.tar.gz
  FILES="$FILES chibi-town-web.tar.gz"
fi

echo "==> Removing old local images..."
remove_old_images "$LOCAL_OLD"

if [[ "$BUILD_ONLY" == true ]]; then
  echo "==> Built: $FILES"
  exit 0
fi

echo "==> Uploading to $SERVER..."
ssh "$SERVER" "mkdir -p $REMOTE_DIR"
scp $FILES "$SERVER:$REMOTE_DIR/"
scp "$COMPOSE_FILE" "$SERVER:$REMOTE_DIR/docker-compose.yml"
scp "$ENV_FILE" "$SERVER:$REMOTE_DIR/.env.prod"

echo "==> Loading images and restarting..."
ssh "$SERVER" bash -s <<REMOTE
  set -e
  cd $REMOTE_DIR
  OLD=\$(docker images -q $IMAGES 2>/dev/null | sort -u)
  for f in $FILES; do
    echo "  Loading \$f..."
    docker load < \$f
    rm -f \$f
  done
  docker compose -f docker-compose.yml --env-file .env.prod -p $PROJECT_NAME up -d
  echo "  Removing old images..."
  for id in \$OLD; do
    if docker images -q chibi-town-api:latest chibi-town-web:latest | grep -q "^\$id\$"; then continue; fi
    docker rmi "\$id" >/dev/null 2>&1 && echo "  Removed old image \$id" || true
  done
  echo ""
  docker compose -p $PROJECT_NAME ps
REMOTE

rm -f chibi-town-api.tar.gz chibi-town-web.tar.gz
echo ""
echo "==> PRODUCTION deploy complete!"
