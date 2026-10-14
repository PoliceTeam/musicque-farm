# Kiến trúc

Kiến trúc mục tiêu đã chốt (Next.js + React + Phaser, 8 khu/multiple maps, `api-sdk` local/HTTP) và thứ tự migration ở [target-architecture.md](target-architecture.md). Migration nền tảng đã triển khai; phần dưới giữ mô tả cơ chế avatar và renderer.

## Nhân vật: đối chiếu với Avatar J2ME

Tham khảo source [itdat/avatar-j2me](https://github.com/itdat/avatar-j2me) (commit `0148355`), thư mục `src/avatar/`. Đó là source dịch ngược nên tên lớp/biến bị làm rối; bảng dưới ghi ý nghĩa đã xác nhận khi đọc code.

| J2ME | Ý nghĩa | Ở đây |
| --- | --- | --- |
| `hn.e` (danh sách `hx`) | Các item đang mặc | `Equip[]` |
| `ld.j` | Lớp của item: vừa là thứ tự vẽ, vừa phân loại chỗ mặc | `ItemDef.layer`, `slot` |
| `fa.c/d/e[pose]` | Mỗi item có 15 pose: mã mảnh hình, độ lệch X, Y | `ItemDef.poses[i] = {piece, dx, dy}` |
| `ke` | Vùng mảnh hình trong atlas | `Piece` trong `sprites/**/sprites.txt` |
| `hn.aN` | Bảng trạng thái × nhịp (0..9) → pose | `POSE_TABLE`, `poseFor()` |
| `gx.H` | Trạng thái: 0 đứng, 1 đi, 2..14 hành động | `Action` |
| `hn.aB` | Bộ đếm nhịp 0..9 | `AvatarState.tick` |
| `gx.K` = 0 hoặc `gx.J` (= 2, `TRANS_MIRROR`) | Hướng: hình gốc hoặc lật gương | `AvatarState.mirror` |
| `fa.a()` | Vẽ mảnh tại gốc + độ lệch; khi lật: `x + d − (2d + w)` | `layoutAvatar()` |
| `hn.g()`, phím trái/phải | Chỉ di chuyển ngang mới đổi hướng | `stepWalker()` |
| Nhánh thay nhóm mắt | Thay item mắt khi chớp | `AvatarState.visibleEquip()` |

Hệ quả:

- Chỉ vẽ **một** hướng (nhìn chếch 3/4 về phía trước, quay phải). Hướng trái là lật gương. Không có hình nhìn sau lưng hay nhìn nghiêng; đi lên/xuống vẫn giữ hướng.
- J2ME đi bộ bằng **2 frame** (pose 0 và 2). Ở đây đi 4 nhịp: 0 → 2 → 0 → 3 (bảng `POSE_TABLE` hàng 1), để hai chân thay nhau bước thay vì một chân bước mãi trông như thọt. Đứng yên vẫn đổi pose 0 và 1.
- Một pose thay đổi bằng cách: đổi mảnh hình (ví dụ chân bước) và/hoặc đổi độ lệch (ví dụ đầu nhún xuống 1px). Item không khai báo pose nào thì dùng pose 0.
- Đổi màu (tóc, áo...) là thay chữ cái bảng màu trên cùng một mảnh hình; J2ME dùng hình riêng cho mỗi màu, ở đây gọn hơn.

## Luồng một khung hình của town Canvas

1. `startLoop` gọi `tick()` mỗi `TICK_MS` (90ms): mọi `AvatarState.step()` tăng bộ đếm, xử lý chớp mắt.
2. `frame(dt)`: `stepWalker` di chuyển từng người theo phím / click / AI đi lang thang, đặt trạng thái Đứng/Đi và hướng.
3. Vẽ cảnh 480×300 đơn vị gốc: nền → danh sách vật thể (hàng rào, cây, cây trồng, nhân vật, thú cưng) **sắp theo đường chân** (`y`) → mũi tên đích. Canvas thế giới thật ra lớn gấp `DETAIL` (4) lần; code game vẫn dùng đơn vị gốc.
4. `present()` chép lên canvas hiển thị (2× × devicePixelRatio). Chữ tên vẽ sau ở độ phân giải hiển thị để nét.

## Hình

Nhân vật, đồ và thú cưng là pixel art trong `apps/game/src/assets/sprites/**/sprites.txt`. Kích thước mảnh cùng độ lệch trong `packages/character-core/src/data/items.json` quyết định chỗ đặt mảnh và cách lật gương (x = −dx − rộng), như J2ME.

- `PieceCache` vẽ mỗi mảnh (theo bộ màu) ở độ phân giải `DETAIL` (4×) một lần rồi lưu cache: mảnh có hình vector thì vẽ vector, không thì tô từng pixel của lưới. `FigureCache` ghép cả nhân vật một lần cho mỗi bộ đồ, pose và hướng. Canvas hiển thị chép bằng nearest-neighbour để pixel luôn sắc.
- Mỗi nhóm màu (da, tóc, áo, quần, giày, băng tay) có chữ cái riêng, nên `toEquip` gộp mọi bộ màu thành một bảng và áp cho mọi món.
- Đầu trọc là khối chuẩn dùng chung cho mọi kiểu tóc; tóc chỉ vẽ đè lên. Phần tóc sau đầu là item `<tóc>.back`, đồ cầm tay đi kèm lớp ngón tay `hand.grip`; `toEquip` tự thêm cả hai.
- Cảnh nền, hàng rào, cây vẽ bằng vector trong `game/rendering/farm-view.ts`; cây trồng trong `game/rendering/crop-art.ts`.

## Nguyên tắc

- Cấu trúc hiện tại và ranh giới logic/handler/view ở [phaser-migration.md](phaser-migration.md). `packages/character-core/`, app `character/` và `world/` không phụ thuộc Phaser, DOM, storage hay renderer.
- Logic thuần (đọc hình, bảng pose, lật gương, di chuyển, bộ đồ) tách khỏi phần vẽ để test trong Node.
- Tọa độ game luôn là pixel nguyên ở độ phân giải gốc.
- Sprite nằm trong `apps/game/src/assets/`; metadata item, màu và pet nằm trong `packages/character-core/src/data/`, được kiểm tra khi nạp: sai tên mảnh, hàng lệch, chữ cái màu lạ đều báo lỗi ngay.

Character Lab dùng update của Phaser gọi `CharacterLabState`; `CharacterView` chỉ đọc draw-op để cập nhật sprite và texture. Các bảng Canvas giữ làm mốc đối chiếu.

Sprite nguồn được chia theo họ item/bộ phận; bộ nạp glob ghép các nhóm và kiểm tra lỗi. Xem [sprite-sources.md](sprite-sources.md).
