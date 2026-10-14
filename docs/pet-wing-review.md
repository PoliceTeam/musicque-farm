# Review pet và cánh theo bảng mẫu

Đối chiếu source ngày 08/10/2026 với bảng tiến hóa pet và bảng 6 cấp cánh do người dùng cung cấp. Đây là ghi nhận trước khi thay artwork mèo; cập nhật mới ở cuối tài liệu.

## Những gì đã xác minh

- Canvas trang game chính co theo `width: 100%` nhưng trước review chưa có `image-rendering: pixelated`, nên trình duyệt có thể nội suy làm mềm ở kích thước CSS khác kích thước canvas. Đã thêm thuộc tính này vào `.stage canvas`; artwork pet/cánh chưa thay đổi.
- Các asset là lưới pixel trong `apps/game/src/assets/sprites/pets/*/sprites.txt` và `accessories/wings/*/sprites.txt`. Renderer tô từng pixel; màn hình game dùng nearest-neighbor. Không có blur/shadow blur áp lên chúng trong phần effect. Tăng DETAIL không khôi phục chi tiết đã mất trong lưới gốc.
- Mèo Lv.1: 32×27, 28 màu; Lv.2: 38×33, 50 màu; Lv.3: 47×40, 59 màu. Corgi Lv.3: 54×48, 56 màu. Nhiều màu trên vùng nhỏ làm từng cụm bóng bị vụn, nhất là phụ kiện, mắt và đường tách chân.
- Mèo Lv.1 có 142 pixel K trong 601 pixel đục (~24%); corgi Lv.1 có 181/826 (~22%). K xuất hiện cả quanh mắt và chi tiết bên trong. Đây là một dấu hiệu cần kiểm tra visually, không phải mọi pixel tối đều là lỗi.
- Cánh Thiên Thần Lv.1 có canvas 74×34, Lv.3 80×45, Lv.6 96×66. Kích thước gồm khoảng trống giữa cánh và padding animation; phần lông thực tế nhỏ hơn. Mẫu nhiều lớp lông và nét sáng bị giảm thành những nét 1px đứt đoạn.
- Độ sắc cạnh và mức khớp hình là hai việc khác nhau: cạnh runtime có thể sắc nhưng sprite vẫn thiếu đặc điểm của mẫu. Trong mẫu, tiến hóa tăng rõ silhouette, phụ kiện, số lớp cánh/đuôi và các điểm nhấn. Không nên chỉ tăng kích thước hoặc số màu.

## Hướng sửa

1. Chốt mèo Lv.1–3 và Thiên Thần Lv.1/3/6 làm bộ thử, duyệt ở kích thước thực trước khi áp dụng cho tất cả.
2. Pet: ưu tiên mắt/mõm, tai, chân, silhouette đuôi. Mỗi vật liệu dùng một nhóm màu gọn và cụm bóng liền. Phụ kiện cấp cao cần thiết kế lại đủ lớn để đọc được, không thu nhỏ toàn bộ bảng tham chiếu rồi giữ mọi chấm màu.
3. Cánh: giữ các nhóm lông lớn, đường tách lông rõ và highlight liền. Tách phần thân trang trí khỏi gốc cánh; quyết định phần nào phải hiện trong game thay vì để nó bị đầu/lưng che.
4. Tách sao, lửa, quầng sáng thành effect; đừng dùng điểm glow để quyết định bounding box hay kích thước thân.
5. Mọi frame dùng cùng anchor và silhouette ổn định. Duyệt cả frame mở, hất lên, cụp xuống; không chỉ frame đầu. Tách thân và cánh trước khi animate, tránh xoay cả phần thân trang trí.
6. Kiểm tra trên nền cỏ với nhân vật mặc đủ đồ, hai hướng, đứng và chạy. Luôn nhìn sprite native trước khi quyết định tăng độ phân giải; thay đổi kích thước runtime cần đánh giá tỉ lệ với nhân vật và khoảng cách đi theo.

## Giới hạn

Art guide nhắc các script `tools/pets`, `tools/pets2` và `tools/wings`, nhưng các script đó chưa có trong repo hiện tại. Do đó các nhận định về quá trình tách/thu ảnh dựa trên tài liệu và kết quả sprite; chưa kiểm chứng trực tiếp thuật toán cũ. Cần đưa nguồn raster và script export vào repo để sửa được và tái tạo được như tóc.

## Cập nhật mèo trắng Lv.1–3

Bản v2 đã bị từ chối sau đối chiếu trực tiếp: đầu hẹp, thân cao, mắt nhỏ và bóng lông quá phẳng. Đã khôi phục chính xác 3 dáng đứng và 6 frame bước chân cũ. Kích thước, anchor, hiệu ứng và các loài khác giữ nguyên.

Đã xóa nguồn raster, exporter và ảnh review của bản thử bị loại. Khi sửa tiếp, lấy sprite cũ làm nền, giữ silhouette tròn mập và khuôn mặt; chỉ sửa vùng nét bị bết sau khi duyệt ở kích thước game.
