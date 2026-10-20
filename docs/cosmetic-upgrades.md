# Nâng cấp ngoại hình

Đã triển khai ngày 20/10/2026: Thợ kim hoàn → Nâng cấp vật phẩm. Modal có hai tab Bằng xu / Bằng lượng, danh sách dòng đồ bên trái và hai khung preview bên phải: khung trái giữ cấp hiện tại, khung phải đổi hình theo tab cấp được chọn (mặc định cấp kế tiếp). Tab chỉ xem trước, giao dịch vẫn nâng đúng cấp kế tiếp. Không có tiêu đề, hướng dẫn chọn tiền hay số dư riêng trong nội dung modal. Nhân vật không có nút nâng cấp.

## Công thức và tỉ lệ

Mỗi lượt cần món cấp nguồn đã sở hữu, đúng đá/ngọc bắt buộc và một loại phí xu hoặc lượng. Thành công mở ngoại hình cấp kế tiếp đã có trong catalog; không thêm chỉ số chiến đấu. Công thức, phí và đối chiếu đủ 113 dòng được mô tả trong [thiết kế](equipment-upgrade-proposal.md) và [catalog](equipment-upgrade-catalog.md). Config runtime: `packages/game-content/src/cosmetic-upgrades.ts`.

| Bước | Xu | Lượng | Bảo hiểm |
| --- | ---: | ---: | --- |
| 1 → 2 | 85% | 95% | Không |
| 2 → 3 | 75% | 85% | Lượt thứ 5 nếu trước đó trượt cả 4 |
| 3 → 4 | 55% | 65% | Lượt thứ 10 nếu trước đó trượt cả 9 |
| 4 → 5 | 35% | 45% | Lượt thứ 15 nếu trước đó trượt cả 14 |
| 5 → 6 | 25% | 35% | Không |

- Lượng tăng 10 điểm phần trăm; không bỏ yêu cầu đá/ngọc. Trượt và lượt bảo hiểm đều tiêu đủ nguyên liệu và phí. Trượt giữ nguyên đồ, màu, vị trí túi/kho và outfit.
- Tiến độ trượt lưu trong `PlayerDocument.upgradeFailures` theo người chơi/dòng đồ/cấp đích, dùng chung cho xu và lượng, giữ qua đăng nhập lại. Thành công kết thúc tiến độ cấp đó; cấp mới bắt đầu từ 0. Không tăng dần tỉ lệ trước mốc bảo hiểm.
- Chỉ 28 dòng có nhiều cấp được cấu hình. Mũ thường dùng đá; cánh, pet và tóc Goku dùng đá cộng ngọc. Phí pet/Goku giữ hệ số ×2. Tóc Goku chỉ dùng xu. Mỗi đường lượng thay phần phí theo bảng riêng, không có API quy đổi tiền.
- Cánh Tiểu Tiên chỉ có cấp 1 độc quyền quay số nên chưa có nâng cấp. Shop chỉ bán cấp đầu; không mở cấp chưa có hình hoặc bỏ cấp.
- Giữ quyền sở hữu cấp cũ. Thành công cấp một instance đích, mang các màu nguồn tương thích và màu chuẩn sang đích. Nếu đang mặc thì mặc cấp mới, cất cấp cũ vào túi hoặc kho khi đầy. Đồ trong kho vẫn ở kho. Màu không xuất hiện thành ô vật phẩm trùng trong túi.

## Giao dịch và retry

- UI hiển thị nguyên liệu cần/có, tỉ lệ hiện tại và bảo hiểm; cần xác nhận trước khi gửi. Trong lúc chưa xác định kết quả do lỗi mạng, khóa giao dịch mới và giữ nguyên requestId để kiểm tra lại.
- Server quyết định công thức/giá/loại phí/tỉ lệ và RNG; client gửi instance, target, recipeVersion và currency. Lệnh thiếu phiên bản/loại phí bị từ chối. Config thay đổi cần tăng phiên bản; offer cũ không bị trừ tiền theo giá mới.
- API kiểm tra thành viên phòng realtime còn lease ở phố mua sắm, đúng khu đã chọn và cách chân NPC tối đa 200 world units. Tọa độ lấy từ world room có kiểm tra di chuyển; không nhận tọa độ từ payload nâng cấp. Receipt đã commit vẫn được kiểm tra sau khi rời NPC hoặc mất kết nối. Local adapter dùng cùng quy tắc tiền/nguyên liệu/RNG/bảo hiểm, UI chỉ mở dịch vụ qua NPC; môi trường offline không có vị trí server để xác thực.
- Giao dịch khóa player và inventory, kiểm tra xu khả dụng sau tiền giữ cược, nguyên liệu và ví lượng; ghi nguyên liệu, ví, tiến độ, grant/outfit và receipt trong cùng transaction. Trượt là kết quả hợp lệ, không phải lỗi API. Lỗi kỹ thuật rollback toàn bộ.
- Receipt cả thành công và thất bại ghi cấp nguồn/đích, phiên bản công thức, nguyên liệu thực tiêu, phí, tỉ lệ, bảo hiểm và tiến độ trước/sau. Retry cùng requestId không trừ thêm, không tăng lượt và không quay lại kết quả. Payload khác dùng lại mã cũ bị từ chối. Hai requestId riêng là hai lượt hợp lệ nếu lượt đầu trượt; khóa double-click tại UI để tránh vô tình gửi hai lượt.
- Đồ và receipt cũ giữ nguyên, không truy thu đá hoặc bịa lịch sử nguyên liệu cho các giao dịch 100% trước đây. Chưa có tháo đá, hoàn phí hay bán ngược mỹ phẩm.

## Kiểm tra

`cosmetic-upgrade-rates.test.ts` kiểm tra biên tỉ lệ ở cả hai loại tiền, đúng mốc bảo hiểm, không bảo hiểm ở cấp 2/6, replay, thiếu nguyên liệu, phiên bản, rollback và đủ 28 dòng. `cosmetic-upgrade.test.ts` giữ kiểm tra palette, outfit, pet, túi đầy/kho, cấp kế tiếp và xu giữ cược. `upgrade-panel.test.tsx` kiểm tra nội dung nguyên liệu/tỉ lệ/bảo hiểm và khóa nút khi thiếu đá. HTTP test kiểm tra quyền sở hữu, giới hạn NPC, retry, ví/nguyên liệu, bảo hiểm và persistence trong PostgreSQL.
