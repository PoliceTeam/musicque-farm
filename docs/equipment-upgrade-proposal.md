# Đề xuất quy trình nâng cấp bằng nguyên liệu

Ngày đối chiếu: 20/10/2026. Trạng thái: đã triển khai công thức, tỉ lệ và bảo hiểm theo yêu cầu ngày 20/10/2026; phần mở rộng hình/nguồn rơi vẫn là kế hoạch. Hành vi đang chạy được mô tả ở [cosmetic-upgrades.md](cosmetic-upgrades.md).

## 1. Yêu cầu và quyết định đề xuất

Yêu cầu của người dùng: đá/ngọc là nguyên liệu bắt buộc và bị tiêu khi nâng cấp; ngoài nguyên liệu vẫn cần xu hoặc lượng. Chỉ nâng tại Thợ kim hoàn. Modal có tab, danh sách món bên trái, không có nút quay lại.

Đề xuất cho phiên bản đầu:

- Công thức: **sở hữu cấp hiện tại + đủ nguyên liệu chính xác + trả một loại phí → thử nâng cấp kế tiếp**.
- Tỉ lệ và mốc bảo hiểm đã được người dùng chốt ở mục 1.1. Mỗi lượt hợp lệ đều tiêu nguyên liệu và phí, kể cả thất bại hoặc lượt được bảo hiểm; thất bại giữ đồ, cấp và màu hiện tại. Không thêm đá tăng tỉ lệ tùy chọn.
- Chỉ tăng ngoại hình theo hình đã có. Không tự thêm chỉ số sức mạnh, lợi tức farm hoặc tốc độ nhân vật.
- Xu là đường mặc định cho cả 28 dòng đang có nhiều cấp. Đề xuất cho phép dùng lượng thay **phần phí** ở 27 dòng; vẫn bắt buộc cùng lượng đá/ngọc. Tóc Goku giữ xu theo quy tắc Premium đã chốt trước đây. Không thu đồng thời cả phí xu và phí lượng.
- Hai tab Bằng xu / Bằng lượng là hai cách trả phí để mở cùng một cấp, không phải hai chuỗi cấp khác nhau. Mở ở tab nào cũng đánh dấu đã sở hữu ở tab còn lại.
- Giữ cấp cũ và các màu đã mở, phù hợp cơ chế hiện tại; UI gọi là “Mở cấp” và nói rõ giữ ngoại hình cũ. Không tiêu hủy món gốc hay tự gộp các cấp thành một instance trong đợt này.

### 1.1. Tỉ lệ và bảo hiểm đã chốt

| Bước | Trả xu | Trả lượng | Mốc bảo đảm thành công |
| --- | ---: | ---: | --- |
| 1 → 2 | 85% | 95% | Không giới hạn lượt, không bảo hiểm |
| 2 → 3 | 75% | 85% | Chậm nhất lượt thứ 5 |
| 3 → 4 | 55% | 65% | Chậm nhất lượt thứ 10 |
| 4 → 5 | 35% | 45% | Chậm nhất lượt thứ 15 |
| 5 → 6 | 25% | 35% | Không giới hạn lượt, không bảo hiểm |

Lượng cộng **10 điểm phần trăm** vào tỉ lệ cơ bản của từng bước, không nhân tỉ lệ với 1,1. Các mốc tối đa tính cả lượt thành công: nếu 4 lần 2 → 3 trước đó đều trượt, lần thứ 5 chắc chắn thành công. Mốc bảo hiểm giống nhau cho xu và lượng, chỉ áp dụng ở bước có mốc; trước mốc dùng đúng tỉ lệ trong bảng, không tự tăng dần sau mỗi lần trượt. Bước 1 → 2 và 5 → 6 đều không bảo hiểm theo yêu cầu đã chốt: có thể trượt bao nhiêu lần cũng không tự được bảo đảm.

Quy tắc lưu tiến độ đã triển khai: số lần trượt lưu theo người chơi + dòng đồ + cấp đích, dùng chung giữa hai loại phí; đổi tab, đổi màu, đổi instance trong cùng dòng, đổi NPC/khu hoặc đăng nhập lại không reset. Thành công kết thúc tiến độ của cấp đó, cấp kế tiếp bắt đầu từ 0. Lệnh không đủ tiền/đá hoặc bị từ chối không tính là lượt thử. Gửi lại cùng requestId không tính lượt mới, không bốc lại kết quả. Giới hạn cấp/hình và loại phí được phép của từng dòng vẫn áp dụng.

## 2. Tham khảo Avatar: Thành phố diệu kỳ

Phân biệt nguồn và phạm vi:

| Nguồn | Điều đối chiếu được | Giới hạn |
| --- | --- | --- |
| [Hướng dẫn Avatar 2D của HiếuMobile, 24/04/2018](https://hieumobile.com/game/tin-tuc-game/huong-dan-nang-cap-cuong-hoa-dap-avatar-2d) | Mua nguyên liệu tại Thợ Kim Hoàn; danh sách nâng bằng xu/lượng; nguyên liệu cộng phí; chỉ đồ được hỗ trợ mới nâng; có khả năng thất bại | Nguồn cộng đồng lịch sử, không phải bảng giá/tỉ lệ chính thức năm 2026. Không lấy các con số cũ áp dụng cho game mình |
| [TeaMobi: Ra mắt chức năng Hoá phép, Admin Mr. Brown, 25/04/2017](https://my.teamobi.com/threads/197743134/Ra-mat-chuc-nang-Hoa-phep-0.html) | Một cơ chế biến đổi khác của Avatar dùng NPC, tiêu các item đầu vào, thành công 100%, đầu ra vĩnh viễn | Hoá phép tại Tiên Cá, **khác** nâng cấp tại Thợ Kim Hoàn. Không suy ra mọi nâng cấp Avatar đều 100% |
| [TeaMobi: Truyền thuyết về mảnh vỡ huyền thoại, Admin Mr. Green, 19/09/2015](https://my.teamobi.com/threads/176749798/Truyen-thuyet-ve-manh-vo-huyen-thoai-0.html) | Thu thập đủ bộ nguyên liệu từ hoạt động/sự kiện để ghép và đổi vật phẩm đặc biệt | Chỉ tham khảo vòng lặp thu thập → ghép → mở đồ; không sao chép nguồn rơi/tỉ lệ |

Kết luận thiết kế: học cách tập trung dịch vụ tại NPC và công khai công thức có nguyên liệu bắt buộc. Bảng tỉ lệ/bảo hiểm mục 1.1 do người dùng chốt cho game mình; mức phí, tên đá, giữ cấp cũ và phân nhóm bên dưới là thiết kế riêng. Chưa xác minh được bảng tỉ lệ nâng cấp Avatar hiện hành từ nguồn chính thức; không gán các tỉ lệ trong tài liệu này cho Avatar.

## 3. Nguyên liệu và ghép đá

Giữ nguyên giá và công thức người dùng đã cung cấp, đang nằm trong `packages/game-content/src/jeweler.ts`. Mỗi công thức ghép tạo 1 viên, thành công 100%, không thêm phí; nguyên liệu ghép bị tiêu. Không tự động ghép, mua hoặc bán nguyên liệu khi nhấn nâng cấp.

| ID | Nguyên liệu | Mua (xu) | Bán hệ thống (xu) | Ghép từ |
| --- | --- | ---: | ---: | --- |
| blue | Đá lam | 5.000 | 3.000 | — |
| green | Đá lục | 15.000 | 13.000 | 3 Đá lam |
| purple | Đá tím | 45.000 | 40.000 | 3 Đá lục |
| pink | Đá hồng | 90.000 | 85.000 | 2 Đá tím |
| gold | Đá kim | 180.000 | 170.000 | 2 Đá hồng |
| mystic | Ngọc huyền linh | 15.000 | 13.000 | — |
| stellar | Ngọc tinh tú | 45.000 | 40.000 | 3 Ngọc huyền linh |
| celestial | Ngọc thiên linh | 90.000 | 85.000 | 3 Ngọc tinh tú |

Đá lam → kim tạo tiến trình cơ bản. Ngọc là nguyên liệu bổ sung bắt buộc cho cánh, pet và tóc Goku, không phải ô chọn để tăng tỉ lệ. Đá cấp cao không thay được đá thấp nếu công thức không nói rõ; không quy đổi ngược.

**Điểm lệch giá cần giữ rõ:** 3 Ngọc tinh tú có giá mua 135.000 xu, nhưng 1 Ngọc thiên linh mua thẳng 90.000 xu. Với hàng mua không giới hạn, ghép này bất lợi 45.000 xu. Bản định nghĩa chưa tự sửa yêu cầu 3 viên hay giá 90k. Màn ghép cần hiển thị số lượng tiêu trước khi xác nhận; không quảng bá ghép là tiết kiệm. Nếu muốn cân lại sau: hoặc đổi thành 2 tinh tú, hoặc nâng giá thiên linh lên 135k; cả hai đều là thay đổi kinh tế riêng. Cũng cần tính lại giá bán sau mọi thay đổi để tránh vòng mua–ghép–bán sinh xu.

## 4. Công thức theo cấp

Các bảng sau là **đề xuất v1**. Nguyên liệu và phí tính cho **một lượt thử**, thành công hay thất bại đều tiêu đủ; không tính phí mua món cấp 1. Tỉ lệ dùng bảng mục 1.1. Chưa tự giảm giá sau khi đổi từ thiết kế 100% sang có thất bại. Không có công thức khi chưa tồn tại hình cấp đích.

### N — Mũ thường và mũ đặc biệt

Áp dụng cho Mũ lưỡi trai, Mũ len, Mũ pháp sư, Vương miện, Halo. Khác nhau ở cấp tối đa, không thêm hệ số giá ngầm theo tên.

| Bước | Nguyên liệu bắt buộc | Phí xu | Hoặc phí lượng |
| --- | --- | ---: | ---: |
| 1 → 2 | 1 Đá lam | 25.000 | 10 |
| 2 → 3 | 1 Đá lục | 60.000 | 24 |
| 3 → 4 | 1 Đá tím | 120.000 | 48 |
| 4 → 5 | 1 Đá hồng | 220.000 | 88 |
| 5 → 6 | 1 Đá kim | 360.000 | 144 |

Dòng 5 → 6 chỉ là quy ước để mở rộng nhóm N; **chưa có mũ nào hiện tại được mở cấp 6**. Phí xu giữ bảng đang có, cộng nguyên liệu mới. Phí lượng là đề xuất riêng với hệ số phí 2.500 xu/1 lượng, không tạo dịch vụ đổi tiền hay định giá lượng toàn game.

### W — Sáu dòng cánh có nhiều cấp

| Bước | Nguyên liệu bắt buộc | Phí xu | Hoặc phí lượng |
| --- | --- | ---: | ---: |
| 1 → 2 | 1 Đá lam + 1 Ngọc huyền linh | 25.000 | 10 |
| 2 → 3 | 1 Đá lục + 1 Ngọc huyền linh | 60.000 | 24 |
| 3 → 4 | 1 Đá tím + 1 Ngọc tinh tú | 120.000 | 48 |
| 4 → 5 | 1 Đá hồng + 1 Ngọc tinh tú | 220.000 | 88 |
| 5 → 6 | 1 Đá kim + 1 Ngọc thiên linh | 360.000 | 144 |

### P — Thú cưng

| Bước | Nguyên liệu bắt buộc | Phí xu | Hoặc phí lượng |
| --- | --- | ---: | ---: |
| 1 → 2 | 1 Đá lam + 1 Ngọc huyền linh | 50.000 | 20 |
| 2 → 3 | 1 Đá lục + 2 Ngọc huyền linh | 120.000 | 48 |

Giữ hệ số phí pet ×2 hiện có; không nhân số nguyên liệu theo hệ số. Tạm dừng ở cấp 3 của catalog.

### G — Tóc Goku, chỉ trả phí xu

| Bước | Nguyên liệu bắt buộc | Phí xu |
| --- | --- | ---: |
| 1 → 2 | 1 Đá lam + 1 Ngọc huyền linh | 50.000 |
| 2 → 3 | 1 Đá lục + 2 Ngọc huyền linh | 120.000 |
| 3 → 4 | 1 Đá tím + 1 Ngọc tinh tú | 240.000 |

Giữ hệ số Premium ×2 hiện có. Áo, quần, giày và băng tay Goku chưa có cấp tiếp theo, không được nâng theo tóc và không nhận miễn phí khi nâng tóc.

## 5. Áp dụng vào toàn bộ catalog hiện tại

Snapshot kiểm kê: 113 dòng item/pet; 28 dòng có nhiều cấp (12 trang bị + 16 pet), 85 dòng chỉ có cấp 1. Màu vật phẩm/màu da là quyền dùng màu, không tính thành một món để nâng cấp. Phụ lục liệt kê đủ 113 dòng.

| Nhóm | Các dòng đồ | Cấp tối đa đang có | Công thức | Phí |
| --- | --- | ---: | --- | --- |
| Mũ cơ bản | Mũ lưỡi trai, Mũ len | 3 | N đến cấp 3 | Xu hoặc lượng |
| Mũ đặc biệt | Mũ pháp sư, Vương miện, Halo | 5 | N đến cấp 5 | Xu hoặc lượng |
| Cánh | Thiên Thần, Băng Giá, Lửa, Bóng Tối, Tinh Linh, Rồng | 6 | W | Xu hoặc lượng |
| Premium | Tóc Goku | 4 | G | Chỉ xu |
| Pet | Mèo trắng, Corgi, Thỏ, Gà con, Slime mầm, Rồng con, Cáo, Robot, Mèo vàng, Chó tai cụp, Hươu con, Gấu trúc, Heo hồng, Rùa xanh, Cá hề, Chim hồng | 3 | P | Xu hoặc lượng |
| Độc quyền quay số | Cánh Tiểu Tiên | 1 | Chưa có công thức | Chỉ nhận cấp 1 từ quay số |
| Các trang bị/ngoại hình còn lại | 84 dòng còn lại trong phụ lục | 1 | Chưa có công thức | Không nâng |

“Cánh Tinh Linh” và “Cánh Tiểu Tiên” là hai dòng khác nhau. Cánh Tiểu Tiên không được mở từ cánh thường, mua thẳng tại thợ hay ghép chỉ bằng đá. Đề xuất tương lai cho Tiểu Tiên: phải sở hữu cấp 1 từ quay số, bổ sung hình cấp 2–3 được duyệt rồi mới tạo công thức riêng; chưa công bố giá hay hứa cấp chưa có hình.

## 6. Chi phí nhìn từ người chơi

Giả định mua thẳng toàn bộ nguyên liệu đúng loại theo bảng giá hiện tại; không tính giá mua món cấp 1, các màu hay giá trị thời gian. Bảng dưới là **chi phí tối thiểu khi mọi bước đều thành công ngay lần đầu**, không phải chi phí trung bình hoặc giá bảo đảm hoàn thành. Mỗi lần trượt tốn thêm nguyên liệu và phí của bước đó. Dùng nguyên liệu kiếm được sẽ giảm xu phải trả tại chợ nhưng nguyên liệu đó vẫn bị tiêu.

| Dòng mẫu | Hành trình | Tổng giá nguyên liệu | Tổng phí xu | Tổng xu nếu mua mọi nguyên liệu | Nếu trả phí bằng lượng |
| --- | --- | ---: | ---: | ---: | --- |
| Mũ len | 1 → 3 | 20.000 | 85.000 | 105.000 | 20.000 xu + 34 lượng |
| Mũ pháp sư | 1 → 5 | 155.000 | 425.000 | 580.000 | 155.000 xu + 170 lượng |
| Cánh Thiên Thần | 1 → 6 | 545.000 | 785.000 | 1.330.000 | 545.000 xu + 314 lượng |
| Mèo trắng | 1 → 3 | 65.000 | 170.000 | 235.000 | 65.000 xu + 68 lượng |
| Tóc Goku | 1 → 4 | 155.000 | 410.000 | 565.000 | Không áp dụng |

Ví dụ mỗi lượt thử cánh cấp 5 → 6: tiêu 1 Đá kim + 1 Ngọc thiên linh + 360.000 xu **hoặc** hai viên đó + 144 lượng. Nếu mua cả hai viên trước, mỗi lượt theo đường xu là 630.000; đường lượng vẫn mất 270.000 xu mua đá và 144 lượng phí. Không phải chỉ 360k/144 lượng là đủ. Ở tỉ lệ 25%, luôn trả xu và mua nguyên liệu theo giá này thì riêng bước 5 → 6 có chi phí kỳ vọng 2.520.000 xu (4 lượt trung bình); không có mức chi phí tối đa được bảo đảm. Không được diễn giải 4 lượt trung bình là chắc chắn thành công ở lượt 4.

Đây là giá khởi điểm dựa trên phí hiện có, **chưa thể gọi là cân bằng đã kiểm chứng**. Theo [phân tích kinh tế hiện tại](cosmetic-economy.md), 60 ô trồng trọt tạo khoảng 1.500–2.400 xu/giờ trong điều kiện thu/trồng liên tục. Riêng chi phí tối thiểu 1,33 triệu xu tương đương khoảng 554–887 giờ trồng trọt ở quy mô đó, chưa tính các lượt trượt, vốn món gốc hoặc nguồn thu khác. Cần theo dõi xu ròng/ngày, thời gian đạt cấp 2, tỉ lệ người chơi tiếp tục nâng và xu bị tiêu trước khi điều chỉnh. Không dùng số dư dev vài triệu xu làm căn cứ cho người chơi mới.

Trong v1, mua bằng xu và ghép tại chợ là nguồn nguyên liệu chắc chắn. Nguồn nhiệm vụ/hoạt động có thể bổ sung sau để tạo vòng lặp kiếm nguyên liệu → ghép → nâng; chỉ hiển thị nguồn nào đã chạy thật, không ghi tỉ lệ rơi hay nhận thưởng chưa triển khai. Phần lượng đã có giao dịch thật theo bảng phí trong tài liệu, kiểm tra ví và nguyên liệu giống đường xu.

## 7. Luồng NPC và modal

1. Click NPC có tên vàng “Thợ kim hoàn” và dấu * đỏ cạnh tên → menu Chợ mua bán đá / Nâng cấp vật phẩm.
2. Chọn Nâng cấp vật phẩm → modal tab Bằng xu / Bằng lượng. Không có tab nâng cấp trong Nhân vật, không có nút quay lại.
3. Danh sách trái: mỗi dòng đồ đã sở hữu có nhiều cấp chỉ một hàng, ưu tiên cấp cao nhất đã sở hữu; hiện tên, cấp hiện tại, cấp tối đa, trạng thái thiếu nguyên liệu/tiền hoặc tối đa. Đồ tối đa vẫn có hàng, ở cuối và không có nút nâng. Tóc Goku chỉ nằm tab xu. Đồ một cấp không xuất hiện.
4. Vùng phải: xem trước ngoại hình hiện tại → cấp tiếp theo; các ô nguyên liệu có icon, tên và “đang có / cần”; phí, số dư khả dụng; tỉ lệ theo loại phí và tiến độ bảo hiểm. Ví dụ 2 → 3 trả xu: “Thành công 75% · Đã thử 2/5”; lượt được bảo hiểm hiện “Lượt này chắc chắn thành công”. Bước 5 → 6 ghi “Không có bảo hiểm”, không hiển thị thanh tiến độ tới một mốc giả. Nói rõ giữ ngoại hình và màu cũ.
5. Đủ điều kiện → nút “Mở cấp 3 · 60.000 xu”. Thiếu nguyên liệu/tiền → khóa nút, ghi rõ thiếu gì; không tự mua, tự ghép hay đổi sang lượng. Muốn mua đá thì đóng modal và mở Chợ từ NPC, giữ đúng yêu cầu không có nút quay lại.
6. Khi bấm, hiện xác nhận ngay trong modal, liệt kê cấp đích, từng nguyên liệu sẽ mất, phí, tỉ lệ và bảo hiểm; ghi rõ trượt vẫn mất phí/nguyên liệu. Đồng ý mới giao dịch. Khóa thao tác trong lúc chờ; hiệu ứng chỉ trình bày kết quả đã được server quyết định.
7. Thành công → cập nhật ví, số đá, cấp và ngoại hình cùng lúc. Nếu mặc món nguồn thì mặc cấp mới; món nguồn về túi/kho. Hiển thị nơi cất cấp cũ để tránh hiểu là bị nhân đôi.
8. Thất bại → cập nhật ví, số đá và tiến độ trượt; không cấp instance/màu mới, không đổi outfit hoặc vị trí đồ nguồn. Hiển thị kết quả và chi phí đã tiêu, cho thử tiếp bằng một requestId mới khi còn đủ điều kiện.

Hai cấp khác nhau của một món vẫn là hai ngoại hình đã mở hợp lệ. Ô màu không trở lại giỏ đồ; không sinh thêm instance cấp đích khi đổi tab, double-click hay retry. Nếu muốn sau này giỏ chỉ có một ô cho cả dòng và chọn cấp bên trong thì cần một thay đổi quản lý túi riêng, không trộn vào công thức nâng cấp.

## 8. Quy tắc dữ liệu và giao dịch khi triển khai

- Recipe khai báo tường minh theo dòng + cấp nguồn + cấp đích: ID ổn định, phiên bản, danh sách nguyên liệu, các lựa chọn phí hợp lệ. Không suy ra từ tên hiển thị hoặc chỉ từ slot. Các bảng N/W/P/G giúp viết config, không tự cấp quyền nâng mọi item mới.
- Server trả offer gồm target, nguyên liệu cần/có, phí được chọn, thiếu gì, phiên bản công thức, trạng thái sở hữu, tỉ lệ cơ bản/hiệu lực, số lần trượt, mốc bảo hiểm hoặc null. Client gửi instance nguồn, recipe/phiên bản, loại phí và requestId; không gửi giá, số đá tự chọn hay xác suất/kết quả.
- Game-service kiểm tra sở hữu, cấp kế tiếp có hình, chưa sở hữu đích, recipe hợp lệ, đủ từng loại đá, đủ tiền khả dụng sau tiền giữ cược. Client mở modal ở đâu không phải bằng chứng đã tới NPC; giao dịch API phải kiểm tra vị trí/map được server quản lý, với phạm vi tương tác dùng chung cho local và server.
- API kiểm tra vị trí từ phòng realtime còn lease tại phố mua sắm, trong phạm vi 200 world units tính từ chân NPC; không tin tọa độ do lệnh nâng tự gửi. Local offline không có vị trí server, chỉ giới hạn luồng UI qua NPC; quy tắc giao dịch và bảo hiểm vẫn dùng chung.
- Kiểm tra phiên bản: nếu giá/công thức đổi sau khi mở modal, từ chối giao dịch chưa thực hiện và yêu cầu tải offer mới; không tự trừ theo giá mới. Retry giao dịch đã hoàn thành phải trả receipt cũ trước bước xét phiên bản hiện tại.
- Trong một transaction có khóa theo người chơi: kiểm tra đủ điều kiện, đọc tiến độ bảo hiểm, quyết định kết quả bằng RNG tin cậy phía server hoặc bảo hiểm, trừ đúng đá và một ví. Thành công mới cấp đích/chuyển quyền màu/cập nhật outfit; thất bại chỉ tăng tiến độ trượt. Lưu receipt cho cả hai kết quả. Lỗi kỹ thuật rollback toàn bộ; kết quả trượt hợp lệ là giao dịch có tiêu phí, không phải lỗi API cần rollback.
- Receipt ghi recipeVersion, cấp nguồn/đích, số lượng từng nguyên liệu thực tiêu, loại phí/số tiền thực trả, tỉ lệ hiệu lực, có dùng bảo hiểm hay không, kết quả và tiến độ trước/sau. Replay requestId trả cùng kết quả; hai requestId đồng thời được xử lý nối tiếp, không mở cùng cấp hai lần. Nếu request đầu trượt, request thứ hai có thể là lượt mới có tiêu phí; UI khóa double-click để tránh vô tình gửi hai requestId.
- Không bốc lại kết quả của receipt đã lưu; client không quyết định RNG. Local dùng cùng quy tắc nghiệp vụ, nguồn ngẫu nhiên được tiêm vào để kiểm tra các nhánh thành công/trượt/bảo hiểm; API dùng nguồn ngẫu nhiên do server kiểm soát.
- Nguyên liệu lưu dạng số lượng xếp chồng trong jeweler, không chiếm ô mỹ phẩm. Màu và màu da không là nguyên liệu. Giữ các cấp cũ, màu cũ, tài sản túi/kho và giới hạn quyền dùng nguyên trạng.
- Người đã nâng bằng xu trước ngày áp dụng vẫn giữ đồ, không truy thu đá, không hạ cấp. Lần nâng tiếp mới dùng recipe mới. Receipt cũ chỉ có tiền vẫn đọc được, không bịa lịch sử nguyên liệu.
- Không bán ngược mỹ phẩm, tháo đá hay hoàn phí nâng trong v1. Bán đá chỉ bán số lượng nguyên liệu thực còn trong kho nguyên liệu.

## 9. Tiêu chí nghiệm thu

- Có tiền nhưng thiếu đúng một nguyên liệu: từ chối, mọi số dư/quyền sở hữu giữ nguyên.
- Có nhiều đá cao hơn nhưng thiếu đá được yêu cầu: từ chối, không tự thay thế.
- Giao dịch xu tiêu đúng đá + xu; giao dịch lượng tiêu đúng đá + lượng và không trừ thêm phí xu.
- Kiểm tra bảng xu 85/75/55/35/25 và lượng 95/85/65/45/35; thưởng lượng là cộng 10 điểm phần trăm. Đá không thay đổi tỉ lệ.
- Ép các lượt đầu trượt để kiểm tra 2 → 3 chắc chắn ở lượt 5, 3 → 4 ở lượt 10, 4 → 5 ở lượt 15; lượt bảo hiểm vẫn tiêu đủ phí và nguyên liệu.
- Bước 1 → 2 và 5 → 6 không tự thành công sau bất kỳ số lần trượt nào, không nhận mốc bảo hiểm của cấp khác. Đổi loại phí/đăng nhập lại vẫn giữ tiến độ đã lưu.
- Trượt không tạo instance/màu hoặc đổi outfit. Replay cùng request trả kết quả cũ, không tăng bộ đếm/tiêu tiền lần nữa; lệnh bị từ chối không tăng tiến độ.
- Tóc Goku không được dùng lượng; mọi món chỉ có một cấp và mọi cấp chưa có hình không có recipe hoạt động.
- Mở cấp một lần, đổi tab hoặc gọi lại cùng request không nhận trùng/tiêu trùng. Hai request đồng thời không mở hai bản cùng cấp.
- Giá thay đổi, request từ xa NPC, hết nguyên liệu do bán đồng thời, lỗi DB hoặc mất mạng đều có kết quả xác định; không mất tiền/đá một nửa.
- Các màu đã sở hữu, outfit đang mặc, cấp cũ và kho/túi đầy được giữ đúng quy tắc.
- Kiểm tra modal ngang/dọc, list trái cuộn độc lập và nút xác nhận không bị khuất. Không hiển thị ghép hay nguồn rơi chưa hoạt động.

## 10. Thứ tự triển khai sau khi chốt bản định nghĩa

1. Config recipe, tỉ lệ và mốc bảo hiểm; offer/result contract và tiến độ trượt lưu bền vững; giữ bản giá cũ cho receipt lịch sử.
2. Giao dịch nguyên tử game-service + API/local, kiểm tra vị trí NPC, nguyên liệu, hai loại phí và kết quả/bảo hiểm.
3. Modal nguyên liệu, xác nhận, tỉ lệ/tiến độ bảo hiểm, trạng thái thiếu/tối đa và hai tab trả phí.
4. Kiểm tra hồi quy giao dịch, concurrency, palette/túi/kho; review UI portrait/landscape.
5. Theo dõi nền kinh tế rồi mới thêm nguồn đá nhiệm vụ hoặc cấp hình mới cho Cánh Tiểu Tiên.

Chi tiết đối chiếu từng dòng đồ: [equipment-upgrade-catalog.md](equipment-upgrade-catalog.md).
