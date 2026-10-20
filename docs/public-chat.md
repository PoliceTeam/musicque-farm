# Chat công cộng theo khu

Mở bằng **Space**, gửi bằng **Enter** hoặc nút Gửi, đóng bằng **Esc** hoặc nút Chat khu. Ô chat dùng chung ở bản đồ thế giới, cổng farm, farm, phố, nội thất, khu game và đua pet. Bảng thu gọn hiển thị bốn tin gần nhất; mở ra xem tối đa 50 tin và nhập nội dung. Space không chiếm phím khi đang nhập ở ô khác, focus nút/link hoặc có dialog. Khi nhập chat, các bộ điều khiển game hiện tại dừng theo focus input; Enter đang xác nhận bộ gõ IME không gửi tin.

## Kênh và giao thức

- Scope là `(regionId, mapId, channelId)`. Bản đồ có khu dùng khu đã chọn được lưu phía server; khu không có channel dùng 0. Farm là kênh công cộng của bản đồ farm, không phải tin nhắn riêng theo chủ farm. Bản đồ thế giới, cổng farm và đua pet có area công cộng riêng trong `game-content/public-chat.ts`.
- UI mount một `PublicChat` trong application shell, đổi scope khi đổi màn và cập nhật khi nhận `map.state` đổi khu. `chat.watch` chỉ gửi area; server đọc channel từ tài khoản. Không nhận channel, tên hoặc playerId do lệnh gửi chat tự khai.
- `chat.watch` đăng ký topic và trả `chat.state`; `chat.send` mang requestId + text; server phát `chat.message` tới đúng topic và trả `chat.result` cho người gửi. `chat.leave` bỏ đăng ký. Chat không thay thế movement room, lobby game hoặc các subscription xã hội.
- Sender id/name/level lấy từ session đã xác thực. Payload được decode trong contracts ở cả hai đầu. Chỉ văn bản thuần, tối đa 200 Unicode code point sau chuẩn hóa NFC và khoảng trắng; bỏ control/bidi controls nhưng giữ emoji ZWJ. React render text, không dùng HTML do người dùng gửi.
- Tối đa một tin mỗi giây theo người chơi, dùng chung giữa các tab và API instance. Lệnh retry cùng requestId/nội dung/scope được xác nhận lại; khác payload/scope báo conflict. Giữ tối đa 100 receipt gần nhất trong cùng thời hạn dữ liệu chat. Không tự phát lại tin khi reconnect.

## Lưu trữ và kết nối

`apps/api/src/modules/world/public-chat.ts` dùng Coordination KV và pub/sub adapter đang chọn (memory ở local API, Redis ở production nhiều instance). Mỗi scope giữ 50 tin gần nhất; key hết hạn sau một giờ không có ghi mới. Không lưu chat dài hạn vào PostgreSQL. Khóa append chỉ cho scope chat tương ứng, đồng bộ snapshot lịch sử và append để tránh mất tin lúc vừa subscribe; không khóa di chuyển hoặc toàn bộ khu trên server. Khóa sender giới hạn tốc độ và dedupe giữa tab/instance.

WebSocket client nhớ `chat.watch` qua reconnect, không nhớ lệnh `chat.send` để gửi tự động. Khi đứt kết nối, UI khóa gửi; nội dung chưa xác nhận được giữ để người chơi thử lại cùng mã. Nếu chưa nhận được state, retry đăng ký sau 5 giây; không polling lịch sử khi đã tham gia. Mất ACK sau 8 giây hiển thị nút Thử lại, không tự xóa nội dung hoặc giả lập nhận tin.

Chat là realtime dạng ngắn hạn, không phải hộp thư có bảo đảm lưu lâu dài. Khi khởi động lại API với memory adapter, lịch sử bị xóa. Với SDK offline không có WebSocket, UI vẫn cho mở ô nhưng báo cần kết nối máy chủ và không tạo tin giả. Muốn hai người chơi chat cần chạy API và cấu hình `NEXT_PUBLIC_API_URL` như các tính năng multiplayer khác.

## Kiểm tra

- `apps/api/tests/public-chat.test.ts`: hai API instance, danh tính thật, tách map/khu, retry và spam qua tab, lịch sử 50 tin, các area có/không có movement room, không gửi sau khi rời.
- `apps/game/tests/public-chat.test.ts`: text tiếng Việt/emoji/control characters, giới hạn payload, Space theo focus/modal/modifier, route/scope, merge lịch sử và reconnect không gửi lặp tin.
- `remote-players.test.ts`: kiểm tra hồi quy replay subscription và thông báo disconnected/reconnected.
