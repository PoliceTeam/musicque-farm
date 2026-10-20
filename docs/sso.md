# SSO trong ứng dụng

Keycloak 26.8.1, realm `sso`, giữ tài khoản và mật khẩu. Farm và Musicque hiện form đăng nhập,
đăng ký, quên và đổi mật khẩu trong chính app. Frontend không dùng popup/trang Keycloak cho các form này.
Trang Keycloak với theme `chibi-farm`/`musicque` vẫn phục vụ liên kết đặt lại mật khẩu qua email và route redirect tương lai.

## Cấu hình và chạy

- `apps/sso/clients.json`: danh sách client confidential, theme, tiền tố env và các đối tác handoff.
- `apps/sso/sync-realm.mjs`: nguồn cấu hình realm đang chạy; tạo client mới từ dữ liệu, bật direct grants,
  service accounts, Standard Token Exchange V2, audience mapper, profile/offline_access, brute force và password policy.
- `apps/sso/import-legacy-users.mjs`: import Farm scrypt và Musicque bcrypt qua provider `chibi-legacy`;
  đăng nhập lần đầu xác minh hash cũ và nâng cấp sang thuật toán Keycloak. Không import lại để đổi mật khẩu người đã dùng SSO.
- `apps/sso/themes/`: giữ nguyên theme dùng cho email action/redirect login.

```sh
pnpm sso:up
pnpm sso:configure
node apps/sso/sync-realm.mjs  # tự đọc apps/sso/.env, chạy từ root cũng được
```

Backend Farm cần `SSO_ISSUER`, `SSO_CLIENT_ID`, `SSO_CLIENT_SECRET`, `SSO_TOKEN_KEY` (32 byte ngẫu nhiên,
hex 64 ký tự), `SSO_HANDOFF_TARGETS` (danh sách `clientId=https://host/api/auth/handoff/accept`, phân cách dấu phẩy),
`SSO_HANDOFF_ORIGINS` (web origin đối tác được phép POST bàn giao; origin của chính app luôn được phép).
`WEB_ORIGIN` (có thể gồm đường dẫn `/farm`) và `PUBLIC_API_URL` là URL public của game và API. Khóa chỉ nằm backend; không đặt trong biến public.
Mỗi backend có khóa riêng. Đổi khóa làm refresh token đã lưu không đọc được, cần đăng nhập lại.
Khi không cấu hình SSO, luồng tài khoản cục bộ và guest vẫn hoạt động.

Local: Keycloak `http://127.0.0.1:8180`, API Farm `http://127.0.0.1:3010/api`, game
`http://127.0.0.1:5173`, Musicque web `http://localhost:8080`, API Musicque `http://localhost:5005`.
Không dùng `down -v` với dữ liệu đang có.

## Giao thức

Backend dùng `openid-client` v6 password grant với scope `openid profile`, kiểm tra ID token gồm chữ ký,
issuer, audience, hạn; chỉ map bằng `(iss, sub)`. Không tự gộp theo username/email. Guest Farm được nâng cấp
ngay trên player hiện tại khi danh tính chưa liên kết player khác. Username Keycloak hợp lệ và chưa trùng được
đặt làm username Farm; dấu `-` hoặc username đã có sẽ yêu cầu chọn username game.

Đăng ký gọi Admin REST bằng service account (realm-management `manage-users`, `view-users`, `query-users`),
tạo username, firstName, email tùy chọn và password non-temporary; Keycloak áp profile/password policy rồi backend đăng nhập.
Quên mật khẩu tìm username/email chính xác, gọi `execute-actions-email` UPDATE_PASSWORD nếu có email;
luôn trả `{ok:true}` cho user có/không tồn tại, kể cả thiếu SMTP. Cảnh báo không chứa thông tin user.
Đổi mật khẩu bắt buộc session và mật khẩu hiện tại, xác minh bằng password grant rồi reset-password qua Admin API.

Handoff gửi access token **mới qua token exchange**, có audience duy nhất là app đích, hạn 60 giây.
Frontend nhận `{url,token}`, điều hướng bằng form ẩn POST; token không nằm trên URL. Access/refresh token gốc không rời backend.
App đích kiểm JWKS/iss/aud/azp/iat/exp/jti rồi tiêu thụ jti một lần (Farm: Coordination; Musicque: Mongo unique + TTL).
Sau đó app đích exchange bằng client của mình để lấy refresh token, map danh tính, cấp cookie riêng và redirect về web.
Chỉ dùng URL đích trong env, không nhận URL tùy ý từ request; không hỗ trợ returnTo nên không có redirect tùy ý.

Refresh token được mã hóa AES-256-GCM trong bảng sessions (Farm) hoặc ssosessions (Musicque), không lưu trong localStorage.
Farm khoá refresh bằng Coordination; Musicque dùng lease Mongo tránh xoay cùng token đồng thời.
Cookie HttpOnly, SameSite=Lax, Secure trên production. Mutation yêu cầu Origin được cấu hình; accept nhận top-level form từ app khác
và xác thực bằng token ký có audience/azp tin cậy. Không cần cookie chung giữa hai app hoặc cùng tên miền.
Không nhận JWT bearer trong Musicque khi bật SSO.

## Token exchange thực tế

Dùng V2 mặc định của Keycloak 26; không bật legacy exchange/FGAP V1. Client attributes:

- `standard.token.exchange.enabled=true`
- `standard.token.exchange.enableRefreshRequestedTokenType=SAME_SESSION`
- `access.token.lifespan=60`

Mỗi client có hardcoded audience mapper cho chính mình và partners. Tham số `audience` chỉ lọc audience đã có;
mapper là phần cấp audience. Accept đổi token với requested_token_type refresh_token bằng secret app nhận.
Scope `offline_access` được cấu hình optional, nhưng **không dùng trong luồng form/handoff**: V2 không cho lấy refresh token
khi subject thuộc offline session và không cấp offline token qua exchange. Thay thế được hỗ trợ là online refresh session dài:
realm idle 30 ngày, max 90 ngày; app session Farm 30 ngày, Musicque 8 giờ. Khi session Keycloak hết hạn phải đăng nhập lại.
Đăng xuất xoá session app và refresh material, trả JSON; không điều hướng sang trang xác nhận logout Keycloak.

Nguồn: [Keycloak token exchange](https://www.keycloak.org/securing-apps/token-exchange),
[mã nguồn 26.8.1: OIDCAdvancedConfigWrapper](https://github.com/keycloak/keycloak/blob/26.8.1/services/src/main/java/org/keycloak/protocol/oidc/OIDCAdvancedConfigWrapper.java).

## Vận hành và kiểm thử

`SSO_SMTP_*` trong apps/sso/.env + sync để email hoạt động; không có SMTP vẫn trả thông báo chung.
`SSO_SMTP_SECURE=true` dùng SSL trực tiếp (Gmail cổng 465 với App Password); để trống là STARTTLS (587).
Không log credential, token, response provider hoặc dữ liệu user. Giữ .env git-ignored với quyền 0600.
Migration Farm chỉ sinh bằng `pnpm --filter @chibi-town/api db:generate`; API tự áp migration lúc khởi động.
Sau thay đổi backend, build bằng `pnpm turbo run build --filter=@chibi-town/api`, restart API serve và worker.
`pnpm format` rồi `pnpm check`; tests/auth-sso.test.ts dùng provider giả và PGlite, không cần server thật.
Xem [tích hợp nền tảng mới](sso-integration.md). BasePath/nginx cho `/farm` thuộc cấu hình deploy riêng.

## Production cùng domain Musicque

Thực hiện đúng thứ tự: **SSO → import chỉ Musicque (dry-run, review, apply) → bật SSO Musicque → Farm**.
Lệnh chi tiết và rollback trong [deploy-police.md](deploy-police.md).

```sh
node apps/sso/init.mjs --prod
# Editor: SMTP/Google trong apps/sso/.env.prod (0600, git-ignored, secret khác dev).
node apps/sso/configure.mjs --prod
apps/sso/deploy.prod.sh --sync
```

Script deploy riêng build Keycloak và tools local `linux/amd64`, nén/scp/load rồi Compose production,
không build trên host. Dùng biến `SERVER`, `SSH_KEY`, `REMOTE_DIR`, `ENV_FILE`, `PROJECT_NAME`;
mặc định ptdevs@167.86.125.164, ~/.ssh/police, /home/ptdevs/internal/chibi-sso.
`--build-only` chỉ local; `--sync-only`/`--sync` mở tunnel local 18180 → server 8180 rồi sync, tự đóng tunnel.
`SSO_ADMIN_URL` tách đường gọi Admin API khỏi `SSO_URL` public; sync/import ưu tiên env process rồi env file.
Issuer lưu trong identity luôn lấy từ SSO_URL, không được dùng URL tunnel làm issuer.
SMTP (`SSO_SMTP_*`, cả `SSO_SMTP_SECURE`) lấy từ env prod, không tự chép secret dev.

Keycloak production `start --import-realm`, `KC_HTTP_RELATIVE_PATH=/sso`, hostname public
`https://musicque.politetech.com/sso`, proxy headers xforwarded. Healthcheck management 9000 có `/sso`.
DB riêng không publish; HTTP chỉ loopback 8180. nginx chặn admin Internet, giữ realms/resources công khai.
Admin của backend qua Docker network nội bộ: Farm hỗ trợ `SSO_ADMIN_URL`; Musicque cần companion patch
`deploy/musicque-sso-admin-url.patch` trước bật register/forgot/change, xem checklist. Không mở admin Internet để né patch.

Import dùng cờ boolean `--musicque`/`--farm` (một hoặc cả hai), URI chỉ từ `MUSICQUE_MONGODB_URI`/
`FARM_DATABASE_URL` trong môi trường hoặc Docker `--env-file` riêng; không truyền URI trên argv.
Image `musicque-sso-tools:latest` có Node/dependencies, chạy trong `musicque_music-order-network` để tới Mongo hiện có
và `SSO_ADMIN_URL=http://sso:8080/sso`; server không cần Node/pnpm hoặc tải dependency lúc import.
`--env` chọn file cấu hình SSO, `--report` ghi report 0600, mặc định dry-run, `--apply` mới ghi.
Collision với Keycloak được báo subject rõ ràng, exit 2. Có collision thì apply không ghi kế hoạch nào.
Lần import Farm sau dùng `--resolutions` chọn `merge-keycloak:<subject>` (giữ mật khẩu/profile hiện có)
hoặc `rename-farm:<name>`, tuyệt đối không tự merge. Gộp hai nguồn mới cùng lúc vẫn hỗ trợ
`merge:farm`/`merge:musicque`. Lỗi runtime có thể ghi một phần; backup, dry-run và rerun để đối chiếu.
Tests logic giả chạy bằng `pnpm --filter @chibi-town/sso test`, đã nằm trong `pnpm check`.
