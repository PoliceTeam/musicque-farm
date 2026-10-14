> Cập nhật: runtime đã chuyển sang Next.js + React và api-sdk; xem [target-architecture.md](../target-architecture.md). Các chi tiết entry HTML/Vite bên dưới mô tả giai đoạn trước migration.

# Ứng dụng và vòng gameplay nông trại

Game dùng một entry Vite với History API: `/map`, `/farm`, `/character` và `/town` (sân thử cũ). `/` mở bản đồ. URL `.html` cũ vẫn dùng được và được đổi sang route tương ứng, giữ query string. `/ui.html` giữ làm trang kiểm tra component.

Chuyển route bằng liên kết trong game và Back/Forward không tải lại document. App sở hữu một bộ âm thanh; từng màn hình nhận bộ âm thanh đó. Màn hình dọn renderer, input, interval/RAF, feedback và đăng ký âm thanh khi rời đi. Import chậm của route cũ không được mount sau khi người chơi đã chọn route mới. CSS riêng chỉ tồn tại trong một style của màn hình hiện tại; theme chung luôn được áp dụng sau đó. Farm lưu trước khi unmount; nhân vật đọc outfit đã lưu khi mở lại.

## Triển khai

Vite dev/preview hỗ trợ mở trực tiếp các route. Hosting production phải phục vụ `index.html` khi request `/map`, `/farm`, `/character`, `/town`; file tĩnh và API phải giữ đường dẫn riêng. Ví dụ Nginx: `try_files $uri $uri/ /index.html;`. Không cần Next/SSR cho các màn hình game này.

## Trồng trọt

Đất khô → xới → gieo → tưới → lớn 60 giây → thu hoạch về đất đã xới. Thu hoạch tăng kho dâu và số lượt thu hoạch, không tăng xu. Gieo dùng hạt trong kho trước; nếu hết hạt, trừ 10 xu/ô theo cơ chế hiện có. Mua hạt giống riêng chưa nằm trong đợt này.

Menu **Chăm sóc hàng loạt** áp dụng xới/gieo/tưới/thu hoạch ngay trên toàn bộ ô đã mở có trạng thái phù hợp. Khi thiếu xu, gieo dừng và báo số ô thực hiện; không xử lý ô chưa mở. Chăm từng ô bằng nhân vật vẫn dùng được.

## Chăn nuôi

Mua con non chiếm một chỗ. Thời gian có thức ăn mới tính vào tuổi và sản xuất; đói thì tạm dừng, không chết. Gia súc: con non <5 phút, đang lớn 5–15 phút; gia cầm: <3 phút, 3–9 phút; cá: <4 phút, 4–12 phút. Các con vật có từ bản cũ được giữ tuổi hiện tại khi chuyển dữ liệu.

Một lần cho ăn kéo dài 5 phút; được bổ sung khi no ≤25%. Giá mỗi đàn: gia súc 50 xu, gia cầm 25 xu, ao 25 xu. Trước khi bổ sung thức ăn, ghi nhận hết thời gian đã chăm của lần trước để không mất tiến độ. Cho cả trại ăn chỉ thực hiện khi đủ xu cho toàn bộ đàn phù hợp.

| Vật nuôi trưởng thành | Sản phẩm | Thời gian sản xuất khi được cho ăn | Bán / sản phẩm | Sau khi thu |
| --- | --- | --- | --- | --- |
| Gà | Trứng gà | 2 phút | 30 xu | Ở lại, bắt đầu chu kỳ mới |
| Vịt | Trứng vịt | 2 phút | 35 xu | Ở lại, bắt đầu chu kỳ mới |
| Bò | Sữa | 3 phút | 90 xu | Ở lại, bắt đầu chu kỳ mới |
| Cừu | Lông cừu | 3 phút | 80 xu | Ở lại, bắt đầu chu kỳ mới |
| Lợn | Thịt lợn | 3 phút | 650 xu | Kết thúc lứa, giải phóng chỗ |
| Cá | Cá thu hoạch | 4 phút | 250 xu | Kết thúc lứa, giải phóng chỗ |

Mỗi con giữ tối đa một sản phẩm sẵn sàng. Tuổi, thời gian sản xuất và thời điểm cập nhật được lưu; khi quay lại, chỉ tính khoảng thời gian có thức ăn, không tạo sản phẩm vô hạn lúc offline. Thu riêng một đàn hoặc thu cả trại đều nhập kho; thu hai lần cùng thời điểm không nhân đôi sản phẩm.

Nâng cấp giữ quy tắc đã có: thêm một chỗ mỗi lần, tự nới diện tích tại mốc 10 và 18 gia súc / 16 cá. Tối đa: 60 ô đất, 24 gia súc, 24 gia cầm, 20 cá. Bảng mua ẩn khi sức chứa đạt tối đa; mua con non hiện lại khi thu hoạch lợn/cá giải phóng chỗ.

## Kho và lưu dữ liệu

Kho hàng hiển thị các sản phẩm có số lượng >0; chọn sản phẩm rồi bán 1 hoặc bán tất cả loại đang chọn. Hộp xác nhận nêu số lượng, số xu nhận và số dư sau bán. Kho giống không có nút bán. Không tự bán khi thu hoạch. Tiến độ hiện vẫn lưu trong localStorage của trình duyệt; đây chưa phải nền kinh tế lưu trên server.

## Kiểm tra

Test logic bao phủ tăng trưởng khi no/đói, offline, bổ sung thức ăn, thu lặp, giải phóng sức chứa, tồn kho/bán, chăm sóc hàng loạt thiếu xu, migration dữ liệu và import route chậm. Test âm thanh xác nhận cùng một music source tồn tại qua các lần chuyển màn hình. Kiểm tra trình duyệt: farm → character → map → Back/Forward, thu cả trại, chọn sản phẩm và bán chủ động. `?review=max` là dữ liệu thử chỉ ở dev, không ghi đè tiến độ thật.

Sức chứa đất được tính theo bố cục: 24 ô trên và 12 ô trong mỗi thảm dưới. 12 ô bổ sung nối sau số 48 để không đổi vị trí các ô trong dữ liệu cũ. HUD, giới hạn mua và storage dùng cùng cấu hình đất.
