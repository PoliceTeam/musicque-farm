# Cổng nông trại và thăm bạn bè

`/farm`, `/farm.html` và điểm đến farm từ bản đồ mở màn cổng trước. Cổng FARM dẫn đến `/farm/home`; thoát farm trở về cổng. Mũi tên bên trái mở Thăm bạn bè / Lịch sử bị trộm. Mũi tên bên trái mở thăm bạn bè, cổng FARM vào farm riêng và mũi tên dưới cửa hàng mở thông tin cửa hàng đang chuẩn bị. Cửa hàng chưa có mua bán; quầy market là cảnh trang trí. Tái sử dụng hai NPC cửa hàng (cây trồng và đồ ăn) làm nhân vật chào đón; chưa có giao dịch riêng cho họ.

Cảnh dùng Phaser, header `LocationLayout` dùng chung và các nguồn scenery chung. Các công trình được cắt riêng từ atlas người dùng gửi, lưu nguồn tại `tools/farm-entrance/source-atlas.png`, cấu hình tại `assets.json`, xuất lại bằng `python3 tools/farm-entrance/export-assets.py`. Runtime chỉ dùng WebP. Bố cục triển khai đầu đã bị người dùng từ chối vì khác hoàn toàn kỳ vọng. Không dùng screenshot của bản này làm chuẩn mỹ thuật. Ảnh tham chiếu #1 và #2 người dùng cung cấp là chuẩn cho bố cục quảng trường, mật độ cảnh vật, tỷ lệ công trình và UI gỗ trang trí; atlas #3 là nguồn mảnh ghép, không thay thế bố cục tham chiếu.

Danh sách chỉ hiện bạn bè đã chấp nhận từ máy chủ. Bản local một người chơi không tạo bạn giả. Chọn một bạn mở `/farm/home?owner=<player-id>`; chỉ xem và trộm cây chín, không mở công cụ sửa farm của chủ nhà.

Luật ban đầu: mỗi ô cây chín chỉ mất 1 nông sản trong một vụ, tính chung cho mọi người ghé thăm. Chủ nhà thu hoạch phần sản lượng còn lại; gieo vụ mới xóa dấu đã bị trộm. Nông sản lấy được vào kho của khách; kho đủ loại hàng thì từ chối. Lịch sử giữ 100 lượt gần nhất của farm bị trộm.

SDK có `getFarmVisit`, `stealFarmCrop`, `getFarmTheftHistory`. HTTP tương ứng `GET /farms/:ownerId`, `POST /farms/steal`, `GET /farms/thefts`. ID khách lấy từ phiên đăng nhập. Snapshot thăm farm không chứa ví, kho, hạt giống hay receipts của chủ nhà. Server kiểm tra tình bạn đã chấp nhận, khóa hai tài khoản/tài liệu theo thứ tự ID và lưu cả hai trong một transaction. Luật chuyển sản lượng nằm trong `packages/game-service/src/farm/farm-social-service.ts`. Request ID chống xử lý lặp; `wateredAt` đảm bảo thao tác từ vụ cũ không lấy cây của vụ mới.


## Bản dựng lại theo ảnh tham chiếu mới

Cảnh 1600×740 dùng toàn bộ bố cục trên màn ngang, không camera crop vào nhân vật. Màn dọc có thể vuốt ngang qua cùng một cảnh, khởi đầu ở cổng FARM. Trên màn ngang, giữ toàn bộ cảnh theo tỷ lệ gốc; màn dọc lấp đầy chiều cao và vuốt ngang. Không còn hai nút nổi dưới màn hình; vùng bấm DOM có nhãn truy cập đặt theo cùng dữ liệu với mũi tên Phaser. Cửa hàng và thăm bạn bè là hai action độc lập, ở tọa độ riêng. Header tiếp tục dùng LocationLayout/ProfileMenu chung, với skin riêng của màn này. Tài nguyên nguyên bản được tái sử dụng từ nguồn farm qua acquireSceneAssets; các props mới dùng registry scenery chung.

Nguồn art và mô tả prompt mới nằm tại `tools/farm-entrance/source-art/`. Bản dựng mới chờ người dùng đánh giá; build/test thành công không phải phê duyệt mỹ thuật.


## Lần chỉnh theo bộ ảnh người dùng gửi

Tái sử dụng cây thu, cây xanh, mây, NPC và đèn từ các map hiện có; thêm chiều sâu bằng hàng cây xa có phủ màu khí quyển. Đường chính nối liền lối cổng FARM và cửa hàng; texture đất/cỏ phản chiếu thành tile 2×2 để tránh đường nối màu. Hàng rào thấp, bồn hoa và cầu thang đóng khung tiền cảnh. Nhân vật và các props sắp theo chân; mũi tên dùng chung tọa độ với vùng bấm DOM. Khung menu và nút giấy cắt từ atlas gốc, dùng border-image để giữ góc trang trí khi đổi kích thước. Nguồn xuất thêm nằm trong `tools/farm-entrance/assets.json`; không dùng ảnh toàn cảnh làm nền runtime.

Kiểm chứng cơ chế bổ sung tại `apps/api/tests/farm-social.test.ts`: cây đang lớn bị từ chối; kho chủ nhà giữ nguyên sau khi bị trộm; hai bạn cùng trộm một ô chỉ một người thành công; gửi lặp không nhận thêm; thu hoạch phần còn lại; vụ mới cho phép trộm lại nhưng từ chối timestamp vụ cũ. Giới hạn hiện tại vẫn là **1 nông sản/ô/vụ cho tất cả khách**, chưa phải 1 lần cho mỗi bạn. Bộ test dùng HTTP adapter và PGlite; không thay thế kiểm thử tải trên PostgreSQL nhiều process.

Bố cục và UI mới đang chờ người dùng đánh giá mỹ thuật.


## Điều chỉnh theo phản hồi: đồng bộ farm chính

Người dùng yêu cầu dùng popup cũ và style cùng farm chính. Sảnh đã bỏ skin header/menu atlas riêng, dùng lại `LocationLayout`, `Dialog` và `Button` mặc định (có tiêu đề/nút đóng). Nền dùng đúng màu đất/cỏ và cách phủ texture nhỏ của `farm-style-view.ts`; cây bốn màu, hàng rào, bụi và hoa dùng cùng nguồn farm. Bỏ nền cỏ vàng chi tiết, trời xanh bão hòa và cây phóng quá lớn của lượt trước. Bản khung gỗ trang trí trước đó không phải hướng được duyệt.


## Atlas mới và bố cục tham chiếu thứ hai

Nguồn người dùng cung cấp được giữ nguyên ở `tools/farm-entrance/source-art/country-v2-atlas.png` và `country-v2-layout.png`. Cấu hình cắt ở `tools/farm-entrance/country-v2.json`; chạy `python3 tools/farm-entrance/export-assets.py` để tái xuất (hoặc `export-country-v2.py` chỉ cho bộ mới). Exporter lọc alpha dưới 140 và giữ cụm liên thông chính để loại mảnh hình hàng xóm; cổng có polygon loại phần cây dính vào góc trái. Bụi bị cây che mất cạnh trong atlas được bỏ khỏi bộ xuất, không ghép một mảnh bị cắt cụt vào cảnh.

Cây, hàng rào trắng, hoa, bụi, đá và gỗ là scenery chung dưới ID `scenery:farmstead-*`; công trình và hai NPC đứng chào giữ ở assets/farm-entrance. Không thay nhân vật người chơi hoặc biến các góc NPC thành sprite di chuyển. Cảnh ghép độc lập ở kích thước 1600×620, có hai lối nối vào đường ngang, cây lớn ở hai mép, cây nhỏ cách nhau phía xa, viền cỏ/đá thay hàng rào tiền cảnh. Không dùng screenshot mẫu làm nền phẳng. Màu đất và cách phủ texture cỏ dùng lại từ farm chính; UI header/popup tiếp tục dùng mặc định, theo yêu cầu trước đó. Tọa độ portal dùng chung cho render và DOM; giới hạn đi bộ được cập nhật theo đường mới.

Bản ghép mới đã xem ở kích thước thực và phóng lớn, còn chờ người dùng đánh giá mỹ thuật.


## Rà lại theo screenshot màn ngang của người dùng

Bản trước bị người dùng từ chối do khung cảnh không lấp đầy cửa sổ (thừa nền trên/dưới và lộ đường nối trời), tên nhân vật sai màu/sát đầu, và hàng rào tràn qua lối vào. Không dùng ảnh tổng hợp trước làm bằng chứng kiểm tra bố cục responsive.

Sảnh hiện giữ chiều rộng thiết kế 1600 nhưng tính chiều cao renderer theo kích thước phần tử thật; nền lấp đầy màn, props giữ nguyên tỷ lệ hình và neo theo chân, tọa độ bấm quy đổi về cùng thiết kế 1600×620. Canvas riêng cho mỗi đoạn rào giới hạn đúng phần vườn để chừa hai lối vào. Tên dùng chung `game/rendering/avatar-label.ts` với TownView của farm: `LV <level> <name>`, màu vàng `#ffe066`, cùng font/stroke của renderer, neo trên toàn bộ outfit và cách 14 đơn vị khỏi đỉnh tóc/mũ. Header dùng cùng dòng cấp nhân vật/cấp farm như farm chính. Kiểm tra trực tiếp trên Chrome màn ngang và trình duyệt trong app màn dọc; chưa có phê duyệt mỹ thuật của người dùng.

## Shared map nameplates

Farm, farm entrance, TownView and location street/interior views all call `game/rendering/avatar-label.ts`. Location views no longer use a separate fixed `y - 78` anchor. Equipment-aware clearance, player/remote colors and font size come from one policy. `MAP_LABEL_STYLE` in render-contracts owns the renderer font, size, stroke and sampling policy. Phaser text uses one fixed raster resolution and nearest filtering, independent of device pixel ratio and scenery smoothing; its scale compensates for camera zoom so text stays 14 CSS pixels. Shared headers and dialogs continue through LocationLayout and the UI package.

Verified the common labels in actual browser captures on farm/home, farm entrance and shopping street. Camera-scale regression covers zoom 1, 2 and 3.25; equipment clearance covers bare heads and tall hats. This is implementation verification, not user approval of the artwork.

## Portal hover and text rendering performance

Removed native title tooltips, visible hover/active backgrounds and the separate focus tooltip from entrance portal hit areas. Accessible names and keyboard focus outlines remain. Actual browser inspection confirmed the home portal matched `:hover` while its background was fully transparent and its title attribute was absent. Verified walking, opening/closing the friends menu and entering/returning from the main farm.

The shared Phaser label renderer previously called TextStyle.setColor and setShadow every frame. The installed Phaser source unconditionally calls updateText from both setters, even for unchanged values; Phaser's official text guide documents canvas rebuilds and GPU texture uploads on text/style changes: https://docs.phaser.io/phaser/concepts/gameobjects/text . Cache text/font/color/shadow per pooled Text instance, set the constant stroke once and read the canvas bounds once per frame for all labels. Regression exercises 120 moving frames without repeating style/text setters, then changes and removes styles to verify invalidation. Full check and production build pass. These checks establish the removed redundant work; they do not constitute an FPS benchmark on the user's Chrome session.

## Fence and gateway continuity correction

The previous farm-style entrance placed the gate and shop below an uninterrupted rear fence and left a south road ending against the foreground flower/stone border. This was rejected by the user. Rear rails now use shared `ENTRANCE_FENCE_SEGMENTS` at the same baseline as the gate/shop. Each rail is clipped to its exact span. Friends enter through a real 110-unit opening on the left, framed with two lantern posts and a soil approach; trees and bushes are excluded from gateway centers. Gate posts and shop walls meet the neighboring rails. The lower lawn is one continuous bed through the south border, with no path cut behind the foreground wall. Tests assert that every entrance arrow has a fence/grass opening and that the lower lawn remains continuous. Production build passes. Browser verification of this iteration was unavailable because local browser use was disabled in Work settings; do not treat earlier screenshots as evidence of this version.

## Dựng lại theo atlas và ảnh bố cục mới — 18/10/2026

Bản hiện tại thay thế bố cục farm-style tối ở trên. Cảnh vẫn 1280×720 và dùng header/dialog chung; trời ban ngày, mây, núi và hàng cây xa là các lớp độc lập từ atlas #3 mới. Cây thu lớn đóng khung hai mép, cổng ở trái, bảng tin ở giữa, cửa hàng và chợ ở phải theo ảnh #2. Đường ngang nối hai lối vào thật, hàng rào trắng dừng trước lối cổng/cửa hàng; viền cỏ, hoa và đá thấp thay bức tường tiền cảnh. Các props giữ tỷ lệ nguồn, sắp lớp theo chân. Nhân vật người chơi và nhãn tên dùng cơ chế chung hiện có.

Nguồn giữ nguyên tại `tools/farm-entrance/source-art/country-v3-atlas.png`; `country-v3-layout.png` chỉ làm tham chiếu và không tải trong runtime. Cấu hình cắt `tools/farm-entrance/country-v3.json`; chạy `python3 tools/farm-entrance/export-assets.py` hoặc `export-country-v3.py` để tái xuất WebP. Scenery dùng ID chung `scenery:farmstead-*`; các công trình giữ trong feature. Hai NPC tĩnh tiếp tục dùng nguồn hiện có. Không tạo lại artwork nhân vật.

Bảng nhà cộng đồng bên phải mở menu bạn bè, bảng tin mở lịch sử, cổng vào `/farm/home`, cửa hàng mở popup thông tin đang chuẩn bị. Mũi tên và các vùng bấm DOM theo cùng `ENTRANCE_TARGETS`. Trên màn dọc, camera đi theo nhân vật để đi ngang qua toàn cảnh; header và các popup vẫn vừa màn hình.

Đã review trực tiếp trình duyệt ở 1280×720 và 390×844, thử di chuyển camera đến cổng trên mobile, popup cửa hàng, bảng cộng đồng, lịch sử và điều hướng vào farm chính. `pnpm check` và production build thành công (preview local với `NEXT_PUBLIC_API_URL=''`, không sửa cấu hình môi trường). Bản mỹ thuật mới chờ người dùng đánh giá.

### Tinh chỉnh viền cỏ và mũi tên

Người dùng xác nhận bố cục country-v3 là bản ổn nhất. Giữ bố cục này; bo mềm góc bãi cỏ, thêm viền cỏ thấp xen vài hoa nhỏ từ chính assets hiện có, thay đổi nhẹ kích thước/khoảng cách để che mép ghép thô. Viền được vẽ vào terrain một lần khi khởi tạo. Hai mũi tên nằm ngay lối vào cổng và trước cửa hàng, sát chân công trình. Người dùng từ chối cách đặt trên đỉnh cổng/mái; không dùng vị trí đó làm chuẩn. Bảng bạn bè giữ nguyên.

### Lối thăm farm bạn bè và rương

Sửa crop rương từ `[1353,674,1470,783]` thành `[1350,672,1487,785]` để giữ đủ mép phải của silhouette gốc. Rương dịch nhẹ sang trái để không chắn lối mới. Lối thăm bạn bè nằm ở khe hàng rào trái, x=130–200; dùng hai asset đầu rào đầy đủ quay rail ra ngoài theo ảnh người dùng. Đồng bộ khe rào, đường đất, mũi tên và vùng bấm; di chuyển cây/hoa tránh cửa mở. Mũi tên tại khe rào mở trực tiếp danh sách thăm bạn bè. Bảng nhà bên phải chỉ còn trang trí; nút bạn bè trên header vẫn mở menu chung. Các mũi tên cổng riêng và cửa hàng giữ tại chân công trình.

### Cân tỷ lệ NPC

Hai NPC tĩnh được tăng kích thước hiển thị, giữ nguyên artwork và baseline: farmer rộng 35→49 (cao khoảng 53), gardener rộng 43→54 (cao khoảng 56), tương đương chiều cao nhân vật người chơi khoảng 54 world units. Không thay tỷ lệ công trình hoặc vị trí mũi tên/lối vào.

Người dùng xác nhận hoàn tất bản hiện tại và yêu cầu push code ngày 18/10/2026. Bố cục, viền cỏ, rương, lối thăm bạn bè, vị trí mũi tên tại lối vào và tỷ lệ NPC hiện tại là mốc đã được chấp nhận.
