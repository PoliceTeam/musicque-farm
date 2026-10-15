# Trang bị, Pet và quyền sở hữu

Cập nhật triển khai ngày 15/10/2026: catalogue, shop bằng xu, quyền sở hữu/màu vĩnh viễn, ba nơi chứa đồ, migration và enforcement đã chạy trên local lẫn HTTP/server. Tủ đồ nằm tại `/character`. Nhiệm vụ/sự kiện có hàm cấp thưởng tin cậy dùng chung, chưa có hệ thống nhiệm vụ/sự kiện hoặc endpoint cho client tự cấp thưởng. Nhân vật hiện tại được ánh xạ vào `main` trong phạm vi từng player; chưa có UI tạo nhiều nhân vật.

## Quy tắc sản phẩm

Mọi trang bị chọn được, Pet ở từng cấp và màu thay thế phải có ID để mua hoặc nhận từ nguồn được server xác thực. Cùng một vật phẩm có thể có nhiều nguồn nhận: shop, nhiệm vụ và sự kiện. Có trong catalogue không đồng nghĩa đang mở bán, có giá hoặc được sở hữu miễn phí.

Tách định nghĩa hình ảnh, quyền sở hữu, và cách nhận. `items.json`, `pets.json`, `colors.json` tiếp tục là nguồn metadata/render; không đặt giá, ví hoặc lịch sự kiện trong các file artwork này.

- `item/<itemId>`: một trang bị hoặc cấp cụ thể. Ví dụ `item/hair.mop`, `item/wings.angel.1`, `item/wings.angel.2`. Sở hữu cấp 1 không mở cấp 2. Family chỉ gom nhóm hiển thị; kiểm tra quyền trên item thực tế sau khi resolve cấp.
- `pet/<petId>`: một Pet ở cấp cụ thể. Ví dụ `pet/cat`, `pet/cat.2`. Không dùng fallback xuống cấp thấp hơn để cho qua kiểm tra sở hữu cấp được yêu cầu.
- `item-color/<itemId>/<colorId>`: màu của đúng item/cấp. Ví dụ `item-color/shirt.tank/red`. Không mở màu đỏ cho `shirt.goku`, hay các cấp khác. Mặc màu yêu cầu cả quyền item và quyền màu.
- `skin-color/<colorId>`: palette da toàn nhân vật, không phải màu áo. Cũng có thể được bán hoặc trao thưởng; không tạo phụ thuộc giả vào một bộ quần áo.

Catalogue sinh từ dữ liệu hiện có tại `packages/character-core/src/cosmetic-catalog.ts`. ID màu dùng khóa ổn định tiếng Anh, tách khỏi tên tiếng Việt đang được renderer sử dụng. Thêm màu mới cần khai báo khóa ổn định; không dùng vị trí trong mảng hoặc tự slug tên dịch làm ID lưu trữ.

Sprite ẩn (tóc phía sau, bản vừa khuôn mặt rộng, bản mũ nữ, bàn tay cầm đồ) đi theo item chính. Không bán riêng từng sprite. `body` là cấu trúc render, không phải item thương mại. Giá, ưu đãi, nguồn nhiệm vụ/sự kiện không thuộc catalogue hình ảnh.

Pet hiện có biến thể màu được tạo sẵn trong metadata, chưa có bộ chọn palette Pet. Mỗi Pet sẵn có vẫn có ID thương mại riêng; khi thêm đổi màu Pet phải định nghĩa palette và quyền riêng trước khi cho chọn.

## Chính sách đổi màu

Đã được người dùng chốt ngày 15/10/2026: mua một lần mở khóa vĩnh viễn **một màu trên một item**, sau đó mặc lại không tốn thêm phí. Màu này cũng có thể được trao từ nhiệm vụ/sự kiện như các quyền khác. Không có palette dùng chung mở toàn bộ áo/tóc.

Một lần mua item có thể gồm item và một màu khởi đầu đã chỉ định trong offer. Các màu khác phải được mua hoặc kiếm riêng. Đồ khởi đầu cấp qua bundle rõ ràng, gồm đúng các item và màu được tặng; không cấp cả bảng màu. Không thu phí khi đổi qua lại giữa những màu đã sở hữu.

## Cấu hình cách nhận

Các type ở `packages/game-content/src/cosmetic-economy.ts` định nghĩa shop offer và reward/grant dùng chung. Giá mở bán hiện tại nằm trong `cosmetic-shop.ts`; server dựng offer từ catalogue bằng `cosmeticOffer`, không lấy giá từ client.

Ví dụ offer mua áo và màu ban đầu:

```ts
const offer = {
  id: 'shop.shirt-tank.dark-purple.v1',
  enabled: true,
  price: { currency: 'coins', amount: 2000 },
  reward: { cosmeticIds: ['item/shirt.tank', 'item-color/shirt.tank/dark-purple'] },
};
```

Ví dụ offer màu bổ sung:

```ts
const colorOffer = {
  id: 'shop.shirt-tank.red.v1',
  enabled: true,
  price: { currency: 'coins', amount: 500 },
  reward: { cosmeticIds: ['item-color/shirt.tank/red'] },
};
```

Giá khởi đầu: trang bị 2.000 xu, ngoại hình 1.500 xu, Pet 5.000 xu; item/Pet có cấp nhân với bình phương cấp. Màu item 500 xu, màu da 1.000 xu. Offer item gồm một màu ban đầu theo preset thích hợp. Đây là bộ giá triển khai ban đầu, có thể cân lại tập trung. Offer màu yêu cầu người chơi đã có item gốc, hoặc item đó nằm trong cùng bundle. Không bán lại quyền đã sở hữu; bundle có một phần đã sở hữu cần offer riêng hoặc chính sách chiết khấu rõ ràng, không tự thu đủ giá rồi bỏ qua phần trùng.

Nhiệm vụ/sự kiện trao cùng `cosmeticIds`, ví dụ `pet/cat.2`. Server kiểm tra điều kiện hoàn thành, thời gian sự kiện và receipt đã nhận; không cho client tự gửi danh sách thưởng hay tự cấp quyền bằng tên `event`/`quest`. Nguồn `starter` và `migration` dành riêng cho quy trình server.

## Dữ liệu người chơi và giao dịch dự kiến

Quyền sở hữu và lịch sử grant dùng bảng riêng trên server theo thiết kế bên dưới; không nhét toàn bộ collection đang tăng vào JSON `PlayerDocument`. Local adapter giữ mô hình tương đương trong IndexedDB. Không dùng `outfit` làm bằng chứng đã sở hữu: outfit là projection từ các instance ở vị trí đang mặc, cộng các quyền màu đã chọn. Mỗi nhân vật có túi đồ, phần đang mặc và kho riêng theo thiết kế bên dưới. Kho trang bị/Pet tách khỏi kho nông sản và không tiêu sức chứa kho farm.

- `buy-cosmetic-offer`: client gửi `offerId` và `requestId`. Server lấy giá/reward từ cấu hình, kiểm tra thời gian, số dư có thể dùng sau khi giữ tiền cược arcade, các điều kiện và quyền trùng. Trừ tiền + cấp toàn bộ bundle + receipt là một transaction. Retry trả lại cùng kết quả.
- `claim-quest-reward` / `claim-event-reward`: client gửi định danh mục tiêu. Server tự xác định reward sau khi kiểm tra tiến độ. Grant ID phải gắn duy nhất với người chơi + nguồn + mốc thưởng; đổi request ID cũng không nhận lại được.
- `equip-outfit`: resolve item và Pet ở đúng cấp, kiểm tra giới tính/slot, quyền item và quyền màu. Từ chối toàn bộ thay đổi nếu thiếu một quyền, không thay đổi item âm thầm bằng sanitize/fallback. Dùng `sanitizeOutfit` cho đọc save cũ, không dùng nó thay kiểm tra sở hữu lệnh mua/mặc.

Bán item trong shop không đồng nghĩa cho phép người chơi bán lại/chuyển nhượng. Mặc định quyền ngoại hình là không tiêu hao, không cộng dồn số lượng và không tự quy đổi phần thưởng trùng thành xu.

## Tủ đồ và tạo nhân vật

Tủ đồ liệt kê đồ sở hữu để mặc; đồ chưa sở hữu có thể xem thử và xem cách nhận. Xem thử không ghi outfit thật hoặc cấp quyền. Màu khóa hiển thị theo đúng item đang xem; không giữ một palette đã mở trên áo trước rồi áp sang áo mới để vượt quyền. Đổi cấp cũng cần kiểm tra lại màu của cấp đó.

Luồng tạo nhân vật hiện cho chọn nhiều item/màu. Khi tích hợp ownership, giới hạn bằng starter bundle được cấu hình; chỉ cấp đúng bộ khởi đầu đã chọn, không tất cả lựa chọn. Gender và thao tác bỏ phụ kiện không cần mua. Quyền đã mua không mất khi đổi giới tính; vẫn tuân theo giới hạn mặc của metadata.

Lab/devtools có thể xem mọi đồ, nhưng không được ghi quyền sở hữu hoặc outfit chưa sở hữu vào tài khoản thật.

## Save cũ và ranh giới triển khai

Migration một lần chỉ cấp quyền cho item/Pet/màu hợp lệ đang mặc trong save trước khi bật enforcement, cùng bộ đồ khởi đầu đã định. Không cấp toàn catalogue và không tin outfit gửi từ client để grandfather. Lưu cờ/receipt migration trong cùng transaction; retry hoặc đổi map không cấp thêm. Giữ nguyên ví và kho farm.

Thứ tự triển khai:

1. Chính sách màu đã chốt là mở khóa vĩnh viễn; duyệt starter bundle và cấu hình các offer/reward thật.
2. Thêm bảng ownership/grant, migration, snapshot phân trang và contracts; local/server dùng chung logic thuần trong `game-service`, adapter chịu trách nhiệm lưu trữ/transaction.
3. Thêm giao dịch mua/nhận thưởng và kiểm tra quyền ở `equip-outfit`, tạo nhân vật, đổi giới tính và mọi đường ghi outfit.
4. Nối tủ đồ/shop và các nguồn nhiệm vụ/sự kiện. Bật enforcement cùng migration, tránh chặn người chơi giữa hai phiên bản.

Kiểm tra bắt buộc: không bỏ sót item/cấp/Pet, ID màu ổn định, không mở màu chéo item/cấp, server từ chối mặc đồ chưa sở hữu, giao dịch thiếu tiền không cấp đồ, hai request đồng thời không thu/cấp hai lần, không tiêu tiền giữ cược, điều kiện sự kiện/nhiệm vụ do server kiểm tra, starter/migration không cấp toàn catalogue.


## Quyết định cấu trúc để mở rộng nhiều item

Đã chọn: catalogue định nghĩa bằng file trong repo hiện tại; quyền sở hữu trên server dùng các bảng chuẩn hóa khi triển khai giao dịch. Không tạo bảng theo loại trang bị và không nhét mọi nguồn nhận/giá vào một JSON item. Chưa tạo migration DB trong giai đoạn định nghĩa này.

### Phân loại và hiển thị

- `category`: `equipment` (trang bị), `appearance` (ngoại hình), `pet`.
- `slot`: phân loại con/vị trí mặc. Trang bị có áo/quần/giày/mũ/cánh/băng tay/cầm tay/đuôi/phụ kiện miệng; ngoại hình có tóc/mặt/mắt/miệng/mũi/sticker, và nhóm màu da.
- `kind`: loại quyền (`item`, `pet`, `item-color`, `skin-color`), độc lập với category.
- `groupId`: một thẻ sản phẩm/tủ đồ. Ví dụ `item/wings.angel` chứa sáu cấp, `pet/cat` chứa ba cấp. Item không có family dùng chính ID item làm nhóm.
- Màu của từng cấp nằm trong nhóm nhưng không trở thành hàng trăm thẻ độc lập. Người chơi mở món rồi chọn cấp và màu. Thay đổi nhóm hiển thị không làm đổi ID quyền đã mua.

`cosmetic-categories.ts` phân loại slot tường minh; thêm slot công khai chưa được phân loại sẽ báo lỗi khi tạo catalogue. `COSMETIC_GROUPS` dựng chỉ mục một lần trong thời gian tuyến tính theo số quyền. Định nghĩa TypeScript dùng discriminated union để item-color luôn có item gốc, palette và điều kiện phụ thuộc; Pet luôn có petId.

Không tự tạo nhãn tìm kiếm/tag từ tên hoặc gender. Khi cần bộ sưu tập, mùa hoặc rarity cho chiến dịch, thêm metadata vào manifest merchandising theo group/item ID, không sửa ID và không trộn vào source sprite.

### Các bảng server mục tiêu

| Bảng | Dữ liệu chính | Khóa/chỉ mục bắt buộc |
| --- | --- | --- |
| `character_cosmetic_unlocks` | character_id, cosmetic_id, first_grant_id, acquired_at | PK (character_id, cosmetic_id); index (character_id, acquired_at, cosmetic_id) |
| `character_item_instances` | id, character_id, cosmetic_id, first_grant_id, location, bag_slot, equipped_slot | PK id; UNIQUE (character_id, bag_slot) khi location=bag; UNIQUE (character_id, equipped_slot) khi location=equipped |
| `cosmetic_grants` | id, player_id, character_id, claim_key, source_kind, source_id, granted_at | PK id; UNIQUE (player_id, claim_key) |
| `cosmetic_grant_items` | grant_id, cosmetic_id | PK (grant_id, cosmetic_id); FK grant_id |
| `cosmetic_shop_offers` | id, enabled, currency, amount, available_from, available_until, revision | PK id; kiểm tra currency, giá nguyên dương và khoảng thời gian hợp lệ |
| `cosmetic_shop_offer_items` | offer_id, cosmetic_id | PK (offer_id, cosmetic_id); FK offer_id |

Catalogue vật phẩm tiếp tục là nguồn chuẩn từ repo và được server nạp thành registry. Các cột cosmetic_id trỏ tới ID trong registry; service kiểm tra ID trước khi lưu, không tạo foreign key giả tới bảng catalogue chưa tồn tại. Dữ liệu shop ban đầu có thể seed từ cấu hình được kiểm duyệt; khi có admin, offer trong DB là nguồn giá chuẩn, không chạy song song hai nguồn giá. Sau này cần biên tập catalogue qua admin thì thêm bảng catalogue và migration riêng, giữ nguyên mọi ID quyền.

`claim_key` do server dựng: mua hàng gắn request receipt; thưởng gắn nhiệm vụ/mốc hoặc sự kiện/lần phát hành đã hoàn thành. Retry đổi request ID không được nhận lại cùng phần thưởng. Không lấy claim_key/giá/reward từ client để quyết định cấp quyền. Lưu snapshot giá/reward thực tế vào receipt giao dịch để đổi cấu hình shop không làm đổi kết quả retry.

Ví, tiền giữ cược, quyền sở hữu và receipt phải cập nhật trong **cùng transaction Postgres**, khóa ví người chơi trước khi kiểm tra số dư/quyền. Không trừ tiền ở document rồi cấp đồ ở transaction khác. Logic mua/kiểm tra quyền vẫn thuần và dùng chung trong game-service; adapter server nạp dữ liệu cần thiết, khóa dòng và lưu bảng; local adapter giữ hành vi tương đương. Lịch sử nhận thưởng không gửi toàn bộ về client.

### Khi có hàng nghìn hoặc hàng chục nghìn item

Shop/tủ đồ trả các nhóm theo category, slot và cursor ổn định; không gửi toàn bộ catalogue, collection và lịch sử grant trong mỗi snapshot farm. Tải cấp/màu khi mở chi tiết món. API báo `owned`/`locked` và vị trí theo những ID thuộc trang đang xem của đúng nhân vật; equip chỉ tra quyền của những item/màu cần dùng. Không đọc lại mọi đồ người chơi sở hữu cho mỗi lần gieo/thu hoạch farm.

Registry server có thể cache theo phiên bản nội dung; dữ liệu sở hữu không cache chung giữa người chơi. Client tải thumbnail theo trang, artwork lớn theo chi tiết/đồ đang mặc. Không thêm bitmap vào bảng SQL. Ẩn bán item chỉ tắt offer, không xóa quyền hoặc metadata cần render đồ đã mua. Đổi giá không thay cosmetic ID; ngừng hỗ trợ artwork phải có kế hoạch thay thế/migration rõ ràng.

Phần bảng offer/admin ở trên là hướng mở rộng. Phiên bản hiện tại dùng bốn bảng inventory/unlock/instance/grant được mô tả trong phần trạng thái triển khai bên dưới; offer có nguồn chuẩn từ cấu hình code.


## Ba nơi chứa đồ của mỗi nhân vật — đã chốt 15/10/2026

Mỗi nhân vật có ba nơi riêng, dùng chung category/catalogue để lọc. Category trả lời “đây là loại gì”; container trả lời “món này đang ở đâu”. Không tạo category `bag` hay `warehouse` và không sao chép vật phẩm sang ba kho độc lập.

| Nơi | Ý nghĩa | Cách lưu |
| --- | --- | --- |
| `bag` — Túi đồ | Các món đang mang theo để sử dụng/thay trang bị | Instance có location=bag và một bag_slot |
| `equipped` — Bản thân | Các món đang mặc, đồ cầm tay và Pet đang đồng hành | Instance có location=equipped và equipped_slot đúng loại |
| `warehouse` — Kho đồ | Tất cả món đã sở hữu còn lại, không mang theo/không mặc | Instance có location=warehouse; danh sách phân trang |

Mỗi món cụ thể có **instanceId** riêng ngoài cosmetic ID. `item/shirt.tank` nói món đó là áo nào; instanceId nói chính chiếc áo đang được di chuyển. Một instance chỉ có đúng một location, không thể vừa ở túi vừa đang mặc hoặc trong kho. Quyền mở khóa giữ thông tin đã nhận/mua; bản thân quyền không là bản sao vật phẩm trong mỗi container. Mô hình mặc định vẫn chặn mua trùng cùng món/cấp; instanceId cho phép mở rộng bản sao/trade sau này bằng chính sách rõ ràng mà không đổi cách định vị đồ.

Quyền màu mua một lần nằm ở `character_cosmetic_unlocks`, không tạo instance, không chiếm ô túi/kho và không bị tiêu hao khi đổi màu. Cấp màu gắn với đúng item/cấp của nhân vật đó. Màu đã chọn giữ cùng item khi chuyển túi/kho; thay áo khác phải kiểm tra lại quyền màu trên áo mới. Màu da cũng là quyền ngoại hình, không phải món đồ bỏ vào túi.

Pet đang đi theo dùng slot `pet`, tối đa một instance đang đồng hành. Pet khác ở túi hoặc kho. “Đồ cầm theo trong túi” khác slot `held`: `held` chỉ là món nhân vật đang cầm trên tay và thuộc phần bản thân.

### Chuyển đồ

- Mặc từ túi: đổi instance mới từ túi sang đúng equipped_slot. Món cũ trả về chính ô túi vừa giải phóng trong cùng giao dịch; túi đang đầy vẫn thay được một-đổi-một.
- Tháo đồ: cần ô túi trống. Thiếu chỗ thì từ chối, không tự xóa món hoặc đẩy món vào một vị trí không tồn tại. Các slot bắt buộc như mặt/quần chỉ thay bằng món hợp lệ khác, không được tháo thành outfit lỗi.
- Cất/lấy: chuyển bag ↔ warehouse sau khi kiểm tra sức chứa, chủ sở hữu và điều kiện truy cập kho. Đồ trong kho cần lấy vào túi rồi mới mặc; UI có thể gộp thành một hành động nếu server xác thực toàn bộ bước và sức chứa trong một transaction.
- Nhận đồ từ shop/nhiệm vụ/sự kiện: đưa instance mới vào túi nếu có chỗ; nếu không thì vào kho. Nếu kho có giới hạn và cũng đầy, giao dịch mua bị từ chối trước khi thu tiền; reward giữ trạng thái chưa nhận. Không đánh dấu đã nhận rồi bỏ mất vật phẩm. Grant quyền màu không cần ô trống.
- Mua màu mới không di chuyển item và không tự mặc màu mới nếu người chơi chưa chọn áp dụng.

Server nhận instanceId và đích chuyển, lấy character_id từ nhân vật thuộc phiên đăng nhập; không tin character_id hoặc cosmetic_id client gửi để xác định quyền. Khóa các instance và vị trí liên quan trong transaction; hai lệnh mặc/cất đồng thời không được nhân đôi hoặc làm mất đồ. DB kiểm tra location hợp lệ: bag phải có bag_slot nguyên không âm và không có equipped_slot; equipped ngược lại; warehouse không có cả hai. Một ô túi hay equipped_slot chỉ chứa một instance của nhân vật. Bất kỳ đường ghi outfit nào cũng phải qua cùng giao dịch inventory.

Số ô túi và giới hạn kho nằm trong cấu hình `CharacterInventoryPolicy`, không hardcode vào item và không tự tăng theo kích thước catalogue. Mức ban đầu và giá mở rộng chốt khi làm UI/gameplay túi; chưa thay sức chứa kho farm hiện tại. Luồng farm đang có giữ kho nông sản riêng trong giai đoạn tích hợp trang bị/Pet, tránh tự đổi nơi tiêu nguyên liệu hoặc làm mất save.

### Nhân vật và migration

Khóa sở hữu là character_id, không phải riêng player_id. Player dùng để xác thực, ví và receipt tài khoản; một nhân vật không tự thấy/sử dụng đồ của nhân vật khác. Nếu sau này cần kho chung tài khoản, đó là container riêng với chính sách chuyển đồ, không dùng nhầm kho nhân vật thành kho chung.

Save hiện tại chỉ có một outfit trên player: migration tạo ánh xạ nhân vật mặc định, đưa đúng item/Pet đang mặc vào equipped, đưa các món sở hữu khác có dữ liệu xác thực vào warehouse, túi bắt đầu rỗng. Chỉ cấp các quyền màu hợp lệ đã mặc và bundle khởi đầu đã cấu hình; không cấp toàn bảng màu. Migration idempotent, không cộng lại xu hoặc grant thưởng đăng ký.

Các type `CharacterCosmeticInstance`, `CharacterItemLocation`, `CharacterInventoryPolicy` là nền tảng của luồng đã triển khai. Ba container, di chuyển instance, migration và enforcement server đã có.


## Trạng thái triển khai và cách sử dụng

- Mở `/character`: preview nhân vật đi cùng các tab **Bản thân / Túi đồ / Kho đồ / Cửa hàng**. Lọc category và vị trí mặc, phân trang tối đa 50 mục/request. Shop gom cấp/màu dưới group; xem chi tiết group để mua cấp/màu cụ thể. Bộ chọn tự do/ngẫu nhiên trước đây đã được thay bằng thao tác trên đồ sở hữu.
- Túi bắt đầu 24 ô; kho trang bị/Pet không giới hạn số món. Đồ mới vào túi, đầy túi thì vào kho. Kho nông sản vẫn giữ quy tắc và sức chứa farm hiện có.
- Mặc từ túi, tháo về túi, cất/lấy giữa túi và kho. Slot bắt buộc không có nút tháo. Khi thay đồ, slot của món mới được giải phóng trước khi cất món cũ, nên túi đầy vẫn đổi một-đổi-một được. Đổi màu chỉ áp dụng trên món đang mặc hoặc màu da và không tính tiền lại.
- Local dùng cùng core và IndexedDB. Server lưu `character_inventories`, `character_cosmetic_unlocks`, `character_item_instances`, `character_cosmetic_grants`, thông qua migration Drizzle `0004`. Một hàng JSON nhỏ chứa metadata từng instance/unlock/grant; toàn bộ collection không nằm trong JSON document người chơi. Khóa player document giữ wallet/stake, grant và vị trí đồ trong cùng transaction. Chỉ những instance đổi vị trí được ghi lại; DB kiểm tra vị trí duy nhất theo owner + nhân vật + slot.
- `getCharacterInventory` qua POST `/character-inventory` trả trang collection/shop riêng. Snapshot farm không chứa collection. Lệnh client: `buy-cosmetic`, `move-character-item`, `equip-character-item`, `unequip-character-item`, `apply-cosmetic-color`; `equip-outfit` cũ cũng kiểm tra quyền và vị trí. Không có lệnh client `grant-cosmetics`.
- `ensureCharacterInventory` migrate một lần từ outfit đã lưu; đăng ký/tạo nhân vật cấp đúng lựa chọn starter trong transaction auth qua `grantStarterSelection`. Không cộng lại ví hoặc cấp toàn bộ palette. Người chơi khác không truy cập được collection qua cách đổi ID trên request.
- `grantCharacterCosmetics` chỉ được gọi từ logic server đã xác minh điều kiện quest/event. Grant ID phải ổn định theo mốc thưởng; cùng ID không cấp lại. Tính năng này chưa tự sinh nhiệm vụ hay lịch sự kiện.

Giới hạn hiện tại: server chỉ hydrate collection cho request inventory/mặc/mua (không cho farm/arcade thông thường), nhưng hydrate toàn bộ collection của một nhân vật để chạy cùng pure core. Response được phân trang và ghi DB theo delta. Khi collection thực tế lên rất lớn, tối ưu repository truy vấn theo những ID/page cần thiết mà giữ nguyên contracts và transaction. Metadata/render hiện vẫn là bundle catalogue tĩnh; ảnh lớn và preview đã tải theo engine hiện có. Không tuyên bố rằng bản này đã có admin, cache phân tán hay nhiều nhân vật trên một tài khoản.

Các mục “thứ tự triển khai” và bảng mục tiêu trước đó là ghi nhận thiết kế mở rộng; trạng thái thực tế trong phần này là nguồn tham chiếu khi vận hành phiên bản hiện tại.

### Ảnh vật phẩm và lọc shop

Thẻ vật phẩm dùng thumbnail tĩnh từ sprite đang có, bao gồm Pet đúng cấp, màu được bán và màu đang chọn của instance. Không tạo scene hoặc vòng lặp animation cho từng thẻ. Crop theo pixel nhìn thấy để đồ nhỏ/cánh rộng nằm gọn trong ảnh. Các nút category Tất cả / Trang bị / Ngoại hình / Pet luôn hiện; category trang bị/ngoại hình có bộ lọc tiếp theo vị trí mặc. Chuyển nơi chứa giữ category/loại đang chọn; đổi category trả về trang đầu và xóa loại/nhóm cũ.
