# Bản đồ thế giới

World Map là màn chọn khu vực, tách khỏi gameplay Nông trại. Mở `/map.html` bằng `pnpm dev`; build tạo `dist/map.html`. Chỉ Nông trại có nút Vào khu; bảy khu khác hiển thị Sắp mở cửa.

## Phase 1 — panorama sạch

- Nền dựa trên `docs/art/world-map-v2.png`; 4 footprint của người, bò và chim cùng 2 footprint của cối xay/vòng quay dùng restoration plate; núi, đảo, cầu và các công trình khác giữ gốc.
- Camera cố định ở mức cover kín màn hình (ảnh 1672×941 gần 16:9, thấy đủ các khu trên màn ngang), chỉ tính lại khi resize. Không có zoom; kéo chuột/vuốt để xem phần ảnh ngoài viewport, camera chặn ở mép ảnh. Bấm nhãn hoặc phần đất mở thông tin. Vùng bấm là đa giác lõm vẽ theo đường bao, không dùng hình chữ nhật.
- Mây dùng texture RGBA riêng `world-map-clouds-v3.png`, tạo bằng imagegen tích hợp theo phong cách tranh gốc. Alpha giữ nguyên, mép texture fade mềm; trôi 1,2 pixel/giây phía sau đường núi khai báo tay trong `layers-v2.json`. Không còn lấy mây bằng phép trừ hai ảnh và mask màu. Núi, đảo và công trình giữ tranh gốc.
- Sóng dùng distance field `world-map-surf.png` theo các đường bờ và 5 cụm đá neo tay: sóng tiến vào bờ, vỡ thành bọt và tan dần; không làm méo đá/công trình. Thuyền nhỏ đổi tuyến ra vùng nước trống, cách cụm đá phía phải. Đây là hiệu ứng 2D theo nét tranh, không phải mô phỏng chất lỏng vật lý.
- Shader có trời riêng theo mask: ngày, chiều/hoàng hôn, đêm với trăng/sao. Nước chỉ thêm glint nhẹ. Đèn dùng ít điểm neo khai báo tay trong `layers-v2.json`, cần tiếp tục tinh chỉnh theo artwork khi làm Phase 2.
- Giao diện full màn hình, giữ nhãn khu, nút âm thanh/thời gian nổi và panel chọn khu. Header/footer và các panel giới thiệu được ẩn theo yêu cầu. Không giả lập tiền, radio hoặc chat khi chưa có hệ thống thật.
- Mặc định Theo giờ thực tại Việt Nam (UTC+7), chính xác tới phút và độc lập timezone trình duyệt. API lấy serverTime từ snapshot để bù lệch đồng hồ; local dùng giờ trình duyệt. Nút thời gian nổi ở góc phải cho Bình minh / Ngày / Chiều / Hoàng hôn / Đêm, kèm thanh chọn giờ để xem thử và nút Theo giờ thực để quay lại; ánh sáng chuyển mượt. Escape đóng panel, giữ camera hiện tại. UI không chịu tint của shader.

## Asset và mã nguồn

### Tải cảnh lúc khởi động

`tools/runtime/build-map-assets.mjs` chạy trong bước chuẩn bị build: xuất nền/trời WebP quality 85, mây lossless và atlas sprite lossless có padding 2px. Nguồn artwork, sprite ID, kích thước frame và các PNG mask dữ liệu giữ nguyên. Atlas bỏ các nhãn raster và công trình cũ đã được thay thế; renderer đọc các frame của atlas trực tiếp, không tải từng PNG.

Trang `/` xuất ảnh nền và preload từ HTML server để hiện trước hydration/Phaser; khi vào map qua client navigation, host cũng dùng cùng ảnh làm nền trong lúc engine tải. Phaser dùng lại URL đã preload, không tải bản nền gốc lần nữa. Tên file dẫn xuất chứa hash và URL phiên bản dùng cache immutable; sửa source sẽ tạo URL mới. Test `tools/runtime/map-assets.test.mjs` kiểm tra alpha và pixel hiển thị của từng frame khi đóng atlas, chạy trong test workspace game. Các derivative và manifest là build artifact, không chỉnh tay hay commit; cấu hình xuất và ảnh nguồn nằm trong repository.

Đo preview production với cache trống, giới hạn 10 Mbps/150ms: nền tải xong khoảng 0,9 giây, asset cảnh khoảng 2,4 giây; 21 request/~2,2MB. Đây là điều kiện kiểm thử, không bảo đảm thời gian đó trên mọi mạng hoặc thiết bị.

| Phần | File |
| --- | --- |
| Tranh gốc / ảnh mẫu HUD | `docs/art/world-map-v2.png`, `world-map-expect-v1.png` |
| Nền trời sạch | `docs/art/world-map-sky-clean-v2.png` → `apps/game/src/assets/map/world-map-sky-clean.png` |
| Export phụ | `tools/world-map/build.py`, `layers-v2.json` |
| Khu vực | `apps/game/src/features/world-map/_utils/world-zones.json` |
| Hiệu ứng / giờ / vùng bấm | `world-map-data.ts`, `world-map-logic.ts` |
| Renderer | `packages/renderer-phaser/src/world-map-view.ts`, `world-map-shader.ts` |
| Trang / HUD | route `/map`, `apps/game/src/features/world-map/` |

Từ gốc repo `musicque-farm/`, tái tạo asset Phase 1:

```sh
uv run --with numpy --with pillow python tools/world-map/build.py
```

Exporter mặc định giữ nền gốc và không chạy OpenCV. Sprite nhãn/thuyền có sẵn vẫn dùng từ `assets/map/sprites/`. Nhánh tách công trình cũ chỉ phục vụ thử nghiệm, bật bằng `--experimental-landmarks` và cần `opencv-python`; không dùng xuất bản vì còn lẫn nền trong vòng quay.

Texture dữ liệu phải **opaque RGB**, không dùng alpha làm kênh dữ liệu vì renderer có thể premultiply màu theo alpha:

- `world-map-mask.png`: R nước, G trời, B=255 thác và B=128 các tán cây/hoa được chọn.
- `world-map-zones.png`: R mã khu ×20, G độ sáng mềm trong đất.
- `world-map-lights.png`: màu và quầng sáng đèn.

Không có WebGL thì giữ ảnh tĩnh; hiệu ứng bầu trời, tint và đèn shader không có trong fallback này.

## Tiếp theo

Tiếp tục duyệt artwork công trình ở native size; nhân vật cần thêm các frame đi bộ/làm việc và tuyến đi trên mặt đất trước khi cho di chuyển xa. HUD tiền, radio và chat chờ dữ liệu và tương tác thật.

## Prompt nền trời

Sinh bằng công cụ imagegen tích hợp, tham chiếu `docs/art/world-map-v2.png`:

> Use case: precise-object-edit. Edit target: attached Chibi Town world map. Remove ONLY all white clouds from the blue sky above the mountain silhouettes, filling with the same smooth blue sky gradient. Keep EXACT framing, 16:9 aspect ratio, mountain silhouettes, mountains, distant city, all islands, buildings, bridges, forests, fairground, airport, sea and every object below the skyline unchanged. Do not move, redraw, resize, invent or remove any landscape or building. This is a cloud-free background plate for animation. No added clouds, haze, birds, text or UI. Preserve exact color and artwork style outside the cloud removal area. Output a full-frame map with clean blue sky.

Ảnh sinh rộng 1671 pixel so với 1672 pixel của gốc; exporter chuẩn hóa kích thước khi tạo mask, shader lấy mẫu UV chuẩn hóa. Chỉ phần trời được dùng trong game. Đây là bản thử, chờ người dùng đánh giá hình ảnh.

## Prompt mây v3

Sinh bằng imagegen tích hợp, tham chiếu tranh gốc; lưu `docs/art/world-map-clouds-v3.png`, dùng nguyên alpha trong `apps/game/src/assets/map/world-map-clouds-v3.png`. Prompt: tạo dải mây cumulus trắng với bóng xanh nhạt, cụm cao hai bên và mây mỏng ở giữa, phong cách vẽ tay anime của bản đồ. Chỉ có mây trên nền trong suốt; không núi, trời, nước, UI. Để khoảng trong suốt quanh bốn mép. Asset sinh vẫn chạm mép ngang, nên shader fade alpha ở 5,5% mỗi mép để không có đường nối cứng.

## Bình minh và đối tượng sống v1

Lighting có bốn trọng số riêng: ngày, hoàng hôn, đêm, bình minh. Bình minh 06:06 dùng trời hồng tím và vàng nhạt; hoàng hôn 18:00 cam ấm với mặt trời lặn phía phải. Sắc ấm tăng từ 10% lúc 14:00 lên 55% lúc 16:00 và 80% lúc 17:12 để cảnh chiều phân biệt rõ với ban ngày. Các pha nội suy theo giờ, UI giữ màu riêng. Theo giờ thực cập nhật cả đồng hồ lẫn ánh sáng; preset và slider giữ giờ xem thử đến khi chọn Theo giờ thực hoặc tải lại màn hình.

Nguồn imagegen tích hợp: `docs/art/world-map-life-clean-v1.png` (xóa riêng cô bé ở cầu thang trung tâm, nông dân/bò trong farm, chim trắng ở biển), `docs/art/world-map-life-atlas-v1.png` (bốn sprite alpha riêng theo hình tham khảo). Cấu hình `life_restore` và `life_sprites` trong `layers-v2.json` giữ vùng phục hồi, kích thước và neo. Exporter chỉ ghép các footprint nhỏ và feather mép, không dùng cả ảnh sinh làm nền.

Bản thử: cô bé và nông dân chuyển động idle nhẹ; bò dao động nhẹ tại chỗ; chim bay vòng trên nước, thay đổi nhịp cánh và hướng. Chưa có frame đi bộ, làm việc hay cúi đầu riêng; không cho người trượt trên đường bằng một pose đứng. Artwork mới đang chờ người dùng đánh giá.

Prompt restoration: remove only the tiny blue/yellow-hat girl at (795,626), farmer at (425,454), cow near (499,440), white seagull at (408,828); restore matching original paving/dirt/grass/water, preserve exact framing and every other subject. Prompt sprite: one row of four equal cells, girl / straw-hat farmer / black-white cow / white flying seagull; genuine transparent background, complete silhouettes, match reference painterly chibi style.


## Công trình chuyển động theo khu v1

- Farm: cánh cối xay RGBA quay riêng quanh trục (301,374), 3 vòng/phút. Thân tháp đứng yên.
- Giải trí: vành/nan bánh xe quay 50 giây/vòng; góc nhìn elip cố định bằng container scaleX 0,82. 12 cabin chạy theo vành nhưng luôn giữ hướng thẳng, chỉ đung đưa 2 độ. Đèn vành cũng xoay theo bánh xe. Chân đỡ giữ trong restoration plate.
- Sân bay: máy bay riêng chạy theo hướng đường băng, tăng tốc, nâng độ cao, khuất dần rồi quay lại hạ cánh; bóng, đèn cánh và ánh sáng thời gian đồng bộ. Một chu kỳ 80 giây.
- Trường học: shader chỉ làm vải cờ gợn nhẹ trong footprint, giữ cột/mái cố định. Rừng: thác chảy xuống, sương chân thác/lá/đom đóm. Trung tâm và khu nhà: sửa neo đài phun nước vào hồ, thêm vòng gợn lan và tan dần. Cảng: giữ thuyền/vệt nước và hải đăng quay ban đêm.

Nguồn tạo bằng **imagegen tích hợp**, đang ở trạng thái prototype chờ người dùng đánh giá: `docs/art/world-map-landmarks-clean-v1.png`, `world-map-mill-rotor-v1.png`, `world-map-ferris-rim-v1.png`, `world-map-ferris-cabin-v1.png`, `world-map-airport-plane-v1.png`. Exporter giữ alpha của sprite, crop theo alpha bbox và resize theo `landmark_sprites` trong `layers-v2.json`; tạo `assets/map/world-map-landmarks.json`. Chỉ ghép hai footprint có feather 4px từ plate, không thay toàn bộ panorama. Không dùng sprite cối xay/vòng quay/máy bay tách kiểu cũ.

Prompt set (built-in):

1. Clean plate: preserve exact map composition; remove only four windmill blades around (306,372), keep tower; remove Ferris rim/spokes/cabins around (446,635), keep two supporting legs, restore matching trees and path.
2. Rotor: isolate four red-orange wooden/cream-canvas blades, symmetrical diagonal X and central axle, no tower/background, genuine RGBA transparency, match reference painterly map.
3. Wheel: circular golden rim with slim spokes and blue-gold hub, rotational symmetry, transparent gaps, no cabins/legs/background, match reference map.
4. Cabin: one upright gondola with orange-yellow roof, red shell, blue window and hanging bracket, painterly reference style, transparent background, no wheel.
5. Plane: one white-blue passenger jet, isometric above, nose lower right along runway, clean transparent silhouette, no halo, fog, cast shadow, logos or text.


## Cư dân, sân bóng, cây và hải đăng v1

Thêm 31 cư dân trên 10 tuyến polyline ở cả 8 khu: người có frame bước chân, đổi hướng và nghỉ 2 giây ở hai đầu. Tuyến đi được chọn trên đường/đường mòn/cầu tàu, không dùng vòng elip xuyên công trình. `walkRoute` trong world-map-logic.ts xử lý vị trí và nghỉ, có test liên tục qua góc và kiểm tra bàn chân trên các vùng mặt đường độc lập. Đội đỏ/xanh mỗi bên 3 cầu thủ, chuyền bóng lần lượt giữa các vị trí trong sân và chạy ngắn về phía bóng. Farm có 5 gà với các frame đi, đứng và mổ thóc. Nông dân, cô bé và bò gốc được thay bằng sprite đi lại trên các tuyến riêng; nguồn mới đang là prototype chưa duyệt.

Nguồn imagegen tích hợp: `docs/art/world-map-walker-atlas-v2.png` (4 ô bước đi) và `world-map-hen-atlas-v1.png` (đứng, 2 bước, mổ). `motion_atlases` trong layers-v2.json lưu kích thước/frame và 4 bảng màu áo; exporter giữ alpha, chung tỉ lệ và điểm chân, chỉ thay bảng màu phần áo đỏ để tạo blue/gold/green. Runtime dùng PNG RGBA riêng, không dùng người/gà procedural kiểu cũ.

Các tán lá/hoa được neo bằng `canopies`, chỉ lấy màu thực vật trong footprint để tránh mái/trunk. Mask B=128 điều khiển gợn nhỏ dưới 1px và ánh lá; thác giữ B=255. Có thêm lá ở quanh trường/khu nhà. Đài phun có 6 tia nước cong, nhịp cao thấp và vòng gợn trong hồ; kết cấu đài/hoa trong tranh không bị kéo méo.

Hải đăng bỏ tam giác Graphics cạnh cứng. Shader dùng quét gaussian theo phối cảnh, falloff theo khoảng cách, lens glow/star nhỏ ở đèn; phản chiếu đứt đoạn bị clip bằng mask nước, bắt đầu dưới chân tháp. Cả hai đèn lên dần vào chiều/đêm và nhạt ở bình minh.

Prompt walker: one row four equal cells, same brown-haired chibi boy/red shirt/navy shorts, 3/4 facing right from slightly above; consecutive walking poses/opposite arms, fixed size and soles baseline; painterly map style, transparent, no ground/shadow/grid/text. V2 targeted third-cell opposite-leg stride; source remains prototype with two main leg silhouettes. Prompt hen: same cream-white/red-comb farm hen, one row four cells stand/left step/right step/peck, fixed feet baseline, transparent, match map style.


## Rà mặt đường và chuyển động v2

Các ảnh người dùng gửi cho thấy kiểm tra ranh giới khu không đủ: tuyến cũ ở fun/port đi trên thành cầu bên dưới mặt sàn. Rà lại ảnh gốc với lưới tọa độ, sửa tuyến ở cả farm/forest/school/center/fun/homes/airport; tuyến cảng đi giữa mặt cầu tàu. `world-map-walkways.json` lưu riêng 11 vùng mặt đường/cầu sàn/đồng cỏ/sân bóng, vẽ độc lập theo tranh. `walkableAt` kiểm tra tâm và bốn điểm quanh bàn chân; renderer không cập nhật vị trí ra ngoài mặt đường. Test lấy mẫu cả chu kỳ và giữ các điểm nước/thành cầu (891,728), (390,722), (422,730) làm regression.

Bấm khu (kể cả sân bay) chỉ mở panel, không tự zoom/pan. Đóng panel/Escape cũng giữ camera. Bản hiện tại bỏ wheel zoom và nút Toàn cảnh; giữ mức cover khi kéo chuột/vuốt, chặn camera ở mép ảnh.

Người nông dân/cô bé ở quảng trường chuyển sang atlas có bước đi; bò đi chậm trong ô cỏ và dừng cúi đầu. Nguồn built-in imagegen: `world-map-farmer-motion-v1.png`, `world-map-girl-motion-v1.png`, `world-map-cow-motion-v1.png`, `world-map-cow-graze-v2.png` trong docs/art. Crop/scale/foot anchor khai báo bằng motion_atlases và life_sprites của layers-v2.json; graze v2 thay riêng frame bị sát mép/cắt mặt. Các atlas có hai pose bước chính; chưa phải motion capture hay tám hướng. Nguồn đang là prototype chờ người dùng duyệt.

Prompt set: tham chiếu life-atlas-v1, tạo từng nhân vật riêng theo hàng bốn ô: đứng / bước / bước đối chân / đứng (bò: đứng / bước / bước / cúi đầu), giữ quần áo/nhận diện/phong cách, chân cùng baseline, full silhouette, alpha thật, không nền/bóng/UI. Grazing correction: one full cow head down, complete muzzle/hooves/tail, at least 15% transparent margin, preserve identity, mouth near hoof baseline.

Tán cây/hoa được mở rộng thêm 20 vị trí quanh các khu, wind trong footprint khoảng 1,8px, giữ mặt đất/thân và công trình cố định. Lá bay, thác, tia nước, chim, thuyền, cối xay, vòng quay, máy bay và đèn giữ hệ thống riêng. Chưa tách mọi cây/con vật baked vào panorama: đây là chuyển động môi trường và các vật thể đã có sprite riêng, không phải toàn bộ tranh biến thành mô phỏng 3D.

Bản v2 trước khi bỏ zoom: wheel zoom giữ world point dưới con trỏ bằng tính tâm camera trực tiếp; không đọc lại getWorldPoint ngay sau setZoom vì transform chưa được Phaser cập nhật. Kiểm tra UI: bấm nhãn sân bay giữ toàn cảnh, đóng panel giữ camera, wheel ở farm/port/fun/airport giữ điểm neo và không hở nền.


## Âm thanh và camera cố định

Camera chỉ thay đổi tỉ lệ khi viewport resize để phủ kín màn hình; wheel không đổi zoom; drag/vuốt di chuyển camera trong biên ảnh. Chọn khu chỉ mở panel. Nút Toàn cảnh và lời nhắc zoom đã bỏ.

Nhạc gốc “Một vòng Chibi Town”: 100 BPM, 32 ô nhịp, vòng lặp 76,8 giây, piano gảy/bell/sáo tổng hợp và bass/brush nhỏ. Không dùng sample hay bài nhạc tải ngoài. Score và bộ tổng hợp deterministic lưu tại `tools/world-map/music-score.json` và `build-music.py`; MP3 runtime nằm ở `apps/game/src/assets/map/audio/chibi-town-loop.mp3`. Export lại bằng `uv run --with numpy python tools/world-map/build-music.py` (cần ffmpeg). Đuôi âm vang được wrap vào đầu vòng PCM; loopEnd bỏ padding bộ mã hóa.

`packages/game-audio/src/index.ts` quản lý Web Audio dùng chung, độc lập với renderer Phaser; shell ở `application/game-application.tsx` sở hữu lifecycle: lần pointerdown/Enter/Space đầu tiên mở khóa, nhạc fade-in; click/chọn khu/đóng/vào khu có motif sine ngắn. Không phát tiếng khi hover. Nút góc trái tắt cả nhạc/SFX, nhớ tùy chọn bằng localStorage; vẫn chạy nếu storage bị chặn. Khi tab ẩn thì dừng nguồn nhạc/suspend context; trở lại tiếp tục từ vị trí cũ. Khi HMR dispose thì bỏ listener và đóng context. Tải nhạc lỗi có thể bấm thử lại, không chặn tương tác bản đồ.

Kiểm tra UI: chọn sân bay khởi động nhạc (`data-state=playing`), cuộn 8 lần không đổi zoom, mute/reload vẫn tắt, bật lại phát nhạc. Test lifecycle gồm concurrent unlock chỉ tạo một loop, mute giữa lúc decode, retry khi offline, pause/resume giữ offset và dispose trong lúc tải. Nguồn art prototype và giới hạn animation của phần trên giữ nguyên.


## Nhãn khu v3 và cân bằng âm thanh

Thay toàn bộ bảng gỗ raster bằng card vector màu giấy kem, viền champagne mảnh, icon đường nét chung 24px trong huy hiệu màu theo khu. Chữ Trebuchet/system được Phaser render ở resolution 3, không crop chữ từ ảnh. `world-map-label-view.ts` lưu toàn bộ hình vẽ gốc; tham khảo hướng marker cartoon màu kem ở https://www.colorosse.com/assets/2d/ui/candy-map-markers, không tải/dùng asset của pack. Kích thước giữ theo màn hình; hover tăng 5% nhẹ, bỏ lắc liên tục. Container có hit area đúng chiều rộng/chiều cao và vẫn callback chọn khu.

Nhạc gain từ 0,32 xuống 0,24; effect gain từ 0,16 lên 0,32. Khi phát SFX thì nhạc hạ tới 0,10 trong 25ms rồi trở về 0,24 ở 480ms; âm click rõ hơn mà không tăng đỉnh quá mạnh. Mute/visibility/dispose tiếp tục dùng lifecycle cũ.

### Kéo map khi đã bỏ zoom

Giữ tỉ lệ cover; kéo chuột hoặc vuốt một ngón để xem phần bị cắt trên màn hình hẹp. Kéo không mở panel chọn khu, kể cả khi bắt đầu ở nhãn. Camera chặn ở cả hai mép, không hở nền. Canvas dùng `touch-action: none`; thả ngoài canvas kết thúc thao tác kéo. Màn hình vừa đủ toàn ảnh sẽ gần như không có khoảng để kéo.
