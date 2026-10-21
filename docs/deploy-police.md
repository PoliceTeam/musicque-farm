# Triển khai musicque.politetech.com

## Deploy bằng tay từ máy local

Dùng **`pnpm run deploy:prod`**. Không đặt script gốc tên `deploy`: pnpm 11 để script đó đè lệnh built-in `pnpm deploy`, mà `apps/api/Dockerfile` cần lệnh built-in (`pnpm --filter @chibi-town/api deploy --prod --legacy /out`).
Cần Node 24+, pnpm, Docker Desktop/build linux/amd64, SSH và Python 3 trên server.
Tất cả lệnh dưới đây chạy từ root Farm và chỉ kết nối production khi người vận hành gọi.

Trước khi chạy `pnpm run deploy:prod`:
1. Không có agent/IDE nào đang sửa code hoặc chạy build/test song song (dễ gây test lỗi giả và quá tải máy).
2. Mọi thay đổi đã commit **và push**: script dừng nếu còn file chưa commit hoặc HEAD khác `origin/main`,
   vì image được build từ thư mục làm việc. `--build-only` không bị chặn; `ALLOW_DIRTY=1` chỉ dùng khi khẩn cấp.
3. `pnpm run env:check` báo đủ biến.
4. Docker Desktop đang chạy. Script tự chạy `pnpm check` (khoảng 2–5 phút) trước khi build.

| Lệnh | Mục đích |
| --- | --- |
| `pnpm run env:check` | Kiểm hai env, chỉ báo tên biến thiếu/rỗng |
| `pnpm run deploy:build` | Chỉ build local, không SSH |
| `pnpm run deploy:prod` | Build và deploy API + worker + web |
| `pnpm run deploy:web` / `pnpm run deploy:api` | Deploy riêng web / API + worker |
| `pnpm run deploy:status` | Container, latest/rollback và HTTP công khai |
| `pnpm run deploy:logs -- api` | 100 dòng log; service api (mặc định), web, worker |
| `pnpm run deploy:rollback` | Retag rollback mới nhất từng image, chờ API/web healthy rồi worker; không prune |
| `pnpm run sso:deploy` | Deploy Keycloak, chưa sync realm |
| `pnpm run sso:sync:prod` | Sync realm production qua tunnel |
| `pnpm run sso:admin` | Tunnel tới admin, giữ đến Ctrl+C |

Thứ tự: tạo/kiểm env → `env:check` → nếu có thay đổi SSO: `sso:deploy`, `sso:sync:prod`
→ `deploy` → `deploy:status`; kiểm đăng nhập và chuyển tài khoản Farm/Musicque.
Nếu lỗi image: `deploy:logs`, `deploy:rollback`, rồi `deploy:status`.
Rollback chọn riêng bản mới nhất của mỗi image, phù hợp deploy từng phần; không rollback DB/env/realm.

Env local: `deploy/.env.prod`, `apps/sso/.env.prod`, tạo từ các file `.example`, quyền 600,
điền secret bằng editor; nhãn `# REQUIRED: TEN_BIEN` xác định biến bắt buộc cho police có SSO.
Không commit env. Client secret phải khớp Keycloak; token key mỗi backend riêng.
`SSO_ADMIN_HOSTNAME=http://localhost:18180/sso` được Keycloak quảng bá;
vào `http://localhost:18180/sso/admin/` qua tunnel, lấy mật khẩu từ `apps/sso/.env.prod`.
Nếu đổi `TUNNEL_PORT`, cập nhật `SSO_ADMIN_HOSTNAME` tương ứng rồi deploy SSO.

Override qua môi trường: `SERVER` (ptdevs@167.86.125.164), `SSH_KEY` (~/.ssh/police;
rỗng để dùng agent), `REMOTE_DIR` (Farm /home/ptdevs/internal/chibi-town;
SSO /home/ptdevs/internal/chibi-sso), `PROJECT_NAME`, `ENV_FILE` cho từng deploy.
Không export chung `REMOTE_DIR`/`PROJECT_NAME` giữa Farm và SSO.
`deploy:status` lọc container police `chibi-town-prod-*`.
Deploy thành công tự prune image của project, giữ latest + một rollback mới nhất
(và image còn container tham chiếu); giữ volume và cache build dùng chung.


Trạng thái triển khai thực tế xem [deploy-police-status.md](deploy-police-status.md).
Các lệnh dưới đây là runbook cho người vận hành; giữ backup trước mỗi lần thay đổi.
Không cần Node trên Ubuntu. Giữ nginx/cert hiện có, Musicque `/api/`, `/socket.io`, `/` vẫn đi client 3800.

## 1. Chuẩn bị và backup

Local, từ root Farm (Docker Desktop bật; tất cả image build `linux/amd64`):

```sh
node apps/sso/init.mjs --prod
# Sửa apps/sso/.env.prod bằng editor: SMTP/Google nếu dùng. Không dùng lại secret dev.
node apps/sso/configure.mjs --prod
cp deploy/.env.prod.example deploy/.env.prod
# Điền mật khẩu DB mới và ghép .env.farm.prod vào deploy/.env.prod bằng editor.
# Farm WEB_ORIGIN được compose lấy từ PUBLIC_URL=https://musicque.politetech.com/farm.
chmod 600 apps/sso/.env.prod apps/sso/.env.*.prod deploy/.env.prod
```

`configure --prod` tạo `.env.farm.prod` và `.env.musicque.prod`, không ghi đè file cũ.
Origin SSO Farm là `https://musicque.politetech.com`, web URL reset/logout là URL có `/farm`.
Issuer luôn `https://musicque.politetech.com/sso/realms/sso`.
Không chuyển mật khẩu lên CLI, không `set -x`, không in/env dump ra terminal.

Trước import/bật SSO, người vận hành trên server lưu backup riêng, quyền 0700/0600:

```sh
umask 077
mkdir -p ~/backups/chibi-sso
# Dùng Node có sẵn trong API container để tạo cấu hình JSON (cũng là YAML hợp lệ).
# URI chỉ nằm trong file 0600, không nằm trên CLI/process list/terminal.
docker exec music-order-api node -e 'process.stdout.write(JSON.stringify({uri:process.env.MONGODB_URI}))' \
  > ~/backups/chibi-sso/mongodump.yml
docker run --rm --network musicque_music-order-network \
  -v "$HOME/backups/chibi-sso/mongodump.yml:/run/mongodump.yml:ro" \
  mongo:7 mongodump --config /run/mongodump.yml --archive > ~/backups/chibi-sso/musicque.archive
rm -f ~/backups/chibi-sso/mongodump.yml
```

Không chấp nhận archive rỗng/lệnh exit khác 0; thử restore vào DB tách biệt trước cutover.
Sao lưu cấu hình nginx/site, env Musicque và image tag hiện tại vào thư mục backup riêng; không in nội dung.
Tạm khóa đăng ký/đổi mật khẩu trong khoảng backup → import → bật SSO để tránh lệch credential.
Nếu đã có SSO/Farm, backup Postgres trước nâng cấp (không publish DB):

```sh
cd /home/ptdevs/internal/chibi-sso
docker compose --env-file .env.prod -f compose.yaml -f compose.prod.yaml -p musicque-sso-prod exec -T sso-db \
  pg_dump -U sso -d sso -Fc > ~/backups/chibi-sso/sso.dump
cd /home/ptdevs/internal/chibi-town
docker compose --env-file .env.prod -f docker-compose.yml -p chibi-town-prod exec -T postgres \
  pg_dump -U chibi -d chibi_town -Fc > ~/backups/chibi-sso/farm.dump
```

## 2. SSO trước

```sh
# LOCAL: build → save/gzip → scp → load → compose up --no-build --wait.
# Script tự dùng ~/.ssh/police; SSH_KEY='' để dùng ssh-agent/config.
SERVER=ptdevs@167.86.125.164 REMOTE_DIR=/home/ptdevs/internal/chibi-sso apps/sso/deploy.prod.sh --sync
# Hoặc chỉ đồng bộ realm qua tunnel (port local 18180, không đụng dev 8180):
apps/sso/deploy.prod.sh --sync-only
```

Env override: `SERVER`, `SSH_KEY`, `REMOTE_DIR`, `ENV_FILE`, `PROJECT_NAME`, `TUNNEL_PORT`, `SSO_PORT`.
`--build-only` hoàn toàn local và tạo `musicque-sso.tar.gz` chứa Keycloak + tools.
Server chỉ cần Docker/Compose, image và hai compose + realm JSON; Postgres SSO không publish cổng.
Network external `musicque_music-order-network` phải có sẵn (đã thuộc Musicque); tên đổi bằng `SSO_NETWORK`.
Realm JSON chỉ import lần đầu. Mọi thay đổi sau đó dùng sync, không xóa volume để import lại.
Healthcheck dùng `9000/sso/health/ready`, không proxy management ra ngoài.

Chèn mẫu `deploy/nginx.musicque.politetech.com.example` vào nginx hiện tại (map ở `http {}`, locations trong
HTTPS `server {}`). Sau review: `sudo nginx -t && sudo systemctl reload nginx`.
`/sso/admin` và `/sso/admin/…` trả 404 từ Internet; quản trị người vận hành qua tunnel.
Backend dùng service account qua network Docker riêng, không cần mở admin công khai.
Không tạo server block/cert mới. `/farm/api/` phải nằm trong location riêng, proxy bỏ đúng `/farm`;
web giữ nguyên `/farm` vì Next đã build basePath. `/farm/farm` là màn cửa nông trại, `/farm` là trang vào app.

## 3. Import chỉ Musicque, dry-run rồi apply

Các lệnh sau chạy **trên server**, không cần checkout repo/Node:

```sh
cd /home/ptdevs/internal/chibi-sso
umask 077
mkdir -p reports
# Không in URI: stdout đi thẳng vào file riêng; không truyền URI qua argv.
{ printf 'MUSICQUE_MONGODB_URI='; docker exec music-order-api printenv MONGODB_URI; } > import.env
chmod 600 import.env

docker run --rm --network musicque_music-order-network --user "$(id -u):$(id -g)" \
  --env-file import.env -e SSO_ADMIN_URL=http://sso:8080/sso \
  -v "$PWD/.env.prod:/run/sso.env:ro" -v "$PWD/reports:/reports" \
  musicque-sso-tools:latest --musicque --env /run/sso.env --report /reports/musicque-dry-run.json
# Review report: collision=0, skipped=0 và tất cả cảnh báo đã được xử lý.
# Lặp lại đúng lệnh docker run ở trên, đổi report và thêm --apply.
docker run --rm --network musicque_music-order-network --user "$(id -u):$(id -g)" \
  --env-file import.env -e SSO_ADMIN_URL=http://sso:8080/sso \
  -v "$PWD/.env.prod:/run/sso.env:ro" -v "$PWD/reports:/reports" \
  musicque-sso-tools:latest --musicque --env /run/sso.env --report /reports/musicque-applied.json --apply
rm -f import.env
```

Chạy dry-run lần nữa để đối chiếu: không tạo thêm user; kiểm tra số document được liên kết và quyền admin Musicque.
Hash được nâng cấp khi đăng nhập lần đầu, không reset/import đè mật khẩu đã dùng SSO.
Report chứa username/id (không hash/token); giữ riêng 0600. Exit 2: còn collision/skipped, cần xử lý trước cutover.
Có collision trong kế hoạch thì `--apply` không ghi gì; lỗi runtime có thể đã ghi một phần giữa hai hệ thống,
không có transaction xuyên DB/Keycloak. Giữ backup, dừng cutover và chạy lại dry-run để phục hồi idempotent.

Farm nhập sau: dùng `--farm`, `FARM_DATABASE_URL` trong env-file 0600; tools phải vào network tới Postgres Farm
(ví dụ nối riêng container tools vào network `<project>_internal`, đồng thời `musicque_music-order-network` bằng Compose).
Không cần quyền DB Farm khi `--musicque`. Có thể chạy local qua tunnel với `SSO_ADMIN_URL`, URI từ môi trường.

Resolutions JSON ví dụ (mount read-only rồi thêm `--resolutions /run/resolutions.json`):

```json
{"alice":"merge-keycloak:SUBJECT_TỪ_REPORT", "bob":"rename-farm:bob_farm"}
```

`merge-keycloak` chỉ thêm `farmUserId` vào subject có sẵn, giữ nguyên mật khẩu/profile Musicque;
không ghi đè một `farmUserId` khác. Rename tạo user mới, liên kết Farm bằng subject, không đổi username trong DB nguồn.
Nếu nhập cả hai DB cùng lúc: `merge:farm`/`merge:musicque` chọn nguồn password hoặc `rename-farm:…`/`rename-musicque:…`.
Tên mới cũng được kiểm tra collision. Không tự gộp theo username/email.

## 4. Bật SSO Musicque rồi Farm

Musicque hiện gọi Admin REST qua issuer public. **Trước khi bật SSO**, cần bổ sung `SSO_ADMIN_URL` nội bộ:
patch mẫu sẵn ở `deploy/musicque-sso-admin-url.patch`, chỉ áp vào checkout Musicque sau khi review và chạy test của repo đó.
Đợt này không sửa/build/deploy Musicque. Nếu thiếu patch thì login có thể chạy nhưng register/forgot/change sẽ hỏng vì nginx chặn admin.

```sh
# LOCAL, trong checkout Musicque, sau khi review patch:
git apply --check ../musicque-farm/deploy/musicque-sso-admin-url.patch
git apply ../musicque-farm/deploy/musicque-sso-admin-url.patch
# Chạy test/build/deploy theo AGENTS.md Musicque; không commit/push nếu chưa được yêu cầu.
```

Ghép `.env.musicque.prod` vào env backend Musicque, bao gồm
`SSO_ADMIN_URL=http://sso:8080/sso`, `SSO_REDIRECT_URI=https://musicque.politetech.com/api/auth/sso/callback`,
`SSO_WEB_ORIGIN=https://musicque.politetech.com`, handoff về Farm; đảm bảo API vẫn trong `musicque_music-order-network`.
Restart/recreate API theo quy trình Musicque và test login với password cũ, session sau reload, admin, đăng ký,
quên/đổi mật khẩu, Google nếu có. Chưa mở handoff sang Farm cho đến khi Farm sẵn sàng.

Sau đó local Farm:

```sh
./scripts/deploy.prod.sh
# Mặc định ENV_FILE=deploy/.env.police.prod; tự chạy pnpm check trước build.
# --web-only / --api-only (gồm worker) / --build-only; env override như script SSO.
```

Web build nhận `NEXT_PUBLIC_BASE_PATH=/farm`, `NEXT_PUBLIC_API_URL=/farm/api`,
`NEXT_PUBLIC_SITE_URL=https://musicque.politetech.com`; phải rebuild nếu đổi prefix.
Compose bổ sung `docker-compose.sso.yml` khi env có `SSO_NETWORK`; backend dùng private Admin URL,
issuer và `PUBLIC_API_URL` vẫn public. Session `chibi_session` path `/farm`, SSO attempt
`farm_sso_attempt` path `/farm/api/auth/sso`; không đụng `musicque_session`.
Postgres/Redis không publish; API 3201, web 3200 chỉ loopback; worker dùng cùng DB/Redis và image API.
Server cũ: đổi SERVER/SSH_KEY/REMOTE_DIR, PUBLIC_URL, đặt basePath rỗng, API `/api`, site URL cũ;
không đặt SSO_NETWORK nếu không cần overlay. `SSH_KEY=''` giữ cấu hình ssh host alias cũ.

## 5. Kiểm tra và rollback

- HTTPS `/api/` và `/socket.io/` Musicque vẫn hoạt động; `/farm`, `/farm/manifest.webmanifest`,
  `/farm/icons/icon-192.png`, asset/audio `/farm/chibi-assets/…` trả 200, chunk `/farm/_next/…` không 404.
- Manifest `start_url`/`scope` `/farm/`, icons `/farm/icons/…`; chuyển trang/đăng xuất không về trang Musicque.
- `/sso/realms/sso/.well-known/openid-configuration` có issuer public đúng, `/sso/admin/` trả 404.
- Đăng nhập hash cũ rồi reload, register/forgot/change, handoff hai chiều và logout riêng từng app;
  kiểm tra cookie Path/Secure/HttpOnly, WebSocket `/farm/api/ws` nâng cấp 101, worker trả thưởng khi offline.
- `docker compose … ps` healthy, logs không chứa credential; kiểm tra migrations và số user/identity trước mở traffic.

Farm và SSO giữ đúng một tag rollback mới nhất cho mỗi repository sau deploy thành công;
image có container tham chiếu luôn được giữ. Chỉ dọn image dangling có label riêng của project.
Giữ backup env/nginx và DB. Retag rollback về tag compose rồi `up -d --no-build` để phục hồi;
không `down -v`, không prune toàn server dùng chung.
Schema đã migrate có thể không tương thích image cũ: chỉ restore DB đã backup trong maintenance window, cùng phiên bản app.
Keycloak nâng phiên bản cũng cần DB backup tương ứng; không downgrade DB đang chạy bằng image cũ tùy ý.
Với Musicque: gỡ toàn bộ `SSO_*` khỏi env backend và recreate API để quay lại JWT, deploy lại client JWT nếu
client cũ không hỗ trợ feature detection. Không xoá hash/role/user hoặc liên kết đã import; JWT/session SSO là hai cơ chế riêng,
người dùng cần đăng nhập lại. Giữ các đăng ký/đổi mật khẩu phát sinh sau cutover để đối soát trước restore.
