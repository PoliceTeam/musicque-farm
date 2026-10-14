# Bộ Goku cơ bản — bản sửa theo form cũ

Người dùng từ chối bản gen v1 vì áo, quần, giày không liền thân và tóc không khớp đầu. Hình Goku gửi chỉ dùng tham khảo ý tưởng; không lấy tỉ lệ bộ tham khảo thay cho form game.

Bản sửa dùng `tools/outfits/goku.json` và `python tools/outfits/build_goku.py`. Exporter dùng các sprite native hiện tại làm template: shirt.tank, pants, shoes, wrist.band. Giữ form và neo của các template. Áo có huy hiệu trắng/đen và overlay nút thắt với hai đuôi đai xanh kéo xuống trên quần. Giày dùng template shoes (layer 15), giữ form/neo/pose giày cũ, chỉ thêm một line đỏ ở mép trên và một line đỏ trên đế trong footprint cũ, nên không che ống quần. Huy hiệu thu về 5×5px; nút thắt rộng 7px và hai đuôi đai dài hơn, có mảng xanh sáng/tối rõ. Thêm palette cam cho áo/quần; không thu nhỏ sprite từ ảnh gen. Các màu trang phục đổi được qua selector hiện có.

Tóc hiện dùng atlas v5 theo demo mới (xem dưới). Đuôi giữ ImageGen built-in theo mẫu v4 (`docs/art/goku-reference-v4.png`): [nguồn đuôi](art/monkey-tail-v2.png) + [prompt](art/monkey-tail-v2.prompt.txt), native 26×18px neo −34/−27 phía sau hông. Exporter tóc: tools/hair3/build.py; đồ/đuôi: tools/outfits/build_goku.py (cần Pillow).

Nút **Goku cơ bản** ở character.html và tủ đồ áp preset. Tóc Lv.1–4 đã được người dùng duyệt; các phần trang phục giữ bản đang dùng. Chưa làm biến hình/aura.

Gậy Như Ý (`held.nyoibo`) là slot cầm tay layer 35, thân đỏ bóng/đậm và hai đầu viền vàng nhỏ. Sprite native dài 46px, nghiêng ra ngoài mặt, đi qua điểm nắm (9, −14); ngón tay layer 36 vẽ đè. Preset Goku mặc sẵn gậy; có thể bỏ/đổi trong Cầm tay. Ô chung **Đuôi** (slot tail) có món đầu tiên **Đuôi khỉ** (`tail.monkey`), màu nâu, cong chữ U sau hông, layer 8 phía sau thân. Preset Goku chọn sẵn; có thể bỏ độc lập. Đuôi dùng đường cong trơn, thu nhỏ từ gốc đến đầu đuôi, ngắn và cong lên sau hông. Bộ đồ lưu từ trước sẽ mặc định không đuôi. Tên slot không gắn với Saiyan để thêm loại khác sau này.

Tóc v3/v4 và các dáng Lv.2–4 đầu tiên bị từ chối; tóc dùng atlas v5. Đuôi procedural bị từ chối; đã thay bằng raster v2. Trạng thái duyệt tóc hiện tại ghi ở mục sửa bên dưới.

## Cấp tóc (Lv.1–4)

Chọn **Tóc Goku** rồi đổi **Cấp tóc**: Goku cơ bản, Super Saiyan, Super Saiyan 2, Super Saiyan 3. Màu chọn riêng, không tự ép vàng. Không có Lv.5 hoặc aura.

Bản cũ bị chê; bản sửa dùng [demo mới](art/goku-hair-reference-v5.png) và [atlas v5](art/goku-hair-atlas-v5.png) / [prompt](art/goku-hair-atlas-v5.prompt.txt), tạo bằng ImageGen built-in. Đây là bản dựng theo demo, không phải cắt nguyên pixel từ demo; Lv.2–3 ở atlas này đã bị thay bởi v6; bản sửa cuối đã được duyệt (xem dưới). Các nguồn tóc v4/Lv.2–4 bị loại đã bỏ để tránh tái sử dụng.

Cấu hình trong tools/hair3/styles.json. Kích thước/neo pose đứng: Lv.1 50×38 tại −29/−72; Lv.2 50×40 tại −29/−71; Lv.3 50×43 tại −29/−73; Lv.4 58×62 tại −37/−73. Lv.4 rộng về sau, phần mane vẽ layer 5 sau đầu/body, kéo đến ngang hông. Màu đen và vàng có bảng tone nguồn riêng, quy về IhHGL. Builder hỗ trợ width riêng, sinh viền phần tóc sau và các bản mặt rộng. Giữ nguyên các style tóc khác.

## Sửa lọn và đường nối sau phản hồi 14:46

Người dùng chê Lv.2–3 phẳng/vỡ và Lv.4 có đường cắt. Lv.1 giữ nguyên. Lv.2–3 thay bằng [nguồn charcoal v6](art/goku-hair-lv23-v6.png) / [prompt](art/goku-hair-lv23-v6.prompt.txt), ImageGen built-in theo demo v5, với các lớp lọn và bóng rõ hơn. Bản sửa tóc Lv.1–4 đã được người dùng duyệt qua phản hồi “okey bản này ngon push code lên giúp tôi”.

Exporter dùng `cluster_sample` riêng cho Lv.2–4: phân cụm màu trước khi giảm kích thước, giữ các mảng bóng và highlight chiếm đủ diện tích, thay vì trung bình RGB làm mất đường lọn. Lv.4 giữ hình nguồn v5; đường bao dựa trên alpha toàn mảng tóc, không vẽ viền tại đường tách lớp trước/sau. Mask toàn mảng cũng được nới theo mặt rộng. Bảng màu game và các tóc khác không đổi.
