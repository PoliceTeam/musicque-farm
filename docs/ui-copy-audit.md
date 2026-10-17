# Rà soát ghi chú trong giao diện game

Ngày 17/10/2026. Đã triển khai đợt dọn nội dung sau khi người dùng duyệt. Các bảng dưới lưu nội dung trước khi dọn để đối chiếu.

## Đã triển khai

- Bỏ đoạn chọn phòng/bàn, hướng dẫn Sẵn sàng/Bắt đầu và mẹo ghép ngọc thường trực. Trạng thái chờ, lượt chơi và số người rút gọn thành nhãn.
- Giữ Cược / Quỹ / Nhất / Nhì là số tiền ngắn. Cách chia quỹ vẫn nằm trong Luật Tiến lên/Phỏm.
- Bỏ hướng dẫn chọn quân và giải thích sông khỏi bàn cờ; giữ nhãn màu quân của người chơi. Luật chơi giải thích thao tác, bên đi trước và luật qua sông; sửa nội dung bot-only đã cũ.
- Bầu cua/Slots không còn đoạn trả thưởng thường trực; công thức vẫn đầy đủ trong Luật chơi.
- Trường đua giữ thú đã chọn, tiền trừ/cộng, lãi/lỗ và thời gian; giải thích vốn/tỉ lệ chuyển vào mục Luật chơi có thể mở trong popup cược.
- Map chỉ mở hướng dẫn khi bấm Điều khiển; bỏ đoạn hướng dẫn chọn khu, chỉ báo mô phỏng khi dùng dữ liệu mô phỏng. Ghi chú xem thử thời gian chỉ hiện khi đang xem thử.
- Giữ nguyên lỗi, cảnh báo mất cược, thiếu xu, giới hạn nhập, thông báo tài khoản khách và dữ liệu giao dịch.

## Hai đoạn bạn chỉ ra

- `arcadeHostStakeLimit`: câu hướng dẫn Sẵn sàng/Bắt đầu còn sai với luồng chủ bàn mới. Đề xuất bỏ đoạn văn; input đã có max và lỗi hợp lệ.
- `arcadeTopTwoPayout` + `tienPayoutTwo/Three/Four`: phần số liệu có ích nhưng đang trộn với giải thích dài. Đề xuất giữ nhãn ngắn “Cược / Quỹ / Nhận khi thắng”, đưa cách chia quỹ vào Luật chơi.

## Quyền tài khoản khách

- Khách: được luyện tập trong tất cả game; được chơi Bầu cua và Slots.
- Bàn cược với người khác của Tiến lên, Phỏm, Kim cương, Cờ vua, Cờ tướng: cần đăng ký hoặc đăng nhập.
- Đã thêm thông báo ngay tại nhóm phòng sơ cấp, nhãn “Cần tài khoản” và popup có nút “Đăng ký / Đăng nhập”; backend vẫn kiểm tra quyền như trước.

## Arcade — đề xuất bỏ khỏi màn chính hoặc đưa vào Luật chơi

Bỏ hướng dẫn lặp / chuyển Luật chơi; riêng số tiền cược, quỹ và trạng thái chờ giữ thành nhãn ngắn.

| Key | Nội dung hiện tại | Vị trí render |
| --- | --- | --- |
| [`arcadeHostStakeLimit`](../packages/arcade-games-react/src/locales/vi.ts#L186) | Đặt cược tối đa {{coins}} xu. Bấm Sẵn sàng rồi Bắt đầu khi mọi người đã sẵn sàng. | `packages/arcade-games-react/src/_components/table-settings.tsx` |
| [`arcadeTopTwoPayout`](../packages/arcade-games-react/src/locales/vi.ts#L300) | Quỹ {{pool}} xu · Nhất nhận {{first}} xu · Nhì nhận {{second}} xu (đã gồm tiền góp). {{rule}} | `packages/arcade-games-react/src/_components/table-settings.tsx` |
| [`tienPayoutTwo`](../packages/arcade-games-react/src/locales/vi.ts#L286) | 2 người: nhất 100%, nhì mất tiền góp. | `packages/arcade-games-react/src/_components/table-settings.tsx` |
| [`tienPayoutThree`](../packages/arcade-games-react/src/locales/vi.ts#L287) | 3 người: chia 80/20, nhì lỗ ít hơn ba. | `packages/arcade-games-react/src/_components/table-settings.tsx` |
| [`tienPayoutFour`](../packages/arcade-games-react/src/locales/vi.ts#L288) | 4 người: chia 60/40, ba và tư mất tiền góp. | `packages/arcade-games-react/src/_components/table-settings.tsx` |
| [`arcadeWaitHost`](../packages/arcade-games-react/src/locales/vi.ts#L23) | Chủ bàn sẽ bắt đầu khi mọi người đã sẵn sàng. | `packages/arcade-games-react/src/_components/table-settings.tsx` |
| [`arcadeHostChoosing`](../packages/arcade-games-react/src/locales/vi.ts#L25) | Chủ bàn đang chọn mức cược. | `packages/arcade-games-react/src/_components/table-settings.tsx` |
| [`arcadeRoomDirectoryIntro`](../packages/arcade-games-react/src/locales/vi.ts#L211) | Chọn phòng luyện tập miễn phí hoặc phòng sơ cấp cược bằng xu. | `packages/arcade-games-react/src/_components/arcade-directory.tsx` |
| [`arcadeChooseTable`](../packages/arcade-games-react/src/locales/vi.ts#L210) | Chọn bàn để vào chơi. | `packages/arcade-games-react/src/_components/arcade-directory.tsx` |
| [`miniReady`](../packages/arcade-games-react/src/locales/vi.ts#L34) | Chủ bàn bấm nút bắt đầu để chơi. | `packages/arcade-games-react/src/_components/mini-game.tsx` |
| [`arcadeTableWaiting`](../packages/arcade-games-react/src/locales/vi.ts#L182) | Chủ bàn thiết lập rồi bắt đầu ván. | `packages/arcade-games-react/src/_components/gem-arena.tsx` |
| [`arcadeBotsReady`](../packages/arcade-games-react/src/locales/vi.ts#L181) | Bot đã sẵn sàng. Chủ bàn bấm nút bắt đầu để chơi. | `packages/arcade-games-react/src/_components/diamonds-game.tsx` |
| [`tienWaiting`](../packages/arcade-games-react/src/locales/vi.ts#L283) | {{count}} bot đã sẵn sàng. Chủ bàn bấm nút bắt đầu để chia bài. | `packages/arcade-games-react/src/_components/phom-table.tsx`, `packages/arcade-games-react/src/_components/tien-table.tsx` |
| [`miniMoveHelpFirst`](../packages/arcade-games-react/src/locales/vi.ts#L42) | Chọn quân của bạn, rồi chọn ô đích. Bạn cầm quân trắng/đỏ và đi trước. | `packages/arcade-games-react/src/_components/mini-game.tsx` |
| [`miniMoveHelpSecond`](../packages/arcade-games-react/src/locales/vi.ts#L43) | Chọn quân của bạn, rồi chọn ô đích. Bạn cầm quân đen và đi sau. | `packages/arcade-games-react/src/_components/mini-game.tsx` |
| [`miniMoveHelp`](../packages/arcade-games-react/src/locales/vi.ts#L41) | Chọn quân của bạn, rồi chọn ô đích. Bạn đi trắng/đỏ trước; bot đi đen. | `packages/arcade-games-react/src/_components/mini-game.tsx` |
| [`miniRiver`](../packages/arcade-games-react/src/locales/vi.ts#L47) | Sông · Quân tượng không được qua sông | `packages/arcade-games-react/src/_components/mini-game.tsx` |
| [`miniBauPayout`](../packages/arcade-games-react/src/locales/vi.ts#L77) | Chọn 1 cửa. Không trùng mất 1 cược; trùng 1/2/3 xúc xắc lãi 1/2/3 lần cược. Luyện tập không tính xu. | `packages/arcade-games-react/src/_components/chance-table.tsx` |
| [`miniSlotsPayout`](../packages/arcade-games-react/src/locales/vi.ts#L78) | Ba cuộn, mỗi cuộn 6 biểu tượng đồng xác suất. Một cặp trả 2×, bộ ba trả 5×, ba kim cương trả 10×; khác nhau trả 0. Mức trả đã gồm cược. | `packages/arcade-games-react/src/_components/chance-table.tsx` |
| [`arcadeTopIntro`](../packages/arcade-games-react/src/locales/vi.ts#L236) | Điểm cao nhất của bạn được lưu sau mỗi lượt. Bảng xếp hạng trực tuyến sẽ mở sau. | `apps/game/src/features/arcade/main.tsx` |

## Trường đua — đề xuất rút gọn

Chuyển giải thích luật vào Luật chơi; giữ thú đã chọn, tiền đã trừ/cộng và countdown. Không xóa dữ liệu kết quả.

| Key | Nội dung hiện tại | Vị trí render |
| --- | --- | --- |
| [`rules`](../apps/game/src/application/i18n/locales/vi/common.ts#L51) | Cược 10–100.000 xu. Thưởng gồm vốn, làm tròn xuống xu. Tỉ lệ khóa theo vòng. | `apps/game/src/features/pet-racing/_components/race-bet-dialog.tsx` |
| [`receiptWinner`](../apps/game/src/application/i18n/locales/vi/common.ts#L41) | {{pet}} về nhất. Thưởng gồm vốn; vốn chỉ trừ một lần khi đặt cược. | `apps/game/src/features/pet-racing/_components/race-result-dialog.tsx` |
| [`payout`](../apps/game/src/application/i18n/locales/vi/common.ts#L50) | Thắng nhận {{amount}} xu, gồm vốn. | `apps/game/src/features/pet-racing/_components/race-bet-dialog.tsx`, `apps/game/src/features/pet-racing/_components/race-bet-summary.tsx` |
| [`stakeDebited`](../apps/game/src/application/i18n/locales/vi/common.ts#L31) | Đã trừ {{amount}} xu tiền cược. | `apps/game/src/features/pet-racing/_components/race-bet-summary.tsx` |
| [`running`](../apps/game/src/application/i18n/locales/vi/common.ts#L18) | Đang đua! Cổ vũ cho thú cưng của bạn! | `apps/game/src/features/pet-racing/main.tsx` |

## Map/khu/nhân vật — chú thích thao tác

Rút gọn hoặc hiện theo ngữ cảnh. Bản xem trước/chưa có chức năng cần báo ở đúng điểm bấm; đổi màu vĩnh viễn giữ cạnh xác nhận.

| Key | Nội dung hiện tại | Vị trí render |
| --- | --- | --- |
| [`entertainmentHint`](../apps/game/src/application/i18n/locales/vi/common.ts#L114) | Bấm để di chuyển · Phím mũi tên / WASD · Bấm công trình để xem | `apps/game/src/features/location/main.tsx` |
| [`channelsDescription`](../apps/game/src/application/i18n/locales/vi/common.ts#L87) | Chọn khu muốn đến. Mỗi khu có giới hạn số người riêng. | `apps/game/src/features/location/_components/channel-dialog.tsx` |
| [`channelsMock`](../apps/game/src/application/i18n/locales/vi/common.ts#L88) | Dữ liệu mô phỏng · Chưa kết nối người chơi trực tuyến. | `apps/game/src/features/location/_components/channel-dialog.tsx` |
| [`entertainmentPreview`](../apps/game/src/application/i18n/locales/vi/common.ts#L115) | Gian hàng đã có mặt tại phố giải trí. Trò chơi và dịch vụ bên trong sẽ được bổ sung sau. | `apps/game/src/features/location/main.tsx` |
| [`mapTimeHint`](../apps/game/src/application/i18n/locales/vi/common.ts#L72) | Giờ Việt Nam (UTC+7). Chọn Theo giờ thực để kết thúc xem thử. | `apps/game/src/features/world-map/map-screen.tsx` |
| [`description`](../apps/game/src/application/i18n/locales/vi/inventory.ts#L4) | Trang bị, Pet và màu đã mở khóa thuộc về nhân vật của bạn. | `apps/game/src/features/character/lab-screen.tsx` |


## Thông tin nên giữ — trạng thái có tác dụng trực tiếp

Giữ vì ảnh hưởng thao tác, giới hạn hoặc dữ liệu; diễn đạt ngắn và chỉ xuất hiện khi đúng điều kiện.

| Key | Nội dung hiện tại | Vị trí render |
| --- | --- | --- |
| [`arcadeNeedMembers`](../packages/arcade-games-react/src/locales/vi.ts#L31) | Cần ít nhất 2 người trong bàn để bắt đầu. | `packages/arcade-games-react/src/_components/table-settings.tsx` |
| [`miniInCheck`](../packages/arcade-games-react/src/locales/vi.ts#L40) | Bạn đang bị chiếu · Phải bảo vệ vua/tướng | `packages/arcade-games-react/src/_components/mini-game.tsx` |
| [`arcadeNoCoins`](../packages/arcade-games-react/src/locales/vi.ts#L197) | Chưa đặt cược hoặc không đủ xu khả dụng. | `packages/arcade-games-react/src/_components/table-settings.tsx`, `packages/arcade-games-react/src/_components/phom-game.tsx` |
| [`arcadeLeaveWarning`](../packages/arcade-games-react/src/locales/vi.ts#L202) | Thoát sẽ mất tiền cược: {{stake}} xu. Bạn có muốn thoát không? | `packages/arcade-games-react/src/_components/leave-table-dialog.tsx` |
| [`betError`](../apps/game/src/application/i18n/locales/vi/common.ts#L62) | Chưa xác nhận được cược. Hãy thử lại hoặc kiểm tra kết quả. | `apps/game/src/features/pet-racing/main.tsx` |
| [`invalidStake`](../apps/game/src/application/i18n/locales/vi/common.ts#L49) | Nhập số xu nguyên từ {{min}} đến {{max}}. | `apps/game/src/features/pet-racing/_components/race-bet-dialog.tsx` |
| [`quickSowInfo`](../apps/game/src/application/i18n/locales/vi/farm.ts#L56) | {{count}} ô trống · Tối đa {{price}} {{currency}} | `apps/game/src/features/farm/_components/farm-batch-dialog.tsx` |
| [`unsettledPrice`](../apps/game/src/application/i18n/locales/vi/farm.ts#L92) | Giá bán chưa chốt | `apps/game/src/features/inventory/_components/inventory-dialog.tsx`, `apps/game/src/features/farm/_components/farm-crop-selector.tsx` |
| [`chestFull`](../apps/game/src/application/i18n/locales/vi/inventory.ts#L52) | Kho đã đầy. Vẫn nhận thêm vật phẩm cùng loại; hãy bán hoặc nâng cấp để thêm loại mới. | `apps/game/src/features/farm/farm-screen.tsx`, `apps/game/src/features/inventory/_components/inventory-dialog.tsx` |
| [`colorPermanent`](../apps/game/src/application/i18n/locales/vi/inventory.ts#L38) | Mua màu một lần, dùng vĩnh viễn trên đúng item/cấp. | `apps/game/src/features/character/_components/character-inventory-panel.tsx` |
| [`growthPaused`](../apps/game/src/application/i18n/locales/vi/farm.ts#L7) | Hết thức ăn · tiến độ đang tạm dừng | `apps/game/src/features/farm/_components/farm-unit-panel.tsx` |
| [`missingSource`](../apps/game/src/application/i18n/locales/vi/farm.ts#L131) | Chưa có nguồn cung cho một số nguyên liệu của món này. | `apps/game/src/features/farm/_components/kitchen-dialog.tsx` |


## Đã đặt trong hộp Luật chơi — không phải note thường trực

Giữ trong Luật chơi; không đưa thành đoạn giải thích thường trực trên bàn.

Có nội dung cần sửa vì đã lệch với luồng hiện tại: `miniCommonHelp` vẫn nói đối thủ cờ chỉ là bot local, trong khi đã có bàn người chơi. `miniHelpTexts.chess` và `miniHelpTexts.chinese-chess` luôn nói bạn đi trắng/đỏ trước; nên mô tả bên trắng/đỏ đi trước, vì người ở ghế thứ hai cầm đen. Đây là lỗi nội dung, không chỉ là ghi chú dài.

| Key | Nội dung hiện tại | Vị trí render |
| --- | --- | --- |
| [`miniCommonHelp`](../packages/arcade-games-react/src/locales/vi.ts#L90) | Phòng 0 luyện tập miễn phí; phòng sơ cấp dùng xu trong game. Chủ bàn đặt cược rồi bắt đầu. Bàn chờ thoát miễn phí; đang chơi cược thoát sẽ mất cược sau xác nhận. Đối thủ cờ hiện là bot local. Gợi ý chỉ có trong luyện tập. | `packages/arcade-games-react/src/_components/mini-game.tsx` |
| [`arcadeHelpDescription`](../packages/arcade-games-react/src/locales/vi.ts#L261) | Đổi hai viên liền kề theo hàng hoặc cột để ghép ít nhất 3 viên cùng loại. Đổi không tạo bộ sẽ trả lại và không mất lượt. Xử lý hết ngọc rơi rồi mới chuyển lượt. | `packages/arcade-games-react/src/_components/diamonds-game.tsx` |
| [`arcadeComboHelp`](../packages/arcade-games-react/src/locales/vi.ts#L271) | Một bộ từ 4 viên hoặc chữ T/L được thêm một lượt, kể cả bộ tạo bởi ngọc rơi. Hai bộ 3 rời nhau không tính. Mỗi nước tối đa một lượt thưởng, tối đa 3 lượt thưởng liên tiếp cho cả bạn và bot. Combo là số đợt ghép trong một nước: đợt đầu không cộng thêm; từ đợt hai, sát thương tăng 10 × (số đợt − 1) nếu có ngọc tấn công. Khi hết nước đi, bàn tự trộn lại. | `packages/arcade-games-react/src/_components/diamonds-game.tsx` |
| [`arcadeSkillHelp`](../packages/arcade-games-react/src/locales/vi.ts#L273) | Tấn công đặc biệt tốn 60 mana, gây 210 sát thương và kết thúc lượt. Giáp chặn cả ngọc tấn công lẫn Tấn công đặc biệt trước khi trừ máu. Máu tối đa 1000, mana 100, giáp 300; phần vượt giới hạn không được tích thêm. Hạ máu đối thủ về 0 để thắng. Điểm vàng chỉ dùng cho kỷ lục cá nhân. Phòng luyện tập miễn phí. Phòng cược: thắng cộng cược, thua hoặc bỏ ván đang chơi trừ cược; bàn chưa bắt đầu được rời miễn phí. Chỉ dùng xu, không dùng Gem. | `packages/arcade-games-react/src/_components/diamonds-game.tsx` |

## Locale có nội dung nhưng không thấy được render trong feature hiện tại

`arcadeReadyHelp`, `arcadeSaveAndStart`, `arcadeResumeInfo`, `arcadeRoomIntro`, `tienIntro`. Không tính chúng là note đang xuất hiện; có thể dọn riêng sau.

Ngoài arcade, các chuỗi giải thích cũ của nông trại/kho cũng chưa thấy nơi render: `batchHint`, `quickSowHint`, `careHarvestHint`, `quickStorageTitle`, `quickStorageHint`, `kitchenHint`, `seedHint`, `emptyGoodsHint`, `emptySeedsHint`, `emptyAnimalsHint`, `emptyKitchenHint`. Vì vậy chúng không được tính là ghi chú đang xuất hiện trong game.

## Phạm vi kiểm tra

Đã rà các component React và locale của arcade, trường đua, nông trại, kho, bản đồ/khu, nhân vật, âm thanh và tài khoản. Các nhãn giá/thời gian/số lượng, lỗi request, xác nhận tiêu tiền và kết quả cược không được tính là note thừa. Âm thanh hiện chủ yếu là nhãn điều khiển, không có đoạn hướng dẫn dài cần chuyển. Màn dev/art review không nằm trong luồng chơi nên không tính vào danh sách này.

Tổng: **47 mục đang có nơi render** trong bảng, cộng nhóm locale không dùng ở trên.

## Bố cục khi bắt đầu ván

Đã thống nhất mốc đặt mặt bàn giữa các trạng thái. Cơ chế giữ chiều cao form thiết lập từng được dùng để tránh nhảy bàn đã được gỡ: nó giữ khoảng trống sau khi chia bài, đẩy bài người chơi xuống và khiến bố cục khác sau F5. Phòng luyện tập hiện bỏ hoàn toàn vùng thiết lập khi ván đã bắt đầu; bố cục phụ thuộc snapshot hiện tại, không phụ thuộc chiều cao đã đo ở trạng thái chờ.
