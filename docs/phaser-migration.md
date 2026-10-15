# Phaser và cấu trúc dự án

## Trạng thái hiện tại

Đã áp dụng cấu trúc theo trách nhiệm, dùng tên file kebab-case. Cả bốn khung của Character Lab dùng Phaser 4.2.1 (WebGL, Canvas fallback). Town đã chuyển vòng update và rendering sang Phaser: sprite, scenery texture, depth, pet, hiệu ứng, marker và name tag. Particle trang bị dùng ParticleEmitter; vòng sáng và marker dùng Tween. Canvas 2D chỉ còn tạo thumbnail tủ đồ và bake texture tĩnh. Asset và nhịp animation 90ms giữ nguyên; chưa kết luận có tăng FPS.

## Cấu trúc đã áp dụng

```text
apps/game/src/
├── application/
│   └── game-application.tsx          # Next/React shell, routing, SDK và audio
├── features/
│   ├── character/
│   │   ├── main.tsx                  # nạp style và Lab screen
│   │   ├── lab-screen.tsx            # React outfit controls và lifecycle preview
│   │   ├── _components/
│   │   │   └── character-lab-view.ts # draw-op cho các bảng đối chiếu
│   │   └── _utils/
│   │       ├── character-lab-logic.ts # state và simulation của Lab
│   │       └── effect-logic.ts       # metadata, vùng phát, hat lights, aura
│   ├── auth/                        # đăng nhập và chọn nhân vật lần đầu bằng React
│   ├── farm/                        # gameplay UI và rendering nông trại
│   └── world-map/                   # bản đồ và chọn khu vực
├── devtools/town/
│   ├── screen.tsx                   # screen sandbox trong Next
│   ├── main.ts                      # ghép town runtime với SDK
│   └── runtime/town-game.ts          # nối shared state, view và input
├── game/
│   ├── runtime/game-config.ts       # tick, speed và preview config
│   ├── movement/                    # town-logic/map, movement và pet-follow logic
│   └── rendering/                   # town-view/effects, providers, portrait và texture/cache helpers
└── assets/
    ├── asset-catalog.ts
    ├── sprite-parser.ts
    └── sprites/**/*.txt
```

Không tạo `boot-scene`, `town-scene`, `pet-view` rỗng chỉ để đủ cây thư mục. Khi town chuyển Phaser, thêm scene/view tương ứng vào các thư mục đã có. `tools/`, `docs/art/`, `apps/game/tests/` chứa regression của app; script export art đã cập nhật đường dẫn JSON.

## Ranh giới trách nhiệm

- **Logic** (`character/`, `world/`): tính state/layout từ dữ liệu và input; không import DOM, Phaser, renderer hay storage. Có thể chạy và kiểm tra trong Node.
- **Handler**: đăng ký event, đổi input thành command gọi logic, trả hàm hủy listener. Không ghép sprite hoặc vẽ.
- **View/rendering**: đọc state/draw-op để vẽ. React outfit controls lấy lựa chọn từ character-core; Lab và bước chọn nhân vật không dùng DOM wardrobe handler cũ. Không quyết định luật level hay di chuyển.
- **Scene/entry**: ghép các phần, quản lý vòng update và cleanup. Provider Phaser quản lý Scene và `CharacterView`; Lab entry điều phối state và UI qua contract chung. Town entry dùng `createTownState()` + `TownView`, nhận delta từ Phaser Scene.
- **Storage**: screen gọi SDK để lưu outfit và tiến trình. Repository của `packages/api-sdk` sở hữu lưu trữ local; HTTP adapter gọi server. Luật sanitize ở `outfit-logic.ts`; adapter đọc bộ đồ legacy khi migrate save.

Luồng: input → handler → logic/state → view. Không dùng file re-export ở đường dẫn cũ; import đã chuyển sang module chịu trách nhiệm.

## Chạy và kiểm tra

```sh
pnpm install
pnpm dev
pnpm check
pnpm build
```

Town: `/`; Lab: `/character.html`. Production build có cả hai entry. Renderer được ghi trên `#game[data-renderer]` và `#big[data-renderer]`.

Regression bao gồm ghép sprite pixel-for-pixel, upgrade/màu/clip/frame/pose, di chuyển và pet. `state-boundaries.test.ts` kiểm tra thay đồ, level, input, animation và state sau khi tách mà không cần trình duyệt.

## Bước tiếp theo

1. Town migration đã hoàn tất; tiếp tục đối chiếu hành vi khi thêm gameplay.
2. Lab migration đã hoàn tất; giữ native pixel size và đối chiếu hình đã duyệt khi thay đổi rendering.
3. Đo frame time/FPS trong cùng cảnh, số resident và effect trên thiết bị mục tiêu.
4. Chỉ cân nhắc atlas khi đo thấy cần. `.txt` vẫn là nguồn art chỉnh sửa; không gen lại asset vì đổi engine.

## Function và alias import

Function là mặc định. `TownState` và `CharacterLabState` là type của object dữ liệu; tạo qua `createTownState()` / `createCharacterLabState()`. Các hàm `updateTown(state, dt, direction)`, `setTownOutfit(state, outfit)`, `updateCharacterLab(state, dt)` nhận state rõ ràng và cập nhật tại chỗ. Đây là mutable simulation, không clone toàn scene mỗi frame. Mỗi factory tạo state riêng, không có singleton dùng chung.

Town runtime dùng `createTownGame()`; Phaser Input quản lý WASD/mũi tên và mouse/touch, Phaser Clock quản lý tick 90ms, Scene pause/resume quản lý lifecycle. Keyboard chỉ nhận sự kiện trong host game; blur/reset tránh kẹt phím khi chuyển sang tủ đồ. Giữ class cho Phaser Scene, pooled character view, Canvas views/cache và `AvatarState` có animation/blink được đóng gói sẵn. Không chuyển mọi class chỉ vì cú pháp.

Alias nội bộ app: `@/` → `apps/game/src/`. TypeScript `paths` và Vite `resolve.alias` cùng trỏ về thư mục này; Vitest dùng chung config Vite. Import module/asset/CSS trong source và test dùng alias; fixture riêng của test giữ đường dẫn tương đối. Không tạo nhiều alias cho từng domain.

```ts
import {createTownState, updateTown} from '@/game/movement/town-logic';
import {defaultOutfit} from '@chibi-town/character-core/outfit-logic';

const state = createTownState({...defaultOutfit});
updateTown(state, 0.016, [1, 0]);
```

## Workspace

Toolchain pnpm + Turborepo + Biome nằm ở root; source/config/test của game nằm trong `apps/game/`. Chạy `pnpm dev`, `pnpm check`, `pnpm build` ở root. Output: `apps/game/dist/`. Tham khảo README cho cấu trúc workspace.

## Character core

`packages/character-core/src/` chứa `character-types.ts`, `sprite-types.ts`, `animation-logic.ts`, `layout-logic.ts`, `outfit-logic.ts`, `item-loader.ts`, `item-catalog.ts`, `random.ts` và `data/{items,colors,pets}.json`. Package không import app, Phaser, DOM hay storage. Types sprite mô tả dữ liệu đầu vào; parser, sprite .txt và renderer thuộc app.

App import bằng public subpath như `@chibi-town/character-core/outfit-logic`, không trỏ vào `src`/`dist` của package. Core dùng import tương đối có đuôi `.js` để output ESM chạy trực tiếp trong Node. TypeScript build ra JS, declarations và JSON trong `packages/character-core/dist/`. Turbo build dependency trước app và kiểm tra cả hai workspace.

Catalog core kiểm tra metadata và cung cấp item/family/palette/pet. `apps/game/src/assets/asset-catalog.ts` tiếp tục kiểm tra tên mảnh và kích thước frame khi nạp sprite. Art được giữ nguyên khi chuyển package.

## Renderer providers

Character Lab preview sử dụng `CharacterRenderer` trong `packages/render-contracts/`. Contract nhận sprite sheet, draw-op, rectangle, particle config, aura và marker theo tọa độ pixel gốc và thứ tự gọi; có `beginFrame`, `endFrame`, `resize`, `setActive`, `destroy`. `RendererOptions` truyền DOM host, kích thước/zoom/background và callbacks `onReady`/`onFrame` (delta milliseconds), tùy chọn `input`, `fixedStep`, `fitParent`. Không public Phaser types. `character-core` không phụ thuộc contract hay engine.

`packages/renderer-phaser/` chứa Scene, pooled sprite view, texture cache và `EffectsView` quản lý native emitter/tween. `packages/renderer-canvas/` chứa Canvas 2D, RAF và texture cache riêng. Cả hai dùng `render-contracts/sprite-pixels` để giữ recolor/clip giống nhau. Sprite sheet đã đăng ký bằng tên phải giữ nội dung ổn định trong một lần mount; đổi asset thì destroy và mount lại. Destroy hủy lifecycle và tài nguyên của instance; registry không có singleton.

App chọn Phaser lúc khởi tạo cho town và toàn bộ Lab; query `renderer=canvas` không còn đổi engine trong Lab. `apps/game/src/game/rendering/renderer-providers.ts` giữ loader/registry cho các provider. Canvas adapter còn phục vụ preview cũ và regression, không triển khai native effects. Để thêm engine, triển khai `RendererProvider`, rồi `registry.register('engine-name', provider)` và nối loader app. Tên không hợp lệ báo lỗi rõ ràng.

Contract dùng chung cho town và preview: `surface` nhận artwork tĩnh đã bake, `label` vẽ tên; `renderScale` tăng mật độ render mà giữ tọa độ world gốc. Town dùng mật độ 2× và camera zoom tương ứng để giữ chữ rõ, canvas co theo host; Phaser Scale FIT quản lý bounds và Camera quy đổi pointer sang world. Animation town và Lab dùng Phaser Clock với tick 90ms, movement giới hạn delta 50ms. Chỉ preview lớn của Lab cập nhật simulation; ba khung còn lại đọc cùng state để tránh nhân tốc độ animation. ParticleEmitter và Tween tự quản lý thời gian trong Scene; effect không còn được submit sẽ được hủy cùng tween/emitter. ResizeObserver theo dõi host và được hủy cùng runtime. Phaser pool sprites/text/rectangles và cache texture; nền không được vẽ lại bằng Canvas mỗi frame. Camera, tilemap và physics chưa public qua contract.

## Nhãn tên trong town (09/10/2026)

Nhãn tên dùng chữ đậm 14px (người chơi vàng, nhân vật khác trắng) ở kích thước CSS, viền tối, nền trong suốt theo mẫu game người dùng gửi. `avatarTop` tính hàng pixel cao nhất thực sự hiện sau mask; TownView dùng lại draw ops của nhân vật và đặt đáy nhãn phía trên 6px native, bao gồm tóc/mũ/halo/cánh. Không còn neo cố định y−70. Phaser Text vẽ nhãn; màu rarity được giữ bằng bóng viền nhẹ thay cho khung chữ nhật. Canvas adapter đồng bộ cách hiển thị. Test đối chiếu với raster thật qua mũ cao, tóc nữ, cánh, pose và hai hướng. Người dùng xác nhận “okey đấy push code đi”.

Sửa nhãn nhảy theo cánh: `nameplateTop` lấy độ cao lớn nhất qua toàn bộ pose/frame của bộ đồ. TownView cache theo mảng equip, tính lại khi thay đồ; vị trí nhãn chỉ đi theo tọa độ nhân vật, không bám frame vỗ cánh hoặc nhịp thở. Giữ người chơi vàng, nhân vật khác trắng.

## Map phủ cửa sổ, kiểm tra trang bị trong Lab (09/10/2026)

Main chỉ mount map và lối vào Lab; bỏ header và panel tủ đồ bên cạnh. Các lựa chọn nhân vật/trang bị tiếp tục ở Character Lab, có link quay về map. Game vẫn đọc outfit đã lưu; chưa thêm tính năng tủ đồ gameplay. Phaser RESIZE phủ parent toàn viewport, camera dùng origin giữa, zoom cover đúng tỉ lệ và bounds map, theo tọa độ người chơi. Các preview Lab giữ scale cũ. Đã kiểm tra canvas phủ 1280×720 không có scroll, click di chuyển và đi/về Lab; công cụ viewport của IAB không áp dụng được kích thước dọc, nên chưa xác nhận trực quan trên điện thoại.

Fullscreen town uses a 1280×720 native world and a preferred camera zoom of 2×, so ordinary desktop viewports reveal more map instead of enlarging characters. Camera zoom only increases when a viewport exceeds the whole world at 2×, to keep the background covered. The current farm layout remains a prototype pending the central-map design.

Town characters and pets render at 0.75× around their ground anchors, independently of the 2× map camera. Equipment shares the same transform; shadows, aura radii, particle regions and hat lights follow that scale. Nameplate clearance uses scaled sprite bounds while text keeps its screen size. Lab previews retain their native proportions.

## Chuyển từ bản đồ vào farm

Khi chọn vùng Farm trên bản đồ, app tải trước module farm, provider Phaser và artwork cảnh. `farm-scene-assets.ts` giữ một promise tải ảnh và canvas nguồn trong phiên trình duyệt; tải lỗi được bỏ cache để thử lại. Loader artwork ổn định giúp frame động vật/ao bất biến được dùng lại qua các lần vào farm. Progress, vị trí, animation state và renderer vẫn thuộc từng scene; không cache dữ liệu tài khoản hay snapshot gameplay.

Farm tải player và snapshot song song, đồng thời chuẩn bị scenery và provider song song. Shell giữ màn trước đến khi module màn kế tiếp sẵn sàng để tránh khoảng trống trong lúc nạp code. Renderer cũ được hủy khi màn mới mount; renderer farm vẫn được tạo mới mỗi lần vào và đọc snapshot hiện tại.

### Location và world map (Phase 5)

Location dùng cùng phân chia logic/runtime/view như farm: input state và hit-test thuần ở feature `_utils`, đăng ký room/input và hủy tài nguyên ở runtime, sắp depth/drawing ở rendering. Draw entries và buffer movement/camera được tái dùng; layout avatar cache theo pose, mirror, blink và frame trang bị. Locale đọc qua callback nên không đổi vòng đời scene/room. World map tải Phaser bất đồng bộ qua renderer-providers và hủy renderer nếu import hoàn tất sau unmount.

Town logic/map dùng chung đã chuyển sang `game/movement`, town view/effects sang `game/rendering`; devtools town chỉ ghép sandbox. Art/sprite/source data giữ nguyên.
