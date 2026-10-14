# Arcade source artwork

`lobby-atlas.png` là bộ người dùng gửi ngày 12/10/2026: banner và bảy thẻ trò chơi có alpha thật. `diamond-reference.png` là screenshot người dùng gửi, dùng để tách sáu viên kim cương và nền nỉ xanh.

Chạy `python3 tools/arcade/export-assets.py` (Pillow). Exporter ghi crop rectangles vào `tools/arcade/assets.json`, xuất WebP lossless vào `apps/game/src/assets/arcade/`. Viên kim cương được lấy alpha theo màu, giữ silhouette lớn nhất và lấp lỗ kín để bảo toàn glyph tối. Không thay đổi avatar hay tạo hình mới.

Chạy `node tools/runtime/prepare-assets.mjs` để tạo static imports. Next đưa ảnh vào `_next/static/media` với tên hash; sprite nhỏ dùng `<img>` trực tiếp, tái sử dụng cùng URL, không qua endpoint resize mỗi viên. Giữ nguồn PNG để chỉnh crop và tái xuất; runtime chỉ dùng WebP.

Căn hiển thị: `apps/game/src/features/arcade/_components/gem-image.tsx` giữ nguyên WebP và dùng viewBox theo alpha bounds để bỏ khoảng trống không đều trong crop. Cả bàn chơi và hộp luật dùng cùng component. Nếu tái xuất crop khác, cập nhật bounds từ alpha thật; không coi glyph là bằng chứng tác dụng trong game gốc.
