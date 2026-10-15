# Kế hoạch sửa sau review (2026-10)

Tài liệu giao việc cho agent. Làm **từng phase một**, theo đúng thứ tự dưới đây; mỗi lần chạy chỉ làm phase được giao trong prompt.

## Quy tắc chung (bắt buộc)

- Đọc `AGENTS.md`, `docs/backend.md`, `docs/target-architecture.md` trước. Mọi quy tắc trong đó vẫn áp dụng.
- **Không commit, không push, không tạo branch.** Người review sẽ commit sau khi duyệt.
- Không sửa dữ liệu art, `apps/api/drizzle/` (schema đổi thì chạy `pnpm --filter @chibi-town/api db:generate`), không thêm lockfile npm/yarn.
- Luật game và xử lý lệnh nằm trong `packages/game-service`, không chỉ ở API. Engine trong `packages/arcade-games` giữ thuần và tất định theo seed.
- Mỗi lỗi sửa phải có test tái hiện (fail trước khi sửa, pass sau khi sửa) trừ khi ghi rõ là không test được và lý do.
- Kết thúc phase: `pnpm format`, rồi `pnpm check` phải pass. Không tắt test, không thêm `skip`, không nới lint.
- Cập nhật tài liệu liên quan (`docs/backend.md`, `docs/arcade.md`, `AGENTS.md`…) khi hành vi hoặc cấu trúc thay đổi.
- Không mở rộng phạm vi ngoài phase. Thấy vấn đề khác thì ghi vào báo cáo cuối, không tự sửa.
- Cuối phase in báo cáo: danh sách mục đã làm (kèm file), test đã thêm, mục bỏ qua/chưa chắc và lý do, kết quả `pnpm check`.

---

## Phase 1 — Bảo mật và tiền (server)

### 1.1 RNG dự đoán được ở bàn có cược — HIGH
Hiện tại: `apps/api/src/modules/arcade/tables/service.ts:153` tạo seed 32-bit từ `clock() ^ Math.random()`; engine dùng LCG 32-bit (`tien-len-logic.ts:138`, `phom-logic.ts` hàm `random`, `mini-games-logic.ts:99-101`, `gem-battle-logic.ts:54-56`). `next-round` của Bầu cua/Xèng giữ nguyên `m.seed` (`mini-games-logic.ts:247-262`), nên quan sát vài ván là đoán được ván sau. Practice (`game-service/src/arcade/practice-context.ts:19`) dùng `getRandomValues` nhưng vẫn qua LCG 32-bit.

Yêu cầu:
- Seed tối thiểu 128-bit, sinh bằng `node:crypto` (server) / `crypto.getRandomValues` (local), đưa vào engine từ bên ngoài. Engine dùng PRNG có state ≥128-bit (ví dụ sfc32/xoshiro128**), vẫn tất định theo seed để test.
- Seed **mới** cho mỗi lần chia bài, mỗi `next-round`, mỗi roll/spin, và mỗi lượt Kim cương có sinh ngẫu nhiên. Không tái sử dụng state giữa các lần người chơi quan sát được kết quả.
- Seed không bao giờ xuất hiện trong snapshot/step/event (giữ quy tắc hiện có).
- Dữ liệu bàn cũ đang lưu seed số vẫn đọc được (migration mềm trong code, không đổi schema nếu không cần).
- Test: seed khác nhau giữa các ván/`next-round`; engine vẫn tất định với cùng seed; audit test hiện có vẫn pass.

### 1.2 Chiếm tài khoản qua liên kết Google — HIGH
`apps/api/src/modules/auth/service.ts:228-237`: `signInWithProvider` gắn identity Google vào bất kỳ `players.email` trùng, giữ nguyên `passwordHash`; đăng ký email không xác minh.
Yêu cầu: không tự gắn vào tài khoản có mật khẩu mà email chưa xác minh. Chọn cách đơn giản, an toàn: khi gắn vào tài khoản đã có, xoá `passwordHash`, thu hồi mọi session cũ của tài khoản đó, và ghi rõ trong `docs/backend.md`. Test: đăng ký email trước bằng mật khẩu → đăng nhập Google cùng email → mật khẩu cũ không đăng nhập được, session cũ bị huỷ.
Đồng thời: đổi tài khoản Google (`auth/controller.ts:~156`) phải xoá session cũ.

### 1.3 Rời bàn Tiến lên bỏ qua người đã về đích — MEDIUM
`packages/game-service/src/arcade/table-play.ts:118-140` (`leaveTable`) chia đều cược người rời cho mọi người còn lại. Với 3–4 người, ghế đã nằm trong `placements` vẫn bị tính là bỏ cuộc hoặc chỉ nhận ~stake/3.
Yêu cầu: ghế đã có placement không bị phạt khi rời; khi một người chưa về đích rời (hoặc bị sweep timeout), thanh toán bằng `topTwoPayout` dựa trên placement đã biết + người rời xếp cuối. Tổng delta vẫn bằng 0. Áp dụng cùng đường cho sweep timeout (`apps/api/src/modules/arcade/tables/maintenance.ts`). Test API cho 3 và 4 người: người về nhất rời; người khác timeout sau khi đã có người nhất.

### 1.4 Sweep nuốt lỗi trong một transaction lớn — MEDIUM
`apps/api/src/modules/arcade/tables/maintenance.ts:78-91` dùng `.catch(() => undefined)` cho nhiều bàn trong một transaction Postgres; `releaseWaiting` (`:33`) cũng nuốt lỗi.
Yêu cầu: mỗi bàn một transaction (hoặc savepoint), lỗi được log có `tableId`, một bàn lỗi không ảnh hưởng bàn khác. Test: một bàn ném lỗi, các bàn khác vẫn được xử lý.

### 1.5 Định tuyến lệnh inventory khai báo hai nơi — MEDIUM
`apps/api/src/modules/commands/controller.ts:15-21` và `packages/game-service/src/application/command-service.ts:31-43` liệt kê riêng. Yêu cầu: export một predicate duy nhất từ game-service, API dùng nó. Test: mọi command type được định tuyến đúng (liệt kê từ union type để test fail khi thêm type mới mà quên).

### 1.6 Race practice ↔ ngồi bàn PvP — MEDIUM
`apps/api/src/modules/arcade/service.ts:72` kiểm tra `seatedMatchId` ngoài khóa. Yêu cầu: kiểm tra lại bên trong khóa document trước khi bắt đầu practice. Test đồng thời (Promise.all) chỉ một trong hai thành công.

### 1.7 Rate-limit đăng nhập kiểm tra ngoài khóa — LOW
`apps/api/src/modules/auth/controller.ts:~90`: `blocked()` ngoài `exclusive`. Yêu cầu: kiểm tra và ghi nhận trong cùng khóa. Sửa comment lỗi thời ở `apps/api/src/_utils/attempt-limiter.ts:3-6`.

### 1.8 Nhỏ
- `gemTable.recordWin` rỗng (`packages/game-service/src/arcade/table-adapters.ts:209-211`): ghi nhận thắng như các game khác.
- `apps/api/src/modules/player/repository.ts:33` dùng `new Date()` → dùng clock inject.
- `apps/api/src/modules/arcade/routes.ts:7` hard-code danh sách game → lấy từ `tableGames`.
- `command-service.ts:3` import qua shim `../character-inventory.js` → import trực tiếp module mới.

---

## Phase 2 — Tooling và build

- `turbo.json`: `test` phụ thuộc `["build"]` (build của chính package) thay vì tự build trong script; bỏ `pnpm build &&` khỏi script `test` của `packages/character-core` và `packages/renderer-phaser`. `lint` không phụ thuộc `^build`. `typecheck` bỏ `^typecheck`. Đọc docs turbo đã cài theo hướng dẫn trong `AGENTS.md` trước khi sửa.
- Build API xoá `dist` trước khi build (còn sót `dist/db`, `application/command-routes.js`…).
- `apps/game/package.json`: `@chibi-town/arcade-games` chuyển sang `devDependencies` nếu src không dùng; khai báo `phaser` làm devDependency thay cho alias trỏ vào `packages/renderer-phaser/node_modules` trong `apps/game/vitest.config.ts`.
- Test app không import `packages/*/src` trực tiếp (`apps/game/tests/raster-surfaces.test.ts:2`, `arcade-table-updates.test.ts:2`): dùng export public, thêm export nếu cần.
- Xác nhận `pnpm check` chạy lạnh (xoá cache turbo) vẫn pass.

---

## Phase 3 — Realtime: vá an toàn

File chính: `apps/api/src/application/realtime-routes.ts`, `packages/api-sdk/src/realtime-client.ts`.

- Giới hạn tần suất **trước** khi đưa vào hàng đợi: lệnh vượt giới hạn bị bỏ ngay, không chạm Redis/khóa. Giới hạn chung cho mọi loại lệnh (không chỉ `map.move`), chặt hơn cho `map.enter`/`lobby.watch`.
- Giới hạn độ dài hàng đợi mỗi kết nối; vượt ngưỡng thì đóng socket với close code riêng.
- Không `presence.touch` trên mỗi message; chỉ làm mới theo heartbeat.
- Kiểm tra tốc độ di chuyển phía server (khoảng cách tối đa theo thời gian) — luật đặt ở module world.
- Đóng socket khi logout / session bị thu hồi / hết hạn (ví dụ kiểm tra lại session trong heartbeat, và logout publish sự kiện đóng tới mọi instance qua hub).
- Kiểm tra `bufferedAmount`; client quá chậm bị ngắt.
- Client: backoff có jitter; phát sự kiện `reconnected` (thêm vào `GameRealtime` trong contracts) để UI arcade/lobby tải lại snapshot. Cập nhật consumer trong `apps/game` và `packages/arcade-games-react`.
- Production (`NODE_ENV=production`) không có `REDIS_URL`: log cảnh báo rõ ràng khi khởi động (không crash, vì một instance vẫn hợp lệ). Thêm Redis vào `deploy/docker-compose.prod.yml` ở dạng tùy chọn có comment.
- Test: spam message không làm chậm người khác và không tăng hàng đợi vô hạn; logout đóng socket; reconnect phát `reconnected`.

---

## Phase 4 — Realtime: tách package (ports & adapters)

Mục tiêu: nghiệp vụ chỉ gọi service; đổi transport (WebSocket → SSE/khác), bus (Redis pub/sub → NATS/Streams) hay store mà không sửa module world/arcade. Theo mẫu `render-contracts` + `renderer-*`.

Cấu trúc:
```
packages/realtime-core/        # không import Fastify, ws, redis, db, Node-only API ngoài node:crypto nếu cần
  src/ports.ts                 # Transport, Connection, Bus, Store
  src/realtime-service.ts      # createRealtimeService
  src/rooms.ts, presence.ts    # topic/room/sức chứa/lease — không có khái niệm map/bàn
  src/_utils/connection-policy.ts  # rate-limit, queue cap, heartbeat, backpressure (chuyển từ Phase 3)
  src/memory.ts                # adapter bộ nhớ cho test/dev
  tests/adapter-contract.ts    # bộ test contract dùng chung cho mọi Bus/Store adapter
packages/realtime-redis/       # Bus + Store bằng Redis
packages/realtime-fastify-ws/  # Transport bằng @fastify/websocket
```

API public của core (có thể chỉnh tên nhưng giữ ý):
```ts
interface RealtimeService {
  publish(topic: string, event: RealtimeEvent, except?: ConnectionId): Promise<void>;
  notifyPlayers(playerIds: string[], event: RealtimeEvent): Promise<void>;
  rooms: RoomService;
  presence: PresenceService;
  handle<T extends RealtimeCommand['type']>(type: T, handler: CommandHandler<T>): void;
}
createRealtimeService({ transport, bus, store, clock, policy? }): RealtimeService
```

Yêu cầu:
- Ghi rõ đảm bảo trong `ports.ts`: event gửi tối đa một lần, thứ tự giữ theo kết nối, client phải tải lại snapshot sau reconnect. Tiền/bài/inventory vẫn đi HTTP + Postgres + game-service; realtime chỉ báo thay đổi.
- `apps/api`: `app.ts` là nơi duy nhất chọn adapter theo config. Handler đăng ký trong `modules/world/realtime.ts` (map.*: bounds, sức chứa kênh, tốc độ) và `modules/arcade/realtime.ts` (lobby.*). Arcade gọi `realtime.notifyPlayers`/`publish` thay cho hub. Xoá `application/realtime-routes.ts`, `infrastructure/realtime/realtime-hub.ts`, `shared-state.ts` sau khi chuyển; phần lock/attempt-limiter còn dùng `SharedState` thì giữ một port KV/lock nhỏ hoặc chuyển sang `realtime-redis` — chọn và ghi lý do.
- Redis data model, bỏ khóa toàn cục `map-rooms` và mọi `SCAN`:
  - room: Hash `room:<topic>` field = playerId, value = {owner, player}; cập nhật owner-checked bằng Lua trên đúng key đó.
  - presence: ZSET theo map/kênh, score = seenAt; dọn bằng `ZREMRANGEBYSCORE`; đếm bằng `ZCARD`; claim sức chứa bằng Lua chỉ chạm key khai báo trong `KEYS` (tương thích Redis Cluster, dùng hash tag cùng slot).
  - một lease cho mỗi kết nối thay cho ba cơ chế presence/connection/room lease chồng nhau.
- Pub/sub theo topic (hoặc sharded pub/sub), instance chỉ subscribe topic có socket cục bộ.
- Hub serialize event một lần cho mọi người nhận.
- Gom `map.move` theo tick mỗi phòng (~10Hz) thành một event `map.moves` (cập nhật contracts, client, renderer location).
- `channel-presence` dọn code thừa: `presence.enter`, `presence.others`, tham số `mapId` bị bỏ qua của `exclusive`.
- Test: bộ contract chạy cho adapter memory và Redis (Redis tự bỏ qua khi không có `REDIS_URL` test); hai app dùng chung bus thấy nhau; không còn lời gọi `SCAN`/khóa toàn cục trong đường đi của move.
- Cập nhật `AGENTS.md` (mục Backend + mục mới "Realtime") và `docs/backend.md`.

---

## Phase 5 — Ứng dụng game

- `apps/game/src/features/farm/farm-store.ts:14`: chỉ áp snapshot khi `revision` lớn hơn (tránh render + clone mỗi giây).
- Code production phụ thuộc devtools: chuyển `devtools/town/_utils/town-logic`, `town-map`, `rendering/town-view`, `town-effects-view` vào `src/game/` (chỗ thích hợp), cập nhật import ở `features/farm/runtime/farm-game.ts`, `farm/_utils/farm-walk-logic.ts`, `farm/rendering/farm-view.ts`, `character/_components/character-lab-view.ts`. Devtools chỉ import từ game/features, không ngược lại. Chặn route devtools `/ui`, `/town`, `/farm-art-review` ở production (`application/game-application.tsx:36-40`, `screen-router.ts:46-48`).
- `features/location/main.tsx`: tách theo mẫu farm thành `_utils/location-input-logic`, `rendering/location-view`, `runtime/location-game`; không cấp phát mảng/closure mỗi frame; đổi ngôn ngữ không dựng lại scene và không rời/vào lại phòng realtime. Bắt lỗi `getWorld()` ở nút portal và bỏ qua sau unmount.
- `features/farm/farm-screen.tsx`: chuyển fixture review (`:47-101`) sang devtools; hit-test sang `farm/_utils`, bỏ tọa độ cứng trùng lặp; bỏ `document.querySelector` bằng ref; memo `execute`.
- `application/game-application.tsx`: effect auth không chạy lại mỗi lần đổi route; effect tải màn không chạy hai lần vì `audio`; bọc `sessionStorage` bằng try/catch (`:272`).
- World map đi qua `game/rendering/renderer-providers.ts`, lazy-load Phaser như town/Lab.
- `packages/renderer-phaser/src/world-map-view.ts`: tạo con bò (hoặc xoá code chết nếu art không có — kiểm tra trước); bỏ cấp phát mỗi frame (`drawFountains`, `texture()`, mảng hằng); chỉ `setTexture` khi frame đổi; kiểm tra dữ liệu thay cho `!` (lighthouses, fishSpots). Có thể tách theo hệ (water, farm, plane, lights) nếu không đổi hành vi.
- i18n: key cho giá + tiền tệ, `LV {{level}} {{name}}`, `Thoát/Vào`, lỗi trong `farm-store.ts:46`, metadata/fallback `app/layout.tsx`; thay `'vi-VN'` cứng bằng `i18n.language`; nút portal hiển thị label.
- CSS: chuyển selector farm/warehouse/world map khỏi `packages/ui/src/theme.css` sang CSS của feature (xem bảng ownership trong `docs/target-architecture.md`).
- Xoá re-export wrapper `farm/_utils/farm-animal-logic.ts`, `farm/_utils/farm-map-data.ts` (consumer import thẳng package); đổi import tương đối sang `@/`; chuyển `farm/_utils/farm-scene-assets.ts` (dùng DOM) sang `rendering/`.
- Arcade React: gom phần lock/alive/stale/replay/timer lặp ở 4 component vào hook `useTableSession` trong `packages/arcade-games-react/src/_utils/`.
- Kiểm tra trực quan (chạy app) màn farm, location, world map, arcade sau khi đổi — ghi lại đã kiểm những gì.
