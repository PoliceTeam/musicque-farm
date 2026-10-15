# @chibi-town/arcade-games

Package luật game và registry độc lập với React, Phaser, DOM, storage và SDK. Hiện có Kim cương, Tiến lên, Phỏm, Bầu cua, Slots, Cờ vua và Cờ tướng, gồm tạo ván, kiểm tra trạng thái, xử lý lượt và bot dễ/trung bình/khó. Ví xu và thanh toán thuộc api-sdk; renderer/UI nằm trong package React đồng hành `@chibi-town/arcade-games-react`.

```ts
import { createArcadeRegistry, diamondsGame, tienLenGame } from '@chibi-town/arcade-games';
const games = createArcadeRegistry<YourGameView>();
games.register(diamondsGame, DiamondView);
games.register(tienLenGame, TienView);
const view = games.get('diamonds')?.adapter;
```

App đăng ký module hoàn chỉnh từ `@chibi-town/arcade-games-react`, gồm UI, metadata, bản dịch và SDK adapter. Registry trong package thuần này dành cho engine và consumer không dùng React. SDK/contracts import luật qua public exports; package không phụ thuộc app hay SDK. Xem [hướng dẫn module React](../arcade-games-react/README.md).

Ngẫu nhiên dùng sfc32 với state bốn word 32-bit trong `random.ts`; engine chỉ nhận seed từ bên ngoài và giữ tất định. Caller dùng crypto để cấp seed 128-bit mới trước mỗi hành động có kết quả ngẫu nhiên (chia bài, roll/spin, next-round, lượt Kim cương). Seed số vẫn được chấp nhận cho save cũ/fixture và chuyển sang bốn word khi dùng; mọi snapshot/step phải loại seed. Không dùng PRNG để tự cấp entropy giữa hai kết quả mà người chơi quan sát được.
