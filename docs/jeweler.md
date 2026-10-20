# Thợ kim hoàn ngoài phố

NPC dùng artwork `npc:jewelry` có sẵn, đứng trước cửa hàng đá quý tại khu mua sắm. Bấm NPC hoặc nút Thợ kim hoàn mở menu Chợ mua bán đá / Nâng cấp vật phẩm. Tòa nhà là cảnh nền, không còn mũi tên hoặc destination vào map đá quý. Map nội thất cũ giữ trong registry để tương thích đường dẫn cũ, không nằm trên luồng vào cửa hàng mới.

## Chợ đá

Modal tab dạng folder giống các cửa hàng khác, không có nút quay lại. Hai tab Mua/Bán; giá do `packages/game-content/src/jeweler.ts` quyết định, client chỉ gửi loại vật liệu, số lượng và requestId.

| Vật liệu | Mua (xu) | Bán hệ thống (xu) | Nguyên liệu cho một lần ghép |
| --- | ---: | ---: | --- |
| Đá lam | 5.000 | 3.000 | — |
| Đá lục | 15.000 | 13.000 | 3 Đá lam |
| Đá tím | 45.000 | 40.000 | 3 Đá lục |
| Đá hồng | 90.000 | 85.000 | 2 Đá tím |
| Đá kim | 180.000 | 170.000 | 2 Đá hồng |
| Ngọc huyền linh | 15.000 | 13.000 | — |
| Ngọc tinh tú | 45.000 | 40.000 | 3 Ngọc huyền linh |
| Ngọc thiên linh | 90.000 | 85.000 | 3 Ngọc tinh tú |

Ghép thành công 100%, chỉ tiêu số nguyên liệu nêu trên, không thêm phí xu. Số lượng giao dịch 1–1.000. Vật liệu có số lượng riêng trong save, không chiếm ô đồ ngoại hình và là nguyên liệu bắt buộc bị tiêu ở mỗi lượt nâng cấp theo công thức.

SDK local và API dùng cùng game-service. GET/POST `/api/jeweler` xác thực bằng session và dùng transaction inventory/ví của player. Receipt giữ fingerprint để retry không trừ xu/cộng vật liệu lần nữa, kể cả sau giao dịch khác; mã trùng payload khác bị từ chối. Kiểm tra xu giữ cược, số nguyên an toàn, nguyên liệu/số lượng đang có trước khi ghi. UI giữ mã giao dịch khi kết quả chưa rõ vì lỗi mạng.

## Nâng cấp vật phẩm

Hai tab Bằng xu/Bằng lượng dùng chung cấp đồ và tiến độ bảo hiểm, có công thức nguyên liệu bắt buộc. Danh sách dọc bên trái, xem trước cấp hiện tại/đích bên phải; trên điện thoại hai bản xem trước xếp dọc. Tóc Goku chỉ hiện ở tab xu. Lượng tăng 10 điểm phần trăm tỉ lệ thành công; xem [quy tắc nâng cấp](cosmetic-upgrades.md). Nút nâng bị khóa khi thiếu tiền hoặc nguyên liệu; mỗi lượt có xác nhận và lưu kết quả để retry không tiêu lặp.

## Kiểm tra

`apps/game/tests/jeweler.test.ts`: toàn bộ giá và công thức, retry, payload khác, xu giữ cược, số lượng sai, thiếu nguyên liệu và overflow. `apps/api/tests/jeweler.test.ts`: session, cô lập chủ sở hữu, request đồng thời và lưu ví/nguyên liệu. `shopping.test.ts`: NPC mở menu ngay trên phố và tòa nhà không mở map nữa.

## Artwork

Tám vật liệu dùng atlas người dùng cung cấp, được cắt lossless qua `tools/jeweler/export-assets.py`; bản gốc lưu trong `tools/jeweler/source-art/`. Runtime chỉ dùng WebP tách nền, không dùng biểu tượng hình thoi tạm nữa.

## NPC dùng chung

`createServiceNpc` trong game-content nhận role (art và tên), service (menu) và tọa độ chân. `game/rendering/service-npc-view.ts` sở hữu vẽ NPC, tính vị trí đỉnh đầu từ alpha một lần, tên vàng và dấu sao đỏ. Nhãn dùng `serviceNpcNames` theo role, không kiểm tra ID thợ kim hoàn trong renderer. `game/npc/service-npc-logic.ts` cung cấp vùng bấm và ưu tiên NPC trước tòa nhà phía sau. NPC về sau có thể dùng lại cấu hình này.

Mũi tên trước cửa hàng thời trang bên cạnh bị ẩn bằng `hideEntranceHint`; cửa hàng vẫn bấm vào được.

Nâng cấp chỉ có tại thợ kim hoàn; menu Nhân vật không còn tab/nút nâng cấp. Giỏ đồ chỉ liệt kê instance vật phẩm, quyền màu giữ trong chi tiết và không chiếm ô riêng. NPC ở shop và cổng farm dùng chung `npcPlacement` để đạt chiều cao phần ảnh nhìn thấy 72 world units, giữ tỉ lệ gốc và vị trí chân. Dấu sao đỏ là prefix cùng dòng tên vàng trong renderer Phaser/Canvas, không vẽ phía trên tên.
