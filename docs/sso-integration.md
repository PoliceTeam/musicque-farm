# Thêm một nền tảng vào SSO

Mỗi nền tảng là một OIDC confidential client và một backend tự cấp session app. Không cần chia sẻ cookie,
JWT riêng giữa app hay sửa mã Farm/Musicque. Chỉ các URL công khai và clientId được cấu hình trong env/dữ liệu.

## 1. Khai báo client

Thêm vào `apps/sso/clients.json`, ví dụ:

```json
{ "clientId": "new-platform", "theme": "musicque", "envPrefix": "SSO_NEW_PLATFORM", "partners": ["musicque", "musicque-farm"] }
```

Thêm new-platform vào partners của các client cần kết nối (chỉ sửa dữ liệu).
Trong apps/sso/.env đặt SSO_NEW_PLATFORM_CLIENT_SECRET ngẫu nhiên, SSO_NEW_PLATFORM_REDIRECT_URI (callback),
SSO_NEW_PLATFORM_WEB_ORIGIN; chạy `node apps/sso/sync-realm.mjs`. Không đưa .env vào git.
Script tạo client, bật standard flow/PKCE, direct access grants/service account, Standard Token Exchange V2,
SAME_SESSION refresh exchange và audience mapper cho bản thân/partners, offline_access optional.
Quyền service account: realm-management manage-users/view-users/query-users, không realm-admin.

## 2. Biến môi trường app

Backend giữ issuer/clientId/clientSecret, redirect URI/web origin, SSO_TOKEN_KEY (AES 256 bit ngẫu nhiên,
hex 64 ký tự). `SSO_HANDOFF_TARGETS` là bảng `clientId=URL` phân cách dấu phẩy:

```dotenv
SSO_HANDOFF_TARGETS=musicque=https://musicque.example/api/auth/handoff/accept,musicque-farm=https://farm.example/api/auth/handoff/accept
```

Thêm URL accept của nền tảng mới vào env của app nguồn, cũng là allowlist azp được tin cậy ở app nhận.
`SSO_HANDOFF_ORIGINS` liệt kê web origin của các đối tác được phép POST bàn giao vào app này.
URL phải HTTPS, không credential/query/fragment; HTTP chỉ dành loopback dev. Dữ liệu đích không lấy từ browser.
Khóa từng app độc lập, không lưu token gốc ở frontend. Thay khóa cần vô hiệu session/đăng nhập lại.

## 3. Form trong app

Login backend gọi token endpoint `/realms/sso/protocol/openid-connect/token` bằng client secret,
grant_type=password, scope=openid profile. Dùng openid-client v6 bật enableNonRepudiationChecks; bắt buộc có ID token,
kiểm chữ ký, iss, aud, exp và sub. Dùng `(iss,sub)` làm khóa danh tính; không tự gộp theo username/email.
Sai mật khẩu/tài khoản không tồn tại cùng lỗi chung 401. Giới hạn lần thử theo IP/identifier và giữ brute force Keycloak.
Lưu refresh token mã hóa AES-256-GCM ở server gắn session. Giữ session cookie riêng HttpOnly/Secure/SameSite=Lax.

Scope offline_access không dùng cho handoff hai chiều: Standard Exchange V2 không cấp refresh token từ offline session.
Dùng online session dài theo policy realm (idle 30 ngày, max 90 ngày), xoay/lưu refresh mỗi lần handoff;
nhận lỗi refresh thì yêu cầu đăng nhập lại. App có thể đặt TTL session ngắn hơn.

Register backend lấy service account token (client_credentials), POST Admin REST `/admin/realms/sso/users`:
username, firstName=tên hiển thị, email tùy chọn, enabled=true, credentials=[{type:password,value:...,temporary:false}].
Để Keycloak kiểm password policy/user profile, map lỗi 409 username/email và 400 invalid; rồi login.
Forgot dùng exact username/email lookup, PUT execute-actions-email với [UPDATE_PASSWORD], client_id và redirect_uri về web;
luôn trả cùng `{ok:true}` kể cả user không có email, không tồn tại, thiếu SMTP. Log cảnh báo chung, không log user/token/password.
Change yêu cầu session/Origin và verify mật khẩu hiện tại bằng password grant; kiểm sub đúng phiên rồi PUT reset-password non-temporary.

## 4. Handoff gửi

POST `/auth/handoff` JSON `{target:"new-platform"}` từ frontend có cookie và Origin hợp lệ.
Backend kiểm session, target allowlist; khoá refresh theo session (coordination hoặc DB lease), giải mã/làm mới token.
Gọi token endpoint bằng client nguồn:

```sh
# Biến bí mật chỉ nằm trong môi trường shell; không bật set -x hoặc curl -v.
curl -sS -X POST "$ISSUER/protocol/openid-connect/token" \
  --data-urlencode "client_id=$CLIENT_ID" --data-urlencode "client_secret=$CLIENT_SECRET" \
  --data-urlencode 'grant_type=urn:ietf:params:oauth:grant-type:token-exchange' \
  --data-urlencode "subject_token=$SERVER_ACCESS_TOKEN" \
  --data-urlencode 'subject_token_type=urn:ietf:params:oauth:token-type:access_token' \
  --data-urlencode 'requested_token_type=urn:ietf:params:oauth:token-type:access_token' \
  --data-urlencode 'scope=openid profile' --data-urlencode "audience=$TARGET_CLIENT_ID"
```

Trả `{url:"https://target/api/auth/handoff/accept",token:"<exchanged access JWT>"}`, Cache-Control:no-store.
Chỉ token đổi có audience đích được gửi browser, token gốc ở server. Frontend tạo form ẩn method=POST,
input name=token rồi submit top-level với application/x-www-form-urlencoded. Không token trong URL/history/referrer.

## 5. Handoff nhận

POST `/auth/handoff/accept`, body-urlencoded `token=<JWT>`, tối đa khoảng 16 KB. Không đòi cookie/session sẵn có.
CORS middleware phải cho top-level form POST từ origin nền tảng khác đi tới riêng route accept;
route này xác thực bằng JWT đầy đủ bên dưới. Các mutation khác vẫn giữ Origin allowlist của web app.
Các kiểm tra bắt buộc trước khi map user:

0. Header `Origin` phải là web origin của chính app hoặc nằm trong `SSO_HANDOFF_ORIGINS` (web origin các nền tảng đối tác,
   phân cách dấu phẩy; `configure.mjs` sinh từ `<PREFIX>_WEB_ORIGIN` của partners). Thiếu Origin cũng từ chối.
   JWT chỉ chứng minh tài khoản, không chứng minh ai gửi: bỏ bước này thì trang bất kỳ có thể POST token của
   tài khoản kẻ tấn công và đăng nhập người xem vào tài khoản đó (login CSRF).
1. Xác minh chữ ký bằng JWKS issuer đã pin; cho phép RS256, từ chối alg khác/unsigned/chữ ký sai. Không dùng URL từ JWT.
2. iss chính xác; aud có client của app nhận; sub có giá trị và giới hạn chiều dài.
3. azp trong bảng đối tác tin cậy. Không tin tất cả client trong realm.
4. Bắt buộc exp, iat, jti; exp chưa hết, iat không tương lai, token age ≤60 giây, exp-iat ≤65 giây (tolerance 3 giây).
5. Tiêu thụ jti một lần, atomic unique/lock với TTL ≥120 giây; dùng storage chung giữa các instance.
6. Exchange tiếp bằng secret app nhận, subject_token=token nhận, audience=client mình,
   requested_token_type=urn:ietf:params:oauth:token-type:refresh_token, scope=openid profile;
   bật `standard.token.exchange.enableRefreshRequestedTokenType=SAME_SESSION` trong Keycloak.
   Phải nhận refresh token, mã hóa at-rest rồi cấp session mới.
7. Map `(iss,sub)` và nâng cấp guest theo quy tắc app nếu cookie guest khả dụng. Rotate session, redirect URL web cố định.
   Lỗi → web `?auth=handoff-failed` và hiện form. Nếu hỗ trợ returnTo sau này, chỉ cho đường dẫn tương đối an toàn.

```sh
curl -sS -D /tmp/handoff-headers -o /dev/null -X POST "$TARGET_ACCEPT" \
  --data-urlencode "token=$HANDOFF_TOKEN"
```

Không log token hoặc response Set-Cookie. Kiểm thứ tự verify → consume jti → exchange → map → session.
Không bật Legacy Token Exchange hoặc FGAP V1. `audience` là bộ lọc; audience mapper mới cấp audience.
Chi tiết theo [Keycloak Standard Token Exchange](https://www.keycloak.org/securing-apps/token-exchange).

## 6. Checklist tích hợp

Test login/register/forgot/change qua app, legacy hash, bàn giao cả hai chiều, đúng identity sau reload;
reject sai aud/azp/iss/exp/iat/signature/replay, origin sai, session thiếu. Không cần cùng origin;
đích nhận Set-Cookie khi top-level POST rồi redirect về web của chính nó. BasePath/proxy là cấu hình triển khai riêng.
