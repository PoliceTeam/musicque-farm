# Kế hoạch Nông trại Chibi Town

Bản đề xuất ngày 10/10/2026. Mục tiêu: map nông trại có nhân vật đi lại, tài nguyên giới hạn và nâng cấp được; vòng chơi trồng trọt, chăn nuôi và ao cá. Tài liệu này là kế hoạch để chốt trước khi triển khai, chưa phải tính năng đã làm. Các con số dưới đây là cấu hình thử nghiệm của Chibi Town, không phải số liệu Avatar đã xác nhận.

## 1. Yêu cầu và hiện trạng

Yêu cầu đã xác nhận từ người dùng:

- Góc nhìn và cách tổ chức gần các ảnh Avatar: đường đất, ruộng xếp hàng, khu nuôi, ao, công trình và nhân vật chibi; được custom hình ảnh.
- Ban đầu giới hạn ô đất, đơn vị chăn nuôi và ao; có khả năng mở rộng/nâng cấp. Người dùng bổ sung: tổng ô đất trong Avatar là 48; Chibi Town phải bố trí đủ 48 ô tối đa. Đây là thông tin người dùng cung cấp, chưa xác nhận độc lập từ server/source.
- Nhân vật phải cân đối với ô đất, đường và công trình; không quá to hoặc quá nhỏ.
- Có đất khô cằn, xới đất, gieo hạt, tưới; cây tăng trưởng, phân bón và sâu bọ.
- Map có chuyển động hợp lý, đối tượng đi trong đúng vùng, vật thể che nhân vật đúng.
- Phải có kế hoạch chi tiết trước khi build.

Dự án hiện có World Map, nhân vật/trang bị, di chuyển và một farm prototype vẽ cảnh. `farm-view.ts` hiện đặt cây trang trí theo hàng, chưa lưu từng ô đất có trạng thái gameplay. `town-logic.ts` quản lý người/NPC, không có mô hình cây, kho, chăn nuôi hay ao. Không coi hình cây đang hiện là cây đã có gameplay.

## 2. Đối chiếu source Avatar

Đã đọc repository [itdat/avatar-j2me](https://github.com/itdat/avatar-j2me), commit `01483558845078c1aabb584973e142afae314408`. Đây là client dịch ngược, có nhiều tên obfuscate. Không có đủ server để xác nhận toàn bộ công thức kinh tế/tăng trưởng.

| Nguồn | Xác nhận được | Dùng cho Chibi Town |
| --- | --- | --- |
| [StringEntity.java](https://github.com/itdat/avatar-j2me/blob/01483558845078c1aabb584973e142afae314408/src/avatar/StringEntity.java#L385) và tutorial phía cuối file | Làm đất, tưới, gieo, chăm sóc/phân, thu hoạch; kho, bếp; vật nuôi có đói, mệt, bệnh, sản phẩm sữa/trứng; tutorial nhắc ao và nâng cây khế | Danh sách tương tác và hướng dẫn. Không suy ra giá/thời gian từ chuỗi UI |
| [go.java](https://github.com/itdat/avatar-j2me/blob/01483558845078c1aabb584973e142afae314408/src/avatar/go.java#L267) | Menu ô đất phụ thuộc cây/trạng thái; nâng cấp ô có điều kiện; kiểm tra kho vật phẩm; thao tác chăm sóc có thể dẫn người tới đối tượng | Menu theo trạng thái, kiểm tra điều kiện và hành động có vị trí |
| [cf.java](https://github.com/itdat/avatar-j2me/blob/01483558845078c1aabb584973e142afae314408/src/avatar/cf.java) | Mỗi ô có dữ liệu riêng, level, cây/frame, thời gian, chỉ số và các cờ; vẽ thanh/timer cho ô được chọn | Tách trạng thái từng ô; hiện timer có chọn lọc. Chưa đặt tên chắc chắn cho mọi cờ |
| [Farm.java](https://github.com/itdat/avatar-j2me/blob/01483558845078c1aabb584973e142afae314408/src/avatar/Farm.java#L87) | Dùng vật phẩm và thu hoạch gửi command với chủ farm, vị trí và item | Thiết kế command riêng, không cập nhật tiền/kho trong renderer |
| [ai.java](https://github.com/itdat/avatar-j2me/blob/01483558845078c1aabb584973e142afae314408/src/avatar/ai.java) | Vật nuôi có tuổi/thời gian, chỉ số, nhu cầu/cờ bệnh, loại và animation | Cây và vật nuôi có mô hình riêng; không dùng NPC trang trí thay cho vật nuôi gameplay |
| [kz.java](https://github.com/itdat/avatar-j2me/blob/01483558845078c1aabb584973e142afae314408/src/avatar/kz.java#L474) | Nhận cập nhật cây/vật nuôi từ server; nhánh cập nhật khu nuôi/ao, nâng level ô, tiền và thời gian công trình | Local prototype trước; khi online, server quyết định trạng thái và giao dịch |
| [gb.java](https://github.com/itdat/avatar-j2me/blob/01483558845078c1aabb584973e142afae314408/src/avatar/gb.java) và [cb.java](https://github.com/itdat/avatar-j2me/blob/01483558845078c1aabb584973e142afae314408/src/avatar/cb.java) | Catalog/ảnh cây và dữ liệu farm được tải/cache; metadata có thời gian và frame | Catalog cấu hình riêng với save người chơi, không hard-code từng cây trong view |

Chưa xác nhận đầy đủ: số ô mặc định, giá từng cấp, thời gian cụ thể, tỷ lệ sâu/bệnh, tác dụng chính xác của từng phân, cơ chế hết hạn/chết và toàn bộ ý nghĩa packet. Không gán các số Chibi Town dưới đây là công thức Avatar. Bếp, cây lâu năm, farm bạn bè và ATM có dấu vết ở source nhưng để giai đoạn sau.

## 3. Bố cục map và hướng hình ảnh

Hai không gian: khu dịch vụ chung và farm cá nhân. Bản đầu ưu tiên farm cá nhân; cửa hàng có thể mở bằng panel/NPC tại cổng, chưa cần dựng đầy đủ map dịch vụ riêng.

```text
           CẢNH XA / HÀNG RÀO / CÂY VIỀN
  [Nhà kho]     [Ruộng chính + ô mở rộng]   [Cây lâu năm dự phòng]
  ----------- đường chính / các nhánh ----------
  [Khu gia súc] [Sân và khu gà/vịt]        [Ao + phần mở rộng]
  ----------- đường về cổng / NPC bán hàng ------
                    [Về World Map]
```

- Dùng thế giới có tọa độ riêng; lấy 1280×720 hiện tại làm khung blockout ban đầu, mở rộng dữ liệu map nếu bố cục cần. Không kéo giãn nhân vật để lấp viewport.
- Góc nhìn từ trên xuống hơi nghiêng, nhà nhìn trực diện, ruộng chữ nhật; không chuyển sang ruộng hình thoi isometric.
- Phong cách pixel chibi có cụm màu rõ, hợp nhân vật hiện tại; không lấy panorama painterly World Map làm nền tương tác nguyên khối.
- Bố trí dự kiến bốn cụm 12 ô (mỗi cụm 4×3), tổng 48 ô; chừa lối đứng/tương tác giữa các cụm. Cách xếp này là đề xuất Chibi Town, không khẳng định đúng bố cục Avatar. Không bắt toàn bộ 48 ô phải nằm trong một viewport nếu điều đó làm nhân vật quá nhỏ.
- Kiểm tra tỉ lệ bằng cùng một cảnh có nhân vật mặc đồ mặc định, đội mũ/đeo cánh, một ô đất, cây ở các giai đoạn, hàng rào và cửa nhà. So sánh ít nhất ba mức scale quanh tỉ lệ hiện tại trên desktop và điện thoại ở kích thước chơi thật; chọn một mức làm baseline sau khi người dùng xem. Scale đồng bộ trang bị/bóng/hiệu ứng; nhãn tên và vùng chạm giữ rõ trên màn hình. Không chốt số scale chỉ từ ảnh phóng lớn.
- Đường chính rộng đủ hai nhân vật; mỗi cụm ruộng có điểm đứng tương tác ở cạnh và lối tiếp cận. Bờ ao, chuồng và nhà có va chạm theo chân, không theo toàn bộ tán/mái.
- Camera theo nhân vật ở mức cố định; không wheel zoom. Quy tắc này tách với World Map luôn ở toàn cảnh.
- Tách lớp: nền/đường → mặt ô đất/ao → công trình và đối tượng sắp theo chân Y → hiệu ứng → UI. Mái/tán cây cần lớp che riêng nếu nhân vật đi phía sau.
- Vẽ sẵn vị trí đất chưa mở, nền chuồng/ao dự phòng; nâng cấp không di chuyển công trình đang dùng. Phần khóa hiện đất hoang/cọc gỗ, bấm thấy điều kiện mở.
- Gió tán cây, hoa/lá, nước, cửa, vật nuôi có animation độc lập. Cây trồng đổi frame theo dữ liệu, không chỉ rung một ảnh nền.

Tham khảo bố cục của người dùng; nghiên cứu thêm cách tổ chức tile ở [Kenney Tiny Farm](https://kenney.nl/assets/tiny-farm) và [Tiny Town](https://kenney.nl/assets/tiny-town). Hai pack có tile 16×16, CC0; dùng làm tham khảo cấu trúc/prototype nếu hợp, không mặc định dùng toàn bộ làm art cuối. Chốt một mẫu đất + cây + nhà + nhân vật ở kích thước chơi thật trước khi xuất hàng loạt asset.

## 4. Giới hạn ban đầu và nâng cấp

Các số là đề xuất dễ thử và sẽ cân bằng bằng chơi thực tế:

| Đơn vị | Bắt đầu | Các mức dung lượng dự kiến | Nâng cấp thay đổi |
| --- | --- | --- | --- |
| Ô đất | Đề xuất 6 ô mở, bố cục có đủ 48 ô tối đa | 6 → 12 → 24 → 36 → 48 (lộ trình đề xuất) | Mở cụm mới, tăng diện tích canh tác |
| Chất lượng từng ô | Cấp 1 | Cấp 1 → 2 → 3 | Giữ ẩm tốt hơn; tốc độ/năng suất là thông số riêng, không tự tăng mọi chỉ số |
| Khu gia cầm | 1 đơn vị, tối đa 2 con | 2 → 4 → 6 con | Mở rộng sân, máng và vị trí; gà/vịt dùng chung hạn mức ở bản đầu |
| Chuồng gia súc | Vị trí khóa | Mở chuồng 2 con → 4 → 6 | Sức chứa gia súc; bắt đầu bằng bò |
| Ao cá | Vị trí khóa | Mở ao 3 con → 6 → 9 | Sức chứa cá, vùng bơi mở rộng trong khu dự phòng |
| Kho | 40 đơn vị vật phẩm | 40 → 80 → 120 | Tăng sức chứa; vật phẩm stack vẫn tính theo số lượng, dụng cụ tính một slot |

Phân biệt mở thêm ô, nâng chất lượng ô và mở/nâng công trình: ba hành động khác nhau. Cấp người chơi dùng để mở điều kiện/catalog; không thay trực tiếp số ô. Gợi ý mở chuồng khi hoàn thành nhiệm vụ chăn nuôi, mở ao sau nhiệm vụ đó; chưa khóa cứng level/giá.

Bản đầu mỗi loại khu có một đơn vị. Kiến trúc lưu `units[]` để sau này có nhiều chuồng/ao; mua thêm đơn vị chỉ bật khi có slot map và luật kinh tế đã chốt. Không cho đặt công trình tự do trong bản đầu.

Nâng cấp có trạng thái khóa / dùng được / đang nâng / hoàn tất. Panel ghi giá, điều kiện, thời gian và lợi ích. Bản đầu dùng xu; vật liệu xây dựng thêm sau. Trừ xu và tạo công việc cùng một giao dịch; không trừ hai lần khi double-click. Khi đang nâng, giữ nguyên cây/con hiện có và sức chứa cũ; hoàn tất mới thêm sức chứa, không xóa sản lượng. Level ô chỉ nâng khi ô trống ở bản đầu. Kho đầy hoặc thiếu xu có lý do rõ ràng; không mất tài nguyên nếu thao tác thất bại.

## 5. Ô đất và cây: các trạng thái độc lập

Không dùng một enum duy nhất gồm khô/xới/gieo/tưới/sâu/chín. Cấu trúc tối thiểu:

| Thành phần | Dữ liệu | Thể hiện |
| --- | --- | --- |
| Quyền sử dụng | locked/unlocked, plotLevel | Đất hoang/cọc khóa; level trong panel |
| Mặt đất | raw/tilled | Khô cằn nứt nhẹ hoặc đất đã xới có luống |
| Nước | moisture 0–100 | Luống tối khi ẩm, nhạt khi khô; icon giọt nước khi cần |
| Cây | cropId, growthProgress, stage | Hạt → mầm → cây nhỏ → trưởng thành → chín |
| Chăm sóc | nutrients, health, fertilizer applications | Panel chất lượng và hiệu ứng bón phân |
| Sự cố | pest/weed severity, thời điểm sự kiện | Sâu/cỏ riêng; không thay frame cây bằng trạng thái bệnh chung |
| Vòng đời | cycleId, timestamps, harvested | Tính offline; ngăn thu hoạch lại cùng một vụ |

Luồng thông thường: mở ô → xới → chọn hạt → gieo → tưới/chăm sóc → chín → thu hoạch → ô xới trống. Ô trống bỏ lâu mới trở lại raw theo cấu hình; không bắt người chơi xới lại ngay sau mỗi thu hoạch nếu chưa có lý do gameplay.

Hành động:

- Xới: chỉ trên ô mở và trống; có animation dụng cụ. Ô có cây thì dùng hành động phá cây riêng, cần xác nhận.
- Gieo: cần đất xới, hạt trong kho, đủ điều kiện cây. Trừ đúng một hạt sau khi người chơi tới điểm đứng và command được chấp nhận.
- Tưới: tăng ẩm tới mức tối đa; không vượt 100. Dụng cụ tưới không tiêu hao; chưa thêm bình nước có giới hạn ở bản đầu.
- Bón phân: tiêu hao một phân, cộng hiệu lực theo loại; có giới hạn mỗi vụ. Bản đầu phân thường hỗ trợ dinh dưỡng/tăng trưởng, phân nhanh là loại mở sau; tổng bonus bị cap để không spam.
- Trị sâu/dọn cỏ: chỉ hiện khi có sự cố, tiêu hao vật phẩm tương ứng. Bản đầu một loại sâu và một loại cỏ; thuốc/dụng cụ có tên/biểu tượng rõ, không dùng chung mơ hồ.
- Thu hoạch: chỉ cây chín; kiểm tra kho trước khi xóa cây. Cấp XP và sản phẩm đúng một lần; kho đầy giữ nguyên cây.
- Phá cây: không tự trả hạt, cho biết hệ quả và có xác nhận. Đổi hạt không âm thầm phá vụ đang trồng.

Đề xuất nhịp chăm sóc: đủ ẩm/dinh dưỡng thì tăng trưởng bình thường; thiếu nước/phân hoặc bị sâu làm chậm và giảm chất lượng. Chất lượng ảnh hưởng sản lượng theo công thức cấu hình. Bản thử nghiệm đầu không tự làm cây chết khi offline; thiết kế có trạng thái héo để mở sau khi nhịp chơi được chốt.

Tăng trưởng tích lũy theo từng khoảng có cùng điều kiện, không chỉ lấy `now - plantedAt` rồi áp dụng trạng thái hiện tại cho toàn bộ quá khứ. Hạn mức phân, tác dụng, tốc độ giảm ẩm và sự cố được cấu hình theo giống. RNG/sự kiện chăm sóc phải có seed và lịch; tải lại không reroll để né sâu.

Catalog thử nghiệm: củ cải (vụ nhanh), ngô (vụ vừa), hoa hồng (vụ dài). Chưa coi tên/giá/thời gian là đã duyệt. Demo tutorial có thể dùng 30–90 giây/vụ; cấu hình chơi bình thường chốt riêng sau khi chơi thử, không đưa timer test vào economy thật.

## 6. Chăn nuôi và ao

Gia cầm/gia súc đều có ID riêng, loại, đơn vị nuôi, giai đoạn con non/trưởng thành, tuổi, đói, sức khỏe, bệnh và chu kỳ sản phẩm. Gà/vịt cho trứng; bò cho sữa. Bản đầu tối đa một bệnh thông thường, có thức ăn và thuốc tương ứng. Tiêm thuốc bổ và nhiều loại bệnh thêm sau; không mặc định thuốc bổ chữa bệnh.

Hành động: mua/thả vào đúng khu → cho ăn/chăm sóc → lớn → tạo sản phẩm → thu sản phẩm → tiếp tục chu kỳ. Bán con vật khác với lấy trứng/sữa; hiển thị hai hành động tách biệt. Sản phẩm tồn có giới hạn, không sinh vô hạn khi offline. Không cho mua vượt sức chứa hoặc nuôi sai loại chuồng. Con vật mới mua đi vào khu an toàn, không spawn ở ngoài hàng rào; cổng không cho AI thoát ra đường.

Ao: vùng nước là polygon độc lập, cá chọn đích trong nước và tránh bờ; bóng/phản chiếu thuộc lớp nước. Dữ liệu có giống, tuổi/tăng trưởng, đói, sức khỏe, sức chứa. Vòng đầu: mua giống → thả → cho ăn → trưởng thành → thu hoạch cá để trống slot. Nuôi cá là hệ thống này; minigame câu cá là tính năng khác, để sau. Chất lượng nước, vệ sinh ao, bệnh cá và rùa mở sau; chưa đồng thời triển khai tất cả.

## 7. Kho, cửa hàng, kinh tế và nâng cấp

Một ví xu nông trại cho bản đầu; không thêm ATM/chuyển hai loại tài khoản như Avatar. Kho gồm hạt, phân, thuốc, thức ăn và nông sản; catalog có giá mua/bán, stack limit và unlock. Cửa hàng chia nhóm, chọn số lượng, xem tổng giá và kiểm tra kho/xu trước giao dịch. Mở capacity không tự tặng cây/con; nhiệm vụ đầu có thể tặng giống/con và ghi rõ.

Phải theo dõi lợi nhuận thực: giá bán trừ hạt, phân/thuốc/thức ăn; năng suất và thời gian nuôi. Chưa chốt giá nâng cấp bằng cảm tính. Dùng bảng cân bằng thử 3 phiên: chơi chăm chỉ, chăm vừa, quay lại sau một ngày. Người mới không bị mắc kẹt hết xu và hết hạt: tutorial thưởng đủ, có nguồn giống cơ bản giới hạn nếu cần.

Kinh nghiệm từ hành động có ích và thu hoạch; tưới liên tục vào ô đã đủ ẩm không cho XP vô hạn. Mua/bán, thu hoạch và nâng cấp có command ID chống lặp; khi online toàn bộ trừ/cộng tài nguyên là giao dịch do server kiểm tra.

## 8. Điều khiển, UI và thời gian

- Click/chạm ô/con/cửa: chọn đối tượng, hiện panel nhỏ theo trạng thái; không dùng loạt timer phủ mọi ô.
- Click hành động: nhân vật đi tới điểm đứng hợp lệ, rồi mới thực hiện; nếu bị chặn thì báo, không tiêu hao. Nhấn Escape/hủy đích hủy hàng đợi trước khi thực hiện.
- Chuột/phím và touch dùng chung luật va chạm; NPC/con vật cũng phải theo vùng đi, không chỉ người chơi.
- UI: xu, level/XP, kho, cửa hàng, nhiệm vụ và về World Map. Chỉ hiện tool phù hợp; có phản hồi thiếu hạt/kho đầy/đang nâng cấp/đã chín.
- Chăm sóc nhiều ô theo hàng là tính năng sau khi single-plot ổn; lệnh hàng loạt phải xử lý từng ô và báo thành công/thất bại riêng.
- Nhạc nền và SFX dùng hệ thống âm thanh đã có; động tác có tiếng tương ứng, không phát hàng chục tiếng cùng lúc khi làm hàng loạt.
- Thời gian sản xuất dùng thời gian thực/timestamp, độc lập với chu kỳ ngày đêm hình ảnh. Ẩn tab dừng render/audio không dừng tăng trưởng.
- Save có version, lastSimulatedAt, các chu kỳ và upgrade jobs; local prototype dùng IndexedDB có transaction. Đồng hồ lùi không làm âm tiến độ; online dùng giờ server. Local prototype chưa có chống gian lận đáng tin cậy.
- Reconcile offline xử lý mốc khô/hết thức ăn/phân/sâu/hoàn tất đúng thứ tự, có giới hạn catch-up cấu hình. Không chạy hàng triệu tick bù; offline không cộng sản lượng vượt giới hạn.

## 9. Dữ liệu và kiến trúc dự kiến

Tách `FarmState` khỏi `TownState` chỉ quản lý avatar/di chuyển. Dữ liệu save không chứa Phaser objects hay canvas. Entity có ID ổn định; catalog và map definition là dữ liệu riêng với trạng thái người chơi.

Các nhóm file dự kiến dưới app (tên cuối có thể điều chỉnh theo kiến trúc hiện có):

- `world/farm/`: farm-state, farm-logic, farm-time-logic, farm-catalog, farm-upgrade-logic; logic thuần và có thể chạy trên server.
- `world/farm/`: farm-map-data, walkability/pathfinding; footprint, cổng, interaction points, expansion slots.
- `game/handlers/`: farm-input-handler và farm-action-handler; chọn/hủy/di chuyển/thực hiện.
- `game/rendering/`: farm-scene-view/crop-view/animal-view/pond-view; hoặc renderer package khi cần Phaser trực tiếp.
- `ui/`: panel chăm sóc, kho, shop, upgrade, nhiệm vụ; không tự sửa tài nguyên.
- `storage/`: farm-save-repository và migration; không import vào logic thuần.

Command trả kết quả có trạng thái/lý do và các thay đổi; renderer chỉ đọc. Timer và RNG có thể truyền vào test; không dùng thời gian thật hoặc Math.random rải trong gameplay. Thêm farm entry/scene routing theo luồng hiện có, giữ outfit đã lưu và World Map đã chốt.

## 10. Các giai đoạn triển khai và nghiệm thu

| Giai đoạn | Đầu ra | Điều kiện hoàn thành |
| --- | --- | --- |
| P0 — Chốt thiết kế | Tài liệu này, cấu hình hạn mức, blockout và mẫu art nhỏ | Chốt bố cục/kiểu hình, cách nâng cấp, trạng thái và phạm vi bản đầu trước khi làm hàng loạt |
| P1 — Map đi được | Map phân lớp, vị trí đủ 48 ô, cổng, đường, va chạm, điểm tương tác và khu khóa | Từ cổng tới được mọi khu mở; không xuyên tường/rào/nước; che khuất đúng; outfit/nhãn tên không lệch; tỉ lệ nhân vật cân đối và được xem ở kích thước chơi thật; đi/về World Map |
| P2 — Vụ cây hoàn chỉnh | 6 ô, 1 cây làm chuẩn rồi mở 3 giống; xới/gieo/tưới/lớn/thu; save cơ bản | Hoàn thành một vụ, tải lại giữ đúng trạng thái; không gieo/thu hai lần; kho đầy không mất cây |
| P3 — Chăm sóc và kinh tế | Phân, 1 sâu/1 cỏ, shop/kho/xu/XP, mở ô và nâng chất lượng/kho | Thiếu vật phẩm có lý do; effect hết hạn đúng; mua/bán không âm kho/xu; mở 6→12 ô thật trên map, save không mất ô |
| P4 — Chăn nuôi | Gia cầm trước, bò sau; thức ăn, bệnh đơn giản, trứng/sữa, nâng khu | Không vượt capacity/đi ra ngoài; thiếu ăn ảnh hưởng; nhận sản phẩm đúng một lần; nâng chuồng giữ con cũ |
| P5 — Ao cá | Mua giống/thả/ăn/lớn/thu, mở/nâng ao | Cá luôn trong nước; đúng capacity; thu trả slot; đồng hồ offline và nâng ao đúng |
| P6 — Bản demo ổn định | Tutorial, nâng cấp có thời gian hoàn chỉnh, âm thanh, art/animation, mobile/performance, offline/save migrations | Người mới làm cây → mở rộng → nuôi → ao; reload/ẩn tab/chơi lại không mất hoặc nhân đôi tài nguyên |
| P7 — Online | Tài khoản, save server, command validation, thời gian server và truy cập farm bạn bè | Client không tự quyết xu/sản lượng; quyền chủ farm rõ; retry không nhân đôi giao dịch |

Mỗi giai đoạn có commit riêng và bản chơi được. Kiểm tra logic phù hợp + `pnpm check`/`pnpm build`; kiểm tra UI trực tiếp ở desktop/mobile thực sự. Không coi test logic pass là đã kiểm tra hình ảnh/đường đi. Chưa đưa ETA ngày cụ thể khi art và luật balance chưa chốt.

## 11. Checklist bắt buộc trước nghiệm thu

- Mọi cây/con/nhân vật spawn trong vùng hợp lệ; điểm tương tác không nằm trong ao/rào.
- Đi tới ô phía xa không xuyên ruộng/công trình; hành động hủy không tiêu hao.
- Double-click/touch lặp không trừ hai hạt, cộng hai sản phẩm hoặc tạo hai nâng cấp.
- Kho đầy, thiếu tiền, thiếu vật phẩm, ô khóa, chuồng đầy có phản hồi đúng.
- Reload ở giữa animation, giữa một vụ và giữa nâng cấp không mất progress.
- Offline nhiều khoảng, đổi tab và đồng hồ lùi không làm sai health/timer/tiền; random không reroll.
- Cá không bơi lên bờ; vật nuôi không ra biển/đường; nâng cấp giữ footprint/ID/dữ liệu.
- Cây thấp/cao và mọi stage che người đúng; UI chữ Việt rõ; avatar/trang bị đúng tỉ lệ.
- Hướng dẫn mới không soft-lock vì hết xu/hạt; không cần đợi giờ thật trong tutorial test.
- Nhạc/SFX/mute vẫn đúng khi đi/về giữa map; không tạo nhiều audio contexts chồng nhau.

## 12. Phạm vi chốt cho lượt build kế tiếp

Bắt đầu P0/P1: một blockout phân vùng, sáu ô mở đề xuất cùng vị trí cho đủ 48 ô, nhà kho, khu gia cầm, vị trí gia súc/ao dự phòng; va chạm, camera, interaction points và mẫu art để xem ở kích thước chơi thật. Chưa làm toàn bộ gameplay/asset trong một lượt. Các giới hạn 6 ô/2 gia cầm và thứ tự mở khu là đề xuất mặc định có thể sửa khi chốt.

## 13. Bản P1 dựng bố cục — 10/10/2026

Entry `/farm.html`, đi vào qua khu Nông trại ở World Map và có nút quay về. Map native 800×500, bốn cụm 4×3 tổng 48 ô, sáu ô mở và 42 ô khóa; kho, chuồng gia cầm, chuồng gia súc và ao dự phòng. Artwork hiện là blockout dựng bằng code để kiểm tra bố cục; chưa phải bộ art cuối hoặc bản người dùng đã duyệt. Giữ avatar/outfit hiện có, render nhân vật 0.65×; camera theo nhân vật và phủ màn hình, không có thao tác zoom.

Click/chạm mặt đất để đi, WASD/mũi tên điều khiển trực tiếp, Esc hủy đích. Click ô/công trình hiện thông tin và đưa nhân vật tới điểm đứng ngoài footprint. Path search kiểm tra từng đoạn và bán kính chân 6px; keyboard dùng cùng luật va chạm, không xuyên ruộng, công trình, ao, thân cây hoặc hàng rào. Canvas nhận touch; UI tự co trên màn hình dọc. Pet đã trang bị được giữ, chặn bước đi xuyên vật cản; chưa có tìm đường riêng cho pet.

Kiểm tra tự động: đủ 48 ID/6 ô mở, đường từ cổng tới tất cả 48 điểm đứng và bốn công trình, click vùng cấm chuyển về đất an toàn, mô phỏng đi vòng các cụm, chặn keyboard tại ao/kho, hủy route. Kiểm tra trình duyệt desktop và viewport dọc; chưa coi viewport dọc là kiểm tra trên thiết bị touch thật.

Phạm vi hiện tại là đi lại/chọn đối tượng. Chưa xới, gieo, tưới, thu hoạch, mở đất, kinh tế, chăn nuôi hoặc save sản xuất. Bước P2 sẽ thêm vòng trồng trọt cho sáu ô và một giống cây.

## 14. Bản P1 mỹ thuật v2 — sửa theo phản hồi

Người dùng từ chối UI/blockout P1 vì thô và quá lớn; yêu cầu theo phong cách game nông trại tham khảo, không vẽ sẵn mọi ô khóa, dùng một bảng Mua tại ô tiếp theo và bỏ mũi tên vàng. Bản v2 dùng nền raster ImageGen `apps/game/src/assets/farm/farm-background-v2.png`; prompt/nguồn ở `docs/art/farm-background-v2.md`. Artwork mới chưa được người dùng duyệt.

World 1280×720 thay 800×500, avatar 0.55× thay 0.65×; camera ưu tiên 1×, tăng vừa đủ để cover viewport. UI là MENU xanh, tiêu đề nhỏ và chỉ số 6/48; không thêm số dư giả hay nút thư/chat chưa hoạt động. Tách UI khỏi ảnh.

Giữ đủ 48 vị trí trong dữ liệu, chỉ vẽ/chọn sáu ô mở và một bảng Mua ở slot 7. Các slot còn lại là bãi cỏ trống và không cản di chuyển. Bảng Mua chỉ mở thông tin, chưa triển khai giao dịch. Footprint kho/chuồng/ao được căn lại theo ảnh đã sinh thực tế.

Cursor bốn góc trắng/xanh neo trực tiếp vào `plot.area`; đích di chuyển dùng `plot.stand` riêng, không còn gửi marker vàng tới renderer. Click ô 1/6, bảng Mua, đóng panel và Esc đã kiểm tra trực tiếp; test xác nhận slot 8–48 không bị chọn như đất đang mở và không tạo vật cản.

## 15. Bản P1 ghép vật thể v3 — thay nền panorama

Người dùng từ chối v2 vì công trình bị vẽ cứng trong một ảnh, không thể mở rộng ao/chuồng, đất trông như đá và avatar quá nhỏ. Renderer v3 không sử dụng panorama v2. Nền cỏ/đường là texture lát; đất, cây, nhà kho và chuồng gà là sprite độc lập. Hàng rào và bờ ao ghép từng đoạn; mặt nước là surface riêng. Prompt và nguồn ở `docs/art/farm-modular-v1.md`; art vẫn chờ duyệt.

Avatar tăng từ 0.55× lên 0.72×. Giữ sáu ô mở, tổng sức chứa 48, bảng Mua duy nhất ở slot 7 và cursor theo mặt ô. Ao/khu gia cầm có ba footprint theo cấp trong vùng đất dự phòng. Cùng một dữ liệu kích thước điều khiển render, hit test, điểm tương tác và va chạm. Mở rộng thêm bờ/rào, giữ nguyên kích thước module; kho và vị trí ô đất không dịch chuyển.

`/farm.html?layout=expanded` là bản xem bố cục cấp 2 để QA, không phải gameplay mua/nâng cấp. Test kiểm tra cả ba cấp và đường đến từng khu; kiểm tra trình duyệt chọn ô 1 và ao ở bản mở rộng. `pnpm check` đạt 158 test của game; `pnpm build` đạt. Chưa triển khai trồng trọt, vật nuôi, mua đất hoặc lưu nâng cấp.

## 16. Mẫu mỹ thuật mới — chờ duyệt

Sau khi người dùng từ chối vẻ ngoài v3, dựng mẫu nhỏ tại `/farm.html?style=sample` với sprite Sunnyside World cùng bảng màu, sáu ô đất, một khu gia cầm và UI kem/gỗ/xanh lá. Menu có đường dẫn qua lại giữa mẫu và bố cục đầy đủ. Chưa thay toàn bộ mỹ thuật farm trước khi duyệt hướng mới.

Các nút xới/gieo/tưới là demo trạng thái hình ảnh riêng từng ô, không có chi phí, thời gian lớn lên hoặc save. Nhân vật giữ artwork hiện có và tỉ lệ 0.72×. Vật thể vẫn độc lập. Nguồn asset/giấy phép và kiểm tra ở `docs/art/farm-style-sample.md`.

## 17. Bản farm ghép asset và vòng trồng thử — 10/10/2026

Đã đưa bộ PNG v4 vào `/farm.html`; URL mẫu cũ cũng mở cùng farm này. Bố cục gồm lợn/cừu trên trái, bò và gia cầm dưới trái, bếp/kho phía trên, hai khu dự phòng trồng trọt giữa map và ao bên phải. Từng đối tượng tách riêng; đường đi, vùng tương tác và vật cản dùng dữ liệu chung. Nhân vật giữ artwork hiện có, scale 0.85. Ao ghép góc/viền, mở rộng phần nước bên trong thay vì kéo cả ảnh ao.

Bản thử bắt đầu với 6/48 ô và 20.000 xu. Chỉ hiện đất đã mua và một bảng Mua ở ô tiếp theo. Mua ô bắt đầu 500 xu, tăng 100 xu mỗi ô. Các giá này dùng để thử gameplay, chưa chốt cân bằng.

Có xới → gieo dâu (10 xu) → tưới → chờ 60 giây → thu hoạch (+35 xu, tăng bộ đếm sản lượng) → gieo lại. Chỉ bật thao tác khi nhân vật tới đúng điểm đứng của ô; không thao tác từ xa. Lưu tiến độ localStorage, tính tăng trưởng theo thời gian thực kể cả lúc đóng trang. Đọc dữ liệu lưu có kiểm tra cấu trúc; không đủ xu, sai thứ tự, mua vượt 48 ô và thu hoạch lặp đều bị từ chối.

Chưa có kho vật phẩm chi tiết, catalog nhiều cây, phân bón/sâu bệnh, chăm sóc/thu sản phẩm vật nuôi, nuôi cá, nhiệm vụ hay nâng cấp công trình bằng gameplay. Các đơn vị hiện là phần bố cục để hoàn thiện lần lượt sau vòng trồng. `?layout=expanded` dùng để kiểm tra vùng mở rộng, không phải giao dịch nâng cấp đã làm.

Kiểm tra gồm luật trồng/tiền/lưu, đường đến tất cả 48 ô khi mở hết, đường tương tác đơn vị ở ba kích thước và thao tác thực tế trong trình duyệt. Artwork/bố cục đang chờ phản hồi người dùng, không tự coi là đã duyệt.

## 18. Map composition revision

The farm now reserves 48 square plots in four groups (24 + 8 + 8 + 8), with one common livestock enclosure and one independently expandable pond. Landscape and props are composed individually. Purchased plots clear reservation flowers. Both units support two paid expansions persisted alongside crop progress; interaction points stay outside their maximum footprints. Full livestock feeding, egg/milk production and fish care remain later gameplay work; the current upgrade only grows the unit's area.
