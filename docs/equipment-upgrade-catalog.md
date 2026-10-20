# Đối chiếu catalog nâng cấp

Snapshot ngày 20/10/2026, đối chiếu `COSMETIC_CATALOG` của `packages/character-core/src/cosmetic-catalog.ts` và cấp hình trong item catalog. Các dòng nhiều cấp đã có công thức runtime theo thiết kế; không tự mở thêm cấp hình.

Công thức và phí chi tiết: [equipment-upgrade-proposal.md](equipment-upgrade-proposal.md). Có 113 dòng item/pet: 28 dòng nâng được theo hình hiện có và 85 dòng chưa có cấp tiếp. Không tính màu/màu da thành món nâng cấp.

## 28 dòng có nhiều cấp

| Group ID | Tên | Cấp có hình | Mã công thức | Cách trả phí đề xuất |
| --- | --- | --- | --- | --- |
| `item/wings.angel` | Cánh Thiên Thần | 1, 2, 3, 4, 5, 6 | W | Xu hoặc lượng |
| `item/wings.ice` | Cánh Băng Giá | 1, 2, 3, 4, 5, 6 | W | Xu hoặc lượng |
| `item/wings.fire` | Cánh Lửa | 1, 2, 3, 4, 5, 6 | W | Xu hoặc lượng |
| `item/wings.shadow` | Cánh Bóng Tối | 1, 2, 3, 4, 5, 6 | W | Xu hoặc lượng |
| `item/wings.fairy` | Cánh Tinh Linh | 1, 2, 3, 4, 5, 6 | W | Xu hoặc lượng |
| `item/wings.dragon` | Cánh Rồng | 1, 2, 3, 4, 5, 6 | W | Xu hoặc lượng |
| `item/hat.cap` | Mũ lưỡi trai | 1, 2, 3 | N | Xu hoặc lượng |
| `item/hair.goku` | Tóc Goku | 1, 2, 3, 4 | G | Chỉ xu |
| `item/hat.beanie` | Mũ len | 1, 2, 3 | N | Xu hoặc lượng |
| `item/hat.wizard` | Mũ pháp sư | 1, 2, 3, 4, 5 | N | Xu hoặc lượng |
| `item/hat.crown` | Vương miện | 1, 2, 3, 4, 5 | N | Xu hoặc lượng |
| `item/hat.halo` | Halo | 1, 2, 3, 4, 5 | N | Xu hoặc lượng |
| `pet/cat` | Mèo trắng | 1, 2, 3 | P | Xu hoặc lượng |
| `pet/corgi` | Chó corgi | 1, 2, 3 | P | Xu hoặc lượng |
| `pet/bunny` | Thỏ | 1, 2, 3 | P | Xu hoặc lượng |
| `pet/chick` | Gà con | 1, 2, 3 | P | Xu hoặc lượng |
| `pet/slime` | Slime mầm | 1, 2, 3 | P | Xu hoặc lượng |
| `pet/dragon` | Rồng con | 1, 2, 3 | P | Xu hoặc lượng |
| `pet/fox` | Cáo | 1, 2, 3 | P | Xu hoặc lượng |
| `pet/robot` | Robot | 1, 2, 3 | P | Xu hoặc lượng |
| `pet/ginger-cat` | Mèo vàng | 1, 2, 3 | P | Xu hoặc lượng |
| `pet/puppy` | Chó tai cụp | 1, 2, 3 | P | Xu hoặc lượng |
| `pet/deer` | Hươu con | 1, 2, 3 | P | Xu hoặc lượng |
| `pet/panda` | Gấu trúc | 1, 2, 3 | P | Xu hoặc lượng |
| `pet/pig` | Heo hồng | 1, 2, 3 | P | Xu hoặc lượng |
| `pet/turtle` | Rùa xanh | 1, 2, 3 | P | Xu hoặc lượng |
| `pet/clownfish` | Cá hề | 1, 2, 3 | P | Xu hoặc lượng |
| `pet/songbird` | Chim hồng | 1, 2, 3 | P | Xu hoặc lượng |

## 85 dòng chỉ có cấp 1

Các dòng sau không xuất hiện trong danh sách nâng cấp. Cần hình cấp đích được duyệt và recipe riêng trước khi hỗ trợ. Đồ mặc định, kiểu mặt, biểu cảm và màu không được tự thêm cấp chỉ để thu phí.

| Group ID | Tên cấp hiện có | Trạng thái |
| --- | --- | --- |
| `item/wings.pixie` | Cánh Tiểu Tiên | Độc quyền quay số; chưa có hình cấp 2 |
| `item/hair.mop` | Tóc bồng | Chưa có hình cấp tiếp theo |
| `item/head` | Mặc định | Chưa có hình cấp tiếp theo |
| `item/eyes.big` | Bình thường | Chưa có hình cấp tiếp theo |
| `item/shirt.tank` | Áo ba lỗ | Chưa có hình cấp tiếp theo |
| `item/wrist.band` | Băng tay | Chưa có hình cấp tiếp theo |
| `item/pants` | Quần dài | Chưa có hình cấp tiếp theo |
| `item/shoes` | Giày | Chưa có hình cấp tiếp theo |
| `item/mouth.line` | Mím cười | Chưa có hình cấp tiếp theo |
| `item/mouth.smile` | Cười hé | Chưa có hình cấp tiếp theo |
| `item/mouth.grin` | Cười tươi | Chưa có hình cấp tiếp theo |
| `item/mouth.small` | Há nhỏ | Chưa có hình cấp tiếp theo |
| `item/mouth.open` | Há to | Chưa có hình cấp tiếp theo |
| `item/mouth.o` | Chữ O | Chưa có hình cấp tiếp theo |
| `item/mouth.sad` | Buồn | Chưa có hình cấp tiếp theo |
| `item/mouth.laugh` | Cười lớn | Chưa có hình cấp tiếp theo |
| `item/nose.dot` | Mũi chấm | Chưa có hình cấp tiếp theo |
| `item/nose.small` | Mũi nhỏ | Chưa có hình cấp tiếp theo |
| `item/eyes.left` | Nhìn trái | Chưa có hình cấp tiếp theo |
| `item/eyes.right` | Nhìn phải | Chưa có hình cấp tiếp theo |
| `item/eyes.wink.near` | Nháy mắt (trái) | Chưa có hình cấp tiếp theo |
| `item/eyes.wink.far` | Nháy mắt (phải) | Chưa có hình cấp tiếp theo |
| `item/eyes.happy` | Cười mắt | Chưa có hình cấp tiếp theo |
| `item/eyes.squint` | Híp mắt | Chưa có hình cấp tiếp theo |
| `item/eyes.angry` | Tức giận | Chưa có hình cấp tiếp theo |
| `item/eyes.cry` | Khóc | Chưa có hình cấp tiếp theo |
| `item/eyes.sparkle` | Lấp lánh | Chưa có hình cấp tiếp theo |
| `item/eyes.sleep` | Ngủ | Chưa có hình cấp tiếp theo |
| `item/eyes.blush` | Đỏ mặt | Chưa có hình cấp tiếp theo |
| `item/eyes.focus` | Tập trung | Chưa có hình cấp tiếp theo |
| `item/eyes.tears` | Chảy nước mắt | Chưa có hình cấp tiếp theo |
| `item/eyes.heart` | Trái tim | Chưa có hình cấp tiếp theo |
| `item/sticker.star` | Ngôi sao | Chưa có hình cấp tiếp theo |
| `item/sticker.heart` | Trái tim | Chưa có hình cấp tiếp theo |
| `item/sticker.bandage` | Băng cá nhân | Chưa có hình cấp tiếp theo |
| `item/mouthacc.mask` | Khẩu trang | Chưa có hình cấp tiếp theo |
| `item/mouthacc.gum` | Kẹo cao su | Chưa có hình cấp tiếp theo |
| `item/held.flower` | Bông hoa | Chưa có hình cấp tiếp theo |
| `item/held.can` | Bình tưới | Chưa có hình cấp tiếp theo |
| `item/held.balloon` | Bóng bay | Chưa có hình cấp tiếp theo |
| `item/hair.messy` | Tóc rối | Chưa có hình cấp tiếp theo |
| `item/hair.fluffy` | Tóc bông | Chưa có hình cấp tiếp theo |
| `item/hair.spiky` | Tóc dựng | Chưa có hình cấp tiếp theo |
| `item/hair.slick` | Tóc vuốt ngược | Chưa có hình cấp tiếp theo |
| `item/face.slim` | Mặt gầy | Chưa có hình cấp tiếp theo |
| `item/face.round` | Mặt tròn | Chưa có hình cấp tiếp theo |
| `item/face.vline` | Mặt V-line | Chưa có hình cấp tiếp theo |
| `item/face.square` | Mặt vuông | Chưa có hình cấp tiếp theo |
| `item/face.angular` | Mặt góc cạnh | Chưa có hình cấp tiếp theo |
| `item/face.long` | Mặt dài | Chưa có hình cấp tiếp theo |
| `item/face.baby` | Mặt bầu | Chưa có hình cấp tiếp theo |
| `item/face.chubby` | Mặt đầy đặn | Chưa có hình cấp tiếp theo |
| `item/face.wide` | Mặt béo | Chưa có hình cấp tiếp theo |
| `item/pants.shorts` | Quần đùi | Chưa có hình cấp tiếp theo |
| `item/pants.swim` | Quần bơi | Chưa có hình cấp tiếp theo |
| `item/sandal.slide` | Dép lê | Chưa có hình cấp tiếp theo |
| `item/sandal.flip` | Dép tông | Chưa có hình cấp tiếp theo |
| `item/boots` | Ủng | Chưa có hình cấp tiếp theo |
| `item/shirt.goku` | Gi Goku | Chưa có hình cấp tiếp theo |
| `item/pants.goku` | Quần Gi Goku | Chưa có hình cấp tiếp theo |
| `item/shoes.goku` | Giày Goku | Chưa có hình cấp tiếp theo |
| `item/wrist.goku` | Băng tay Goku | Chưa có hình cấp tiếp theo |
| `item/held.nyoibo` | Gậy Như Ý | Chưa có hình cấp tiếp theo |
| `item/tail.monkey` | Đuôi khỉ | Chưa có hình cấp tiếp theo |
| `item/eyes.female` | Mắt nữ | Chưa có hình cấp tiếp theo |
| `item/hair.female-long` | Tóc nữ dài | Chưa có hình cấp tiếp theo |
| `item/hair.female-short` | Tóc nữ ngắn | Chưa có hình cấp tiếp theo |
| `item/hair.female-shoulder` | Tóc nữ ngang vai | Chưa có hình cấp tiếp theo |
| `item/hair.female-ponytail` | Tóc nữ buộc cao | Chưa có hình cấp tiếp theo |
| `item/hair.female-twintails` | Tóc nữ hai chùm | Chưa có hình cấp tiếp theo |
| `item/hair.female-double-buns` | Tóc nữ hai búi | Chưa có hình cấp tiếp theo |
| `item/hair.female-half-up` | Tóc nữ buộc nửa đầu | Chưa có hình cấp tiếp theo |
| `item/hair.female-low-bun` | Tóc nữ búi thấp | Chưa có hình cấp tiếp theo |
| `item/hair.female-low-ponytail` | Tóc nữ buộc thấp | Chưa có hình cấp tiếp theo |
| `item/shirt.female` | Váy liền (áo) | Chưa có hình cấp tiếp theo |
| `item/pants.female` | Váy liền (chân váy) | Chưa có hình cấp tiếp theo |
| `item/shoes.female` | Giày + tất trắng | Chưa có hình cấp tiếp theo |
| `item/held.star-wand` | Gậy ngôi sao | Chưa có hình cấp tiếp theo |
| `item/held.heart-wand` | Gậy trái tim | Chưa có hình cấp tiếp theo |
| `item/held.moon-wand` | Gậy mặt trăng | Chưa có hình cấp tiếp theo |
| `item/held.snow-wand` | Gậy bông tuyết | Chưa có hình cấp tiếp theo |
| `item/held.sunflower-wand` | Gậy hướng dương | Chưa có hình cấp tiếp theo |
| `item/held.pink-guitar` | Đàn guitar hồng | Chưa có hình cấp tiếp theo |
| `item/held.tennis-racket` | Vợt tennis | Chưa có hình cấp tiếp theo |
| `item/held.rose` | Hoa hồng | Chưa có hình cấp tiếp theo |
