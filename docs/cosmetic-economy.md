# Cửa hàng ngoại hình và Premium

## Nguồn thu dùng để cân giá

Giá dưới đây dựa trên cấu hình trong `farm-catalog.ts`, `farm-animal-catalog.ts`, `farm-balance.ts` và `farm-recipes.ts`, không dựa trên tốc độ thời gian tăng trong Lab/dev.

| Cây | Thời gian | Thu bán mỗi ô | Giá hạt | Lãi/ô/vụ | Lãi/ô/giờ |
| --- | --- | --- | --- | --- | --- |
| Dâu | 2 giờ | 60 xu | 10 xu | 50 xu | 25 xu |
| Hoa hồng | 2 giờ | 90 xu | 10 xu | 80 xu | 40 xu |
| Ớt | 1 giờ | 45 xu | 10 xu | 35 xu | 35 xu |
| Lúa | 48 giờ | 720 xu | 10 xu | 710 xu | ~14,79 xu |

Sáu ô khởi đầu tạo khoảng 150–240 xu/giờ nếu thu và trồng lại đúng lúc. Sáu mươi ô tạo khoảng 1.500–2.400 xu/giờ theo cùng giả định. Đây là giới hạn lý thuyết của riêng trồng trọt, không phải thu nhập được bảo đảm: bỏ lỡ thu hoạch làm giảm tốc độ. Chăn nuôi và chế biến tạo thêm thu nhập nhưng cần vốn, thức ăn và nguyên liệu: ví dụ 20 trứng bán được 200 xu mỗi chu kỳ 6 giờ; bánh trứng bán 5.880 xu nhưng tiêu thụ 720 lúa và 12 trứng, giá nguyên liệu bán thô 840 xu, phần chênh 5.040 xu trước các chi phí chăm sóc. Không coi giá bán món ăn là lãi ròng miễn phí.

Tài khoản mới có 30.000 xu; đăng ký được cộng 50.000 xu theo chính sách hiện tại. Ngoại hình mặc định vẫn được cấp ban đầu. Giá shop mới không sửa ví hoặc quyền sở hữu đã lưu, và không đổi giá nông sản trong đợt này.

## Giá mới (xu)

| Nhóm thường | Giá |
| --- | --- |
| Kiểu tóc | 35.000 |
| Dáng mặt | 25.000 |
| Kiểu mắt | 18.000 |
| Kiểu miệng | 10.000 |
| Kiểu mũi | 8.000 |
| Hình dán mặt | 12.000 |
| Màu của từng vật phẩm | 12.000 |
| Màu da | 30.000 |
| Trang bị khác | 40.000 |
| Thú cưng | 80.000 |

Một kiểu tóc thường tương đương khoảng 146–233 giờ trồng trọt liên tục với 6 ô, hoặc 15–23 giờ với 60 ô; các nguồn thu khác rút ngắn thời gian này. Mốc này tạo giá trị sử dụng lâu dài cho ngoại hình thay vì thay đổi sau một lượt thu hoạch. Đây là bộ giá khởi đầu để theo dõi thực tế và điều chỉnh qua config, chưa phải kết luận cân bằng dựa trên telemetry người chơi.

| Goku / Premium | Giá |
| --- | --- |
| Tóc Goku cấp đầu | 200.000 |
| Áo Goku | 180.000 |
| Quần Goku | 140.000 |
| Giày Goku | 100.000 |
| Vòng tay Goku | 60.000 |
| Màu Premium | 35.000 |

Premium dùng xu theo yêu cầu, không tiêu Lượng. Toàn bộ 5 món Goku có giá tổng 680.000 xu, bán từng món, không tự giảm giá theo bộ. Các nhóm Premium được liệt kê rõ trong `PREMIUM_COSMETIC_GROUPS`; không chuyển tất cả đồ có cấp sang Premium.

## Quy tắc mua và nâng cấp

- `COSMETIC_SHOP_PRICES`, `COSMETIC_SLOT_PRICES` và `PREMIUM_SLOT_PRICES` trong game-content là nguồn giá duy nhất. Server tự tính giá từ offer ID; client không được quyết định số xu hoặc tiền tệ.
- Cửa hàng đồ cầm tay bán riêng slot `held` qua shop `accessories`. Tám món bổ sung từ atlas dùng giá đồ thường 40.000 xu/món; không có cấp nâng cấp mới hoặc quyền mua nội thất.
- Shop thú cưng tại khu mua sắm bán pet cấp đầu với giá 80.000 xu/con. Các loài mới dùng cùng quy tắc sở hữu và nâng cấp; đồ nội thất của shop được tách asset để tái sử dụng, chưa có giao dịch nội thất.
- Mỹ viện chỉ bán `appearance` thường; Goku ở Premium. API lọc theo shop và giới tính phù hợp khi truy vấn cửa hàng cụ thể. Danh mục tổng trong Lab vẫn dùng cho phát triển.
- Mỗi dòng có cấp chỉ bán cấp thấp nhất tồn tại trong catalog. Cấp cao và màu của cấp cao không hiện trong cửa hàng, kể cả khi gọi danh sách chi tiết nhóm; gọi thẳng lệnh mua cũng bị từ chối. Bỏ công thức giá nhân cấp bình phương. Nâng cấp mở cấp kế tiếp qua tab Thợ kim hoàn → Nâng cấp vật phẩm → Bằng xu/Bằng lượng theo từng dòng, bắt buộc nguyên liệu và áp dụng tỉ lệ/bảo hiểm; xem [quy tắc nâng cấp](cosmetic-upgrades.md).
- Đồ cấp cao đang sở hữu tiếp tục dùng bình thường. Migration, quest/event hoặc nâng cấp đã xác thực có thể cấp đồ; quy tắc cửa hàng không thu hồi đồ.
- Mua kiểu gốc kèm bảng màu chuẩn của chính món đó. Goku dùng preset riêng: tóc đen, áo/quần cam, giày/vòng tay xanh. Thumbnail, thử đồ và grant mua dùng cùng nguồn màu; món đã mua bằng shop mà thiếu màu gốc chuẩn được bổ sung quyền màu miễn phí, giữ nguyên màu khác và outfit đang mặc. Quyền màu gắn với chính vật phẩm, mở một lần và dùng lại miễn phí. Thử đồ không ghi vào DB; thao tác sử dụng phải qua kiểm tra sở hữu thật.
- Giao dịch giữ nguyên cơ chế chống trùng, ví bị giữ cược và rollback SQL. Grant mới ghi shop, offer ID, tiền tệ và số tiền thực trả để giá lịch sử không thay đổi khi sửa config. Grant cũ vẫn đọc được.
- Chưa có cơ chế bán lại mỹ phẩm/ngoại hình. Không suy ra giá bán lại từ bảng giá mua mới hoặc cho phép đổi ngược nâng cấp; nếu triển khai sau phải dựa trên lịch sử thanh toán và quy tắc riêng để tránh mua/bán sinh lời vô hạn.
