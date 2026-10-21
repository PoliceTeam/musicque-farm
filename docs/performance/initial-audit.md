# Phân tích tải game — 21/10/2026

## Cấu hình và phương pháp

Next.js 16.4.0, Webpack, `NEXT_PUBLIC_BASE_PATH=/farm`, `NEXT_PUBLIC_API_URL=/farm/api`. Phân tích tại máy trên production build; không triển khai, không thêm tracking/API thu số liệu. Build phân tích tách riêng `.next-perf` để không ghi đè `.next` của dev. Báo cáo gốc lưu ngoài repo ở `outputs/farm-performance/before/` và `after/` của workspace cha.

JS ban đầu được xác định bằng các script trong HTML của `/farm`, gzip từng chunk riêng bằng Node zlib. Không cộng preload hai lần. Loại polyfill `noModule` khỏi số cho trình duyệt hiện đại; nếu cộng cả polyfill thì trước/sau lần lượt 429097 / 387256 byte gzip. Đây là dung lượng tính toán, không phải số byte Network thực đo.

| Chỉ số | Trước | Sau | Thay đổi |
| --- | ---: | ---: | ---: |
| JS ban đầu, modern, gzip | 380.3 KiB | 339.5 KiB | -10.7% |
| Chunk layout, gzip | 215.6 KiB | 174.8 KiB | -40.9 KiB |
| Ảnh khai báo của map và audio | Giữ nguyên | Giữ nguyên | Không giảm chất lượng |
| Frame game đầu / điều khiển được / chuyển map lạnh và ấm | Chưa đo | Chưa đo | Không suy ra từ dung lượng |

## Thay đổi đã làm

1. CSS trước đây nằm chung một module `generated-styles.ts`; module này có khoảng 191 KB code đã minify trong chunk shell. Xuất thêm module riêng cho mỗi stylesheet và chuyển các consumer sang import trực tiếp. Giữ barrel cũ cho tương thích; Turbo cache/outputs bao gồm thư mục mới.
2. Nhánh HTTP của app gọi trực tiếp public subpath `api-sdk/http-adapter`, realtime cũng dùng subpath riêng. Local/review vẫn giữ API và hành vi cũ. Bundle vẫn chứa một số logic game dùng cho validation; chưa tuyên bố loại toàn bộ simulation khỏi client.
3. Thêm `@next/bundle-analyzer` chỉ nạp khi `ANALYZE=true`, xuất HTML và webpack stats; build thường không bật analyzer.

## Asset

Phaser nằm trong chunk tải trễ, không nằm trong script HTML ban đầu. Bản đồ thế giới đã dùng WebP có hash và một sprite atlas. Các PNG nguồn còn nằm trong public không có nghĩa browser đang tải chúng. Nhạc được tải/giải mã sau unlock và không được await để dựng map; chưa đổi codec/bitrate hoặc thứ tự nhạc khi chưa có trace.

Các ảnh được khai báo trực tiếp cho world map: **1489.0 KiB**, gồm nền/sky/cloud/atlas và overlay lights/mask/surf/zones. Artwork scene farm trong manifest: **3747.3 KiB**. Không cộng nhạc, JS, nhân vật hoặc canvas được sinh động.

Bảng dưới là tổng duy nhất của ảnh layer khai báo trong map definition. Không phải số request đã ghi bằng browser. `Unresolved` gồm canvas tạo runtime hoặc asset chưa map được; không coi là 0 byte. Farm/arcade không dùng layer definition nên không gộp vào bảng.

| Map | KiB layer ảnh | File duy nhất | Unresolved |
| --- | ---: | ---: | ---: |
| fun/entertainment-street | 670.2 | 25 | 4 |
| center/shopping-street | 1721.3 | 24 | 3 |
| center/salon | 396.1 | 20 | 0 |
| center/pet-shop | 685.7 | 21 | 0 |
| center/held-shop | 645.1 | 27 | 0 |
| center/premium-shop | 979.8 | 32 | 0 |
| center/jewelry-shop | 478.6 | 23 | 0 |
| center/fashion-shop | 495.2 | 22 | 0 |

## Trace còn thiếu

Browser automation bị tắt trong Work settings. Thử điều khiển Chrome và Safari native đều bị ngắt khi gửi phím điều hướng; chưa tải được trang game qua UI. Không có file trace hợp lệ, không có số liệu CPU 4×/Fast 4G và chưa có xác minh chơi game thực tế trên bản sau tối ưu. Không thay kiến trúc engine/texture/cache trong lượt này.

Để hoàn tất: chạy production cùng API qua reverse proxy ở origin riêng; mở DevTools Performance, CPU 4×, Fast 4G; ghi lần cache lạnh và lần quay lại cùng tuyến bản đồ → Phố giải trí → cửa hàng → quay về. Dùng frame scene có thể nhìn thấy và thao tác di chuyển thành công làm hai mốc riêng. Lặp ba lần; không dùng lúc logo loading hiện làm frame game đầu. Lưu trace trước/sau, kèm Chrome/version/máy/cache/network preset. Nếu baseline chưa có trace thì phải rebuild baseline, không so một trace sau với ước lượng trước.

## Chạy lại

```sh
pnpm --filter @chibi-town/game analyze
# Xem apps/game/.next-perf/analyze/client.html
# Chạy server bản phân tích ở terminal riêng:
cd apps/game
NEXT_ANALYSIS_DIR=.next-perf NEXT_PUBLIC_BASE_PATH=/farm NEXT_PUBLIC_API_URL=/farm/api pnpm exec next start --hostname 127.0.0.1 --port 5174
# Từ root, sau khi server khởi động:
curl -fsSL http://127.0.0.1:5174/farm -o /tmp/farm-page.html
node tools/performance/build-report.mjs apps/game/.next-perf /tmp/farm-page.html /tmp/farm-report
```

Server riêng này chỉ đủ kiểm tra HTML/asset. Để chơi và ghi trace, `/farm/api` phải được reverse proxy tới API local đã cấu hình origin phù hợp. Không sửa cấu hình deploy hoặc mở thêm quyền truy cập production chỉ để đo.


## Panel đo local (`?perf=1`)

Đã thêm panel chỉ bật nếu URL lúc tải trang có `perf=1`, ví dụ `/farm/?perf=1` trên production hoặc `/?perf=1` trên dev. Cờ giữ trong bộ nhớ qua điều hướng client, không lưu vào localStorage và không tự bật ở lần tải trang tiếp theo nếu bỏ query. Panel được tải trễ, có thể thu gọn, và xuất JSON bằng nút **Xuất JSON**. Không gửi log tới API.

Các mốc:

- `auth`: thời gian kiểm tra/khởi tạo phiên.
- `world-data`: chờ world definition khi vào location; `screen-code`: chỉ thời gian import code màn, tách khỏi world-data.
- `renderer-import`: tải module engine; `renderer-init`: từ khởi tạo đến scene ready. Ở world map, thời gian này gồm cả Phaser loader.
- `scene-assets`: chờ bộ ảnh scene (gồm decode), áp dụng location, entrance và farm; không phải thời gian upload GPU riêng.
- `first-frame-submitted`: callback vẽ đầu tiên đã chạy, hoặc POST_RENDER ở world map. Đây chưa phải bằng chứng pixel đã hiện trên màn hình hay toàn bộ mạng đã xong.
- `movement-observed` / `zone-selected`: đã quan sát di chuyển/chọn khu. Thời gian này gồm khoảng chờ người thử thao tác, không phải thời gian tự động xác định game điều khiển được.

JSON giữ tối đa 30 lượt tải, 60 mốc/lượt và 300 resource gần nhất. Resource chỉ lấy đường dẫn static cùng origin, bỏ query; không lấy API payload, cookie hoặc dữ liệu tài khoản. `startedAtMs` và timing resource cùng gốc `performance.now()`; `atMs` tính từ đầu mỗi lượt tải. Lượt đầu bắt đầu khi effect ứng dụng chạy, **sau khi bundle khởi động**, nên không dùng riêng `atMs` làm tổng thời gian mở trang. JSON có thêm Navigation Timing để đối chiếu. Các span chạy song song không được cộng để thành tổng. Byte transfer 0 có thể do cache, không tự kết luận tài nguyên không tải.

Sau khi thêm instrumentation, đo lại HTML production: JS modern gzip **349209 byte (341.0 KiB)**, giảm **10.34%** so với baseline 389470 byte. Panel/recorder làm JS ban đầu tăng 1580 byte gzip so với lượt tối ưu đầu (347629 byte). Báo cáo và analyzer mới lưu `outputs/farm-performance/instrumented/` ngoài repo. Đây vẫn là đo bundle, chưa có runtime trace hoặc số chuyển map hợp lệ.

Đã kiểm tra production build Webpack, typecheck/lint game + renderer và 20 test SDK/URL/recorder/opt-in (gồm bật/tắt, giới hạn bộ nhớ, async về đúng lượt và lọc dữ liệu export). Chưa deploy/push các thay đổi này.
