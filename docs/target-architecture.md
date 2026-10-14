# Kiến trúc mục tiêu: maintain và scale

Quyết định đã chốt ngày 2026-10-11. Migration nền tảng đã triển khai: Next.js + React + Phaser, Zustand, contracts/gameplay/game-content và api-sdk local/HTTP. Tài liệu này mô tả ranh giới hiện tại và phần online còn chờ backend.

## Công nghệ và ranh giới

- Next.js App Router + React + TypeScript: shell ứng dụng, routing, UI và tài khoản khi cần.
- Phaser: thế giới game, camera, sprite, animation, input và thứ tự vẽ. Tải runtime trong trình duyệt, không import Phaser vào đường chạy server.
- Zustand: state client dùng cho UI và snapshot SDK; vị trí/animation mỗi frame vẫn thuộc runtime Phaser.
- pnpm workspace, Turborepo, Biome: tiếp tục toolchain hiện có.
- Vitest: gameplay, SDK, store và lifecycle. Kiểm tra trình duyệt: các luồng UI và chuyển map; chưa có suite E2E tự động.
- Adapter local giả lập API bất đồng bộ và lưu tiến trình trong trình duyệt. Server thật nằm ở `apps/api` (Fastify + PostgreSQL), có tài khoản, lưu tiến trình, socket và bàn Tiến lên người với người; xem [backend.md](backend.md).

Không đưa Redis, microservices hoặc realtime server vào migration ban đầu. Next.js không thay thế các ranh giới gameplay/UI/data.

Farm và các màn location dùng `application/_components/location-layout.tsx` cho header, avatar/menu, xu/gem và khung màn hình. Screen truyền title, player, số dư; các mục menu và counter riêng (như số ô đất) được truyền qua props. Layout không tự poll SDK hoặc quản lý runtime Phaser.

Modal React dùng `packages/ui/src/_components/dialog.tsx`: title/header, vùng `.ui-dialog-body` cuộn độc lập và `footer` cho hành động cố định. Nội dung dài đặt trong `children`; CTA chính đặt trong prop `footer`. Modal có tab giữ tab bên ngoài surface, nhưng dùng cùng header/body/footer. Xác nhận giao dịch DOM cũng dùng cấu trúc này.

## Cấu trúc hiện tại

```text
apps/game/
  public/
  src/
    app/                           # Route/layout Next.js
    application/                   # Shell, SDK, UI services, i18n
      _components/location-layout.tsx # Header/avatar/wallet dùng chung cho farm và location
    features/
      farm/                        # Screen, store, CSS, _components, _utils, runtime, rendering
      world-map/                   # Overview, audio, world zone data
      location/                    # Location screen and movement constraints
      character/                   # Lab screen và React outfit controls
      inventory/                   # Warehouse UI
      settings/                    # Audio settings UI
    game/
      runtime/                     # Shared runtime configuration
      movement/                    # Shared walking and pet following
      rendering/                   # Shared renderer providers/assets/portrait
    assets/                        # Source artwork and generated catalogs
    devtools/                      # Town sandbox, UI showcase, farm art review
  tests/
packages/
  api-sdk/                         # Public interface, local and HTTP adapters
  game-service/                    # SDK operations on a player document, shared by local adapter and server
  contracts/                       # Commands, DTOs and errors
  gameplay/                        # Rules independent of UI/rendering/storage
  game-content/                    # Region/map registry and economy configuration
  ui/src/_components/              # Reusable React components
  game-audio/
  character-core/
  render-contracts/
  renderer-phaser/
  renderer-canvas/
```

Scene và page làm nhiệm vụ ghép các phần, không chứa toàn bộ gameplay. Không tạo package cho từng màn hình; chỉ tách package khi có ranh giới dependency rõ ràng. Không di chuyển renderer vào app hoặc để engine types lọt vào public contracts.

## Nơi sở hữu CSS

CSS được chia theo thành phần/màn sở hữu, dùng cùng skin của UI package. Các file nguồn dưới đây là nơi chỉnh style; không sửa `assets/generated-styles.ts` vì build sẽ tạo lại file đó.

| Phần | File nguồn |
| --- | --- |
| Control, form, dialog, header và UI dùng chung | `packages/ui/src/theme.css` |
| Đăng nhập, đăng ký và chọn nhân vật lần đầu | `apps/game/src/features/auth/auth.css` |
| Bản đồ chung | `apps/game/src/features/world-map/map.css` |
| Màn khu vực và chọn kênh | `apps/game/src/features/location/location.css` |
| Nông trại | `apps/game/src/features/farm/farm.css` |
| Lab nhân vật | `apps/game/src/features/character/character-base.css`, `lab.css` |
| Các game trong package arcade | `packages/arcade-games-react/src/theme.css` |
| Trang kiểm tra UI | `apps/game/src/devtools/ui/showcase.css` |

`tools/runtime/prepare-assets.mjs` khai báo các stylesheet và tạo module CSS dạng chuỗi cho shell. Shell nạp theme dùng chung và style tài khoản; khi chuyển màn, nó thay stylesheet riêng của màn hiện tại. CSS riêng của app không đưa vào UI package.

## World → region → map → instance

Giữ nguyên 8 ID đang có trong `apps/game/src/features/world-map/_utils/world-zones.json`:

| regionId | Tên |
| --- | --- |
| farm | Nông trại |
| forest | Rừng già |
| school | Trường học |
| center | Trung tâm |
| fun | Khu giải trí |
| homes | Khu nhà ở |
| port | Cảng biển |
| airport | Sân bay |

World overview chọn khu; mỗi khu có nhiều map. Chưa chốt số lượng hoặc nội dung map của các khu chưa mở. Một map definition có thể tạo nhiều instance, ví dụ farm của từng người chơi.

- Region definition hiện tại: ID, nhãn và danh sách map. Quyền mở khóa online sẽ do backend bổ sung.
- Map definition: ID, regionId, scene, kích thước, layers với asset/color/depth, obstacles, spawn, portals và các system cần dùng.
- Map instance: ID, mapId, owner khi có, revision và tiến trình riêng.
- Portal: ID, map đích và spawn đích; local SDK xác nhận map/instance tồn tại. Quyền truy cập online cần backend.
- Validate ID trùng, tham chiếu thiếu, kích thước, tọa độ spawn/portal và layer/obstacle. Asset được kiểm tra khi tải; lỗi tải được hiển thị trong UI.

Map renderer tái sử dụng definition. Thêm map cùng cơ chế bằng dữ liệu; thêm cơ chế mới bằng system riêng. Chỉ tải assets của map đang dùng và dự tải có giới hạn. Asset dùng chung được giữ theo vòng đời/reference; không xóa texture đang được scene khác sử dụng.

## Lớp hiển thị

Từ dưới lên: background → ground → trang trí mặt đất/bóng → world objects/entities sắp theo vị trí chân → hiệu ứng phù hợp → React UI.

Không cố định nhân vật trên mọi cây/nhà/hàng rào. Mặt nước, cá, bờ, cầu và sóng có thứ tự riêng. Bảng mua/mũi tên gắn tọa độ thế giới thuộc Phaser; bấm mở dialog React. Dialog chặn input xuống map. React overlay không chặn kéo/click ở vùng không có UI.

## api-sdk: hợp đồng chung, adapter thay được

Tên package là `api-sdk`, public import theo namespace repo: `@chibi-town/api-sdk`. Web không import adapter nội bộ, không gọi fetch hoặc đọc/ghi storage tiến trình từ component/scene.

```ts
interface GameSdk {
  getPlayer(): Promise<PlayerSnapshot>;
  getWorld(): Promise<WorldSnapshot>;
  getMap(input: MapRequest): Promise<MapSnapshot>;
  getInventory(): Promise<InventorySnapshot>;
  execute(command: GameCommand): Promise<CommandResult>;
}
```

Type cụ thể nằm trong packages/contracts; interface public được api-sdk export. Commands là discriminated union theo tính năng, không nhận arbitrary object hoặc cho UI gửi số xu cần cộng.

```text
React/Phaser → api-sdk → local adapter → gameplay → local repository
React/Phaser → api-sdk → HTTP adapter → server → gameplay → database
```

Chọn adapter một lần tại composition qua `createGameSdk(config)`. Local repository có thể dùng storage hiện có khi migration, rồi chuyển IndexedDB; thay storage không đổi consumer. Audio preferences có storage riêng, không phải tiến trình gameplay.

Quy tắc hợp đồng:

- Tất cả API bất đồng bộ, kể cả bản local; loading/error/retry được xử lý ở UI.
- SDK quyết định tiền, kho, sản phẩm, nâng cấp, quyền vào map; UI chỉ gửi ý định và hiển thị kết quả.
- Command có requestId; local và server chống xử lý lặp cùng request, giữ kết quả để retry không trừ tiền hai lần.
- Snapshot/result có revision, serverTime và dữ liệu thay đổi được định nghĩa rõ; client bỏ phản hồi cũ và có cách tải snapshot để đồng bộ lại.
- Lỗi ổn định: mã lỗi nghiệp vụ và lỗi kết nối; HTTP adapter ánh xạ lỗi transport về cùng contract. Validate dữ liệu tại boundary.
- Local adapter dùng clock inject được để giả lập serverTime, không tin thời gian component gửi lên; HTTP adapter dùng thời gian server.
- Lệnh local cập nhật và lưu atomic; xử lý concurrent commands/multiple tabs để tránh ghi đè tiến trình.
- Local dữ liệu có schema version, migration và import từ bản lưu hiện tại; không reset dữ liệu người chơi khi đổi cấu trúc.
- Có chế độ dev giả lập latency/failure. Chạy cùng contract tests cho local và HTTP adapter với test server khi adapter HTTP được triển khai.

Mục tiêu: đổi adapter và cấu hình kết nối, không sửa UI/Phaser cho các tính năng có cùng contract. Không khẳng định adapter HTTP đã hoạt động khi chưa có server; không hứa các tính năng mới như chat/realtime tự hoạt động bằng đổi adapter. Chuyển dữ liệu local lên tài khoản online là luồng import được server xác minh riêng.

## Maintain và scale

- Gameplay nhận state, command và clock rõ ràng; không phụ thuộc React, Zustand hay SDK adapter.
- Giá, thời gian trưởng thành, sức chứa nằm trong game-content, không rải trong JSX hoặc scene.
- React đọc phần snapshot cần dùng qua selectors; không render toàn HUD mỗi frame.
- Mốc thời gian quyết định tăng trưởng; không cần server timer cho từng cây/vật nuôi.
- Server tương lai là nguồn xác nhận tiến trình; bán/nâng cấp/thu hoạch có transaction và idempotency.
- HTTP backend ban đầu có thể là một ứng dụng với module rõ ràng. Realtime nhiều người cùng map được bổ sung riêng khi có yêu cầu; room/instance là đơn vị đồng bộ, không broadcast cả thế giới.
- Chuyển map tải → dựng → đặt nhân vật → kích hoạt; rời map dọn listener/timer/scene resources. Runtime và audio dùng chung sống qua routing; chuyển map nhanh phải hủy/bỏ kết quả load cũ.

## Thứ tự triển khai và điều kiện hoàn tất

1. Chốt contracts + api-sdk local; chuyển các thao tác farm/kho/nâng cấp và đọc snapshot qua SDK, giữ migration save. Kiểm tra không còn truy cập storage tiến trình trực tiếp từ UI/scene.
2. Tách game-content/gameplay từ logic hiện có; bảo toàn ID, vị trí map, công thức và tiến trình. Test vòng trồng/chăm sóc/thu hoạch/kho/bán và nuôi/trưởng thành/sản phẩm.
3. Chuyển app sang Next.js, runtime client dùng chung; giữ `/map`, `/farm`, `/character` và tương thích đường dẫn `.html`. Test direct load, Back/Forward, chuyển nhanh, cleanup và nhạc liên tục.
4. Chuyển packages/ui và từng feature sang React, loại bỏ HTML strings/manual event binding cũ khi đã thay thế. Kiểm tra responsive, contrast, spacing, focus, disabled/loading và input blocking.
5. Thêm region/map registry, portals và map loader. Xác minh cả 8 region hiện tại, nhiều map dùng chung renderer, instance tách dữ liệu và assets không tải toàn thế giới.
6. Khi cần online: triển khai HTTP adapter/server theo cùng contract, contract tests và luồng nhập tiến trình local; consumer không đổi.

Migration từng bước, không viết lại assets hay đổi gameplay đồng thời. Các bước 1–5 đã triển khai cho các màn hình chính. HTTP adapter của bước 6 đã có và chạy cùng contract tests bằng transport giả lập; server `apps/api` đã có tài khoản, lưu tiến trình, socket và bàn Tiến lên người với người; các game arcade khác chưa có bàn người với người. Xem [backend.md](backend.md).

## Tệp triển khai chính

- `apps/game/src/application/game-application.tsx`: shell audio và nạp/dọn màn hình, bỏ kết quả load đã lỗi thời.
- `apps/game/src/features/farm/farm-store.ts`: snapshot, loading, revision và retry cùng requestId.
- `apps/game/src/features/`: dialog kho, chăm sóc hàng loạt, vật nuôi và âm thanh bằng React.
- `packages/api-sdk/src/local-repository.ts`: transaction IndexedDB và migration bản lưu cũ.
- `packages/api-sdk/src/local-adapter.ts`, `http-adapter.ts`: hai adapter cùng GameSdk.
- `packages/game-service/src/game-service.ts`: thao tác của GameSdk trên một document người chơi; local adapter và `apps/api` cùng gọi.
- `packages/game-content/src/world.ts`: 8 khu và registry nhiều map; renderer location dùng layers/depth/obstacles.

Các helper vẽ canvas và công cụ art/sandbox còn dùng DOM cho rendering hoặc preview; UI gameplay chính đã dùng React. Map farm giữ bố cục và assets hiện có. Map location tổng quát chưa có nội dung cho 7 khu còn lại. Local cho phép nhiều instance cùng map; wallet/kho dùng chung, ruộng/vật nuôi riêng từng instance. Đây chưa phải multiplayer.


Component nội bộ đặt trong `_components/`, tiện ích nội bộ trong `_utils/`; chỉ tạo thư mục khi có code. Farm store nằm cạnh farm feature. Imports gameplay/content dùng public package exports trực tiếp, không qua file chuyển tiếp trong app. Không tạo thư mục rỗng cho các khu/map chưa triển khai.

Arcade dùng `packages/arcade-games` cho luật/bot/session thuần TypeScript và `packages/arcade-games-react` cho module UI, metadata, locale và SDK adapter. `features/arcade/_utils/registered-games.ts` đăng ký module Kim cương/Tiến lên; màn chính lấy danh mục và màn chơi từ registry. App inject SDK, assets, renderer avatar và navigation qua host provider. `api-sdk` sở hữu session chủ bàn, kiểm tra cược, giữ khả năng chi trả và thanh toán idempotent bằng xu. Package arcade không phụ thuộc SDK/React/app, tránh vòng dependency.
