# Production ngày 2026-10-21

Farm chạy tại https://musicque.politetech.com/farm trên police, project
`chibi-town-prod`, thư mục `/home/ptdevs/internal/chibi-town`.
Theo yêu cầu lần này, dùng Postgres mới, không dump/restore/import user từ couponlinkh.
Dữ liệu và dịch vụ trên couponlinkh chưa bị thay đổi. Không restore DB cũ đè lên DB mới
đang nhận người chơi; một lần nhập dữ liệu sau này cần kế hoạch đối soát riêng.

## Cấu hình và deploy

Env private local: `deploy/.env.police.prod`; `deploy/.env.prod` hiện cùng cấu hình mới.
Cấu hình couponlinkh cũ được giữ riêng trong `deploy/.env.couponlinkh.prod`.
Không commit/in nội dung các file này.

```sh
./scripts/deploy.prod.sh
# Chỉ giao diện: thêm --web-only; chỉ API + worker: thêm --api-only
```

Web build: basePath `/farm`, API `/farm/api`, site origin
`https://musicque.politetech.com`. API và worker dùng chung Postgres/Redis riêng;
API vào network SSO `musicque_music-order-network`. Web/API chỉ publish loopback
3200/3201; Postgres/Redis không publish cổng.

Nginx giữ `/api/`, `/socket.io/`, `/` của Musicque; thêm `/farm` và `/farm/api/`,
bao gồm WebSocket. Backup đã giữ trước sửa; `nginx -t` thành công trước reload.
`/sso/admin/` tiếp tục trả 404 từ Internet.

Script deploy tách `--wait` cho API/web và phụ thuộc, sau đó khởi động và kiểm tra
worker đang chạy. Compose trên server từ chối `--wait` với worker tắt healthcheck;
đây là lỗi báo kết quả deploy dù process worker đã chạy, không phải lỗi migration.

## Kết quả kiểm tra

- Admin Musicque đăng nhập bằng thông tin cũ, quyền admin, reload phiên và logout thành công.
  Credential Keycloak của admin có algorithm `argon2`; không reset mật khẩu.
- Musicque form đăng nhập thông báo cần đăng nhập lại một lần bằng thông tin cũ.
  Cookie session có Secure/HttpOnly; Farm cookie scope `/farm`.
- Đăng ký mới qua form SSO Musicque nhận 100 PC theo cơ chế grant cũ nếu device đủ
  điều kiện. Tài khoản thứ hai cùng device nhận 0 PC; đăng nhập lại giữ nguyên số dư.
  Đã thử đổi mật khẩu fixture và đăng nhập với mật khẩu mới.
- Forgot-password cho tài khoản không tồn tại trả response chung; chưa kiểm chứng
  giao email thật vì cần thay App Password Gmail và tài khoản nhận hợp lệ.
- Musicque → Farm và Farm → Musicque qua token handoff thành công. Đăng xuất Farm
  giữ phiên Musicque. Musicque đã bật target `musicque-farm` và ô ICE City.
- `/farm`, manifest, icon, session API trả 200; manifest scope/start_url/icon có `/farm`.
  WebSocket `/farm/api/ws` mở thành công qua HTTPS production.
- API/web/Postgres/Redis healthy, worker báo `Background worker ready` và chạy ổn.
  Không ép thanh toán ván/đua hoặc chờ job nửa đêm trên tài khoản thật.
- Hoàn tất chọn username, tạo nhân vật và vào bản đồ/cổng nông trại trên trình duyệt
  production. Đã xem ảnh ngang 1440×1000 và dọc 390×844 tại `outputs/production-review/`.
- `pnpm check` Farm thành công; build Docker cả API/web thành công.
  Musicque backend: 279 pass, 3 integration test skip; Auth + Workspace UI: 15 pass.
  ESLint các file React sửa thành công. Tooling tests và `bash -n` của script deploy thành công.
- Đã xoá đúng 2 tài khoản fixture trên Keycloak/Mongo và 1 player Farm fixture,
  cùng session, grant, ledger thử nghiệm. Không xoá tài khoản thật.
- Chỉ ẩn ô Cờ tướng trong Workspace, giữ trang `/xiangqi` và backend.

## Backup và việc còn lại

Backup police: `/home/ptdevs/backups/chibi-sso/remaining-20261020174942/`
chứa compose, nginx và source auth Musicque trước thay đổi. Image Musicque API đã có
rollback tag tương ứng; các image rollback trước đó tiếp tục được giữ.
Theo yêu cầu bổ sung, mỗi lần deploy thành công tự xoá tag rollback/image Farm cũ
không dùng ở local và server, đồng thời prune dangling image có label Farm.
Giữ image `latest`, image còn được container tham chiếu, volume và image dự án khác.
Không còn giữ image rollback sau một lần deploy thành công; deploy thất bại không dọn.
Backup cấu hình/DB vẫn được giữ để người vận hành đối chiếu trước khi dọn riêng.
Script tự chạy `pnpm check` trước build; không cần chạy check thủ công lần nữa.

Chủ tài khoản Google cần thu hồi App Password Gmail cũ và tạo mật khẩu mới, rồi cập
nhật qua kênh private/config để thay SMTP; chưa có mật khẩu mới trong phiên này.
Không cần gửi mật khẩu mới trong chat.

Không dọn couponlinkh khi chưa có backup cuối và danh sách được duyệt. Các cải thiện
đã liệt kê trước đó (thêm email, back-channel logout, Musicque trên world map, đổi tên
bên trong Farm, Google OAuth và theme Keycloak) chưa triển khai trong đợt vận hành này.
