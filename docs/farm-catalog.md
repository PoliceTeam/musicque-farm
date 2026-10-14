# Quy tắc farm hiện hành — 11/10/2026

Cấu hình theo bảng người dùng cung cấp. Giá cây trồng là giá cân bằng đề xuất, dữ liệu Avatar chưa được kiểm chứng độc lập. Tài liệu này thay các thông số demo trong kế hoạch cũ.

## Trồng trọt

Một ô dùng một hạt. Đất khô → xới → gieo → tưới → tăng trưởng → thu hoạch. Bộ đếm bắt đầu khi tưới; dùng giờ thực, không theo chu kỳ ngày/đêm của cảnh. Thu hoạch cất toàn bộ sản lượng vào kho, trả ô về đất đã xới. Không tự bán. Dùng hạt trong kho trước; nếu hết, gieo tự mua đúng một hạt với giá đang hiển thị. Có thể mua 1/10 hạt và chọn giống khi gieo hàng loạt. Gieo hàng loạt dừng khi hết tiền/hạt, báo số ô đã xử lý.

| ID cây | Giá giống | Tiền | Giờ | Sản lượng/ô | Xu/SP |
| --- | ---: | --- | ---: | ---: | ---: |
| tomato | 10 | coins | 4 | 75 | 1 |
| carrot | 10 | coins | 6 | 108 | 1 |
| pineapple | 10 | coins | 10 | 165 | 1 |
| watermelon | 10 | coins | 8 | 138 | 1 |
| grape | 10 | coins | 16 | 240 | 1 |
| rose | 10 | coins | 2 | 45 | 2 |
| rice | 10 | coins | 48 | 720 | 1 |
| mango | 10 | coins | 24 | 360 | 1 |
| dragonFruit | 10 | coins | 12 | 189 | 1 |
| sunflower | 10 | coins | 12 | 189 | 2 |
| tulip | 10 | coins | 6 | 108 | 2 |
| corn | 10 | coins | 24 | 360 | 1 |
| aloe | 1 | gems | 2 | 1345 | Chưa chốt |
| cosmos | 10 | coins | 3 | 62 | 2 |
| lotus | 10 | coins | 8 | 140 | 2 |
| pumpkin | 10 | coins | 2 | 80 | 1 |
| potato | 10 | coins | 6 | 120 | 1 |
| chili | 10 | coins | 1 | 45 | 1 |

Dâu của save demo cũ giữ chu kỳ 60 giây, sản lượng 1 và bán 35 xu để không đổi cây đang trồng. Không đưa dâu demo vào danh sách giống mới. Nha đam dùng Gem, vẫn trồng/thu vào kho nhưng chưa cho bán.

## Chăn nuôi

| ID | Giá mua | Tiền | Trưởng thành (giờ chăm sóc) | Bán con trưởng thành (xu) | SP | Số lượng/chu kỳ | Giờ/chu kỳ |
| --- | ---: | --- | ---: | ---: | --- | ---: | ---: |
| hen | 500 | coins | 24 | 950 | egg | 20 | 6 |
| duck | 600 | coins | 48 | 1200 | duckEgg | 20 | 6 |
| pig | 1000 | coins | 48 | 2000 | Không có | 0 | 0 |
| cow | 5 | gems | 72 | 2000 | milk | 30 | 6 |
| sheep | 2 | gems | 48 | 1500 | wool | 20 | 12 |
| fish | 5000 | coins | 72 | 10000 | Không có | 0 | 0 |
| buffalo | 1000 | coins | 72 | 3000 | Không có | 0 | 0 |
| turtle | 2000 | coins | 24 | 5000 | Không có | 0 | 0 |
| dog | 1 | gems | Chưa rõ | Chưa rõ | Không có | 0 | 0 |

- Gà/vịt thả vườn; bò/heo/cừu/trâu ở chuồng chung; cá/rùa ở ao. Chó chưa được mở mua do chưa rõ thời gian trưởng thành và vai trò.
- Chỉ thời gian có thức ăn mới tính tăng trưởng và sản xuất. Quy tắc thử nghiệm hiện tại: một lần cho ăn phủ 12 giờ, 50 xu/chuồng, 25 xu/khu gia cầm hoặc ao; cho ăn lại khi còn tối đa 25%. Cho ăn tất cả là giao dịch nguyên tử, thiếu tiền không cho ăn một phần.
- Gà/vịt/bò/cừu giữ lại sau khi thu sản phẩm. Mỗi con tối đa một chu kỳ chờ nhận, không cộng dồn vô hạn khi offline. Trứng gà và trứng vịt là hai item riêng; công thức ghi “gà” dùng trứng gà, “bò” dùng sữa bò.
- Bán con trưởng thành là hành động riêng, cần xác nhận. Chuyển bò/heo/cá trưởng thành thành nguyên liệu cho 1 đơn vị thịt riêng trong kho, không cộng tiền. Thu hàng loạt heo/cá cũng chuyển thành thịt; trâu/rùa chuyển thành item trưởng thành. Đây là quy tắc chuyển đổi thử nghiệm. Giá thịt hiện tạm dùng giá bán con tương ứng (heo 2.000, bò 2.000, cá 10.000 xu), chưa có giá thịt được người dùng chốt.
- Sức chứa theo bảng nâng cấp mới: chuồng bắt đầu 10, tối đa 20; ao bắt đầu 2, tối đa 10. Gia cầm giữ 6 → 24 vì chưa có bảng giá mới cho khu thả vườn. Mỗi lần mua thêm một chỗ, không tự mua con vật. Chuồng mở hình học ở 15/20, ao ở 5/8; hết sức chứa thì ẩn bảng mua. Save cũ có chuồng 6 được tăng lên 10 miễn phí; chỗ đã mua vượt MAX mới (chuồng 24, ao 20) được giữ để không mất tiến độ.
- Vật nuôi có ID ổn định. Giao dịch bán/chuyển thành thịt dùng ID, tránh thao tác cũ tác động lên con khác khi danh sách thay đổi.

## Nhà bếp

Một lượt nấu (cấu hình khởi đầu), trừ nguyên liệu nguyên tử lúc bắt đầu, kiểm tra đủ toàn bộ nguyên liệu. Hết giờ phải nhận món vào kho; bán riêng. Mỗi công thức tạo một món. Thời gian bắt đầu/kết thúc lưu local, đóng trang không hủy lượt nấu. Thực tế bảng có **22 công thức**.

| ID món | Nguyên liệu | Phút | Xu/món |
| --- | --- | ---: | ---: |
| eggCake | 12 egg + 720 rice | 60 | 5880 |
| milkCake | 20 milk + 720 rice | 60 | 6160 |
| riceMeal | 1440 rice | 30 | 6211 |
| eggRice | 1440 rice + 12 egg | 60 | 8040 |
| carrotRice | 1440 rice + 108 carrot | 60 | 8244 |
| mangoSalad | 1440 mango | 60 | 7920 |
| fries | 500 potato + 100 egg | 60 | 20000 |
| butterCorn | 1500 corn + 300 egg | 60 | 19000 |
| pancake | 2000 rice + 100 egg + 5 pork | 240 | 30000 |
| pizza | 5000 rice + 5 pork + 1 beef + 1 fish + 200 egg | 1440 | 72000 |
| fruitJuice | 338 pineapple + 480 grape | 60 | 6030 |
| starfruitYogurt | 72 milk + 96 starfruit | 60 | 12096 |
| fruitMilkTea | 1 fruitPlate + 50 milk | 60 | 17000 |
| sweetSoup | 500 lychee + 50 milk + 1 cream | 120 | 25000 |
| peachTea | 1000 peach | 120 | 7000 |
| friedIceCream | 1 cream | 30 | 12500 |
| watermelonJuice | 1000 watermelon | 120 | 10000 |
| beefBalls | 2 beef | 30 | 20000 |
| fishBalls | 2 fish | 30 | 10000 |
| cheese | 100 milk + 400 egg | 240 | 32000 |
| ketchup | 1000 tomato | 360 | 20000 |
| chiliSauce | 500 chili | 30 | 3000 |

Khế, vải, đào, kem tươi, đĩa trái cây chưa có nguồn sản xuất/mua nên các món thiếu chúng báo chưa có nguồn cung. Nếu SDK cung cấp đủ item tương ứng thì công thức hoạt động mà không cần đổi UI. Không tự bịa công thức nguyên liệu trung gian.

## Ranh giới và lưu trữ

- game-content: catalogue, giá, thời gian, sản lượng, công thức; locale chứa nhãn dịch.
- gameplay: luật thuần TypeScript, không DOM/storage/Phaser.
- contracts/api-sdk: kiểm tra command, giao dịch, retry/idempotency, migration save. Kho, giống, xu và Gem chung người chơi; đất, vật nuôi, lượt bếp riêng từng instance map.
- React: chọn giống, kho, bếp, chăm sóc/bán. Render chỉ biểu diễn state; không tự trừ tiền hay thêm item.
- Save version 1 được mở rộng theo trường tùy chọn khi đọc: thiếu gems/seeds/kitchen thì mặc định 0/{}/[], thiếu cấp rương thì mặc định 1/1 và homeInventory rỗng; giữ tiền, cây và kho cũ. Không xóa save để cập nhật.
- Art mới chưa hoàn thiện: nhiều cây dùng mầm chung khi lớn và icon khi chín; trâu/rùa dùng icon tạm. Bộ sprite riêng theo từng giai đoạn là phần mỹ thuật tiếp theo, không coi icon là sprite đã duyệt.
- Phân bón, sâu bệnh và backend online chưa thuộc phần triển khai này. Giá/chu kỳ còn cần playtest kinh tế trước khi phát hành.

## Giá mở rộng — cập nhật theo bảng người dùng

Các giá là giá riêng cho lần mua tiếp theo, không phải tổng tích lũy. UI và SDK cùng đọc catalogue `farm-upgrade-catalog.ts`.

- Đất: bắt đầu 6; giá ô thứ n là **300 × (n−1)²**. Phần +3.300 trong công thức người dùng không khớp các dòng giá nên không áp dụng. Giữ map 60 ô, nối công thức cho ô 49–60; ô 60 là 1.044.300 xu.
- Chuồng: giá sức chứa n là **20.000 × (n−10)²**, n từ 11 đến 20. Tổng **7.700.000 xu**; con số 8.700.000 trong phần mô tả không khớp tổng các dòng giá.
- Ao: giá sức chứa n là **50.000 × (n−2)²**, n từ 3 đến 10. Tổng **10.200.000 xu**.
- Gia cầm giữ biểu giá hiện tại: chỗ tiếp theo n giá 200 + (n−7) × 75 xu, n 7–24.

| Cấp kho | Giá nâng cấp | Sức chứa |
| --- | --- | --- |
| 1 | Khởi đầu | 12 loại |
| 2 | 50.000 xu | 18 loại |
| 3 | 100.000 xu | 24 loại |
| 4 | 50 Gem | 30 loại |
| 5 | 100 Gem | 36 loại |
| 6 | 150 Gem | 48 loại |

Farm có một Nhà kho duy nhất, với tab Kho hàng và Kho giống. Không chọn rương chính/rương trong nhà, không chuyển đồ giữa rương. Kho dùng chung giữa các map; thu hoạch, nhận món và nguyên liệu bếp cùng sử dụng kho này. Cấp 6 ẩn nút nâng cấp. Kho giống không tính vào số loại sản phẩm.

Save đã dùng hai rương được gộp đồ vào kho, cộng dồn cùng loại và giữ cấp cao hơn đã mua. Không xóa đồ vượt sức chứa: vẫn nhận thêm cùng loại, còn loại mới phải chờ bán đồ hoặc nâng cấp. Thu theo khu vật nuôi là nguyên tử; chăm sóc hàng loạt có thể nhận các ô/khu có chỗ rồi báo số đã xử lý.

Thanh tiến độ trên map theo thời gian thực: cây dùng thời gian tưới; con non dùng thời gian được cho ăn; con lớn chuyển sang chu kỳ sản phẩm. Đến giờ thu thanh đầy, màu vàng và nhãn Thu. Hết thức ăn hiển thị dấu tạm dừng; mở modal chỉ chặn điều khiển nhân vật, vẫn cập nhật/vẽ thế giới.

## Chăm sóc nhanh và rổ trứng

Menu chăm sóc nhanh có bốn thao tác: cho cả trại ăn, tưới các ô đã gieo, thu cây chín, thu sản phẩm vật nuôi đủ điều kiện. Nút hiển thị số đối tượng và chi phí cho ăn; bị khóa khi không có đối tượng phù hợp hoặc thiếu xu. Xới/gieo không nằm trong menu này.

Thu vật nuôi dùng cùng logic thu theo khu: lợn/cá trưởng thành vào kho dưới dạng thịt heo/thịt cá, rời trại và giải phóng chỗ nuôi; gà/vịt/bò/cừu vẫn ở lại sau khi thu trứng/sữa/len. Không tự bán sản phẩm.

Gà và vịt có rổ riêng cạnh nhà kho. Rổ của một loài chỉ hiện khi đang nuôi loài đó; chưa có sản phẩm thì dùng sprite rổ rỗng. Số trứng là sản phẩm đang chờ trên đàn, không phải trứng trong kho; thu xong rổ trở về rỗng. Bấm rổ mở bảng chăm sóc gia cầm.

### Bảng chăm sóc và mua vật nuôi

Bảng Gia súc, Gà/Vịt và Ao cá chỉ có cho ăn và thu hoạch vào kho. Tiến độ từng con hiển thị trên map. Mua con non và mở thêm sức chứa nằm trong bảng riêng “Mua vật nuôi & mở rộng”, mở từ menu avatar hoặc biển Mua của chuồng/ao. Khi đạt sức chứa tối đa, biển nâng cấp ẩn; menu vẫn cho mua bù vào chỗ trống sau thu hoạch.

Cá dùng ảnh nhìn ngang, lật trái/phải với độ nghiêng nhỏ và đuôi quẫy riêng. Đường bơi cong liên tục có giới hạn bên trong bờ ao; hiệu ứng mặt nước độc lập với cá.

### Gieo hạt nhanh và menu gọn

Chăm sóc nhanh có chọn cây và gieo trên các ô đất khô/đã xới thuộc quyền sở hữu. Mỗi ô gieo thành công được xới và tưới trong cùng lệnh; dùng giống dự trữ trước rồi trả giá giống bằng xu/Gem. Không đổi cây đang trồng và không xới các ô thiếu số dư. Kho giống chỉ hiển thị giống dự trữ, không có mua giống riêng.

Menu avatar giữ điều hướng nhân vật/bản đồ, mua vật nuôi & mở rộng, chăm sóc nhanh và âm thanh. Các nhà mở trực tiếp trên map; bảng chăm sóc không liệt kê từng con. Trạng thái trống của kho, vật nuôi và bếp dùng EmptyState chung trong packages/ui.
