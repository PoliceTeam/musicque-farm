# Sprite nguồn theo nhóm item

Sprite nguồn nằm trong `apps/game/src/assets/sprites/`. Một thư mục chứa một họ item hoặc bộ phận nền tảng; `sprites.txt` chứa các level, frame và biến thể mặt rộng liên quan. ID `@piece` giữ nguyên để metadata, outfit đã lưu và renderer không đổi.

```text
sprites/
  characters/shared/{body,head,face,eyes,mouth,nose,hand}/sprites.txt
  characters/female/eyes/sprites.txt
  hair/{mop,messy,fluffy,spiky,slick,goku,female-long,female-short,female-shoulder,female-ponytail}/sprites.txt
  hats/{cap,beanie,witch,crown,halo}/sprites.txt
  outfits/{basic,goku}/{shirt,pants,shoes,wrist}/sprites.txt
  accessories/
    wings/{angel,ice,fire,shadow,fairy,dragon}/sprites.txt
    held/{flower,can,balloon,nyoibo}/sprites.txt
    tails/monkey/sprites.txt
    sticker/{star,heart,bandage}/sprites.txt
    mouthacc/{mask,gum}/sprites.txt
  pets/{cat,corgi,bunny,chick,slime,dragon,fox,robot}/sprites.txt
  scenery/melon/sprites.txt
  palettes/{character,goku,hats,hat-families,wings}.txt
  pets/palette.txt
  scenery/palette.txt
```

Bộ phận nhân vật dùng chung nằm trong `characters/shared/`. Bộ phận riêng có họ `female` (ví dụ `eyes.female`) được `tools/sprite-source.py` ghi vào `characters/female/<bộ phận>/`, không ghi đè file dùng chung; thêm `characters/male/` theo cùng quy tắc khi cần.

## Thêm item

1. Tạo thư mục tên kebab-case đúng nhóm, ví dụ `hats/new-hat/sprites.txt`. Dùng format `@piece` và giữ tất cả frame/level của cùng họ trong nhóm đó.
2. Dùng màu trong palette namespace nhân vật, hoặc thêm palette riêng vào `palettes/`. Pets và scenery có namespace palette độc lập. Có thể khai báo palette ngay trong một file nhóm nếu chỉ các mảnh của file đó dùng nó. Không ghi đè chữ màu đã có sang màu khác trong cùng namespace.
3. Thêm metadata vào `packages/character-core/src/data/items.json` (hoặc `pets.json` cho pet), giữ ID toàn namespace duy nhất. Metadata tiếp tục thuộc core để ứng dụng Node có thể dùng mà không nạp sprite/browser.
4. Chạy `pnpm check`, `pnpm build` và xem Character Lab. Không cần thêm import thủ công: Vite glob nạp tất cả `.txt` dưới `sprites/`, kể cả thư mục mới.

`asset-catalog.ts` ghép ba namespace thông qua `sprite-source-loader.ts`, kiểm tra trùng piece, xung đột palette, hàng sai độ rộng, màu không khai báo, metadata thiếu sprite và kích thước frame. Lỗi giữ đường dẫn nguồn để tìm đúng file.

## Export art

Các exporter tóc, cap, các họ mũ và Goku dùng `tools/sprite-source.py` để đọc namespace và ghi nhóm. File nguồn raster và cấu hình export không đổi. Không tái tạo các file sprite tổng cũ. Exporter tóc chỉ ghi các nhóm tóc; các exporter khác ghi các nhóm do chúng sinh ra.

`apps/game/tests/fixtures/sprite-baseline.json` lưu fingerprint trước khi chia: toàn bộ 447 piece, kích thước, pixel và palette trong ba namespace. Test này bổ sung regression ghép nhân vật và giữ danh sách ID/chữ palette cũ; asset mới có thể thêm mà không đổi fingerprint của mốc đã duyệt. Chỉ cập nhật baseline khi thay đổi artwork có chủ ý đã được duyệt; đổi thư mục hoặc renderer phải giữ fingerprint.

## Tải và tối ưu

Đây là cấu trúc nguồn, chưa phải atlas hoặc cơ chế streaming. Glob hiện dùng eager, nên production vẫn tải toàn bộ catalog sprite như trước. Chia file không tự tăng FPS hay giảm dung lượng tải. Khi kho item lớn, thêm bước build atlas theo bundle và manifest để provider chỉ tải nhóm đang dùng; giữ thư mục nguồn làm nơi chỉnh sửa. Không tạo một HTTP request riêng cho từng `.txt` trong production.
