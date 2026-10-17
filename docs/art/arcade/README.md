# Arcade source artwork

`lobby-atlas.png` là bộ người dùng gửi ngày 12/10/2026: banner và bảy thẻ trò chơi có alpha thật. `diamond-reference.png` là screenshot người dùng gửi, dùng để tách sáu viên kim cương và nền nỉ xanh.

Chạy `python3 tools/arcade/export-assets.py` (Pillow). Exporter ghi crop rectangles vào `tools/arcade/assets.json`, xuất WebP lossless vào `apps/game/src/assets/arcade/`. Viên kim cương được lấy alpha theo màu, giữ silhouette lớn nhất và lấp lỗ kín để bảo toàn glyph tối. Không thay đổi avatar hay tạo hình mới.

Chạy `node tools/runtime/prepare-assets.mjs` để tạo static imports. Next đưa ảnh vào `_next/static/media` với tên hash; sprite nhỏ dùng `<img>` trực tiếp, tái sử dụng cùng URL, không qua endpoint resize mỗi viên. Giữ nguồn PNG để chỉnh crop và tái xuất; runtime chỉ dùng WebP.

Căn hiển thị: `apps/game/src/features/arcade/_components/gem-image.tsx` giữ nguyên WebP và dùng viewBox theo alpha bounds để bỏ khoảng trống không đều trong crop. Cả bàn chơi và hộp luật dùng cùng component. Nếu tái xuất crop khác, cập nhật bounds từ alpha thật; không coi glyph là bằng chứng tác dụng trong game gốc.

`game-ui-atlas-user.png` là sheet người dùng gửi ngày 16/10/2026. Mặt bàn đỏ `card-table.webp` được crop nguyên bản, bỏ matte đỏ sáng/alpha nhiễu và chỉ giữ silhouette nối với tâm bàn; không dùng mask hình học để tránh cắt mất góc gỗ nguyên bản. Tiến lên và Phỏm dùng chung asset qua `ArcadeHost.assets`; package giao diện không import asset của app. Các phần còn lại trong sheet chưa được tích hợp.

`chess-atlas-user.png` và `xiangqi-atlas-user.png` là hai sheet người dùng gửi tiếp ngày 16/10/2026. Exporter lấy 12 quân vua và 14 quân tướng lớn thành WebP riêng; cờ vua bỏ nền caro RGB bằng flood fill vùng trung tính nối với mép crop, giữ các highlight kín của quân. Các quân vua được đặt lên canvas 128×192 cùng đáy; quân tướng dùng alpha gốc giới hạn ở viền đồng xu. BoardPiece nhận URL qua host, không import tài nguyên app vào package. Bàn/điểm đi vẫn dựng theo tọa độ logic để lật hướng, đánh dấu nước đi và hitbox khớp nhau; không dùng ảnh bàn có tọa độ cố định. Mặt bàn bài dùng ảnh rộng theo vùng bàn, chiều cao tự tính từ tỷ lệ nguồn; căn giữa theo vùng ghế, không kéo riêng chiều ngang/dọc.

Các màn arcade lưu game/phòng/bàn vào URL hash. Tải lại chỉ khôi phục view và đọc snapshot server, không tự vào bàn hay đặt cược. Header dùng tên game và địa chỉ phòng/bàn; tên người chơi chỉ dùng display name, tên của mình màu vàng. Luyện tập chỉ có thiết lập và Bắt đầu; chủ bàn người thật thiết lập mức cược, các thành viên còn lại xác nhận sẵn sàng.
