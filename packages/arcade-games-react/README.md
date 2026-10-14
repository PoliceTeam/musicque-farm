# @chibi-town/arcade-games-react

Module React cho khu game. Mỗi module đóng gói màn chơi, metadata danh mục, bản dịch, SDK adapter và tham chiếu engine thuần TypeScript. Hiện cung cấp `diamondsGameModule`, `tienLenGameModule`, `phomGameModule`, `bauCuaGameModule`, `slotsGameModule`, `chessGameModule` và `chineseChessGameModule`.

App đăng ký tại `apps/game/src/features/arcade/_utils/registered-games.ts`:

```ts
import {
  createArcadeGameRegistry,
  diamondsGameModule,
  tienLenGameModule,
  phomGameModule,
  bauCuaGameModule, slotsGameModule, chessGameModule, chineseChessGameModule,
} from '@chibi-town/arcade-games-react';

export const arcadeGames = createArcadeGameRegistry();
arcadeGames.register(diamondsGameModule);
arcadeGames.register(tienLenGameModule);
arcadeGames.register(phomGameModule);
arcadeGames.register(bauCuaGameModule);
arcadeGames.register(slotsGameModule);
arcadeGames.register(chessGameModule);
arcadeGames.register(chineseChessGameModule);
```

Danh mục app đọc `registry.list()`; mở game bằng `ArcadeGameMount`. Không cần thêm nhánh theo ID hoặc sửa catalog SDK để hiển thị module mới. ID đăng ký trùng bị từ chối.

Module mới implement `ArcadeGameModule`: `id`, `title`, `seats`, `card`, `View`, `messages`, `bindSdk`; có thể cung cấp `engine`, `summary` và `css`. `View` nhận player, coins, audio, back và refreshWallet. `card` là khóa asset host hoặc URL. Bản dịch dùng instance i18next riêng cho mỗi module, không ghi vào tài nguyên i18n app. CSS tích hợp của các game hiện tại xuất qua `theme.css`.

App cấu hình `ArcadeHostProvider` một lần với SDK, asset URLs, renderer avatar và navigate. Package không import Next.js hay source app. Ví và thanh toán vẫn do SDK quản lý; module dùng adapter được inject qua `useArcadeHost`. Luật/bot ở package thuần `@chibi-town/arcade-games` để dùng lại trên backend mà không kéo React vào.

Register không tự tạo backend: game mới phải có logic, commands và adapter tương ứng; muốn chơi online cần backend thực hiện contract của game đó. Các game hiện tại dùng SDK local/HTTP hiện có.

Kiểm chứng: `apps/game/tests/arcade-game-modules.test.tsx` đăng ký ID không có trong catalog SDK, render UI/bản dịch riêng và kiểm tra SDK adapter cùng việc không làm đổi i18n app.
