#!/bin/bash
# Chỉ chạy khi người vận hành gọi rollback; không prune.
set -euo pipefail
cd "$(dirname "$0")/.."
SERVER="${SERVER:-ptdevs@167.86.125.164}"
SSH_KEY="${SSH_KEY-$HOME/.ssh/police}"
REMOTE_DIR="${REMOTE_DIR:-/home/ptdevs/internal/chibi-town}"
PROJECT_NAME="${PROJECT_NAME:-chibi-town-prod}"
[[ "$REMOTE_DIR" =~ ^/[a-zA-Z0-9_./-]+$ && "$PROJECT_NAME" =~ ^[a-zA-Z0-9_-]+$ ]] || exit 1
SSH_OPTS=(-o ServerAliveInterval=15)
[[ -z "$SSH_KEY" ]] || SSH_OPTS+=(-i "$SSH_KEY")
printf -v REMOTE_COMMAND '%q ' bash -s -- "$REMOTE_DIR" "$PROJECT_NAME"
ssh "${SSH_OPTS[@]}" "$SERVER" "$REMOTE_COMMAND" <<'REMOTE'
set -euo pipefail
cd "$1"
COMPOSE=(docker compose --env-file .env.prod -p "$2" -f docker-compose.yml)
# Chọn overlay từ env, không đọc/in secret hoặc dump config.
USE_SSO_NETWORK=$(docker compose --env-file .env.prod -f docker-compose.yml config --environment | python3 -c 'import sys; print("true" if any(line.startswith("SSO_NETWORK=") and line.partition("=")[2].strip() for line in list(sys.stdin)) else "false")')
[[ "$USE_SSO_NETWORK" == false ]] || COMPOSE+=(-f docker-compose.sso.yml)
ROLLBACKS=()
for repository in chibi-town-api chibi-town-web; do
  reference=$(docker image ls --format '{{.Repository}}:{{.Tag}}' "$repository" | sed -n "/^$repository:rollback-/p" | LC_ALL=C sort -r | head -1)
  [[ -n "$reference" ]] || { echo "Thiếu rollback: $repository"; exit 1; }
  docker image inspect "$reference" >/dev/null
  ROLLBACKS+=("$reference")
done
docker tag "${ROLLBACKS[0]}" chibi-town-api:latest
docker tag "${ROLLBACKS[1]}" chibi-town-web:latest
"${COMPOSE[@]}" up -d --no-build --wait --wait-timeout 180 api web
"${COMPOSE[@]}" up -d --no-build worker
WORKER_ID=$("${COMPOSE[@]}" ps -q worker)
[[ -n "$WORKER_ID" && "$(docker inspect --format '{{.State.Running}}' "$WORKER_ID")" == true ]]
"${COMPOSE[@]}" ps
REMOTE
