# Mũ

Đọc [approved-art-rules.md](approved-art-rules.md) trước. Bản mũ đang chạy là mốc thử hiện tại, chưa có xác nhận duyệt riêng bản cuối.

Bộ thử hiện tại: mũ lưỡi trai Lv.1–3 theo bảng mẫu người dùng. Giữ góc chéo 3/4 quay phải của artwork ban đầu; engine lật ngang khi quay trái. Mũ len và phù thủy đã vẽ mới bằng imagegen; bốn họ còn lại lấy từ bảng mẫu mũ (xem mục cuối).

Nguồn raster: `art/cap-atlas-v1.png`, tạo bằng imagegen built-in. Runtime nạp `apps/game/src/assets/sprites/hats/cap/sprites.txt`; ảnh nguồn chỉ dùng để tái tạo.

Prompt đã dùng: ba biến thể mũ lưỡi trai trong ba ô ngang bằng nhau, nền alpha thật, mũ riêng không tóc/da/mặt/chữ/khung. Cùng độ rộng sọ và hướng phải, vành vươn sang phải. Lv.1 trắng/đỏ và huy hiệu đỏ; Lv.2 đen/đỏ với sao vàng; Lv.3 trắng/xanh cobalt, viền vàng, huy hiệu cyan và cánh lông nhỏ. Giữ mảng bóng pixel lớn, viền tối mảnh; không glow hay hạt rời.

Chạy từ `game` (Python + Pillow):

```sh
python3 tools/hats/build.py
pnpm check
pnpm build
```

Exporter cập nhật riêng họ `hat.cap` và sheet mũ, giữ định dạng item cũ. Native rộng 50px, cao 26/26/30px (thu nhỏ khoảng 11–14% so với bản đầu); sinh biến thể `.w2/.w4/.w6` cho mặt rộng. Palette riêng tránh bị màu tóc đổi màu mũ.

Slot `hat`, layer 55, chọn họ và cấp qua `hat`/`hatLevel`. Mũ đi cùng đầu trong pose 0–3. `hairBelow` là hàng vành mũ tính từ đầu sprite: layout chỉ clip lớp `hair` và `hairBack` phía trên hàng đó; không xóa hay thay sprite tóc. Bỏ mũ khôi phục nguyên tóc đã chọn. Mũ hở như halo/vương miện sau này không khai báo `hairBelow`, hoặc cần mask riêng nếu hình dạng không phù hợp đường vành ngang.

Duyệt native trên nền cỏ, mặt rộng, tóc dựng, hai hướng và đứng/chạy. Test kiểm tra mắt không bị mũ phủ, clip theo pose, cấp hợp lệ, save cũ mặc định không mũ và bỏ mũ khôi phục tóc. Ảnh chụp duyệt tạm không đưa vào repo.

Lv.3 có hiệu ứng `crystal`: hạt vàng/cyan 1px, sinh ở đỉnh mũ và đá, bay lên nhẹ. Emitter mũ riêng với cánh để có thể hiện cùng lúc; 6 hạt/giây khi đứng, 10 khi chạy, không dùng blur hay aura dưới chân. Vùng sinh theo pose và lật hướng, nằm trên vùng mắt.

Bản gen gần chính diện đã bị người dùng từ chối; đã khôi phục atlas góc chéo cũ. Căn mũ lệch 2px về phía sau so với bản đầu (`dx=-24` thay cho -22), nới đều vùng giữa cho mặt rộng; nén 12 cột chóp vành thành 9 cột ở 7 hàng thấp nhất để rút phần nhô 3px. Giữ nguyên thân mũ, huy hiệu, cánh nhỏ, kích thước canvas và hiệu ứng Lv.3. Đây là điều chỉnh lưới native bằng exporter, không gen lại artwork.

## Atlas riêng cho len, phù thủy, vương miện và halo

Tất cả được tạo bằng ImageGen built-in, nguồn và prompt tại `docs/art/<họ>-atlas-v1.png` / `.prompt.txt`; cấu hình ở `tools/hats/<họ>.json`. Vương miện/halo theo `docs/art/crown-halo-reference-v1.png` do người dùng gửi. Mũ len và phù thủy đã được người dùng duyệt. Vương miện/halo mới chưa được duyệt.

Chạy từ `game` (numpy, scipy, Pillow):

```sh
python3 tools/hats/sheet/export.py
pnpm check
pnpm build
```

Exporter ghi `apps/game/src/assets/sprites/hats/*/sprites.txt`, cập nhật bốn họ, giữ `hat.cap`. Len 3 cấp; phù thủy, vương miện, halo 5 cấp. Mỗi item có biến thể mặt rộng `.w2/.w4/.w6`. Các ô atlas vương miện/halo có vùng x riêng trong `regions` vì độ rộng cánh/quỹ đạo khác nhau; crop alpha thật, BOX resize và palette MAXCOVERAGE 48 màu để giữ đá/viền nhỏ. Không chia alpha lần nữa.

- Len rộng 48px, cao 28/28/33px, tâm −2 và đáy −44. Clip tóc phía trên vành.
- Phù thủy Lv.1–3 rộng 54px, cao 38/40/42px. Lv.4–5 dùng `wizard-high-atlas-v3.png` và prompt tương ứng: xanh đậm/trăng treo và trắng ngà/đá xanh/vòng vàng. Rộng 56/58, cao 43/46; neo vành hàng 39/41, clip tóc y −49. Không căn theo đáy dải vải.
- Vương miện rộng 32/36/40/50/54, cao 20/26/28/30/30, tâm −2, đáy −61. Đế nằm trên tóc; các vòm có alpha hở. Cánh trắng Lv.4–5 không làm đế rộng thêm. Không lật nguồn hoặc clip tóc.
- Halo rộng 34/36/38/44/48, cao 12/24/24/26/34, tâm −2, đáy −69. Vòng có lòng trong suốt, nổi phía trên tóc; không clip tóc.
- Hạt nhẹ 1px từ Lv.3, `crystal` cho crown/halo; phù thủy Lv.4–5 dùng `arcane`. Không blur/glow che mặt.

Đã bỏ bunny, sừng, headset, tai mèo và hiệp sĩ khỏi item, sprite, menu và random. Save cũ được sanitize về không mũ, giữ tóc; exporter dọn các họ đã bỏ để không tái xuất chúng. Danh sách cấp phụ thuộc họ đã chọn; random/save dùng cấp có thật.

Duyệt ở native và phóng lớn, mặt rộng, tóc sáng/tối, pose và hai hướng. Test/build không thay cho người dùng duyệt artwork.

## Hiệu ứng động Lv.4–5 (bản thử)

`hatLights` trong `src/features/character/_utils/effect-logic.ts` sinh điểm sáng pixel gắn với ornament theo kích thước sprite, pose và hướng. Lv.4 lóe dấu cộng 5 pixel trong một phần chu kỳ 2,4 giây. Lv.5 giữ nhịp đó và thêm: halo có hai đốm sáng chạy quanh vòng; vương miện lóe luân phiên hai cánh; phù thủy có vệt cyan/white ngắn trên vành. Không blur, không đổi source art và không thêm aura dưới chân. Hạt cũ vẫn chạy riêng.

Game và lab dùng chung hàm vẽ đốm sáng/hạt. Lab có preview phóng lớn và cảnh ×2; lớp tách riêng và dải pose giữ tĩnh để kiểm tra lưới. Test kiểm tra chuyển động theo thời gian, mirror, pose, mặt rộng và vị trí trên mắt. Đây là hiệu ứng thử theo yêu cầu “thử xem nào”, chưa được người dùng duyệt.

## Cánh trang trí đập (bản thử)

Mũ lưỡi trai Lv.3 và vương miện Lv.4–5 có 3 lưới cánh: mở, hơi cụp và cụp. Chu kỳ mở → hơi cụp → cụp → hơi cụp, 200ms/frame (800ms/vòng). Nguồn raster giữ nguyên; `tools/hats/flaps.json` lưu polygon tách cánh và pivot trên lưới native, `flaps.py` chiếu nearest-neighbour phần lông theo trục dọc quanh gốc cánh. Thân mũ, đế và đá giữ nguyên. Các frame cùng canvas, pose anchor và hairBelow; runtime dùng cơ chế frames của engine, lật toàn bộ khi quay trái. Phù thủy Lv.4–5 có dải vải, không coi là cánh để animate.

Chạy exporter cap trước, rồi sheet exporter để giữ thứ tự họ; cả hai dùng chung flaps.py/config, sinh cả biến thể mặt rộng. Kiểm tra riêng frame trên/dưới, vùng thân/đá bất động, anchor tất cả pose/hướng. Animation mới là bản thử, chưa được người dùng duyệt.

## Ghép tóc nữ dưới mũ kín

Tóc trước dùng `hairBelow` như cũ. Tóc sau nữ có `clipSpans` trên lưới native: lấy vùng bao của vành mũ rồi quét ngược lên trên; phần thoát ra sau vành được thu theo đường cong để tránh một dải tóc dựng bên cạnh mũ. Không dùng riêng silhouette chóp hẹp từng hàng vì sẽ để khối tóc trên đầu nhô cạnh chóp phù thủy. Tóc dưới vành không đổi, crown/halo không clip; mask được dùng chung bởi Canvas town và các preview provider. Bản ghép hiện tại chưa được người dùng duyệt.

## Neo mũ theo tóc nữ v6 đã thu nhỏ (09/10/2026, chưa duyệt)

Các screenshot 01:10–01:11 cho thấy nhiều họ mũ lệch phải sau khi tóc nữ được căn/thu nhỏ. Giữ nguyên sprite và neo nam; `packages/character-core/src/data/hat-fit.json` lưu offset nữ −3px theo x cho cả cap/beanie/wizard/crown/halo, áp dụng mọi cấp và biến thể mặt rộng. Không đổi góc chéo hoặc kích thước artwork.

`equippedPose` trong character-core là neo dùng chung cho layout, vùng che tóc, hạt và đốm sáng của mũ trong town/lab. Phần đuôi buộc cao ngoài mũ vẫn được giữ theo yêu cầu trước đó. Regression kiểm tra toàn bộ cấp của năm họ, mặt thường/rộng, bốn pose, hai hướng và neo nam không đổi. Bản căn mũ nữ này chưa được người dùng duyệt.

## Mũ len ôm tóc nữ và búi tóc lộ ngoài mũ (09/10/2026, chưa duyệt)

Dịch neo chung chưa đủ làm mũ len ôm tóc nữ đã thu nhỏ. `beanie.json` thêm cấu hình nữ: rộng 44 thay vì 48px, cao 26/26/31 thay vì 28/28/33px, đáy −45 thay vì −44. Exporter lấy lại cùng atlas, giữ artwork/mũ nam, sinh `.female` và `.female.w2/w4/w6`; outfit tự chọn biến thể theo giới tính và mặt. Palette nữ riêng EC00..EC5F để tránh màu mũ lưỡi trai Lv.3.

Theo screenshot 01:24:16, tóc buộc cao cần lộ búi và dây buộc ở cửa sau mũ. Bản thử dịch búi (−6,+3), cắt gốc và thêm viền riêng đã bị người dùng từ chối ở screenshot 02:05:29 vì khác dáng gốc. Bản sửa lấy nguyên phần trên của tóc buộc cao từ atlas, giữ tọa độ native, bóng và dây hồng; không dịch, cắt lại đỉnh/búi hoặc tạo viền cho mảnh tách. Phần gốc kéo tới vành để nối với đuôi gốc; item `hair.female-ponytail.tie` lớp 54 hiện cùng mũ kín, nằm sau lớp mũ 55. Nó không dùng mask của phần sọ; tóc đuôi bên dưới giữ như cũ. Bỏ mũ hoặc dùng crown/halo không thêm lớp này, dùng nguyên tóc trần. Có biến thể mặt rộng, bốn pose và hai hướng. Bản mũ len/búi tóc mới chưa được duyệt.

Ảnh 02:11:27 cho thấy lớp búi 56 đè lên thân mũ đỏ. Đã chuyển lớp búi về 54, trước mũ 55: vùng vải mũ nguyên vẹn che phần tóc nằm bên trong, chỉ phần tóc ngoài silhouette mũ lộ ra. Không khoét mũ để cố lộ dây buộc, không dịch hay đổi hình tóc. Test ghép từng pixel xác nhận toàn bộ pixel mũ kín còn ở trên cùng qua mọi cấp, frame, mặt rộng, pose và hướng. Bản ghép này chưa được người dùng duyệt.

## Chốt bản ghép nữ (09/10/2026)

Người dùng xác nhận “okey push code đi” sau bản sửa lớp búi tóc: tóc/outfit v6, neo mũ nữ và mũ len nữ hiện tại được chốt để push. Búi giữ hình gốc, lớp 54 nằm sau mũ 55; thân mũ che tóc bên trong. Các ghi chú “chưa duyệt” phía trên mô tả trạng thái trong những lần thử trước; bản búi dịch/cắt và bản tóc đè lên mũ vẫn bị loại.

## Căn riêng vương miện và halo nữ (09/10/2026, chưa duyệt)

Hai họ mũ hở bị lệch trái khi dùng chung offset −3px của mũ kín. Đối chiếu trên tóc nữ dài: chỉnh offset nữ crown/halo thành −1px (sang phải 2px so với bản trước), giữ nguyên artwork, độ cao và neo nam. Đế/vòng căn theo sọ thay vì bề ngang đuôi tóc, không thêm mask tóc. Neo dùng chung vẫn đồng bộ hiệu ứng, pose, biến thể mặt rộng và hướng.

Người dùng xác nhận “okey” với bản căn crown/halo nữ −1px trước khi chuyển sang chỉnh nhãn tên. Bản căn này đã được duyệt.
