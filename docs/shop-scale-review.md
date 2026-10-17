# Rà soát cửa hàng và hướng mở rộng danh mục

Ngày 17/10/2026. Phạm vi: cửa hàng, thử/phối đồ, palette, sở hữu, kho/túi, mua/mặc đồ; đối chiếu thêm luồng kết bạn/thông báo và di chuyển bằng source và bộ kiểm tra chung. Đây không phải xác nhận toàn bộ giao diện đã được kiểm tra trực tiếp bằng trình duyệt.

## Các vấn đề đã sửa

- Mỗi tab lưu riêng chuỗi cursor và số trang. Chọn món ở trang sau, chuyển tab rồi quay lại giữ đúng trang và món đang chọn; nhánh cursor phía trước được thay khi tiếp tục từ trang cũ.
- Giữ draft phối đồ độc lập với danh sách trả về. Đổi tab/trang, tải lại ownership sau mua không ghi đè draft. Mặc một món dùng outfit thật làm nền, tránh gửi cả bộ có các món đang thử nhưng chưa sở hữu.
- Nhóm màu không dừng ở 50 kết quả đầu. Client theo `nextCursor` tới hết nhóm, bỏ kết quả nếu lựa chọn đã thay đổi, phát hiện cursor lặp.
- Catalog có index bất biến theo category, slot và group; mỗi lần tra cứu chọn bucket nhỏ nhất và giữ thứ tự ID nhất quán. Slot validation dùng index thay vì duyệt toàn catalog. Chỉ index metadata; ownership, quyền mua và số dư luôn lấy từ người chơi hiện tại.
- Chỉ dựng offer/quyền thao tác và clone instance của các hàng trên trang trả về; không dựng tất cả rồi mới cắt trang. Lọc sở hữu/container vẫn diễn ra trước khi phân trang, để không tạo trang rỗng hoặc sai tổng.
- Xóa lỗi tải cũ khi request danh sách mới thành công. Không cho thao tác lên danh sách cũ trong lúc đổi trang.

## Kiểm tra và giới hạn hiện tại

Danh mục tại thời điểm rà soát có **542 acquisition IDs** (bao gồm màu/cấp), không đồng nghĩa với 542 mẫu đồ riêng. Giao diện chỉ dựng 9 thẻ/trang; API giới hạn 50 hàng/request. ID mua, giá, cấp thấp nhất, ownership, slot túi và receipt vẫn được kiểm tra ở game-service dùng chung cho API/local. Rà soát này không thay schema hoặc bỏ transaction/khóa ví.

Bộ kiểm tra có các trường hợp nhóm/slot/category giao nhau, ID bucket không tồn tại, phân trang, sở hữu và tính tiền, giữ bộ thử nhiều slot, đổi màu, giữ cursor độc lập, hủy tải nhóm cũ và cursor lặp. Kiểm tra index dùng 20.000 mục giả lập và đếm truy cập: nhóm 10 mục chỉ đọc 10 entry khi lọc nhóm.

Benchmark tái lập: build character-core rồi chạy `node tools/benchmarks/cosmetic-catalog.mjs`. Một lần chạy local:

| Metadata giả lập | Tạo index | 1.000 truy vấn nhóm 10 mục |
| --- | ---: | ---: |
| 10.000 mục | 3,63 ms | 1,39 ms tổng |
| 100.000 mục | 43,71 ms | 1,68 ms tổng |

Đây chỉ là đo metadata trong process, không đo nhiều người chơi đồng thời, PostgreSQL, network, parse sprite hay FPS. Không suy ra hệ thống hiện tại đã phục vụ được 100.000 item thực tế.

## Điểm còn giới hạn khi tăng quy mô

1. **Sprite khởi động:** `generated-sprite-sources.ts` khoảng 1,8 MiB source hiện tại; `asset-catalog.ts` vẫn parse toàn bộ character/pet/scenery khi module khởi tạo. Index không làm giảm tải này. Bước tiếp theo là manifest có version và tải sprite theo family đang hiển thị/đang mặc, tách thumbnail khỏi sprite animation; cache và đồng bộ request cho cùng asset, giới hạn bộ nhớ và giữ gói outfit hiện tại/offline fallback. Cần bảo toàn ID và anchor của sprite đã duyệt.
2. **Danh mục shop:** index bỏ sort lặp và thu hẹp truy vấn nhóm/slot, nhưng bucket slot lớn vẫn cần lọc toàn bucket và tính `total`. Khi tăng mạnh, sinh sẵn tập base product theo shop/gender/category/slot ở bước content build; đưa các trang metadata tới API/CDN theo catalog version, chỉ ghép ownership của các ID trên trang. Không cache response có số dư/quyền mua chung giữa người chơi.
3. **Inventory theo người chơi:** repository hiện vẫn hydrate tất cả instances/unlocks/grants trong transaction và so sánh collection khi lưu. Đây sẽ là nút thắt khi mỗi người sở hữu nhiều nghìn món, dù trang API nhỏ. Tách read model phân trang trực tiếp trong SQL và đọc ownership theo ID trên trang; command chỉ khóa/đọc những instance/unlock cần thay đổi, vẫn chung transaction với ví và receipt. Lưu lịch sử grants ngoài đường đọc thông thường. Phải có test đối chiếu API/local và race mua/mặc/chuyển kho trước khi chuyển kiến trúc.
4. **SQL cursor:** schema đã có PK theo player/character và unique vị trí túi/trang bị. Với read model mới, đo `EXPLAIN (ANALYZE, BUFFERS)` để thêm composite index theo filter thật, ví dụ `(player_id, character_id, container, instance_id)`. Không thêm index hoặc migration khi chưa có query dùng nó. Dùng thứ tự ổn định và cursor thay vì OFFSET sâu; catalog version phải nằm trong cache key/cursor khi metadata được cập nhật độc lập.
5. **Lời mời và thông báo:** danh sách quan hệ có giới hạn nghiệp vụ, nên hiện chưa cần thay kiến trúc. Khi tăng giới hạn hoặc thêm chat, tách count/unread summary khỏi tải đầy đủ profile và phân trang conversation/message phía server. Tin nhắn riêng chưa được triển khai; nút hộp thư hiện quản lý bạn bè/lời mời.
6. **Đá quý:** hiện là map và thông báo chuẩn bị; chưa có inventory/giá/giao dịch đá quý. Đồ trang trí trên kệ không tự động là sản phẩm. Cần catalog và luật sở hữu riêng trước khi mở bán/nâng cấp.

## Cơ sở tham khảo

- [React: preserving and resetting state](https://react.dev/learn/preserving-and-resetting-state): lưu lựa chọn/cursor theo danh tính tab ở component cha, không phụ thuộc việc dựng lại nội dung tab.
- [PostgreSQL: multicolumn indexes](https://www.postgresql.org/docs/current/indexes-multicolumn.html): thứ tự cột và điều kiện lọc quyết định phạm vi index được quét; thiết kế index theo truy vấn thực tế.

Ưu tiên tiếp theo: đo cold-start/heap với nhiều sprite → chia tải asset; sau đó thử tải API với người chơi có nhiều đồ → SQL read model. Benchmark metadata chỉ hỗ trợ quyết định phần catalog, không thay thế hai phép đo này.
