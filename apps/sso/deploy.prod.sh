#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
SERVER="${SERVER:-ptdevs@167.86.125.164}"
SSH_KEY="${SSH_KEY-$HOME/.ssh/police}"
REMOTE_DIR="${REMOTE_DIR:-/home/ptdevs/internal/chibi-sso}"
ENV_FILE="${ENV_FILE:-apps/sso/.env.prod}"
PROJECT_NAME="${PROJECT_NAME:-musicque-sso-prod}"
TUNNEL_PORT="${TUNNEL_PORT:-18180}"
SSO_PORT="${SSO_PORT:-8180}"
BUILD_ONLY=false
SYNC=false
SYNC_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --build-only) BUILD_ONLY=true ;;
    --sync) SYNC=true ;;
    --sync-only) SYNC=true; SYNC_ONLY=true ;;
    --help) echo 'Usage: apps/sso/deploy.prod.sh [--build-only|--sync|--sync-only]'; exit 0 ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done
[[ "$REMOTE_DIR" =~ ^/[a-zA-Z0-9_./-]+$ && "$PROJECT_NAME" =~ ^[a-zA-Z0-9_-]+$ && "$TUNNEL_PORT" =~ ^[0-9]+$ && "$SSO_PORT" =~ ^[0-9]+$ ]] || exit 1
if [[ "$BUILD_ONLY" == true && "$SYNC_ONLY" == true ]]; then echo 'Cannot combine --build-only and --sync-only'; exit 1; fi
SSH_OPTS=(-o ServerAliveInterval=15)
[[ -n "$SSH_KEY" ]] && SSH_OPTS+=(-i "$SSH_KEY")
if [[ "$BUILD_ONLY" == false && ! -f "$ENV_FILE" ]]; then echo "Run node apps/sso/init.mjs --prod and edit $ENV_FILE first"; exit 1; fi
if [[ "$SYNC_ONLY" == false ]]; then
  STAMP=$(date -u +%Y%m%d%H%M%S)
  docker image inspect musicque-sso-keycloak:26.8.1 >/dev/null 2>&1 && docker tag musicque-sso-keycloak:26.8.1 "musicque-sso-keycloak:rollback-$STAMP" || true
  docker build --platform linux/amd64 -t musicque-sso-keycloak:26.8.1 apps/sso
  docker build --platform linux/amd64 --target tools -t musicque-sso-tools:latest apps/sso
  docker save musicque-sso-keycloak:26.8.1 musicque-sso-tools:latest | gzip > musicque-sso.tar.gz
  if [[ "$BUILD_ONLY" == true ]]; then echo 'Built musicque-sso.tar.gz'; exit 0; fi
  ssh "${SSH_OPTS[@]}" "$SERVER" "umask 077; mkdir -p '$REMOTE_DIR/realm'; touch '$REMOTE_DIR/.env.prod.upload'; chmod 600 '$REMOTE_DIR/.env.prod.upload'"
  scp "${SSH_OPTS[@]}" musicque-sso.tar.gz apps/sso/compose.yaml apps/sso/compose.prod.yaml apps/sso/prune-images.sh "$SERVER:$REMOTE_DIR/"
  scp "${SSH_OPTS[@]}" apps/sso/realm/sso-realm.json "$SERVER:$REMOTE_DIR/realm/"
  scp "${SSH_OPTS[@]}" "$ENV_FILE" "$SERVER:$REMOTE_DIR/.env.prod.upload"
  ssh "${SSH_OPTS[@]}" "$SERVER" bash -s -- "$REMOTE_DIR" "$PROJECT_NAME" "$STAMP" <<'REMOTE'
set -euo pipefail
cd "$1"
# Realm contains placeholders only; Keycloak UID must be able to read this bind mount.
chmod 755 realm
chmod 644 realm/sso-realm.json
chmod 600 .env.prod.upload
[[ ! -f .env.prod ]] || install -m 600 .env.prod ".env.prod.backup-$3"
mv .env.prod.upload .env.prod
docker image inspect musicque-sso-keycloak:26.8.1 >/dev/null 2>&1 && docker tag musicque-sso-keycloak:26.8.1 "musicque-sso-keycloak:rollback-$3" || true
docker load < musicque-sso.tar.gz
rm -f musicque-sso.tar.gz
docker compose --env-file .env.prod -f compose.yaml -f compose.prod.yaml -p "$2" up -d --no-build --wait
docker compose --env-file .env.prod -f compose.yaml -f compose.prod.yaml -p "$2" ps
bash prune-images.sh
REMOTE
  rm -f musicque-sso.tar.gz
  bash apps/sso/prune-images.sh
fi
if [[ "$SYNC" == true ]]; then
  TUNNEL_DIR=$(mktemp -d)
  trap 'ssh "${SSH_OPTS[@]}" -S "$TUNNEL_DIR/control" -O exit "$SERVER" >/dev/null 2>&1 || true; rm -rf "$TUNNEL_DIR"' EXIT
  # -f returns only after forwarding succeeds; an occupied port fails before any admin credential is sent.
  ssh "${SSH_OPTS[@]}" -M -S "$TUNNEL_DIR/control" -fN -o ExitOnForwardFailure=yes \
    -L "127.0.0.1:$TUNNEL_PORT:127.0.0.1:$SSO_PORT" "$SERVER"
  export SSO_ADMIN_URL="http://127.0.0.1:$TUNNEL_PORT/sso"
  # Wait for forwarding without sending credentials; fail if SSH exited or the port was already in use.
  for attempt in {1..30}; do
    ssh "${SSH_OPTS[@]}" -S "$TUNNEL_DIR/control" -O check "$SERVER" >/dev/null 2>&1 || { echo 'SSH tunnel failed'; exit 1; }
    if node -e 'fetch(`${process.env.SSO_ADMIN_URL}/realms/master`).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))'; then break; fi
    sleep 1
  done
  node apps/sso/sync-realm.mjs "$ENV_FILE"
fi
