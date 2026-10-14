# Nhân vật nữ cơ bản · mẫu tóc và outfit v6 (bản thử)

Mắt và đồ giữ nguồn nhân vật lớn bên trái của `docs/art/female-reference-v1.png`. Tóc hiện dùng `docs/art/female-hair-atlas-v6.png`, tách/tái dựng bằng ImageGen built-in theo bảng 15 nhân vật người dùng gửi (`female-reference-v6.png`). Outfit vẫn dựng trên thân/pose nam và được chỉnh theo mẫu mới. Bản v2 (tóc ImageGen `female-hair-long-v2.png`, áo/váy vẽ tay) bị nhận xét không đúng ảnh mẫu, nên v3 dựng lại toàn bộ theo cách đã làm với nhân vật nam. **Tóc dài v4 đã được người dùng duyệt** qua phản hồi “chuẩn đấy”. Đã thêm ba bản thử tóc ngắn, ngang vai, buộc cao; các kiểu mới chưa được duyệt. Tám kiểu còn lại trong bảng chưa làm.

Trong Character Lab hoặc tủ đồ, chọn tab **Nữ** rồi bấm **Nữ cơ bản**. Preset `femaleOutfit` (`character-core/outfit-logic`) gồm:

- da Trắng hồng, mặt gầy;
- tóc dài Nâu hạt dẻ;
- mắt nữ màu Nâu;
- váy liền hồng (áo + chân váy);
- giày kèm tất trắng.

Body, đầu và hệ pose dùng chung với nhân vật nam. Nhận diện nữ chủ yếu đến từ kiểu tóc; mắt và bộ váy là lựa chọn preset, không yêu cầu một khung người riêng.

### Sửa ghép tóc v4 (08/10/2026, đã duyệt)

Giữ mái và khối đỉnh lấy từ ảnh mẫu; thu phần tóc sau tai dần tới 55% bề ngang cũ để cân với khung nam. Chuyển phần tóc rủ sau tai về lớp sau, nối khe lấy mẫu trong khối tóc và vẽ lại viền ngoài một pixel. Lớp tóc sau phủ kín vùng nối sọ–gáy để mặt gầy không làm lọt nền. Không đổi body, mặt, mắt hoặc quần áo trong lần sửa này.

Test kiểm tra thêm vùng ghép tóc–đầu liên tục qua cả 10 mặt, 4 pose và 2 hướng. Bản ghép đã kiểm tra trên nền cỏ ở native và phóng lớn; đã được người dùng xác nhận “chuẩn đấy”.

## Cách dựng

```sh
python3 tools/characters/female/build.py   # cần numpy + Pillow
pnpm check
pnpm build
```

### Căn ảnh mẫu (`reference.py`)

Đầu của nhân vật mẫu cùng tỉ lệ với đầu gốc: 3,47 px trên bảng bằng 1 px game. Hai mắt mẫu khớp `eyes.big` (x −9..10, y −42); tai và cằm cũng khớp.

Chân mẫu dài hơn thân gốc, nên phần dưới cằm (y > −27) được ép dọc 36 → 27 hàng để đế giày về y 0.

Mỗi ô game lấy nhóm màu chiếm đa số trong ô; nét tối thắng khi chiếm từ 40%. Các nhóm là nền, viền tối, da, trắng, vải hồng, tóc và màu khác. Ảnh không bị thu nhỏ trung bình.

### Tóc dài v4 (`hair.py`, mốc cũ)

- **Vùng lấy:** khối tóc chính lan từ đỉnh đầu, cộng mảng bóng rất tối sau gáy và dưới lọn, cộng viền ngoài.
- **Vùng loại:** tròng mắt nâu, khoá kéo/dây chuyền và icon bên cạnh.
- **Màu:** mỗi ô lấy bậc I h H G L có độ sáng gần nhất trên bảng Nâu hạt dẻ, nên màu mặc định giống ảnh mẫu và đổi màu tóc vẫn đủ 5 bậc.
- **Phần trước** (lớp 50): mọi ô trên cằm, cộng lọn ôm má phải xuống vai, cộng phần phủ da đầu trên y −46. Mắt và mi của mọi kiểu mắt luôn được chừa trống.
- **Phần sau** (lớp 5): cả khối tóc. Thân gốc hẹp hơn thân mẫu, nên khe giữa khối tóc dài và vai trái được lấp bằng bậc tóc tối để tóc rủ liền từ gáy.
- **Mặt rộng:** `.w2/.w4/.w6` nhân đôi cột ở vùng sọ x −12..6.

### Mắt nữ (`face.py`)

`eyes.female` gồm:

- E: mi trên dày, có đuôi mi;
- C: con ngươi tối;
- B/b: tròng;
- W: đốm sáng.

C, B và b đổi theo màu mắt.

### Váy liền, tất, giày (`dress.py`)

Vẽ thẳng trên thân gốc, giữ neo:

- **Áo** (`shirt.female`, lớp 30): tay phồng ngắn viền trắng ở hàng −22, cổ chữ V trắng ngay dưới cằm, mặt dây vàng, khoá kéo xám giữa thân, đai eo có khoá vàng.
- **Chân váy** (`pants.female`, lớp 20): xoè dần, xếp ly, diềm trắng ở gấu, chừa bàn tay; gấu ở y −10.
- **Giày** (`shoes.female`): giữ đúng footprint và offset từng bước của giày gốc. Hai hàng trên của mỗi cột đổi thành tất trắng.
- **Màu:** hồng đổi được (nhóm áo/quần/giày); vàng và xám nằm trong `palettes/female-basic.txt`.

Exporter chỉ quản lý item nữ. Mắt nữ nằm ở `characters/female/eyes/`, không ghi đè mắt dùng chung. Test kiểm tra:

- preset nữ;
- mắt (mọi kiểu mắt không thuộc riêng nhân vật nam) không bị tóc che ở mọi mặt, pose và hướng;
- gấu váy và footprint giày.

## Còn khác ảnh mẫu

- Thân gốc ngắn và hẹp hơn thân mẫu, nên váy, tay và chân không thể giống hệt về tỉ lệ.
- Tai gốc nằm cao hơn tai mẫu khoảng 3 hàng, nên mái bên trái che gần hết tai.
- Băng tay hồng trắng ở cổ tay mẫu chưa làm.

`tools/characters/female/basic.json`, `docs/art/female-hair-long-v2.png` và `female-example-v2.png` thuộc bản v2 và không còn được exporter dùng. Có thể xoá khi bạn duyệt v3.

## Ba kiểu tóc bổ sung (bản thử, chưa duyệt)

Tab Nữ có thêm **Tóc nữ ngắn**, **Tóc nữ ngang vai**, **Tóc nữ buộc cao**. Đều giữ khung chung với nam, bốn pose, hai hướng, màu tóc và biến thể mặt rộng.

`tools/characters/female/hair-styles.json` lưu vùng cắt từ các layer 02, 03, 08 trong ảnh mẫu gốc cùng kích thước và neo native. `styles.py` lấy nhóm màu trước khi thu lưới, bỏ nền slate, giữ dây buộc hồng riêng. Tóc buộc cao tách phần đuôi sang lớp sau. Builder dùng cùng cách phủ sọ, nối thái dương và chừa mắt với tóc dài đã duyệt; tóc dài được giữ nguyên.

## Thu nhẹ và làm sạch nét (bản thử, chưa duyệt)

Người dùng xác nhận tỉ lệ bốn kiểu trước đó ổn, rồi yêu cầu thử tóc nhỏ hơn và mềm, rõ nét hơn. `finish.json` lưu cấu hình: rộng 94%, khối đỉnh 92% quanh mốc trán −46, giảm phần nhô sau tai 15%. Đầu/body và mắt không đổi vị trí; builder phủ lại vùng sọ và nối mọi biến thể mặt. `finish.py` gom những pixel sáng/tối rời theo cụm lân cận và đổi viền tóc sang bậc I để viền mềm, đổi theo màu tóc. Không dùng blur hoặc nội suy canvas.

Mũ kín trước đây cắt toàn bộ tóc sau trên một hàng ngang nên tóc buộc cao trông bị chặt dù thu nhỏ. Layout mới dùng khoảng che theo từng hàng của silhouette mũ cho tóc nữ lớp sau; lọn ngoài mũ được giữ. Canvas town và hai provider preview dùng cùng khoảng che, theo pose, mặt rộng và hướng lật. Bỏ mũ trả lại toàn bộ tóc. Bản sửa này chưa được người dùng duyệt.

### Sửa tóc nhô cạnh chóp mũ phù thủy

Mask theo từng hàng chóp mũ v2 còn để lộ khối sọ/đuôi buộc cao bên cạnh chóp hẹp (hai ảnh người dùng gửi lúc 19:44). Bản sửa lấy vùng vành rồi quét ngược lên trên, mở rộng vùng che theo đường cong ở chỗ tóc thoát ra sau vành. Che kín tóc trên đầu, giữ pixel tóc dưới vành và trả lại toàn bộ khi bỏ mũ. Không đổi sprite, kích thước hoặc neo của tóc/mũ. Regression kiểm tra bốn kiểu tóc, năm cấp phù thủy, mặt thường/rộng và hai hướng/pose. Bản sửa chưa duyệt.

## Mẫu mới v6 (09/10/2026, bản thử chưa duyệt)

Người dùng chê bản tô vệt sáng chưa đạt và đưa tóc nam làm chuẩn chất lượng. Bản raster v5 thử chia lọn theo atlas nam nhưng có mái/gai giống nam. Sau đó người dùng gửi bảng 15 mẫu nữ, nhận xét ảnh gen tốt và yêu cầu kiểm tra cả outfit. Nguồn hiện tại dùng bảng này; bản v5 đã bỏ khỏi exporter.

Bốn kiểu hiện có được lấy theo hướng mẫu: dài thẳng (hàng 2, cột 1), bob ngắn (hàng 1, cột 1), ngang vai cong (hàng 3, cột 1), buộc cao (hàng 2, cột 2). Giữ dạng mái nữ, tóc mai và đuôi rủ, không thêm gai/cowlick. Chưa thêm 11 kiểu còn lại.

`raster-styles.json` lưu crop, kích thước và neo. `raster-hair.py` phân loại năm cụm màu nguồn **trước** khi thu native, giữ bóng giữa lọn và điểm sáng. Các tâm màu lấy từ atlas thực tế; tránh dùng palette nguồn nam làm tóc nữ bết tối. Tóc rủ nằm sau mặt/thân. Builder nới mặt rộng, phủ sọ, nối thái dương bằng màu lọn gần nhất, chừa mắt và xuất pose. Mask mũ dùng chung như trước. Dây buộc hồng giữ riêng.

Outfit v6 trong `dress.py`: cổ viền trắng gọn với mặt dây riêng, placket xám và một mép sáng, cụm sáng ở vai/ngực, bóng dưới tay áo, đai eo tối. Nếp váy mở dần từ eo với rãnh tối và mặt nếp sáng, thay cách modulo theo mép hàng làm nếp bị zigzag. Diềm trắng còn hai hàng để phần váy hồng đọc rõ. Giày giữ footprint từng pose, tất trắng và mũi giày hồng; không đổi body hoặc animation.

Các bước thu tỉ lệ/exporter v4 ghi phía trên là lịch sử, không áp vào raster v6. Nguồn và prompt: [female-hair-v6-prompt.md](art/female-hair-v6-prompt.md). **Bản v6 đang thử trong game, chưa được người dùng duyệt.**

### Căn lại trục tóc v6 (09/10/2026, chưa duyệt)

Screenshot 00:53:47 cho thấy tóc lệch với mặt khi bỏ mũ và đội mũ. Vùng hở mặt trong atlas mới lệch phải so với mắt của game; không dùng bounding box của tóc rủ để căn sọ. `face_shift_x` dịch đồng thời tóc trước/sau về trái: dài và ngang vai 3px, ngắn và buộc cao 2px. Artwork, kích thước và neo mũ giữ nguyên. Mask tóc sau dưới mũ kín giấu toàn bộ phần gốc từ 4px trên vành trở lên; phần chuyển tiếp sát vành vẫn theo silhouette mũ, đuôi dưới vành giữ nguyên. Sửa trường hợp buộc cao lộ gốc cạnh mũ lưỡi trai Lv.3. Builder phủ lại sọ/nối thái dương sau khi căn.

Exporter kiểm tra trục phần hở mặt trước khi vá scalp/chừa mắt để bước vá không che lỗi neo. Regression mask mũ kiểm tra mọi cấp mũ kín, bốn biến thể bề ngang, bốn pose và hai hướng. Bản chỉnh neo này chưa được người dùng duyệt.

### Thu khối tóc và giữ đuôi buộc ngoài mũ (09/10/2026, chưa duyệt)

Người dùng chê bản neo/mask trước vẫn quá to và chấp nhận để tóc buộc cao lộ ngoài mũ. Thu kích thước lấy mẫu native: dài 54×58 → 48×54, ngắn 48×40 → 44×38, ngang vai 50×43 → 46×40, buộc cao 58×58 → 52×52. Căn lại origin quanh mắt/trục mặt, không co body/mắt/mũ. Atlas và cụm màu giữ nguyên; builder vẫn phủ sọ, nối thái dương và sinh mặt rộng.

Riêng tóc buộc cao: phần sau ngoài khoảng vành mũ được giữ cả phía trên vành, bỏ mask toàn hàng và taper mở rộng để không chặt ngang gốc. Phần sọ dưới vùng che mũ vẫn ẩn. Các kiểu khác giữ mask mũ kín. Regression kiểm tra các cấp mũ, pose/hướng và việc phục hồi tóc khi bỏ mũ. Đây là bản thu nhỏ để người dùng xem lại, chưa được duyệt.

### Bỏ nét lấy mẫu thừa cạnh mắt, ghép tóc mai lên mép má (09/10/2026, chưa duyệt)

Ảnh 01:17–01:18 cho thấy mặt có nét kẻ cạnh mắt, kể cả khi bỏ tóc. Vùng lấy mẫu cũ của mắt nữ chứa pixel tối ngoài aperture mắt gần (x −11/−10) và mép dọc dưới mắt xa (x 10). `face.py` giới hạn mẫu về mắt gần x −9..−3, mắt xa x 5..9; giữ cụm màu/mi bên trong, y −42..−34. Không sửa đầu hay vị trí mắt nam.

Builder không dùng lại mask mắt nữ của lần export trước; dùng mắt vừa sinh để kết quả tái tạo ổn định. Tóc mai phủ một hàng pixel ở mép ngoài má gần nơi có tóc sau, y −38..−30, x ≤ −12, để viền mặt không thành nếp đen nằm bên trong khối tóc. Tai, da mặt, mắt và tỉ lệ thân giữ nguyên. Bản sửa mặt/tóc mai chưa được người dùng duyệt.

## Chốt bản ghép nữ (09/10/2026)

Người dùng xác nhận “okey push code đi” sau bản sửa lớp búi tóc: tóc/outfit v6, neo mũ nữ và mũ len nữ hiện tại được chốt để push. Búi giữ hình gốc, lớp 54 nằm sau mũ 55; thân mũ che tóc bên trong. Các ghi chú “chưa duyệt” phía trên mô tả trạng thái trong những lần thử trước; bản búi dịch/cắt và bản tóc đè lên mũ vẫn bị loại.

## Ba kiểu bổ sung từ bảng mẫu (09/10/2026, chưa duyệt)

Thêm hai chùm (hàng 2 cột 3), hai búi tròn (hàng 3 cột 2) và tóc dài gợn buộc nửa đầu (hàng 3 cột 3). Nguồn ImageGen `docs/art/female-extra-hair-atlas-v1.png`, prompt và hai ảnh tham chiếu lưu cùng thư mục. Export qua cấu hình từng kiểu trong `raster-styles.json`, chung màu, đầu/body/outfit, mặt rộng và pose. Artwork cũ giữ nguyên. Các kiểu mới hiện trong tab Nữ; mũ kín che phần tóc bên trong, không đưa tóc lên trên vải mũ. Bản mới cần người dùng duyệt.

## Búi thấp và đuôi ngựa thấp lệch bên (09/10/2026, chưa duyệt)

Hai screenshot 02:19:56 và 02:20:01 xác định chính xác kiểu cần thêm: búi thấp cuộn tròn sau tai với lọn xoăn ôm mặt, và đuôi ngựa thấp lệch bên buộc hồng. Nguồn tham chiếu lưu tại `female-low-bun-reference-v1.png` / `female-low-ponytail-reference-v1.png`. Cùng exporter raster, khung đầu và bảng màu tóc với các kiểu hiện có; không lấy búi cao làm thay thế. Khi đội mũ tóc nằm sau vải mũ, phần thấp bên tai/đuôi vẫn lộ theo vùng che chung. Hai kiểu bổ sung chưa được người dùng duyệt.
