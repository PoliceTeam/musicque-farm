# api-sdk: local và HTTP

Ứng dụng import `@chibi-town/api-sdk`, chọn adapter một lần tại `apps/game/src/application/api-sdk.ts`. Component và renderer không đọc/ghi storage tiến trình hoặc gọi endpoint trực tiếp.

## Chạy local

Không đặt `NEXT_PUBLIC_API_URL`. Repository dùng IndexedDB `chibi-town-progress`, schema version 1. Lần đầu đọc sẽ nhập save cũ `chibi-town-farm-v1` và outfit `chibi-town.outfit.v2`; giữ nguyên bản cũ để phục hồi. Đọc và command chạy trong transaction readwrite, tuần tự cả giữa các tab.

`createMemoryRepository` dùng cho test/review. `createLocalSdk` nhận `clock`, `latencyMs`, `fail` và registry `world` để kiểm tra thời gian, lỗi mạng và nhiều map. `/farm?review=max` là bản review trong memory, không ghi tiến trình thật.

`getMap({regionId,mapId,instanceId})` trả ID instance cụ thể. UI phải dùng `snapshot.mapInstanceId` trong command. Farm mặc định `farm-home/home` giữ ID `home`; instance khác có ID `mapId:instanceId`. Đất/vật nuôi riêng từng instance, tiền/kho dùng chung người chơi. Local hiện không có phân quyền chủ sở hữu.

## Hợp đồng backend

Đặt base URL trong `apps/game/.env.local` theo `.env.example`. Restart dev/build khi đổi biến môi trường. Các request dùng `credentials: include`; backend khác origin phải cấu hình CORS/cookie phù hợp.

| SDK | HTTP | Body | Response |
| --- | --- | --- | --- |
| getPlayer | GET /player | — | id, name, level, outfit |
| getWorld | GET /world | — | regions, maps |
| getMap | POST /maps/snapshot | regionId, mapId, instanceId | Snapshot |
| getMapChannels | POST /maps/channels | regionId, mapId | ChannelDirectory |
| joinMapChannel | POST /maps/channels/join | regionId, mapId, channelId | ChannelDirectory |
| getInventory | GET /inventory | — | Snapshot |
| execute | POST /commands | Command | CommandResult |

Types và boundary validation nằm trong `packages/contracts`. Snapshot gồm `mapInstanceId`, `revision`, `serverTime` (Unix milliseconds), `farm`, `outfit`; CommandResult thêm `completed`, `eligible`. Response lỗi không-2xx có `{code}` với mã `ApiSdkError`; lỗi transport/JSON/schema chuyển thành `NETWORK_ERROR`.

Command chỉ mang ý định (`plot`, `batch`, `expand`, `buy-animal`, `feed`, `collect`, `sell`, `feed-all`, `collect-all`, `equip-outfit`), `requestId` và `mapInstanceId`. Backend phải xác nhận số dư, kho, giới hạn, thời gian và quyền truy cập; không dùng client như nguồn xác nhận gameplay.

## Retry và đồng bộ

Zustand store bỏ snapshot có revision cũ hơn. Khi phản hồi command thất bại chưa rõ server đã commit hay chưa, retry giữ cùng requestId và payload. SDK local nhận lại đúng request thì trả receipt và snapshot hiện tại; requestId trùng với payload khác trả `REQUEST_CONFLICT`. Backend phải thực hiện command và receipt trong cùng transaction.

Snapshot dùng thời gian SDK; render farm tính offset so với đồng hồ browser. Thu hoạch cất kho, bán là command riêng. Không có auto-sell trong renderer/UI.

Test chạy cùng contract cho local và HTTP transport giả lập, gồm migration IndexedDB, concurrent clients, rollback, retry, snapshot isolation, nhiều map/instance và response hỏng. HTTP adapter đã có; server ở `apps/api` triển khai hợp đồng này cho một người chơi và test của nó gọi qua chính `createHttpSdk`. Xem [backend.md](backend.md).

## Catalogue farm và command bổ sung

Snapshot.farm có `gems`, `seeds` (số hạt theo cropId), `kitchen` (id, recipeId, startedAt, readyAt). Xu/Gem/kho/giống dùng chung người chơi; lượt nấu riêng từng map instance. Save cũ thiếu trường được migrate khi đọc trong repository.

`plot`/`batch` nhận thêm `cropId` khi gieo. `buy-seeds {cropId,count}` mua giống với đúng currency. `cook {recipeId}` trừ đủ nguyên liệu và mở một KitchenJob; jobId dùng requestId. `collect-dish {jobId}` nhận món đã đủ giờ vào kho. `sell-animal`/`butcher-animal {unit,animalId}` bán trưởng thành hoặc chuyển thành nguyên liệu, dùng ID ổn định thay vì vị trí mảng. `sell {product,count}` là lệnh riêng cho nông sản/sản phẩm/món ăn; giá null không bán được. Cùng requestId/payload chỉ xử lý một lần; ý định không hợp lệ với state trả NOT_ALLOWED và rollback. Backend thay local phải thực hiện cùng quy tắc giao dịch và kiểm tra thời gian server.

Catalogue và giả định thử nghiệm: [farm-catalog.md](farm-catalog.md).

Giá mở đất/chuồng/ao dùng catalogue nâng cấp; chuồng mới 10→20, ao 2→10. Reader giữ sức chứa legacy đã mua vượt giới hạn mới, không reset save. Rương đã có command nâng cấp và chuyển đồ theo sức chứa được chốt, mô tả ở phần dưới.

## Kho farm và giới hạn chứa

Farm có một kho chung: `inventory` và cấp `chests.main`, dùng `upgrade-chest {chest: 'main'}`. Kho giống giữ riêng trong `seeds`. Cấp 1–6 chứa 12/18/24/30/36/48 loại; cùng loại cộng dồn. Thu hoạch, nhận món, bán và nguyên liệu bếp dùng cùng kho.

Các trường `homeInventory`, `chests.home` và command chuyển đồ được giữ để tương thích schema cũ; UI farm không sử dụng. Local repository gộp đồ legacy từ home vào inventory một lần, xóa homeInventory và giữ cấp kho cao hơn đã mua. Không nhân đôi qua những lần đọc lại và không bỏ đồ khi số loại vượt sức chứa.

Kho đầy trả `INVENTORY_FULL`; loại mới giữ ở cây, vật nuôi hoặc lượt nấu để nhận sau. Kho vượt mức vẫn cộng dồn loại đã có, chưa nhận thêm loại mới đến khi có chỗ hoặc nâng cấp. Thu theo khu vật nuôi nguyên tử; thu hàng loạt xử lý các ô/khu còn chỗ và báo completed/eligible.

## Local development clock and wallet

With `pnpm dev` and the local SDK, the application uses `chibi-town-progress-dev` in IndexedDB. On its first transaction it clones the existing normal save (`chibi-town-progress`) and grants at least 5,000,000 coins and 1,000 Gems. Normal saves and HTTP responses are not modified. Funds are granted once, so buying or spending is not undone on reload.

Set these public variables in `apps/game/.env.local` and restart dev to override defaults:

```env
NEXT_PUBLIC_DEV_TIME_SCALE=600
NEXT_PUBLIC_DEV_COINS=5000000
NEXT_PUBLIC_DEV_GEMS=1000
```

600x means one game hour takes six real seconds (tomato: 24 seconds, chicken maturity: 144 seconds). Crop growth, animal growth/production, food depletion and kitchen jobs share this clock. The saved anchor survives reloads and synchronizes browser tabs; speed changes rebase the anchor without resetting game time. Walking and scenery animation use real time. Production builds always use normal time and normal saves. URL review fixtures keep their independent clock.


## Khu/phòng trong cùng một map

`MapDefinition.channels` cấu hình số khu và sức chứa mỗi khu. Phố giải trí hiện có `{count: 40, capacity: 30}`, ID từ 0 đến 39. Đây là channel của cùng map, độc lập với instance farm và command tiến trình.

UI gọi `getMapChannels` khi vào màn, mở hộp chọn khu hoặc bấm làm mới; không poll mỗi giây. `joinMapChannel` trả directory sau khi chuyển thành công. `ChannelDirectory` gồm `regionId`, `mapId`, `source: 'mock' | 'live'`, `currentChannelId` và `channels: [{id, occupants, capacity}]`. Decoder kiểm tra ID duy nhất, sức chứa/count hợp lệ và khu hiện tại tồn tại; HTTP adapter còn đối chiếu map và membership được yêu cầu.

Local adapter dùng số người mô phỏng ổn định để thử khu trống/đông/đầy. Có thể truyền `channelPopulation(mapId, channelId, capacity)` vào `createLocalSdk` để đặt fixture. Người chơi local được cộng đúng một lần vào khu đang chọn; đổi khu không đổi xu, farm hoặc revision farm. `channelSelections` được lưu trong cùng repository để giữ lựa chọn khi reload, không tạo instance farm mới. Chỉ dữ liệu mock được hiển thị, không có người chơi từ xa hoặc đồng bộ realtime.

Mã lỗi: `CHANNEL_FULL` khi khu đích đầy; `INVALID_CHANNEL` cho ID sai; `MAP_NOT_FOUND` khi map không hỗ trợ khu. Khu hiện tại được join lại an toàn mà không cộng thêm người. UI giữ lựa chọn cũ nếu join thất bại và không khởi tạo lại renderer khi đổi số trên bảng.

Khi có API, đặt `NEXT_PUBLIC_API_URL` như adapter cũ. Backend trả `source: 'live'`, xác thực người chơi từ session/cookie và chuyển membership giữa các khu một cách atomic (kiểm tra sức chứa rồi rời khu cũ/vào khu mới trong cùng thao tác). Số người thực và việc hết hạn membership khi ngắt kết nối do backend quản lý; UI không quyết định sức chứa hay sửa population.
