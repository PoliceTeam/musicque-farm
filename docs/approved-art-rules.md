# Quy tắc art theo phản hồi người dùng

Tổng hợp ngày 08/10/2026. Dùng tài liệu này trước khi gen hoặc sửa asset mới; hướng dẫn kỹ thuật chi tiết ở [hair-workflow.md](hair-workflow.md), [hat-workflow.md](hat-workflow.md) và [pet-wing-review.md](pet-wing-review.md). Phân biệt hình người dùng đã duyệt với bản thử đang chạy; test/build pass không có nghĩa là artwork được duyệt.

## Mốc hiện tại

| Asset | Mốc và trạng thái |
| --- | --- |
| Tóc nam | Artwork raster trong `art/male-hair-atlas-v2.png` được duyệt. Bản tóc vuốt ngược và tóc dựng đã cân đỉnh về sau 2px được người dùng xác nhận đẹp. Lưới runtime và cấu hình exporter mới nhất là mốc ghép, không chỉ atlas thô. |
| Mũ lưỡi trai | Bản đang dùng giữ góc chéo cũ, rộng 50px, cao 26/26/30px, lùi 2px và rút chóp vành 3px. Người dùng yêu cầu giữ dáng chéo và cân lại; chưa có xác nhận duyệt riêng bản mũ cuối. Bản gen gần chính diện đã bị từ chối. |
| Mũ len mới | `docs/art/beanie-atlas-v1.png`, imagegen built-in. Rộng 48px, cao 28/28/33px, đúng hướng phải. Đã ghép Lv.1–3 và được người dùng xác nhận “okey” khi chuyển sang mũ phù thủy. Bản len cắt từ bảng mẫu đã bị chê chất lượng, không lấy làm chuẩn mỹ thuật. |
| Mũ phù thủy mới | `docs/art/wizard-atlas-v1.png`, imagegen built-in theo `docs/art/wizard-reference-v1.png` người dùng gửi. Tím, chóp cong về sau, đai đen, vàng/đá xanh; native 54px × 38/40/42px cho Lv.1–3. Lv.4–5 dùng `docs/art/wizard-high-atlas-v3.png` theo `docs/art/wizard-high-reference-v3.png` mới: một chóp, Lv.4 xanh đậm/trăng treo/đá xanh, Lv.5 trắng ngà/đá xanh/vòng vàng, dải vải trắng thay cánh. Rộng 56/58px, cao 43/46px; neo vành ở hàng 39/41. Bản hai chóp v2 đã được thay theo yêu cầu; không dùng làm chuẩn cho các cấp này. **Đã được người dùng duyệt** qua phản hồi “okey rồi đấy” trước khi chuyển sang vương miện/halo. |
| Vương miện và halo mới | `docs/art/crown-atlas-v1.png` và `docs/art/halo-atlas-v1.png`, ImageGen built-in theo `docs/art/crown-halo-reference-v1.png`. Mỗi họ 5 cấp. Vương miện vàng/đỏ/cyan, Lv.4–5 có cánh trắng; halo vòng vàng, sao, hạt treo, trăng và quỹ đạo. Không clip tóc. **Bản thử chưa duyệt**. |
| Goku cơ bản | Bản raster v1 bị người dùng từ chối: áo/giày rời khỏi thân, tóc không khớp đầu. Hình gửi chỉ là tham khảo. Bản sửa dùng đúng footprint/pose/neo của áo ba lỗ, quần dài, giày, băng tay cũ; Bản tóc dùng lại hair.spiky bị chê giống tóc dựng. Tóc Goku v3 dùng nguồn riêng `docs/art/goku-hair-v3.png` từ ImageGen built-in, lọn lớn xòe về sau, mái nhọn; Bản ghép v3 đầu tiên bị chê cùng đuôi: tóc bè/khối ngang sát tai, đuôi cứng như ống. Bản sửa cân neo theo trục sọ, rút chiều cao và giới hạn lọn thấp sát thái dương; giữ raster. Người dùng yêu cầu giữ huy hiệu Goku, nút thắt/hai đuôi đai và giày có đặc điểm riêng, không chỉ đổi màu. Người dùng chê huy hiệu 7px quá to, ủng che quần và nút thắt/đuôi đai quá bé. Bản hiện tại thu huy hiệu về 5px, mở rộng nút thắt và đuôi đai; giày giữ template shoes/layer 15 và thêm line đỏ trên/dưới. Theo yêu cầu “vẽ đúng theo như này”, tóc v4 đã bị chê và được thay bằng atlas v5 theo dòng Cấp tóc Goku; đuôi dùng raster riêng `docs/art/monkey-tail-v2.png`, cong chữ C như layer mẫu. **Bản sửa chưa được duyệt**. Không dùng lại cách thu nhỏ từng món từ sheet gen. |
| Cấp tóc Goku | Người dùng yêu cầu đến Lv.4, dùng bảng màu hiện có. Bản nguồn v4/Lv.2–4 đầu tiên bị chê xấu hơn kỳ vọng (đỉnh cao, nhiều gai nhỏ, Lv.4 chỉ lộ vài lọn sau tai). Mẫu mới `goku-hair-reference-v5.png` là hướng người dùng muốn tham khảo. Bản thay hiện dùng ImageGen built-in `goku-hair-atlas-v5.png`: Lv.1 lọn đen xòe, Lv.4 mảng tóc dài sau vai. Lv.2–3 v5 bị chê phẳng/vỡ hơn Lv.1 nên thay bằng nguồn charcoal `goku-hair-lv23-v6.png`. Sửa exporter giữ cụm sáng/tối và bỏ viền nhân tạo tại chỗ tách tóc Lv.4. Màu độc lập; không thêm Lv.5/aura. Bản sau cùng (Lv.1 giữ v5, Lv.2–3 v6, Lv.4 sửa đường nối) **đã được người dùng duyệt**: “okey bản này ngon push code lên giúp tôi”. |
| Phụ kiện Goku | Gậy Như Ý nằm trong Cầm tay. Người dùng chọn tên slot chung **Đuôi**, món đầu tiên **Đuôi khỉ**, không dùng tên Đuôi Saiyan. Đuôi nâu bản đều, dày bị chê cứng. Bản mới ngắn hơn, dùng đường cong mềm và thu nhỏ dần ở đầu. Gậy đỏ và đuôi nâu đang là bản thử chưa duyệt. |
| Nữ cơ bản | v4 sửa ghép **đã duyệt** qua phản hồi “chuẩn đấy”, 08/10/2026: thu gọn tóc sau tai theo khung nam, chuyển tóc rủ về lớp sau, nối kín khe lấy mẫu và vùng sọ/gáy; giữ chung body/đầu, không đổi mắt/đồ trong lần sửa. v3, 08/10/2026: dựng lại theo nhân vật lớn trong `female-reference-v1.png`. v1/v2 bị chê là không đúng ảnh mẫu: tóc như mũ dẹt, mái thẳng, trán lộ, tóc sau mỏng, mắt nam, áo/váy khác mẫu. Tóc và mắt lấy mẫu từng ô từ ảnh (cách dựng nhân vật nam), không còn dùng `female-hair-long-v2.png`. Váy liền, tất trắng và giày vẽ trên thân/giày gốc theo chi tiết mẫu. Tóc dài v4 đã duyệt; thêm tóc ngắn, ngang vai, buộc cao lấy từ layer ảnh mẫu (02/03/08), cùng khung nam và cơ chế ghép v4. Người dùng xác nhận **tỉ lệ cả bốn kiểu ổn**; bản thử sau thu rộng 6%, đỉnh 8%, gọn tóc sau tai, gom cụm sắc độ/viền cùng màu tóc và sửa mask mũ cắt ngang tóc sau. Mask theo chóp từng hàng vẫn bị chê vì tóc nhô cạnh mũ phù thủy; bản sửa mới quét vùng vành lên trên và thu cong phần chân tóc, giữ tóc dưới vành. **Bản chỉnh nét, thu nhẹ và mask mũ mới chưa duyệt**; tám kiểu còn lại chưa làm. 09/10/2026: người dùng chê thiết kế tóc hiện tại cứng ngay khi đứng yên; bản thử mới chia mảng sáng thành lọn cong lớn, giảm khối tối và uốn nhẹ đuôi 1–2px, giữ tỉ lệ và vùng ghép. **Bản tô đường sáng bị người dùng chê chưa đạt**, yêu cầu giống cách chia lọn tóc nam trong screenshot 00:34:54. Bản thử v5 dựa atlas nam được thay bằng mẫu mới người dùng gửi: bảng 15 nữ `female-reference-v6.png`, người dùng nhận xét gen chuẩn và muốn kiểm tra outfit. Tóc hiện dùng ImageGen built-in `female-hair-atlas-v6.png` tách/tái dựng bốn kiểu hiện có từ mẫu mới; exporter giữ cụm màu trước khi thu native, không thêm gai kiểu nam. Outfit chỉnh cổ áo/tay áo, mặt sáng và rãnh nếp váy, diềm trắng hai hàng và mũi giày hồng trên body/pose chung. Screenshot 00:53:47 cho thấy neo tóc lệch phải; bản sửa dịch trục tóc trước/sau về trái 2–3px theo vùng hở mặt, phủ lại sọ và kiểm tra toàn bộ cấp mũ kín. Giữ artwork và neo mũ; sửa mask giấu gốc tóc trên vùng chuyển tiếp 4px của vành, bắt lỗi buộc cao lộ cạnh mũ lưỡi trai Lv.3. Sau screenshot 01:00:55 người dùng chê tóc nữ vẫn quá to và cho phép đuôi buộc cao lộ ngoài mũ: bản thử thu rộng 8–11%, cao 5–10%, căn lại quanh mặt; riêng buộc cao giữ phần ngoài khoảng vành, bỏ cắt toàn hàng/taper ở gốc. Sau ảnh 01:10–01:11 người dùng yêu cầu rà toàn bộ họ mũ: bản thử căn mũ nữ −3px theo x cho cả năm họ/mọi cấp, đồng bộ mask và hiệu ứng qua neo chung; artwork và neo nam giữ nguyên. Ảnh 01:17–01:18 tiếp tục cho thấy nét kẻ cạnh mắt/mặt méo khi có tóc: bản thử bỏ pixel lấy mẫu mắt ngoài aperture, ghép tóc mai trước mép má gần thay vì để viền đầu lộ bên trong tóc. Người dùng tiếp tục yêu cầu mũ len ôm tóc và búi tóc buộc cao lộ rõ (ảnh 01:24:16): bản thử có mũ len nữ rộng 44px/cao 26–31px, neo đáy −45; tách búi/dây hồng từ nguồn và ghép tại cửa sau mũ kín. **Bản tóc/outfit v6, mặt, mũ len nữ và búi tóc mới chưa duyệt**. |
| Các mũ đã bỏ | Bunny, sừng ma vương, headset, tai mèo và hiệp sĩ đã bỏ khỏi runtime/menu/random theo yêu cầu. Bộ vương miện/halo cắt từ bảng mẫu đã được thay bằng atlas riêng; không lấy làm chuẩn mỹ thuật. |
| Pet | Bộ mèo mới bị từ chối và đã khôi phục bộ cũ. Giữ bộ cũ làm nền khi sửa tiếp; không lấy bộ thử bị loại làm chuẩn. |
| Cánh | Chưa đổi artwork trong đợt này; bảng tham chiếu là kỳ vọng, không phải bằng chứng bộ hiện tại đã được duyệt. |

## Phong cách và tỉ lệ

- Giữ cấu trúc dự án, cơ chế di chuyển và nhân vật hiện tại. Làm nam trước; không tự đổi dáng đầu/body hoặc mở rộng góc nhìn.
- Dùng raster pixel art theo hình expect, cụm lọn và mảng bóng rõ, viền mảnh. Không thay bằng hình vector đơn giản hóa. Vẫn xuất sang lưới pixel runtime của dự án.
- Chỉ cần góc đang dùng trong game; hướng trái được lật ngang. Không gen thêm góc sau hoặc nhiều hướng nếu chưa được yêu cầu.
- Căn asset theo sọ, trán, tai và trục mặt/thân. Đừng căn chỉ theo bounding box; lọn nhô, cánh trang trí và hạt sáng có thể làm lệch tâm.
- Dáng có thể chéo như mẫu, nhưng khối lớn phải cân trên đầu. Không tự đổi sang chính diện để xử lý cảm giác nghiêng; thử sửa vị trí, phân bố khối và phần nhô trước.
- Giữ hình đã được duyệt khi sửa lỗi ghép. Không gen lại toàn bộ để vá khe hở, đổi offset hoặc cân nhẹ phần đỉnh.

## Tóc

- Giữ silhouette và lọn tóc đã duyệt. Đỉnh không dồn quá nhiều về phía trước, không làm sọ như chúi hoặc dài bất thường.
- Tóc vuốt ngược và tóc dựng hiện dùng `crown_shift_x: -2`. Độ dịch giảm về 0 tại `crown_until`: −51 với vuốt ngược, −48 với dựng. Đây là cấu hình riêng của hai kiểu hiện tại; không tự áp −2 cho mọi tóc mới.
- Khi cân đỉnh, giữ chân tóc và thái dương đứng nguyên. Dịch cả mảnh có thể làm hở cạnh tai hoặc che mắt.
- Trán lộ là có chủ ý; nền lọt giữa tóc và sọ là lỗi. Vùng nối phải theo hairline từng kiểu và từng dáng mặt, không dùng một dải ngang chung.
- Giữ mắt/mi mắt lộ rõ. Sinh đồng thời các biến thể mặt rộng `.w2/.w4/.w6` và kiểm tra lại vùng nối.
- Tóc đổi màu được; kiểm tra đen, vàng, trắng và màu bão hòa để tránh bóng/viền thành mạng đen hoặc bết màu.

## Mũ

- Mũ là slot riêng, đi theo đầu và có biến thể cho mặt rộng. Đội mũ chỉ che phần tóc bên trong; bỏ mũ phải trả lại tóc đã chọn.
- Tỉ lệ thử hiện tại: rộng 50px, cao 26/26/30px. Bản 56px trước đó bị nhận xét quá to. Không dùng các số này làm kích thước bắt buộc cho mọi họ mũ.
- Giữ góc chéo của mẫu; cân tâm phần thân mũ theo sọ và tránh vành nhô quá xa. Bản gần chính diện làm mất dáng và bị loại.
- Huy hiệu, đá và cánh nhỏ cần đọc được ở kích thước game. Mũ kín dùng đường che tóc theo vành; halo/vương miện hoặc mũ có vùng hở cần cách ghép phù hợp, không mặc định cắt ngang tóc.
- Lv.3 lưỡi trai có hạt vàng/cyan nhẹ 1px quanh đỉnh và đá. Hiệu ứng riêng với cánh, không blur hoặc che mặt, sinh theo pose và lật hướng. Không gộp hiệu ứng rời vào ảnh nguồn để tính kích thước.

## Pet và cánh

- Với pet, giữ nét tròn mập, đầu/body dễ thương và biểu cảm mắt/mõm. Bộ mèo thử làm đầu hẹp, thân cao, mắt nhỏ và lông phẳng hơn đã bị loại.
- Không gom màu quá tay hoặc đặt một giới hạn màu chung cho mọi vật liệu/asset. Nét sạch phải giữ được bóng, mắt và đặc điểm đã duyệt; ít màu hơn không tự động đẹp hơn.
- Cánh cần giữ nhóm lông lớn, lớp và điểm nhấn của mẫu. Chốt một bộ thử ở kích thước game trước khi làm hàng loạt; chưa coi các hướng sửa trong review là artwork đã được duyệt.
- Frame đứng/đi/đập cánh phải ổn định anchor; đầu và phụ kiện không rung ngoài chuyển động có chủ ý.

## Quy trình chốt và lưu source

1. Lấy asset đã duyệt và hình ghép trong game làm tham chiếu, ghi rõ phần giữ nguyên và phần cần thay. Khi gen tóc/mũ riêng: alpha thật, không da/mắt/body/chữ/khung; cùng góc nhìn, khoảng cách ô đủ rộng.
2. Xuất native, duyệt ở kích thước game trước và phóng ×2/×4 để bắt khe hở. Xem trên nền cỏ, cùng nhân vật mặc đồ, không chỉ xem sprite rời.
3. Kiểm tra mặt rộng, pose đứng/đi/nhịp thở, hai hướng, màu sáng/tối; với mũ kiểm tra cả tóc dựng và bỏ mũ. Dùng test phù hợp và `pnpm check`, `pnpm build` sau khi ghép.
4. Chỉ ghi nhận “đã duyệt” khi người dùng xác nhận. Nếu bản mới bị chê, quay về mốc cũ rồi sửa vùng cụ thể; không tiếp tục lấy bản bị loại làm nền.
5. Giữ ảnh nguồn được dùng, cấu hình và exporter tái tạo được trong repo. Xóa bản thử bỏ, script không dùng, file build tạm và PNG screenshot/preview dư. Ảnh kiểm tra tạm lưu ngoài repo; không để nguồn bắt buộc chỉ ở thư mục tạm.

## Búi tóc nữ dưới mũ (09/10/2026)

Người dùng từ chối bản búi rời ở screenshot 02:05:29: dịch và cắt phần gốc đã làm khác hoàn toàn búi nguyên bản. Giữ nguyên hình, tọa độ, bóng và dây buộc của tóc buộc cao từ atlas; chỉ đổi thứ tự che/hiện với mũ. Không dùng bản búi đã bị loại làm mẫu mới. Bản sửa ghép mũ hiện tại chưa được người dùng duyệt.

Ảnh 02:11:27 từ chối cách đưa búi lên trên thân mũ vì tóc làm hỏng silhouette/vải mũ. Tóc gốc phải nằm sau mũ; phần vải che tóc bên trong, chỉ lộ phần ngoài mũ. Không ưu tiên lộ toàn bộ dây buộc bằng cách tô tóc đè lên vải.

## Chốt bản ghép nữ (09/10/2026)

Người dùng xác nhận “okey push code đi” sau bản sửa lớp búi tóc: tóc/outfit v6, neo mũ nữ và mũ len nữ hiện tại được chốt để push. Búi giữ hình gốc, lớp 54 nằm sau mũ 55; thân mũ che tóc bên trong. Các ghi chú “chưa duyệt” phía trên mô tả trạng thái trong những lần thử trước; bản búi dịch/cắt và bản tóc đè lên mũ vẫn bị loại.
