# Hướng dẫn vẽ hình và thêm đồ

## Định dạng hình

Nhân vật, đồ và thú cưng là pixel art, viết dạng chữ trong `apps/game/src/assets/sprites/**/sprites.txt`: mỗi ký tự là một pixel gốc, game vẽ đúng lưới đó (phóng to không làm mượt).

```
@palette
K #0e0a0e
S #fcbe98

@piece mouth.line
K....K
.KKKK.
```

- `.` là trong suốt. Các ký tự khác tra trong `@palette` (một ký tự, màu `#rrggbb`).
- Dòng bắt đầu bằng `#` là chú thích. Dòng trống kết thúc một mục.
- Mọi hàng trong một mảnh phải dài bằng nhau. Sai định dạng thì game và `pnpm test` báo lỗi kèm tên file và số dòng.
- `scenery/melon/sprites.txt` là khung cho cây trồng; cây trồng vẫn vẽ bằng vector trong `src/features/farm/rendering/crop-art.ts`.

## Khung nhân vật

- Nhân vật mẫu cao 67px, rộng khoảng 49px, đầu và tóc chiếm khoảng 60%. Vẽ **quay phải, nhìn chếch 3/4**; engine tự lật cho hướng trái.
- **Gốc** là điểm giữa hai bàn chân, trên mặt đất. `dx, dy` trong `items.json` là góc trên trái của mảnh so với gốc (`dy` âm là phía trên).
- Mặt quay phải nên **má gần** (rộng, phía có tai) nằm bên trái hình, mắt bên phải hẹp hơn. Miệng ở giữa khe hai mắt (x 2), mũi nhích về phía mặt quay tới (x 3); sticker dán ở má gần.
- Ánh sáng từ **trên bên phải**: mỗi vật liệu 3–5 sắc độ, viền `K` gần đen.
- Đầu trọc (`head`) là khối chuẩn dùng chung: mọi kiểu tóc vẽ đè lên nó và không được khoét vào đầu. Phần tóc nằm sau đầu (tóc dài, đuôi ngựa) tách thành item `<id tóc>.back`, game tự thêm. Bóng tóc hắt lên trán vẽ trong mảnh tóc bằng chữ cái da.

Vị trí tham khảo (so với gốc, nhân vật quay phải):

| Phần | Vị trí |
| --- | --- |
| Mắt gần / mắt xa | x −8..−2 / x 6..12, y −42..−34 |
| Miệng | tâm x 2 (giữa khe hai mắt), y −33..−28 (8 kiểu: viền `K`, trong miệng `5`, san hô `6`, hồng `7`) |
| Má gần (sticker) | x −10..−5, y −33..−29 |
| Cằm | y −28 |
| Nắm tay gần | lòng tay x 7..11 (tâm x 9), y −18..−13 |
| Đỉnh tóc | y −65 |

## Pose

| Pose | Dùng khi | Thường thay đổi |
| --- | --- | --- |
| 0 | Đứng | Hình gốc |
| 1 | Đứng, nhịp phụ (đổi với 0) | Đầu và đồ trên mặt xuống 1px (thở); cánh lên 1px |
| 2 | Bước chân A | Thân, quần, giày dùng mảnh `*.step`: chân gần (to, ở dưới) sải lên 2px, chân xa lùi 1px và nhấc 2px; đầu xuống 1px |
| 3 | Bước chân B | Mảnh `*.step2`: ngược lại, chân xa sải lên, chân gần lùi và nhấc; đầu xuống 1px |
| 4–14 | Hành động (chưa có hình) | |

Đi bộ chạy 4 nhịp: đứng → bước A → đứng → bước B (khác Avatar gốc chỉ đổi 0/2), nên hai chân thay nhau bước. Chân chỉ cử động từ gối xuống để không đè lên tay.

Item không khai báo pose nào thì dùng pose 0.

## Màu thay được

Mỗi nhóm có chữ cái riêng, `colors.json` thay theo bộ màu. Game gộp mọi nhóm thành một bảng đổi màu cho mọi món, nên món nào cũng có thể dùng chữ cái da (ví dụ bóng tóc trên trán).

| Nhóm | Chữ cái (sáng → tối) |
| --- | --- |
| Da | `S` `s` `k` `n` |
| Tóc | `L` `G` `H` `h` `I` |
| Áo | `T` `t` `V` `Y` `Z` |
| Quần | `N` `P` `p` `D` |
| Giày | `O` `o` `Q` |
| Băng tay | `M` `m` `x` |

Con ngươi đổi theo bộ màu mắt (`C` `B` `b` `A`, tối → sáng). Mi mắt `E`, lòng trắng `W`, nước mắt `0` `1`, lấp lánh `2`, tim `3` `4`, má hồng `8`, quần lót và đồ phụ (khẩu trang, cánh, hoa...) dùng màu cố định.

## Mắt

15 kiểu mắt theo bảng mẫu: bình thường, nhìn trái, nhìn phải, nháy mắt trái/phải, cười mắt, híp mắt, tức giận, khóc, lấp lánh, ngủ, đỏ mặt, tập trung, chảy nước mắt, trái tim. Các kiểu mắt tròn (ngạc nhiên, ngơ ngác, hài hước, sợ hãi, chóng mặt) bị tóc bồng che thành hình chữ C, còn buồn, lạnh lùng, nhìn lên/xuống có vệt mi tách rời trông như hai cặp mắt, nên tạm bỏ (thiết kế vẫn giữ trong `tools/eyes/design.py`, mục `DROPPED`, để dùng lại với kiểu tóc ngắn). Mắt gần (to) 7 cột ở x −9..−3, mắt xa 5 cột ở x 6..10, mi trên ở y −42; kiểu mắt tròn nhích mắt xa sang trái 1px vì mép phải bị tóc che. Lông mày không vẽ: tóc mái che gần hết, chỉ lộ ra vài chấm trông như bẩn, nên cảm xúc thể hiện qua dáng mi mắt. Mắt đã nhắm sẵn (cười, ngủ, khóc, tim) có `"blink": false` để không bị thay bằng mắt chớp. Hình mắt sinh từ `tools/eyes/design.py`.

## Kiểu tóc

Quy trình, prompt và checklist cho tóc mới: [hair-workflow.md](hair-workflow.md). Cấu hình từng kiểu nằm trong `tools/hair3/styles.json`.

Ngoài Tóc bồng (`hair.mop`, có phần sau `hair.mop.back`) có 4 kiểu tóc nam theo ảnh mẫu đầu nhìn chếch 3/4 của người dùng (mỗi hàng một kiểu, nhiều màu): rối (`hair.messy`), bông (`hair.fluffy`), dựng (`hair.spiky`), vuốt ngược (`hair.slick`).

- Bốn kiểu mới dùng nguồn raster `docs/art/male-hair-atlas-v2.png`, với các lọn và mảng sáng lớn. Game vẫn nạp lưới pixel trong `sprites/**/sprites.txt`, không nạp atlas lúc chạy.
- Sinh lại từ thư mục gốc repository bằng `python3 tools/hair3/build.py` (cần Pillow). Script giữ 5 chữ màu `I h H G L`, dùng alpha để tạo viền `K` 1px, loại chấm rời và giữ các nét bên trong đổi màu được.
- Mái và thái dương căn theo đầu gốc, giữ tai và vùng mắt lộ ra. Các biến thể `.w2`, `.w4`, `.w6` được sinh cùng lúc để dùng với mặt rộng. Phần trong suốt ở cạnh tai được nối với mép đầu để nền không lọt qua; mỗi biến thể nối theo dáng đầu tương ứng. Đỉnh tóc rối ở y −67, tóc bông và vuốt ngược ở y −68, tóc dựng ở y −75 (pose đứng).
- Tóc bồng gốc (`hair.mop`) và phần sau của nó không thay đổi.

## Khuôn mặt

Ngoài đầu gốc (`head`, "Mặc định") có 9 dáng mặt cùng slot `head`, theo bảng mẫu (hàng Nam, nhìn nghiêng): `face.slim` Gầy, `face.round` Tròn, `face.vline` V-line, `face.square` Vuông, `face.angular` Góc cạnh, `face.long` Dài, `face.baby` Bầu, `face.chubby` Đầy đặn, `face.wide` Béo. Tủ đồ chọn ở ô "Khuôn mặt" (trường `face` của bộ đồ).

- Mỗi dáng là một đường viền mượt (spline qua các điểm điều khiển, raster siêu mẫu 8× nên bậc thang đều, bỏ gai 1 pixel), sọ dùng đúng đầu gốc. Màu và bóng lấy từ đầu gốc bằng ánh xạ từng hàng (sát mép giữ đúng nét mép gốc), tai chép nguyên rồi gắn theo mép trái mới. Mắt, miệng, mũi không đổi chỗ: mọi dáng đều chứa trọn chúng (test kiểm tra).
- Mặt to hơn đầu gốc có `wide` = số px rộng thêm (2, 4, 6); đầu phình chủ yếu về phía má gần và hàm (bên trái khi quay phải), ít về phía mặt xa, nên mặt vẫn cân quanh mắt. Kiểu tóc khi đó dùng biến thể `<id>.w<wide>` (và `<id>.back.w<wide>`), được nới bằng cách nhân đôi vài cột rải ở giữa mảnh tóc để tóc vẫn che vừa đầu. Thêm kiểu tóc mới thì sinh lại các biến thể này.
- Sinh bằng `tools/faces/make5.py` (dáng mặt, điểm điều khiển trong `LOW`) và `tools/faces/widen.py` (nới tóc).

## Quần

Slot `pants` có Quần dài (`pants`), Quần đùi (`pants.shorts`) và Quần bơi (`pants.swim`), cùng nhóm màu quần. Quần đùi và quần bơi được cắt từ mảnh quần dài của từng pose (giữ cạp, hông, đũng), hàng ngay dưới chỗ cắt thành viền gấu, phía dưới lộ chân trần của thân; quần bơi ngắn hơn và có sọc sáng (`N`) bên hông. Sinh bằng `tools/faces/bottoms.py`.

## Giày dép

Slot `shoes` có Giày (`shoes`), Dép lê (`sandal.slide`), Dép tông (`sandal.flip`) và Ủng (`boots`), cùng nhóm màu giày (chữ `O o Q`) nên đổi màu được như giày. Dép được sinh từ mảnh giày của từng pose: giữ dáng bàn chân và viền, mu bàn chân thành da (chữ da nên ăn màu da), chỉ giữ đế và quai. Dép có đế màu dép dày 1px dưới bàn chân; dép lê có quai bản rộng, dép tông có quai chữ V. Ủng: mỗi ống quần được thay bằng cổ ủng đúng bằng bề ngang ống ở 4 hàng dưới cùng (vẫn lộ phần trên ống quần), nối liền xuống bàn chân không còn đường viền ngang, lớp 22 trên quần, vành cổ tối để không lẫn với giày. Sinh bằng `tools/faces/footwear.py`.

## Thêm một món đồ

Mũ lưỡi trai Lv.1–3 hiện nằm trong sheet riêng `hats/cap/sprites.txt`. Xem [hat-workflow.md](hat-workflow.md) để tái tạo và ghép mũ với tóc.

1. Vẽ mảnh trong `sprites/**/sprites.txt`, ví dụ `@piece hat.cap` (thêm `hat.cap.step` nếu khi bước phải khác).
2. Thêm vào `packages/character-core/src/data/items.json`:
   ```json
   {"id": "hat.cap", "label": "Mũ lưỡi trai", "slot": "hat", "layer": 55,
    "poses": {"0": ["hat.cap", -20, -68], "1": ["hat.cap", -20, -67], "2": ["hat.cap", -20, -67]}}
   ```
   Lớp (`layer`) quyết định thứ tự vẽ:

   | Lớp | Slot |
   | --- | --- |
   | 3 | `back` (cánh, đồ nâng cấp: xem dưới) |
   | 5 | `hairBack` (phần tóc sau đầu, tự thêm theo tóc) |
   | 10 | `body` |
   | 15 / 20 | `shoes` / `pants` |
   | 30 / 32 | `shirt` / `wrist` |
   | 35 / 36 | `held` / `grip` (ngón tay nắm, tự thêm khi cầm đồ) |
   | 40 | `head` |
   | 44–48 | `nose`, `eyes`, `mouth`, `sticker`, `mouthAcc` |
   | 50 | `hair` |
3. Đồ cầm tay cho cán hoặc dây đi qua tâm nắm tay (x 9); lớp ngón tay vẽ đè lên để trông như đang nắm.
4. Slot mới (như `hat`) cần thêm ô chọn trong `outfitFields` và `toEquip` ở `packages/character-core/src/outfit-logic.ts`. Ô có thể để trống thì đặt `optional: true`.
5. `pnpm test`, rồi `pnpm dev` và mở `/character.html` để xem đủ pose, lật trái, từng lớp riêng và khi đi trong cảnh.

## Đồ nâng cấp

Một món nâng cấp là một **họ** item cùng `family`, mỗi cấp một item có `level` (1 = cơ bản) và id `<họ>.<cấp>`, ví dụ `wings.fire.1` … `wings.fire.6`. Tủ đồ chọn họ ở ô của slot (ví dụ "Cánh") và chọn cấp ở ô cấp (`backLevel`); `toEquip` lấy item đúng cấp, thiếu cấp nào thì lùi về cấp thấp hơn gần nhất. Tên cấp: Lv.1 Cơ bản, Lv.2 Nâng cấp, Lv.3 Hiếm, Lv.4 Sử thi, Lv.5 Huyền thoại, Lv.6 Thần thoại (`RARITY` trong `assets.ts`).

Cánh có 6 họ × 6 cấp (Thiên Thần, Băng Giá, Lửa, Bóng Tối, Tinh Linh, Rồng), nằm trong `apps/game/src/assets/sprites/accessories/wings/*/sprites.txt` với bảng màu riêng bằng ký tự Unicode (gộp vào bảng nhân vật khi nạp). Gốc cánh ở lưng (y −27, gốc nằm ở 62% chiều cao cánh), lớp 3, sau mọi thứ; gốc mỗi cánh cách giữa lưng 9–16px (giữ khoảng hở tự nhiên của bảng mẫu: cánh nhỏ đặt xa hơn) để cánh luôn ló ra hai bên vai, không bị tóc và thân che; phần trang trí giữa lưng (hào quang, thân rồng) bị bỏ vì nằm sau đầu/lưng. Cấp càng cao cánh càng to (rộng 56 → 84px). Mỗi cánh có 4 khung đập cánh `<id>`, `<id>.f1`, `<id>.f2`, `<id>.f3` (cùng kích thước): xoè, hất lên 22°, xoè, cụp xuống 24° — mỗi cánh xoay quanh gốc của nó. Sinh bằng `tools/wings/cut.py` (cắt ô từ bảng mẫu) và `tools/wings/make3.py` (cắt rộng ra ngoài khung ô 10px vì chóp cánh cấp cao vượt qua khung, rồi xoá đường khung: đoạn xám dài và nét mảnh thẳng; bỏ quầng tối quanh cánh (trừ cánh Bóng Tối vốn tối), nét tối bên trong được giữ; xoay/co trên ảnh gốc rồi mới thu về pixel bằng màu đa số nên khung nào cũng nét; không tô tối mép).

**Item có hoạt ảnh.** Item nào có `frames` (danh sách hậu tố gắn vào tên mảnh của pose, `""` là chính mảnh đó) và `frameMs` thì `layoutAvatar(..., time)` đổi khung theo thời gian (ms): khung = ⌊time / frameMs⌋ mod số khung. Mọi khung của một pose phải cùng kích thước (`loadItems` kiểm tra). Cánh dùng `frames: ["", ".f1", ".f2", ".f3"]`, `frameMs: 120`.

Để thêm món nâng cấp khác (mũ, đồ cầm tay...): thêm các item cùng `family` và `level`, rồi thêm ô cấp tương ứng (`levelOf`) trong `outfitFields`.

## Hiệu ứng cấp cao

Đồ và thú cấp cao khai báo hiệu ứng trong dữ liệu (`src/features/character/_utils/effect-logic.ts` vẽ, không cần sửa code khi thêm đồ mới):

- `effect`: kiểu hạt pixel bay quanh: `embers` (tàn lửa), `snow` (bông tuyết), `smoke` (khói tím), `petals` (cánh hoa), `leaves` (lá), `sparkle` (lấp lánh trắng), `stars` (sao vàng), `sparks` (tia điện), `spirit` (lửa hồn hồng). Đứng yên thì lấp lánh nhẹ, di chuyển thì hạt rơi lại phía sau thành vệt. Hạt là ô vuông 1-3px, tối đa 32 hạt mỗi nguồn.
- `aura`: vòng sáng dưới chân nhịp nhẹ và viền bảng tên: 1 Sử thi (tím), 2 Huyền thoại (vàng cam), 3 Thần thoại (cầu vồng).

Hiện dùng cho cánh: Lv.4 aura 1; Lv.5 aura 2 + hạt; Lv.6 aura 3 + hạt (Thiên Thần `sparkle`, Băng Giá `snow`, Lửa và Rồng `embers`, Bóng Tối `smoke`, Tinh Linh `petals`). Thú Lv.3: aura 2 + hạt theo loài (mèo, corgi `stars`; thỏ `petals`; gà `embers`; slime `leaves`; rồng `embers`; cáo `spirit`; robot `sparks`). Hạt của cánh sinh ở hai bên thân (chỗ cánh), không che mặt.

## Thú cưng

Thú cưng là nhân vật nhỏ đi theo sau chủ (`src/game/movement/pet-follow-logic.ts`): đứng sau 30px, đợi chủ đi trước khoảng 14px rồi mới chạy theo, lúc dừng thì quay mặt nhìn chủ. Hình nằm riêng trong `apps/game/src/assets/sprites/pets/*/sprites.txt` (bảng màu riêng), cao khoảng 26–35px, quay phải, gốc là giữa đáy mảnh.

1. Vẽ dáng đứng (`pet.dog`) và các khung đi cùng kích thước: thường là `pet.dog.walk1` (chân 1 và 3 nhấc 1px, nhích về trước) và `pet.dog.walk2` (chân 2 và 4). Con không có chân (slime) dùng khung bẹp xuống.
2. Thêm vào `packages/character-core/src/data/pets.json`: `{"id": "dog", "label": "Chó", "piece": "pet.dog", "walk": ["pet.dog.walk1", "pet.dog", "pet.dog.walk2", "pet.dog"], "hop": 1}`. Khi chạy, game lần lượt đổi các khung trong `walk` (4 khung cho một nhịp nảy); `hop` là độ nảy (px, mặc định 2, thỏ 3).
3. Thú bay (như rồng): thay `walk` bằng `flap` (các khung đập cánh, chạy cả khi đứng yên, nhanh hơn khi đuổi theo chủ) và `fly` (độ cao bay, px). Thú bay lơ lửng lên xuống nhẹ, bóng vẫn nằm dưới đất. Khung cánh được tạo bằng cách tách cánh khỏi thân rồi ép dọc quanh gốc cánh (`tools/pets/wings.py`).
4. Có thể thêm `recolor` để đổi màu theo chữ cái trong `pets/*/sprites.txt`.

**Tiến hoá (nâng cấp).** Mỗi loài là một họ 3 cấp trong `pets.json` (`family`, `level`): Lv.1 có id là tên loài (`cat`), Lv.2/Lv.3 là `cat.2`, `cat.3` (mảnh `pet.cat.2`...). Tủ đồ chọn loài ở ô "Thú cưng" và cấp ở ô "Cấp thú cưng" (`petLevel`); `wornPet(outfit)` trả về thú đúng cấp (thiếu cấp thì lùi về cấp thấp hơn gần nhất). Lv.2/Lv.3 lấy từ bảng tiến hoá, cùng tỉ lệ với Lv.1 của loài đó nhưng giới hạn to hơn Lv.1 tối đa 25% (Lv.2) và 50% (Lv.3); màu được gom trên ảnh gốc độ phân giải cao rồi mỗi ô pixel lấy màu chiếm đa số (ưu tiên nét viền tối), ngưỡng phủ 30% để giữ chóp đuôi, cánh, tai; thêm viền ngoài 1px màu tối như Lv.1; khung đi tự tìm chân chạm đất, rồng các cấp đều bay và đập cánh. Sinh bằng `tools/pets2` (`seg2.py` cắt theo cả khung panel để không mất chóp tai/đuôi/cánh vượt ô, gán từng mảnh cho con gần nhất; điểm sáng rực như mắt robot, đá quý được giữ dù nhỏ; `samp2.py` gom màu, thu pixel, viền, `frames2.py` khung đi/đập cánh, `export.py` ghi file).

## Công cụ

Hình mẫu được tách từ ảnh tham chiếu bằng các script Python trong `chibi-town/outputs/male-pixel-v1/tools/` (ngoài repo game): `split.py` tách lớp và vẽ phần bị che, `extras.py` vẽ đồ phụ, `export.py` xuất `sprites/**/sprites.txt`, `items.json`, `colors.json`; `pets/` chuyển bảng thú cưng mẫu thành `pets/*/sprites.txt`, `pets.json` (kể cả khung đi). `tests/character.test.ts` kiểm tra ghép đủ đồ ở pose 0 khớp từng pixel với `tests/fixtures/male-reference.txt`.

## Review độ sắc nét pet và cánh

Xem [pet-wing-review.md](pet-wing-review.md) để phân biệt lỗi nội suy canvas với chi tiết bị mất trong sprite native, cùng hướng sửa theo bảng mẫu.

### Nguồn mèo trắng hiện tại

Mèo Lv.1–3 đã khôi phục bộ sprite cũ trong `apps/game/src/assets/sprites/pets/*/sprites.txt`, gồm cả 6 frame bước chân. Đã xóa nguồn raster và exporter của bản thử bị từ chối. Xem [pet-wing-review.md](pet-wing-review.md) trước khi sửa tiếp.
