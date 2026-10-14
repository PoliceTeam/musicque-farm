# Quy trình tạo và ghép tóc

Đọc [approved-art-rules.md](approved-art-rules.md) trước để giữ đúng các mốc người dùng đã duyệt.

Mục tiêu: giữ chất lượng của bộ tóc nam đã duyệt trong `art/male-hair-atlas-v2.png`, có thể đổi màu, ôm đúng đầu trong game và không lọt nền ở cạnh tai. Dùng cùng một góc nhìn 3/4 quay phải; hướng trái do engine lật. Không cần gen góc sau hay sheet nhiều hướng.

## 1. Chốt hình ở kích thước game

- Xem cả ×1, ×2 và ×4. Hình đẹp khi phóng lớn chưa đủ để duyệt.
- Đầu gốc đặt ở x −21, y −58 (pose 0). Mắt nằm quanh y −42…−34. Căn theo sọ, thái dương và tai; không căn theo bounding box có khoảng trống hay các chấm hiệu ứng.
- Bề ngang tóc thường 48px. Đỉnh từng kiểu khác nhau: rối −67, bông −68, vuốt ngược −68, dựng −75. Đây là mốc của bộ hiện tại, không phải bắt mọi kiểu mới cao bằng nhau.
- Với tóc ngắn, phần sọ phải ôm đầu. Với tóc dựng, phân biệt chiều cao sọ và chiều cao lọn nhô lên. Với tóc vuốt ngược, giữ đường chân tóc cong và trán lộ tự nhiên.

## 2. Prompt tạo raster

Dùng ảnh tóc đã duyệt làm tham chiếu. Yêu cầu alpha thật, chỉ tóc, không da/mắt/tai/đầu, không bảng màu, chữ hoặc khung. Các style trong atlas cùng hướng và cùng kích thước sọ, có khoảng cách đủ lớn giữa ô.

Prompt mẫu (thay phần style):

> Production pixel-art game hair asset, male chibi, three-quarter view facing right, visible near-ear opening on the left. Match the approved reference's skull proportions and clustered pixel shading. [DESCRIBE STYLE AND SILHOUETTE]. Hair only, transparent face opening and actual transparent background. Copper-brown source with five clear warm tones, broad coherent locks, small deliberate highlights, thin outer contour, recolourable dark interior strands. No skin, ears, eyes, body, text, frame, glow or loose decorative specks. Intended native width approximately 48 pixels; judge legibility at game size. Preserve the whole crown, natural fringe and temple attachment.

Chốt silhouette và lọn trước khi đổi màu. Nếu người dùng đã duyệt hình, chỉnh ghép và mask trong source; không gen lại hình để sửa một khe hở.

## 3. Chuyển sang lưới pixel

Chạy từ thư mục `game`:

```sh
python3 tools/hair3/build.py
pnpm check
pnpm build
```

Script dùng Pillow, nguồn ảnh được lưu trong repo. `sprites/**/sprites.txt` là asset runtime; atlas chỉ là nguồn tái tạo.

- Lấy vùng alpha có phủ đủ, loại chấm rời rồi thu về kích thước native.
- Gom màu theo các cụm lọn, dùng 5 chữ `I h H G L`. `K` chỉ dùng cho đường bao 1px, không biến mọi bóng tối thành viền đen.
- Giữ các lọn và mảng sáng lớn; không thêm noise để giả chi tiết. Màu vàng/trắng phải vẫn sạch, không thành mạng lưới đen.
- Vùng da trán được phép lộ. Vùng nền giữa mép sọ và tóc ở thái dương phải kín. Không dùng một đường cắt ngang trán hoặc một mảng tối phẳng cho tất cả style.
- Nối mask cạnh tai theo từng dáng đầu. Vùng nối phải bắt đầu tại đường chân tóc của style (`scalp_until`), không cố định y −48: tóc vuốt ngược bắt đầu cao hơn, tại y −51. Mỗi lần đổi hairline phải kiểm tra lại các hàng ngay phía trên vùng nối cũ. Không tô đè vùng mắt để che một lỗi ghép. Không bỏ một lọn hợp lệ chỉ vì thuật toán coi nó là chấm rời.
- Có thể cân phần đỉnh qua `crown_shift_x`/`crown_until`: tóc vuốt ngược và tóc dựng dịch đỉnh về sau 2px (`-2`), giảm dần về 0 tại y −51 (vuốt ngược) hoặc −48 (dựng). Giữ nguyên đường chân tóc, thái dương và offset ghép; không dịch cả mảnh rồi gây khe hở cạnh tai.
- Tạo `.w2`, `.w4`, `.w6` cùng lúc cho mặt rộng; kiểm tra lại seam và mắt sau khi nới.

## 4. Thêm một style

1. Lưu raster nguồn có alpha trong `docs/art/`; ghi nguồn/tham chiếu và phiên bản được duyệt.
2. Thêm cấu hình style vào `tools/hair3/styles.json`: id, ô atlas, kích thước native, mốc phủ sọ. Nếu dùng ảnh riêng, khai báo `"atlas": "docs/art/hair-new.png", "grid": [1, 1], "cell": [0, 0]`; builder nạp ảnh theo style mà không cần sửa code. Không ghi đè atlas đã duyệt. Tóc vuốt ngược có thể dùng thêm `temple_end_y` và `temple_front_x` để thái dương không chạm mi mắt.
3. Thêm item `hair.<name>` vào `items.json`, slot `hair`, layer 50; thêm các item `.w2/.w4/.w6` hidden và các pose offset. Pose 1/2/3 đi cùng đầu (thường xuống 1px so với pose 0).
4. Thêm các section tương ứng vào `sprites/**/sprites.txt` trước khi export. Builder phải báo lỗi nếu thiếu item/section, thay vì im lặng bỏ asset.
5. Nếu thực sự cần tóc sau tai, dùng `<id>.back` ở layer 5; đây là lớp ghép cùng góc nhìn, không phải thêm góc sau.
6. Sinh sprite, chạy kiểm tra và duyệt trong `/character.html`, rồi kiểm tra trên nền cỏ của game.

## 5. Checklist duyệt

- Đúng silhouette và tỉ lệ của mẫu đã duyệt; đỉnh không làm sọ dài bất thường.
- Đường chân tóc có chủ ý; trán của tóc vuốt ngược không bị thanh đen ngang.
- Không có nền lọt ở cạnh tai, mép sọ, giữa tóc và đầu; thử nền sáng/tối/cỏ.
- Không che mắt hoặc lông mi; thái dương không tạo khuyết như một mắt thứ ba.
- Cả 10 dáng mặt, pose 0–3, quay trái/phải đều khớp.
- Kiểm tra đen, vàng, trắng và một màu bão hòa; không chỉ duyệt màu nguồn.
- Kiểm tra đứng, đi, nhịp thở và đổi hướng, ở ×1/×2/×4.
- Mọi frame/biến thể tồn tại, generator chạy lại cho kết quả giống nhau, test và build pass.

Test topology bắt khe hở; test không thay thế việc nhìn đường chân tóc, màu và silhouette.
