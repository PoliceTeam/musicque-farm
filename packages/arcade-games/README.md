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
