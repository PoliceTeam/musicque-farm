#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
SERVER="${SERVER:-ptdevs@167.86.125.164}"
SSH_KEY="${SSH_KEY-$HOME/.ssh/police}"
REMOTE_DIR="${REMOTE_DIR:-/home/ptdevs/internal/chibi-town}"
PROJECT_NAME="${PROJECT_NAME:-chibi-town-prod}"
[[ "$REMOTE_DIR" =~ ^/[a-zA-Z0-9_./-]+$ && "$PROJECT_NAME" =~ ^[a-zA-Z0-9_-]+$ ]] || exit 1
SSH_OPTS=(-o ServerAliveInterval=15)
[[ -z "$SSH_KEY" ]] || SSH_OPTS+=(-i "$SSH_KEY")
case "${1:-}" in
  status)
    ssh "${SSH_OPTS[@]}" "$SERVER" 'set -euo pipefail; docker ps -a --filter name=chibi-town-prod-; docker image ls --format "{{.Repository}}:{{.Tag}} {{.ID}}" | awk '\''$1 ~ /^chibi-town-(api|web):(latest|rollback-)/'\'
    for url in https://musicque.politetech.com/farm https://musicque.politetech.com/farm/api/auth/session; do
      curl --fail --silent --show-error --location --max-time 30 --output /dev/null --write-out '%{http_code} %{url_effective}\n' "$url"
    done
    ;;
  logs)
    shift
    [[ "${1:-}" != -- ]] || shift
    service="${1:-api}"
    case "$service" in api|web|worker) ;; *) echo 'Service: api|web|worker'; exit 1 ;; esac
    ssh "${SSH_OPTS[@]}" "$SERVER" "cd '$REMOTE_DIR' && id=\$(docker compose --env-file .env.prod -p '$PROJECT_NAME' -f docker-compose.yml ps -q '$service') && test -n \"\$id\" && docker logs --tail 100 \"\$id\""
    ;;
  sso-admin)
    TUNNEL_PORT="${TUNNEL_PORT:-18180}"
    SSO_PORT="${SSO_PORT:-8180}"
    [[ "$TUNNEL_PORT" =~ ^[0-9]+$ && "$SSO_PORT" =~ ^[0-9]+$ ]] || exit 1
    echo "Admin: http://localhost:$TUNNEL_PORT/sso/admin/"
    echo 'Lấy mật khẩu admin trong apps/sso/.env.prod bằng editor. Giữ tunnel tới khi Ctrl+C.'
    exec ssh "${SSH_OPTS[@]}" -N -o ExitOnForwardFailure=yes -L "127.0.0.1:$TUNNEL_PORT:127.0.0.1:$SSO_PORT" "$SERVER"
    ;;
  *) echo 'Cách dùng: remote.prod.sh status|logs [api|web|worker]|sso-admin'; exit 1 ;;
esac
