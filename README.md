# Musicque Farm

Game nông trại xã hội 2D trên web, nhân vật chibi phối đồ. Cơ chế dựng nhân vật lấy theo Avatar J2ME ([itdat/avatar-j2me](https://github.com/itdat/avatar-j2me)): nhân vật là danh sách item, mỗi item có lớp vẽ và 15 pose, quay trái là lật gương.

Hiện có: nông trại 60 ô tối đa, 18 giống cây theo giờ thực, 8 loài vật nuôi, 22 công thức nhà bếp, hai rương nâng cấp 6 cấp với 12–48 ô, chuyển đồ và bán hàng chủ động, nuôi con non đến trưởng thành, chăm sóc hàng loạt, nâng cấp sức chứa, nhân vật đi bằng click hoặc phím, NPC tự đi lại, tủ đồ đổi màu da, tóc (có thể để trọc), mắt, miệng, mũi, đồ ở miệng (khẩu trang, kẹo cao su), sticker má, áo, quần, giày, băng tay, cánh, đồ cầm tay, thú cưng đi theo, và màu từng món. Nhân vật là pixel art 49×67 đầu to kiểu chibi, tách từ hình mẫu thành từng item. Map nông trại ghép từ các sprite riêng. Chưa có server.

## Chạy

Cần Node 22.13 trở lên (CI dùng Node 22, xem `.nvmrc`).

```sh
pnpm install
pnpm dev        # http://127.0.0.1:5173
```

| Lệnh | Việc |
| --- | --- |
| `pnpm dev` | Chạy bản phát triển, tự tải lại khi sửa code |
| `pnpm test` | Chạy test game (Vitest) và core (Node) |
| `pnpm typecheck` | Kiểm tra kiểu TypeScript |
| `pnpm check` | Format + lint + typecheck + test |
| `pnpm build` | Build Next.js và các package |
| `pnpm preview` | Xem bản build |

CI (GitHub Actions) chạy typecheck, test và build cho mỗi push lên `main` và mỗi pull request.

## Toolchain

Repository: [PoliceTeam/musicque-farm](https://github.com/PoliceTeam/musicque-farm). Repo dùng pnpm 11.22.0, Turborepo và Biome. Chạy các lệnh từ root repo (thư mục `musicque-farm/`). Cấu trúc workspace:

```text
apps/game/             Next.js + React + Phaser, routes/features/tests/assets
packages/api-sdk/       SDK local (IndexedDB) và HTTP, entry cấu hình adapter
packages/contracts/     DTO, commands và kiểm tra dữ liệu tại boundary
packages/gameplay/      Luật nông trại thuần TypeScript
packages/arcade-games/  Registry engine, luật và bot thuần TypeScript
packages/arcade-games-react/  Module UI, metadata, locale và SDK adapter của game
packages/game-content/  8 khu, map definitions, sức chứa, giá và thời gian
packages/ui/            React controls, theme và feedback dùng chung
packages/game-audio/    Nhạc/SFX, tồn tại qua chuyển màn hình
packages/character-core/ Types, catalog item/màu/pet, outfit/layout/animation thuần
packages/render-contracts/ Contract, registry, chuyển sprite thành RGBA
packages/renderer-phaser/ Provider Phaser, sprite pool và texture cache
packages/renderer-canvas/ Provider Canvas cho thumbnail/preview cũ
docs/                  Tài liệu và art tham khảo
tools/                 Script export art
package.json           Lệnh điều phối workspace
pnpm-workspace.yaml    apps/* và packages/*
pnpm-lock.yaml         Lockfile duy nhất
turbo.json             Task graph và cache
biome.json             Format/lint chung
```

`@chibi-town/character-core` là package dùng chung, chạy được trong Node và không phụ thuộc Phaser/DOM. Game import qua public exports của package; sprite và renderer vẫn thuộc app. `pnpm dev` chạy Next.js và theo dõi các package phụ thuộc. Assets và CSS được chuẩn bị tự động trước dev/build/test. `pnpm format` format code; `pnpm check` kiểm tra format, lint/import, kiểu TypeScript và test. Biome giữ nguyên các grid/JSON art đã duyệt và cấu hình exporter. `pnpm preview` xem bản build của game.

## Cấu trúc

Thiết kế mục tiêu để maintain và scale ở [docs/target-architecture.md](docs/target-architecture.md): Next.js + React + Phaser, 8 khu với nhiều map/instance, và `@chibi-town/api-sdk` có adapter local/HTTP. Runtime đã chuyển sang Next.js; hướng dẫn cấu hình SDK ở [docs/api-sdk.md](docs/api-sdk.md).

Tên file dùng **kebab-case**. Cấu trúc và ranh giới chi tiết ở [phaser-migration.md](docs/phaser-migration.md).

```text
apps/game/src/
  application/game-application.tsx Shell client, audio, routing và scene lifecycle
  composition/            Chọn api-sdk local/HTTP một lần
  state/                  Zustand snapshot và commands bất đồng bộ
  features/               React UI farm, inventory và settings
  farm/farm-screen.tsx    Ghép nông trại với renderer và snapshot
  map/map-screen.tsx      Chọn khu/map và hiệu ứng world overview
  lab/lab-screen.tsx      Character Lab và lưu outfit qua SDK
  character/              Effect logic và Lab state
  world/                  Movement, pet follow, town state và map data
  game/
    handlers/             Keyboard, pointer và Lab input
    rendering/            Texture tĩnh và draw calls cho Phaser
    game-config.ts        Timing, speed và preview config
    town-game.ts          Ghép town state, input và view
  ui/                     Shared helpers và developer preview
  assets/
    sprites/              Nguồn pixel chia theo item/bộ phận, palette riêng
    asset-catalog.ts      Nạp và kiểm tra sprite theo catalog core
apps/game/tests/          Regression logic, pixel layout và state integration
docs/                     Kiến trúc, migration, hướng dẫn art
```

Town và cả bốn khung của `/character` dùng Phaser WebGL (Canvas fallback của Phaser): vòng update, clock animation, sprite, depth, text, ParticleEmitter cho trang bị và Tween cho vòng sáng/marker. Town nhận WASD/mũi tên/click/chạm qua Phaser Input, Camera và Scale FIT. Lab dùng một clock animation chung; các bảng layer/pose/cảnh nhỏ vẽ cùng state và layout. Canvas 2D còn dùng cho thumbnail tủ đồ và tạo texture tĩnh. Luật di chuyển, pet follow, equip và ghép pose ở các module logic.

## Thêm một món đồ

1. Vẽ mảnh pixel trong `apps/game/src/assets/sprites/**/sprites.txt` theo [docs/art-guide.md](docs/art-guide.md): quay phải, đúng vị trí so với gốc giữa hai chân, dùng chữ cái màu của nhóm.
2. Thêm item vào `packages/character-core/src/data/items.json`: `slot`, `layer` và pose 0 (thêm pose 1, 2 nếu nhún hoặc khác khi bước).
3. `pnpm test` để kiểm tra, `pnpm dev` để xem trong tủ đồ.

`/character` vẽ nhân vật phóng to (đứng, đi, lật trái), từng lớp riêng theo thứ tự vẽ, và vài người kèm thú cưng đi trong cảnh, để chỉnh hình.

Không cần sửa logic animation hoặc renderer.

## Routing và dữ liệu

`/map`, `/farm`, `/character` chuyển trong cùng ứng dụng, giữ audio. `/play/[regionId]/[mapId]` chọn map theo registry; `.html` cũ được redirect. `/ui` là trang kiểm tra UI chung, `/town` là sandbox renderer, `/farm-art-review` kiểm tra trạng thái sprite. Mặc định chỉ khu farm có nội dung; 7 khu còn lại giữ ID và chưa mở.

Dữ liệu local nằm trong IndexedDB, tự nhập bản lưu farm/outfit cũ lần đầu. Backend nằm ở `apps/api` (xem `docs/backend.md`); đặt `NEXT_PUBLIC_API_URL` trong `apps/game/.env.local` để dùng nó. Khi đó game tự tạo tài khoản khách và lưu tiến trình trên server. Popup đăng ký tùy chọn giúp giữ tiến độ và chơi trên thiết bị khác; đăng nhập tài khoản có sẵn không gộp tiến độ khách. Khách vắng trên 30 ngày sẽ bị dọn. API có test PGlite qua HTTP adapter. Bản đồ mặc định theo giờ Việt Nam (UTC+7), bù lệch bằng serverTime khi dùng API; preset/slider chỉ là xem thử, nút “Theo giờ thực” quay lại đồng hồ thực.

## Hướng tiếp theo

- Bổ sung animation hành động tưới, gieo và thu hoạch.
- Thêm loại đồ: mũ, kính.
- Mở rộng tóc và trang phục nữ từ bản thử cơ bản trên cùng khung.
- Vẽ lại cảnh nền và cây trồng bằng pixel cho đồng bộ.
- Server nhiều người chơi.

## Lưu ý bản quyền

Không dùng hình của Avatar (TeaMobi). Repo J2ME chỉ là tài liệu tham khảo cơ chế; mọi hình trong repo này là hình mới.

Cấu trúc sprite, cách thêm item và giới hạn tải hiện tại ở [sprite-sources.md](docs/sprite-sources.md).

Bản thử nữ cơ bản: bấm **Nữ cơ bản** trong Lab/tủ đồ. Nguồn, cấu hình và cách tái tạo ở [female-character.md](docs/female-character.md).

## Locale

Game React UI uses typed i18next namespaces with Vietnamese as the default. Locale files live in `apps/game/src/application/i18n/locales/vi/`. See [locale guide](docs/ui/i18n.md) for usage, adding languages and migration coverage.

Source layout: Next.js routes in `apps/game/src/app`, shell/services in `src/application`, feature-owned screens/state/rendering in `src/features`, shared runtime in `src/game`, and review tools in `src/devtools`. See [architecture guide](docs/target-architecture.md).

Quy tắc và các thông số chưa chốt của farm: [docs/farm-catalog.md](docs/farm-catalog.md).
