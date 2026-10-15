# Backend: `apps/api`

Trạng thái ngày 2026-10-15. Server phục vụ farm, kho, outfit, đăng nhập, người chơi cùng khu trên phố giải trí và bàn người thật cho cả bảy game arcade. Phòng luyện tập vẫn chơi riêng với bot.

## Quyết định đã chốt

- **Stack**: Node ≥ 22.13, Fastify, PostgreSQL, Drizzle. Mặc định chạy một process với shared-state trong bộ nhớ; đặt `REDIS_URL` để nhiều process dùng chung Redis. Postgres giữ save và khóa sweep, không dùng queue bền vững.
- **Tài khoản**: tự tạo khách khi trình duyệt chưa có phiên; popup đăng ký bằng email + mật khẩu hoặc Google là tùy chọn. Khách chỉ truy cập được bằng cookie trong trình duyệt hiện tại. Đăng ký nâng cấp cùng player/save; đăng nhập tài khoản có sẵn chuyển tài khoản, không gộp tiến độ khách.
- **Lưu tiến trình**: server là nguồn chính. Adapter local chỉ dùng để phát triển và test; không có luồng nhập save local lên tài khoản.
- **Bàn arcade**: ô cố định theo địa chỉ `(gameId, khu, roomId, tableId)`. Chỉ ván đang diễn ra được lưu; bàn trống là bàn không có ván.
- **Bot**: chỉ ở phòng luyện tập. Phòng cược là người với người.
- **Vào bàn PvP**: chủ bàn không chọn số người. Tiến lên/Phỏm tối đa 4 chỗ; Cờ vua/Cờ tướng/Kim cương có 2 chỗ; Bầu cua/Xèng có 1–4 người cược với nhà cái. Mọi người đã vào và sẵn sàng thì chủ bàn bắt đầu.
- **Xu/Gem**: không mua bằng tiền thật.
- **Triển khai**: API đặt sau cùng domain với game (proxy `/api`) để cookie là first-party.

## Cấu trúc

```text
apps/api/
  compose.yaml               # Postgres cho dev, cổng 5433
  drizzle/                   # migration sinh bởi drizzle-kit, không sửa tay
  src/
    main.ts                  # đọc env, chạy migration, listen
    app.ts                   # createApp(deps): CORS, lỗi, đăng ký route
    config.ts
    _utils/                  # password, session-auth, http-errors
    application/             # WebSocket transport
    infrastructure/
      database/              # schema, kết nối, migration runner
      realtime/              # shared-state, Redis, hub phát sự kiện
    modules/
      auth/                  # đăng ký, đăng nhập, Google
      player/                # player route, khóa và lưu document
      character/             # lựa chọn trang bị khởi đầu
      inventory/             # inventory route, hydrate/lưu collection trong transaction
      farm/                  # snapshot, kho nông sản
      arcade/                # routes, repository, transaction bàn, dọn bàn hết hạn
      world/                 # khu, presence, phòng map
      commands/              # endpoint SDK /commands, chuyển tới service của domain
  tests/                     # chạy trên PGlite, không cần Docker
packages/game-service/       # lõi điều phối dùng chung cho local và server
```

`@chibi-town/game-service` chứa toàn bộ thao tác của `GameSdk` dưới dạng hai bước: gọi với input để validate, nhận lại một hàm chạy trên `PlayerDocument`. Nơi gọi tự mở transaction. `createLocalSdk` chạy nó trên IndexedDB với người chơi cố định `local-player`; server chạy nó trên một dòng Postgres bị khóa, với id tài khoản thật. Session bàn ghi id đó làm `hostId`, khớp với `getPlayer().id` mà UI dùng để bật quyền chủ bàn.

### Ranh giới nghiệp vụ và cách lần lỗi

`app.ts` khởi tạo dependency và đăng ký từng module qua `app.register()`. Module dùng các tên file ngắn theo vai trò:

```text
modules/inventory/
  index.ts        # public API và nối route/controller/service
  routes.ts       # URL → controller được đặt tên
  controller.ts   # request.player/body → service
  service.ts      # nghiệp vụ, transaction, gọi pure core
  repository.ts   # SQL inventory
  transaction.ts  # hydrate/lưu collection cùng row lock của ví
```

Chỉ thêm lớp khi có trách nhiệm thật: `player` có một route đọc nên gọi service trực tiếp; `farm` dùng player repository và không có repository riêng; `character` chỉ có service cấp starter nên không tạo route/controller rỗng. `arcade/tables` có service/repository và helper dọn bàn riêng vì bàn PvP được lưu khác phòng luyện tập. Module khác gọi qua `index.ts` của owner; helper nội bộ không cần export rộng.

Nhóm route game có hook `preHandler` xác thực một lần, gán `request.player` từ cookie và cập nhật presence. Public auth nằm ngoài scope đó; WebSocket vẫn kiểm tra origin/cookie riêng. Controller gọi thẳng `service.getInventory(player, query, trace)` hoặc các hàm có tên tương tự; không còn `GameContext`, `runPlayer`, `runInventory`, `onPlayer` hay callback `prepare`.

`/commands` giữ nguyên cho SDK; `commands/controller.ts` validate rồi chuyển lệnh tới `inventory/service.ts` hoặc `farm/service.ts`. Service của domain mở đúng loại transaction. Player repository không biết bảng inventory. `inventory/transaction.ts` hydrate/chạy/lưu collection bằng cùng transaction và row lock với wallet; auth gọi `character` khi cấp starter. Các service API chỉ dùng shared rules: command coordinator vẫn chịu trách nhiệm receipt/revision/ví để local và server xử lý giống nhau.

Trong shared core, `game-service.ts` chỉ ghép các service nhỏ. `application/command-service.ts` giữ validation, receipt, revision và đồng bộ ví; `farm/farm-commands.ts` xử lý farm; `character/` xử lý outfit; `inventory/` giữ grant, collection và thao tác; `shop/cosmetic-offers.ts` giữ offer/mua. `arcade/` chia phòng luyện tập theo game và bàn PvP theo vòng đời. Hai file public `character-inventory.ts` và `arcade-tables.ts` chỉ re-export để giữ tương thích. Không thêm DI container, base repository hay event bus nghiệp vụ.

Bật `LOG_LEVEL=debug` khi chạy API để thấy từng bước. Header response `X-Request-Id` tương ứng `reqId` trong JSON log; `commandId` là requestId do SDK gửi để replay, hai mã phục vụ hai mục đích khác nhau. Các bước inventory: `lock-player → load-player → load-inventory → run-operation → save-inventory → save-player`. Khi lỗi, log dừng ở bước tương ứng; transaction rollback toàn bộ. Log từ chối có `code` và `reason` như `ITEM_IN_WAREHOUSE`, `COLOR_NOT_OWNED`, `COSMETIC_ALREADY_OWNED`; response vẫn chỉ trả code tương thích SDK. Không log body, mật khẩu, cookie hoặc outfit.

Ví dụ lỗi mua đồ: tìm `reqId` → xem `operation/commandId/playerId/phase/reason` → mở `modules/commands/routes.ts` → `controller.ts` → `modules/inventory/service.ts` → `transaction.ts` → `packages/game-service/src/shop/cosmetic-offers.ts`. Farm đi tới `farm/farm-commands.ts`; bàn PvP đi tới `modules/arcade/service.ts` → `tables/service.ts` rồi luật `arcade/table-play.ts`.

## Dữ liệu

| Bảng | Nội dung |
| --- | --- |
| `players` | id, tên hiển thị, username nullable/duy nhất, level, email nullable (duy nhất khi có), guest, last_seen_at, hash mật khẩu, registration_bonus_at, username_required, last_renamed_at |
| `identities` | (provider, subject) → player |
| `sessions` | hash của token cookie, player, hết hạn sau 30 ngày (khách: 365 ngày) |
| `player_documents` | một `PlayerDocument` mỗi người, kiểu `json` |
| `arcade_tables` | bàn người với người đang mở: địa chỉ bàn và `TableRecord` (ván, ghế, receipt) |
| `arcade_seats` | (player, game) → bàn đang ngồi |

Cột document dùng `json` thay vì `jsonb`: việc cắt bớt receipt cũ dựa vào thứ tự key, `jsonb` không giữ thứ tự đó. Mỗi request khóa dòng bằng `SELECT … FOR UPDATE`, chạy thao tác rồi ghi lại, nên lệnh gửi đồng thời xếp hàng thay vì ghi đè nhau.

Ván người thật nằm trong `arcade_tables`, còn ví xu và tiền giữ cược nằm trong document của từng người. Transaction khóa toàn bộ ví tham gia trước khi thanh toán; chưa có sổ biến động xu riêng.

## API

Mọi route nằm dưới `/api`. Các route game giống hệt `createHttpSdk` (bảng trong [api-sdk.md](api-sdk.md) và [arcade.md](arcade.md)) và đều cần cookie phiên; thiếu cookie trả `401 {code: 'UNAUTHENTICATED'}`.

| Route | Body | Kết quả |
| --- | --- | --- |
| POST `/auth/guest` | — | 201 `{player}`, tạo Khách + 4 chữ số, cookie 365 ngày |
| POST `/auth/register` | email, password (8–200 ký tự), name (2–20 ký tự sau trim), username (3–20 ký tự) | 201 `{player}`, đặt cookie hoặc giữ phiên khách khi nâng cấp |
| POST `/auth/login` | email (email hoặc username), password | `{player}`, đặt cookie |
| POST `/auth/username` | username | `{player}`, chỉ đặt một lần cho tài khoản không phải khách; lỗi `USERNAME_TAKEN`/`USERNAME_IMMUTABLE` |
| POST `/player/name` | name | `{player}`, đổi tên tối đa một lần mỗi 7 ngày; `429 RENAME_TOO_SOON` kèm `nextAllowedAt` (epoch ms) |
| POST `/auth/logout` | — | xóa phiên |
| GET `/auth/session` | — | `{player \| null, providers: {google}}` |
| GET `/auth/google` | — | chuyển hướng sang Google (404 khi chưa cấu hình) |
| GET `/auth/google/callback` | — | đặt/giữ cookie rồi chuyển về `WEB_ORIGIN`, lỗi thì thêm `?auth=failed` |

Mọi `{player}` trong auth có `guest: boolean` và `username: string | null`; `/player`, presence và `players` của bàn cũng có username. Khách có username null. `POST /auth/register` khi đang là khách cập nhật email/hash/tên và `guest=false` trên cùng player, giữ nguyên phiên và document. Google chưa có identity/email cũng nâng cấp khách và giữ phiên; identity hoặc email đã có thì chuyển sang người chơi đó. `/auth/login` luôn chuyển sang tài khoản đích.

### Số dư, thưởng và giới hạn đăng ký

Mọi document tài khoản server mới khởi tạo **30.000 xu, 0 lượng**; các hằng số nằm trong `packages/game-content/src/account-balance.ts`. Local và server dùng chung mức xu khởi đầu; chỉ áp dụng khi tạo người chơi mới, không đặt lại ví đã lưu. Lần đầu chuyển thành tài khoản không phải khách (đăng ký trực tiếp, nâng cấp khách, Google lần đầu) nhận thêm **50.000 xu + 20 lượng**. Đăng ký trực tiếp/Google mới vì thế có số dư cuối 80.000 xu và 20 lượng. Nâng cấp giữ tiền và tiến độ đã có rồi cộng thưởng.

`registration_bonus_at` được ghi cùng transaction tạo/nâng cấp và cập nhật document đã khóa; identity Google cũng ghi trong transaction đó. Retry, đăng nhập lại và callback Google đồng thời không trả thưởng thêm. Tài khoản không phải khách có từ trước thay đổi này không được trả thưởng hồi tố. Popup dùng key react-i18next để xác nhận “Bạn nhận 50.000 xu và 20 lượng”; Google chuyển về `?auth=registered` khi vừa được thưởng.

Đăng ký trực tiếp và nâng cấp khách dùng chung hạn mức **5 đăng ký thành công mỗi địa chỉ trong cửa sổ 24 giờ**, qua attempt limiter và khóa SharedState theo địa chỉ; thất bại validate/trùng email/username không tiêu hạn mức. Vượt hạn trả `429 TOO_MANY_ATTEMPTS`. Google không nằm trong hạn mức đăng ký email này. `request.ip` là địa chỉ do Fastify xử lý theo cấu hình `trustProxy`.

### Username và tên hiển thị

Username bắt buộc khi đăng ký email/nâng cấp khách: 3–20 ký tự `[a-z0-9_.]`, bắt đầu bằng chữ hoặc số, chuyển chữ thường trước lưu, unique và không đổi sau khi đặt. Login giữ body field `email` để tương thích SDK, nhưng chấp nhận cả email lẫn username trong field này.

Google mới giữ `username=null`, `username_required=true`; client bắt buộc hoàn thành “Chọn username” trong cùng popup trước khi mount màn hình chơi. `POST /auth/username` lấy player id từ cookie, từ chối khách, tên trùng và mọi lần đặt sau lần đầu. Dòng player khóa khi đặt để hai request không thể đổi username của nhau.

**Tài khoản cũ được sinh username ở lần đăng nhập email hoặc Google đầu tiên, không backfill trong SQL migration.** Chuẩn hóa email local part bằng NFKD, bỏ dấu/chữ không hợp lệ và dấu `_`/`.` đầu chuỗi, bổ sung `player` nếu quá ngắn, cắt còn tối đa 20 ký tự và thêm hậu tố số nếu trùng. `username_required` phân biệt tài khoản Google mới cần tự chọn với tài khoản cũ. Phiên cũ còn hiệu lực nhưng thiếu username cũng được client yêu cầu chọn trước khi chơi.

Tên hiển thị được trim, dài 2–20 ký tự, được trùng. Khách cũng dùng `POST /player/name`. Lần đổi đầu không bị chờ; lần sau cách `last_renamed_at` ít nhất 7×24 giờ. API khóa player và trả thời điểm được đổi tiếp qua `nextAllowedAt`; popup hiển thị thời điểm đó. Profile và UI bàn ghi `Tên hiển thị @username`; snapshot bàn đọc lại tên/username hiện tại từ `players` để phản ánh đổi tên ngay.

Tạo khách giới hạn 10 lần mỗi địa chỉ trong một giờ, dùng attempt limiter qua SharedState, trả `429 TOO_MANY_ATTEMPTS`. Request có phiên hợp lệ cập nhật `last_seen_at` tối đa mỗi giờ một lần. Sweep bàn dùng cùng advisory transaction lock để xóa khách vắng trên 30 ngày sau khi xử lý bàn cũ; FK cascade xóa document, identity và session. Tài khoản đã đăng ký không bị dọn.

Cookie `chibi_session` là httpOnly, `SameSite=Lax`, thêm `Secure` khi `NODE_ENV=production`. Google dùng authorization code + PKCE; tài khoản được tạo ở lần đăng nhập đầu, và chỉ gắn vào tài khoản email sẵn có khi Google xác nhận email đó. Khi gắn identity mới vào email sẵn có, transaction xóa `passwordHash` và thu hồi **mọi session cũ** của tài khoản đích; mật khẩu được đăng ký trước khi email xác minh không còn đăng nhập được. Callback cấp phiên mới sau liên kết và xóa phiên trình duyệt cũ khi chuyển sang tài khoản Google khác. Nâng cấp khách mới vẫn giữ phiên. CORS chỉ trả header cho đúng `WEB_ORIGIN`. Sai mật khẩu 10 lần cho một email (hoặc 30 lần từ một địa chỉ) thì đăng nhập bị khóa 10 phút, trả `429 {code: 'TOO_MANY_ATTEMPTS'}`; bộ đếm đi qua `SharedState`: trong bộ nhớ mặc định, dùng chung và có TTL khi bật Redis; kiểm tra hạn mức, xác thực và ghi nhận kết quả nằm trong cùng khóa theo địa chỉ rồi theo email, dùng namespace khác khóa ghi bộ đếm.

Lobby arcade và danh sách khu trả `source: 'live'`. Presence đếm người chơi thật, TTL 5 phút, được làm mới bởi request và heartbeat socket. Mặc định ở bộ nhớ; Redis chia sẻ giữa các API. Join khu giữ chỗ nguyên tử bằng Lua khi bật Redis, trước khi ghi lựa chọn khu vào save; mặc định dùng cùng quy tắc qua hàng đợi trong bộ nhớ.

## Realtime

`GET /api/ws` nâng cấp thành WebSocket. Handshake phải có cookie phiên và header `Origin` đúng `WEB_ORIGIN`. Kiểu message nằm ở `packages/contracts/src/realtime.ts`; client là `createRealtimeClient` trong `@chibi-town/api-sdk`, tự kết nối lại và gửi lại `map.enter`/`lobby.watch` gần nhất.

| Client gửi | Server làm |
| --- | --- |
| `map.enter {regionId, mapId, x, y}` | Đưa người chơi vào phòng `map:<mapId>:<khu đã lưu>`, trả `map.state`, báo `map.join` cho người khác |
| `map.move {x, y}` | Báo `map.move` cho người cùng khu, lọc trước queue tối đa một lần mỗi 80 ms, kiểm tra ngân sách quãng đường phía server |
| `map.leave` hoặc đóng socket | Báo `map.leave` |
| `lobby.watch {gameId}` | Nhận `lobby` khi bàn của game đó trong khu của mình thay đổi |

Server đẩy `match {gameId}` cho mọi người ngồi trong bàn khi bàn đổi. `lobby` và `match` không mang dữ liệu: client đọc lại snapshot của chính mình qua SDK, nên bài của người khác không bao giờ nằm trên một message dùng chung.

`infrastructure/realtime/shared-state.ts` là ranh giới phối hợp (`get/set/entries`, lease, claim presence nguyên tử, khóa và pub/sub). `createApp({shared})` cho phép inject một bus trong bộ nhớ dùng chung khi test. Không đặt `REDIS_URL` thì mỗi app tự tạo bộ nhớ riêng; có URL thì dùng npm client `redis` ghim 5.8.2, với một kết nối lệnh và một kết nối subscribe. Hub chỉ giữ socket/topic cục bộ; envelope pub/sub có id process để không phát trùng ở nguồn. Không đưa snapshot bài vào Redis pub/sub.

Policy thuần nằm trong `application/_utils/connection-policy.ts`, không import Fastify/ws/Redis; transport giữ state và thực hiện quyết định. Mọi frame (kể cả JSON sai) dùng chung token bucket 30 message/giây, burst 40, trước khi parse/queue/chạm shared-state. `map.enter` và `lobby.watch` dùng thêm bucket chung 2/giây, burst 2; `map.move` cách nhau tối thiểu 80 ms. Frame quá tốc độ bị bỏ ngay. Mỗi socket có tối đa 16 lệnh không phải move đang chạy/chờ; vượt mức đóng code `4008`. Move được gộp last-write-wins: tối đa một move đang chờ ngoài move đang chạy, thay move chờ bằng vị trí mới nhất và đưa về cuối queue để không vượt enter/leave đứng trước nó. Move vượt rate-limit vẫn bị bỏ ngay như các frame khác. Heartbeat/lease là tác vụ bảo trì, không tính vào giới hạn lệnh; chỉ một heartbeat được chờ/chạy tại một thời điểm. Queue giữ tác vụ thực, không tích lũy Promise placeholder của move cũ. Khi đóng, tác vụ chưa chạy bị bỏ, cleanup chờ tác vụ đang chạy kết thúc. `bufferedAmount` quá 256 KiB đóng code `4009`, kiểm tra trước/sau send và mỗi heartbeat.

`modules/world/movement-policy.ts` giữ luật thuần: tối đa 120 pixel native/giây, ngân sách quãng đường tích lũy tối đa 40 pixel để chịu jitter mạng (client đi 100 pixel/giây). Cả khoảng cách chéo và các bước liên tiếp đều trừ cùng ngân sách; đứng yên lâu không tích lũy khả năng teleport. Map room lưu ngân sách trong lease dùng chung; gọi lại enter trên cùng socket khi vẫn ở cùng phòng không reset ngân sách. Socket mới vẫn được nhận vị trí enter mới nhất của client khi reconnect, theo contract hiện tại.

Presence không touch theo từng message; socket chỉ gia hạn theo heartbeat (enter vẫn phải claim sức chứa, HTTP giữ cơ chế touch hiện tại). Handshake dùng `readSessionState` chỉ đọc, ghi nhớ `expiresAt`; mỗi heartbeat kiểm tra hạn đã biết và đóng `4001` khi hết hạn mà không query DB. Kiểm tra thu hồi bằng lookup chỉ đọc mỗi 4 heartbeat (60 giây, `CONNECTION_POLICY.sessionCheckEveryHeartbeats`), không cập nhật `players.lastSeenAt`. Session thực sự không hợp lệ mới đóng `4001`; lỗi DB/Redis được log, giữ socket và thử lại ở heartbeat sau. Request HTTP vẫn cập nhật lastSeenAt theo cơ chế hiện tại. Logout xóa session rồi publish hash phiên qua hub để mọi tab của đúng phiên trên mọi instance đóng ngay; phiên khác của cùng tài khoản vẫn được giữ. Chuyển tài khoản Google cũng revoke cookie cũ qua hub. Pub/sub bị mất sự kiện thì lookup định kỳ phát hiện ở lần kiểm tra session tiếp theo (bình thường tối đa khoảng 60 giây). Client backoff lũy thừa có jitter 0,5–1,5 lần, trần 30 giây; sau khi mở lại và gửi enter/watch, phát notification cục bộ `reconnected` qua `GameRealtime.subscribe`. Arcade reload snapshot riêng/lobby, shell arcade reload thông tin người chơi/ví và location xóa remote cache chờ `map.state` mới. Notification này không được decode từ wire.

Map room lưu outfit/vị trí và token chủ sở hữu theo socket, lease 45 giây. Heartbeat 15 giây gia hạn lease, kiểm tra pong và gửi lại `map.state` để loại người đã hết hạn. Tab cũ đóng hoặc di chuyển không xóa/ghi đè người đang do tab mới giữ. Socket lease dùng chung cũng giúp một API không gỡ ghế chờ của người còn kết nối ở API khác. Redis pub/sub không lưu lịch sử; snapshot trong Postgres vẫn là nguồn chính.


Test an toàn realtime: `realtime-safety.test.ts` bao phủ logout xuyên instance, spam/queue nghẽn không chặn kết nối khác, hạn mức chung/enter-watch, không touch mỗi message, heartbeat hết hạn/thu hồi, backpressure và teleport/re-enter. `realtime-review.test.ts` kiểm tra lỗi DB/Redis tạm thời không ngắt socket, lookup session thưa/chỉ đọc, hết hạn không query và 100 move khi lock chậm chỉ áp dụng vị trí cuối. `connection-policy.test.ts` kiểm tra biên policy thuần, thứ tự enter/leave khi thay move chờ, giới hạn chỉ tính command và ngân sách di chuyển; `apps/game/tests/remote-players.test.ts` kiểm tra jitter, replay enter/watch và notification reconnect. Phase 3 giữ cấu trúc hiện tại; package ports/adapters, thay Redis data model và batch move vẫn thuộc Phase 4.

## Bàn người với người

Đã có Tiến lên, Phỏm, Cờ vua, Cờ tướng, Kim cương, Bầu cua và Xèng. Khách chỉ được vào phòng luyện tập ID 3 và bàn nhà cái Bầu cua/Xèng; vào bàn cược Tiến lên/Phỏm/Cờ vua/Cờ tướng/Kim cương trả `403 ACCOUNT_REQUIRED`. Luật dùng chung trong `assertTableAccount` của game-service; SDK HTTP giữ nguyên code, UI hiện giải thích và nút mở popup đăng ký. Phòng cược (ID 0–2) chỉ có người thật; phòng luyện tập (ID 3) vẫn là ván riêng với bot trên save của người chơi. SDK và đường dẫn HTTP giữ nguyên; `modules/arcade/routes.ts` gọi controller; `service.ts` chọn bàn hoặc save theo phòng và ván đang ngồi. Kim cương dùng lobby `/arcade`, `battleId` và kết quả `battle`; các trò khác dùng `matchId` và `match`.

- **Địa chỉ bàn**: `(gameId, khu, roomId, tableId)`; khu là khu phố giải trí đã chọn. `arcade_tables` chỉ có dòng khi có người ngồi; `arcade_seats` đảm bảo mỗi người một bàn mỗi game, kể cả không mở đồng thời phòng luyện tập.
- **Luật bàn**: `packages/game-service/src/arcade/table-types.ts` khai báo `TableGame`, `table-adapters.ts` đăng ký từng game; `table-lobby.ts`, `table-play.ts`, `table-view.ts` giữ luật/chuyển trạng thái/snapshot, không đụng DB. Người đầu tiên là chủ bàn. Không mời bot vào phòng cược. Bài cần ít nhất 2 người; cờ/Kim cương đúng 2; trò nhà cái cho phép 1–4.
- **Tiến lên/Phỏm**: chủ bàn đặt cược chung; đổi cược thì các thành viên xác nhận lại. Số người là số ghế thật, không do chủ bàn chọn. Cả hai trả `topTwoPayout`: 2 người 100/0, 3 người 80/20, 4 người 60/40 cho nhất/nhì. Phỏm giữ chủ bàn là người nhận 10 lá và đi đầu; các ghế còn lại nhận 9 lá. Chỉ xử lý hành động ghế gọi; không tự chơi các ghế khác.
- **Cờ vua/Cờ tướng**: chủ bàn trắng/đỏ, ghế còn lại đen. Snapshot có `side`, board/moves giữ tọa độ và màu tuyệt đối; kết quả thắng/thua theo người xem. Người đen thấy bàn xoay 180 độ và được đi quân đen đúng lượt. Đầu hàng cho đối thủ thắng. Thắng +cược, thua −cược, hòa 0.
- **Kim cương**: ghế 0 là fighter `player`, ghế 1 là `bot` trong engine; đây là hai người thật. Snapshot ghế 1 đổi fighters, lượt, won/lost và actor của từng bước animation. Lượt thưởng/cascade giữ cùng luật; không tự tạo nước đi cho đối thủ. Thắng +cược, thua −cược.
- **Bầu cua/Xèng**: mỗi thành viên gọi `configureArcadeTable` để đặt cược riêng và, với Bầu cua, cửa riêng; thao tác đó đánh dấu chính họ sẵn sàng. Chủ bàn đồng thời đặt mặc định của bàn, không sửa cược người khác. Chủ bàn roll/spin khi mọi người sẵn sàng; cùng một kết quả nhưng thanh toán từng cược theo nhà cái. `TableGame.settlement` và `session.settlement: house` cho phép tổng delta khác 0; `housePayouts` ghi delta và số dư từng người. `next-round` giữ bàn/receipt, xóa kết quả và reset sẵn sàng của mọi thành viên. Trạng thái `playing` cũng hỗ trợ lệnh `start` riêng trước roll/spin.
- **Ngẫu nhiên**: server sinh seed 128-bit bằng `node:crypto.randomBytes`, local dùng `crypto.getRandomValues`. Engine thuần dùng sfc32 với bốn word 32-bit; cùng seed và action vẫn cho cùng kết quả. Boundary cấp seed mới lúc tạo/chia lại, mỗi action (bao gồm `next-round`, roll/spin và lượt Kim cương); receipt retry trả kết quả cũ. Seed số từ save/bàn cũ vẫn đọc được và chuyển mềm sang state bốn word; không đổi schema. Seed không có trong snapshot/step/event.
- **Practice/PvP**: kiểm tra ghế lại trong transaction đã khóa document; ngồi PvP cũng kiểm tra practice sau khi khóa cùng document, nên hai start đồng thời chỉ một thành công.
- **Thông tin kín**: snapshot bài quay ghế để người xem là ghế 0; `players` theo thứ tự đó, gồm `{ id, name, username, outfit }`, chỉ có hand của họ. Nọc, bài chưa chia và seed không ra ngoài server. Phỏm đánh số lại các vùng bài/điểm/xếp hạng và đích `send.seat`; khi kết thúc, `finalHands` là bài công khai theo thứ tự người xem. Cờ giữ tọa độ tuyệt đối; `players` vẫn đặt người xem trước. Không snapshot hay bước kết quả nào chứa seed.
- **Xu**: khi bắt đầu, `tableStakes` trên từng save giữ đúng mức cược đã đồng ý, nên farm và ván khác không tiêu được. Người thiếu xu không thể sẵn sàng/bắt đầu. Tất cả thay đổi xu đi qua `pay`: khóa bàn, khóa save theo thứ tự id và ghi cùng một transaction. Receipt theo người/requestId trả lại kết quả lần đầu, không thanh toán hai lần.
- **Rời bàn**: chờ hoặc đã có kết quả thì miễn phí. Tiến lên giữ nguyên placement đã đạt; người về đích rời không phạt. Người chưa về đích rời/timeout được engine thuần đánh dấu `forfeited`, xử thua và không vào top 2. `departedPlayerIds` giải phóng `arcade_seats` nhưng giữ chỉ số ghế, bài kín và document tham gia để thanh toán sau. Kết quả rời trả `coinDelta = -stake`, ví chưa đổi và `tableStakes` vẫn giữ tới settlement; chưa được mở ván cùng game trước đó. Nếu chưa đủ nhất/nhì, những người còn lại tiếp tục chơi, không suy hạng theo index ghế. Chỉ suy hạng khi còn đúng một người tranh hạng; khi đủ nhất/nhì dùng `topTwoPayout` trên số người góp cược ban đầu, tổng delta bằng 0 và ghi thắng cho nhất. Bàn 2 người chỉ cần xác định người còn lại thắng; nếu nhiều lần bỏ cuộc chỉ còn một người không bị loại thì người đó nhận cả quỹ, không gán hạng cho người bỏ cuộc. Kết thúc do rời/timeout thì đóng bàn ngay. Save cũ không có `forfeited` vẫn hợp lệ. Phỏm và các game khác giữ hành vi cũ: đang chơi mà rời mất cược riêng, chia đều cho người ở lại và đóng bàn; phần dư cho ghế còn lại đầu tiên. Bàn nhà cái một người không có người nhận nên nhà cái giữ cược bỏ cuộc.
- **Hết giờ**: `TableRecord.turnStartedAt` ghi lúc chia bài và mỗi lần đổi ghế tới lượt; thao tác cùng lượt (như rút/hạ/gửi Phỏm hoặc lượt thưởng Kim cương) không gia hạn. Sweep dùng mốc này, không dùng `updated_at`; dữ liệu cũ thiếu mốc tạm dùng `updated_at`. Sau 60 giây ghế đang tới lượt bị xử qua cùng `leaveTable`. Với Tiến lên, engine bỏ qua ghế `forfeited` khi chuyển lượt/mở vòng/pass; nếu ván còn tiếp tục, `turnStartedAt` được đặt lại bằng clock inject cho ghế tới lượt mới. Không trừ ví hay trả thưởng sớm khi chưa có thứ hạng. Bàn chờ/đã xong để yên 10 phút thì đóng. Người ngắt kết nối 20 giây mất chỗ ở bàn chưa bắt đầu. UI nghe `useArcadeLive`, đọc lại snapshot riêng, hiện tên thật và khóa thao tác ngoài lượt; nếu người khác đóng bàn, quay về danh sách bàn và cập nhật ví.

- **Đồng hồ**: mọi snapshot bàn đang chơi có `serverTime` và `turnEndsAt` (epoch ms). `TurnCountdown` bù lệch đồng hồ theo thời điểm nhận snapshot như farm, hiện tại ghế đang đi và nổi bật khi là lượt người xem; 10 giây cuối đổi sang cảnh báo. Locale nằm trong package arcade React. Phòng luyện tập không thêm hạn lượt.
- **Replay**: `TableRecord.lastSteps` lưu bước của hành động cuối theo từng ghế, đã loại thông tin kín và đổi actor về góc nhìn ghế đó. Active snapshot trả `lastSteps: { revision, steps }`; UI so revision đã xác nhận, chỉ phát hành động mới rồi chốt snapshot cuối. Mở lại/reload lấy baseline, không phát lại lịch sử. Tiến lên, Phỏm, Kim cương, cờ và kết quả Bầu cua/Xèng dùng lại cùng hàm replay/pacing với bước bot. Chỉ lưu hành động cuối, không phải nhật ký toàn ván.
- **Outfit**: lấy từ save, `sanitizeOutfit` trước khi lưu ghế và trước khi xuất snapshot; ngồi lại cập nhật outfit. Ghế bài/cờ/Kim cương và danh sách người cược dùng outfit thật; bot luyện tập giữ hình mặc định.
- **Sweep nhiều process**: khóa `pg_try_advisory_xact_lock(76324891)` chỉ bảo vệ bước lấy danh sách bàn có khả năng hết hạn. Mỗi bàn có transaction riêng: khóa bàn với `skipLocked`, đọc lại trạng thái/mốc hết hạn rồi khóa ví theo thứ tự id trước khi thanh toán. Hai sweep có thể cùng thấy ứng viên; khóa và kiểm tra lại ngăn xử lý lặp. Lỗi một bàn rollback riêng, log có `tableId`, bàn khác tiếp tục; `releaseWaiting` cũng log lỗi theo bàn. Thông báo chỉ phát sau khi transaction của bàn commit.

Test `account-policy.test.ts` bao phủ số dư server, thưởng một lần với retry/callback đồng thời, hạn mức đăng ký, username/login/backfill, đổi tên và biên 7 ngày, chặn khách ở cả năm game PvP và cho luyện tập/nhà cái, cùng username/tên hiện tại trong snapshot bàn. Client kiểm tra payload/lỗi auth, bước Google bắt buộc, xác nhận thưởng và ACCOUNT_REQUIRED. Các bộ test bàn dùng số dư đăng ký mới 80.000 xu.

Test `auth.test.ts` bao phủ tạo/giới hạn khách đồng thời, cookie 365 ngày, giữ farm và phiên khi đăng ký, Google liên kết/chuyển tài khoản, login không gộp save, throttle last_seen và cleanup. Client tự mở popup một lần mỗi browser session (sessionStorage có try/catch), cho chơi tiếp và mở lại qua menu hồ sơ; khách không có mục đăng xuất.

Test API dùng PGlite: `tables.test.ts` cho Tiến lên; `tables-phom.test.ts`, `tables-chess.test.ts`, `tables-chinese-chess.test.ts`, `tables-diamonds.test.ts`, `tables-bau-cua.test.ts`, `tables-slots.test.ts` cho sáu trò còn lại. Bao phủ ván đầy đủ, payout chính xác, snapshot kín, lỗi lượt/nước đi, receipt, giữ cược, bỏ cuộc, sweep timeout và phòng luyện tập. Các trò cờ kiểm tra hòa lặp thế; Cờ vua thêm chiếu hết bởi quân đen.

Test hồi quy được nhóm theo chức năng: `auth-google-linking.test.ts`, `login-rate-limit.test.ts`, `arcade-random.test.ts`, `arcade-start-concurrency.test.ts`, `tables-sweep.test.ts`, `player-document-clock.test.ts`; test ghi nhận thắng Kim cương nằm trong `tables-diamonds.test.ts`. Không còn file `phase-one.test.ts`.

## Chạy

Import nội bộ API dùng `@/` trỏ tới `apps/api/src/`, không thêm đuôi `.js` trong source; import package dùng public exports như trước. TypeScript và Vitest cùng cấu hình alias này. Build xóa toàn bộ `dist/` trước khi chạy `tsc` rồi `tsc-alias` để đổi alias thành đường dẫn tương đối có đuôi `.js` trong `dist/`; production tiếp tục chạy bằng Node ESM, không cần loader alias lúc runtime. Sau khi sửa source, dùng lệnh build của workspace thay vì gọi riêng `tsc` để bản xuất có đầy đủ đường dẫn.

```bash
cp apps/api/.env.example apps/api/.env
pnpm --filter @chibi-town/api db:up     # Postgres qua Docker, cổng 5433
pnpm exec turbo run build --filter=@chibi-town/api
pnpm --filter @chibi-town/api serve     # http://127.0.0.1:3001/api
```

Không có Docker thì đặt `DATABASE_URL=pglite:.data/dev`: Postgres chạy ngay trong process, lưu vào thư mục đó. Chỉ dùng cho phát triển, một process.

Chạy game với server: đặt `NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api` trong `apps/game/.env.local` và `WEB_ORIGIN` của API trùng origin của game, rồi khởi động lại `pnpm dev`.

Server tự chạy migration khi khởi động. Sau khi đổi `src/infrastructure/database/schema.ts`, chạy `pnpm --filter @chibi-town/api db:generate` và commit thư mục `drizzle/`. `pnpm dev` ở gốc không khởi động API.

## Nhiều process và Redis

Cài dependencies bằng `pnpm install`, dùng cùng `DATABASE_URL` Postgres và cùng `REDIS_URL=redis://127.0.0.1:6379` cho mọi API. Ví dụ chạy Redis cho dev: `docker run --rm -p 6379:6379 redis:7-alpine`. `apps/api/.env.example` có cấu hình này. Production dùng URL có mật khẩu/TLS (`rediss://`) và mạng riêng. Không chia sẻ thư mục PGlite giữa các process; PGlite chỉ phục vụ test/dev một process.

Production (`NODE_ENV=production`) không có `REDIS_URL` log cảnh báo rõ khi khởi tạo app, vẫn chạy một instance. Compose có Redis profile tùy chọn `realtime`: đặt `REDIS_URL=redis://redis:6379` và chạy với `--profile realtime` khi cần dùng chung.

Không có Redis thì không đặt URL; không tự hạ về bộ nhớ khi đã cấu hình Redis mà Redis lỗi. Presence/map-room/connection leases tự hết hạn; save, receipt và thanh toán vẫn ở Postgres. Khóa Redis giữ thứ tự cập nhật trạng thái tạm, còn Lua `claimPresence` kiểm tra sức chứa và ghi lease trong một thao tác nguyên tử. Không cần sticky session cho fan-out bàn/map. Redis pub/sub không bảo đảm giao lại sự kiện bị lỡ khi mất kết nối.

Test bổ sung: `apps/api/tests/table-updates.test.ts` kiểm tra metadata cả bảy game, replay kín, outfit được sanitize/cập nhật và timeout Phỏm không kéo dài bởi rút bài; `shared-state.test.ts` kiểm tra lease hết hạn và tab cũ không ghi đè tab mới; `multiple-processes.test.ts` dùng hai `createApp` chung DB/bus để kiểm tra fan-out socket, map, sức chứa, sign-in limiter và sweep. Test Redis thật được skip nếu thiếu `REDIS_URL`. `apps/game/tests/arcade-table-updates.test.ts` kiểm tra bù lệch giờ và baseline/revision replay.

## Deploy

Giống coupon-linkh: build image `linux/amd64` ở máy local, nén, `scp` lên server rồi `docker compose up`. Server mặc định là `couponlinkh`, thư mục `/root/apps/chibi-town`.

```bash
cp deploy/.env.prod.example deploy/.env.prod   # điền PUBLIC_URL, DATABASE_PASSWORD, ...
./scripts/deploy.prod.sh                       # hoặc --web-only / --api-only / --build-only
```

- Stack (`deploy/docker-compose.prod.yml`): `postgres`, `api` (cổng `127.0.0.1:3201`), `web` (cổng `127.0.0.1:3200`); chỉ nginx của server truy cập được hai cổng này.
- Image web gọi API qua đường dẫn tương đối `/api`, nên một image dùng được cho mọi domain. nginx của domain game chuyển `/api` (kể cả WebSocket `/api/ws`) sang API; mẫu ở `deploy/nginx.conf.example`.
- Lần đầu trên server: tạo file nginx theo mẫu, `certbot --nginx -d <domain>`. Phải có HTTPS vì cookie phiên là `Secure` trong production.
- RAM khi chạy thử: web ~85 MB, API ~60 MB, Postgres ~80 MB; compose giới hạn web 320 MB, API 256 MB.

## Còn lại

Đã hoàn tất đồng hồ lượt, replay hành động người khác, outfit thật và hạ tầng nhiều process ở trên. Phòng luyện tập ID 3 vẫn chạy bot trên save riêng, không đổi luật hoặc tiền.

- **Sổ ghi biến động xu** (`coin_ledger`) và tách `coins`/`gems` thành cột nếu cần thống kê: chưa thuộc đợt triển khai này.
- Redis thật cần được kiểm chứng ở môi trường có `REDIS_URL`; test bus trong bộ nhớ không thay thế test triển khai Redis/Postgres nhiều máy.



### Túi đồ, trang bị và Pet

Migration `0004` thêm bốn bảng character inventory/unlock/instance/grant, có owner là player + character `main`. Các request inventory/equip hydrate trạng thái riêng và lưu delta cùng transaction ví; `PlayerDocument` không lưu collection trên server. `POST /character-inventory` trả danh sách phân trang; `/commands` xử lý mua, di chuyển, trang bị và màu. `equip-outfit` bị chặn nếu đồ/màu chưa sở hữu hoặc món còn trong kho. Đăng ký chọn starter cấp đúng đồ/màu một lần; save cũ migrate từ outfit đã lưu. Xem [cosmetic-economy.md](cosmetic-economy.md) để biết giá, container và phạm vi quest/event.
