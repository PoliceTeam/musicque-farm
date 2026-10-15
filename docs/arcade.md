# Khu GAME

Vào máy GAME ở phố giải trí hoặc `/play/fun/arcade-hall`: chọn game → phòng → bàn. Đã mở cả Tiến lên, Phỏm, Kim cương, Bầu cua, Xèng, Cờ vua và Cờ tướng. Mỗi trò có 3 phòng sơ cấp (SDK ID 0–2, mỗi phòng 10 bàn) và phòng luyện tập (SDK ID 3, 20 bàn, UI hiển thị phòng 0). Chọn phòng chỉ duyệt bàn, chưa tạo ván.

## Tài khoản, số dư và định danh

Tài khoản server mới (khách, đăng ký trực tiếp hoặc Google) khởi tạo 50.000 xu và 0 lượng. Khi lần đầu trở thành tài khoản không phải khách, được thêm 100.000 xu và 20 lượng đúng một lần trong transaction; số dư đăng ký trực tiếp/Google mới là 150.000 xu, 20 lượng. Local adapter giữ mặc định farm hiện tại. Xem [backend.md](backend.md) về marker nhận thưởng, hạn mức 5 đăng ký email/nâng cấp mỗi địa chỉ trong 24 giờ và username.

Khách chơi được tất cả phòng luyện tập (ID 3) và Bầu cua/Xèng với nhà cái. Khách **không được ngồi bàn cược của Tiến lên, Phỏm, Cờ vua, Cờ tướng, Kim cương** vì các bàn này chuyển xu giữa người chơi; API trả `403 ACCOUNT_REQUIRED`, HTTP SDK giữ code, khu GAME hiện giải thích và nút “Đăng ký” mở popup hiện tại. Không chỉ khóa ở client.

`players` trong snapshot bàn mang `{id, name, username, outfit}` theo thứ tự người xem. UI ghế, tên người tới lượt và danh sách người cược/kết quả dùng `Tên hiển thị @username` để phân biệt tên trùng. Username duy nhất, không đổi sau khi đặt; khách ở bàn nhà cái có username null. Tên hiển thị được đổi tối đa mỗi 7 ngày ở menu hồ sơ, snapshot đọc tên mới từ account. Google mới cần hoàn tất “Chọn username” trong popup trước khi chơi.

## Bàn người thật và luyện tập

Trên server, mọi phòng cược dùng bàn người thật, không có bot. Tiến lên/Phỏm có 2–4 ghế, Cờ vua/Cờ tướng/Kim cương đúng 2 ghế; Bầu cua/Xèng cho 1–4 người cùng cược với nhà cái. Chủ bàn là người vào đầu tiên. Số người chơi là số ghế thực tế. Lobby hiển thị số người thật theo `(gameId, khu, roomId, tableId)`, không sinh occupancy giả.

Phòng luyện tập ID 3 giữ ván riêng và bot trên save của chính người chơi, không đổi xu. Chủ bàn vẫn chọn số bot/độ khó theo luồng luyện tập hiện có. Local adapter giữ mô phỏng một người/bot để phát triển và test, kể cả các phòng cược local; bàn nhiều tài khoản thật dùng HTTP server. Ván không có session từ save cũ tiếp tục miễn phí, chỉ bị xóa khi người chơi chọn rời.

Chủ bàn đặt cược chung cho bài/cờ/Kim cương. Mỗi người tự xác nhận sẵn sàng; thay đổi cược chung xóa xác nhận của người khác. Bầu cua/Xèng dùng cược riêng như phần dưới. Tiền khả dụng trừ mọi cược đang giữ, nên không tiêu qua farm hoặc cược ở ván khác. Người thiếu xu không thể sẵn sàng/bắt đầu. Rời khi chờ hoặc sau kết quả miễn phí; rời đang chơi mất đúng cược của mình, chia cho người còn lại và đóng bàn. Bàn nhà cái một người bỏ cuộc thì nhà cái giữ cược.

Lượt có hạn 60 giây, hết giờ xử như bỏ bàn. Bàn chờ/đã xong để yên 10 phút đóng; ghế chờ mất kết nối 20 giây bị gỡ. `turnStartedAt` ghi lúc chia bài/đổi người tới lượt, nên thao tác cùng lượt không kéo dài 60 giây. Snapshot bàn người thật có `serverTime`/`turnEndsAt`; UI bù lệch giờ như farm, hiện đếm ngược tại ghế và nổi bật khi tới lượt mình, cảnh báo trong 10 giây cuối. `useArcadeLive` nghe thông báo lobby/match rồi đọc lại snapshot riêng; không truyền bài qua sự kiện chung. UI hiện tên người thật, khóa thao tác ngoài lượt, đợi request/replay của mình trước khi áp snapshot mới và xử lý bàn bị người khác đóng. `lastSteps: { revision, steps }` trong active snapshot chứa hành động cuối đã lọc theo ghế. UI dùng cùng replay/pacing/thông báo như bước bot cho bài, Kim cương, cờ và kết quả Bầu cua/Xèng, rồi chốt snapshot cuối. Chỉ phát revision chưa thấy; reload lấy baseline nên không phát lại bước cũ. `players` mang `{ id, name, outfit }`; outfit được lấy từ save lúc ngồi/ngồi lại và sanitize, mọi màn hình vẽ outfit thật của người ở bàn.

## Tiến lên

Luật miền Nam: chia 13 lá/người. Bàn 4 người giữ 3 bích đi đầu; bàn 2–3 người giữ lá nhỏ nhất đã chia đi đầu và phải đánh bộ chứa lá đó. Chất bích, tép, rô, cơ; số 3..A rồi 2. Có rác, đôi, bộ ba, tứ quý, sảnh từ 3 lá và 3–4 đôi thông; sảnh/đôi thông không chứa 2. Chặn bằng cùng loại/số lá, lá cao nhất lớn hơn. Ba đôi thông chặt một 2; tứ quý chặt một/đôi 2 hoặc ba đôi thông; bốn đôi thông chặt một/đôi 2, ba đôi thông hoặc tứ quý. Chặt chỉ trong lượt của mình.

Bỏ lượt chờ vòng mới. Khi người còn lại đều bỏ, người đánh cuối mở vòng mới; nếu đã về nhất, người kế tiếp còn bài mở. Bàn 2 người kết thúc khi có nhất; bàn 3–4 tiếp tục đến nhì. Chưa áp tới trắng, cóng, thối. Snapshot quay ghế để người xem là 0, chỉ chứa hand của họ và số lá ghế khác; bài chưa chia chỉ có số lượng, không có nội dung hay seed.

## Phỏm

Chủ bàn đi đầu và nhận 10 lá, các ghế khác 9 lá. Phỏm ngang cùng số hoặc dọc cùng chất, không nối K–A; điểm A=1..K=13. Mỗi người đánh 4 lượt, không dịch quân đã đánh để né hạ. Ăn phải tạo được phỏm; mỗi phỏm tối đa một lá ăn và mọi lá ăn phải vào phỏm. Hạ tự chọn tổ hợp ít điểm rác nhất; gửi từng lá hợp lệ vào phỏm đã hạ, móm không được gửi.

Ù kết thúc ngay. Còn lại ít điểm rác trước, móm sau, bằng điểm ưu tiên thứ tự ghế của engine. Không ù khan, không phạt riêng ăn chốt/ù đền. Ù là nhất, các ghế khác vẫn xếp điểm xác định nhì, không nhân cược.

`phomSeatSnapshot` quay hand/counts, discards, eaten, melds, turns, laid, last, placements, scores, mom, winner, u và finalHands về thứ tự người xem. `send.seat` gửi từ UI cũng ở thứ tự người xem và được đổi về ghế engine. Đang chơi không lộ nọc hoặc hand người khác; bài còn lại ở `finalHands` công khai sau khi kết thúc.

### Quỹ cược bài

Tiến lên và Phỏm dùng chung `topTwoPayout`. Phần nhận đã gồm tiền góp, không thu phí:

| Người | Chia quỹ nhất/nhì | Delta khi cược 100 xu/người |
| --- | --- | --- |
| 2 | 100% / 0% | +100 / −100 |
| 3 | 80% / 20% | +140 / −40 / −100 |
| 4 | 60% / 40% | +140 / +60 / −100 / −100 |

Nhất làm tròn xuống, nhì nhận phần còn lại; tổng delta luôn 0. Tiến lên chỉ cần hai hạng đầu; Phỏm xếp mọi ghế. Luyện tập không đổi tiền. Save local cũ không payoutRule giữ chính sách cũ, không đổi giữa ván.

## Cờ vua và Cờ tướng

Chủ bàn là trắng/đỏ đi trước; người thứ hai là đen. Snapshot thêm `side: 0 | 1`, giữ tọa độ/màu board tuyệt đối và trả outcome theo người xem. UI xoay bàn 180 độ cho đen, chọn được quân đen và chỉ nhận input trong lượt của họ. Mỗi request xử lý đúng một nước, không tự đi nước đối thủ. Đầu hàng cho bên kia thắng. Thắng +cược, thua −cược, hòa 0.

Cờ vua dùng `chess.js`: nhập thành, en passant, chọn bốn phong cấp, chiếu hết, bí nước, thiếu quân, lặp thế ba lần và luật 50 nước. Bản giải trí tự hòa khi đủ điều kiện, giới hạn 300 nửa nước.

Cờ tướng có cung/sông, chân mã, mắt tượng, ngòi pháo, tốt qua sông và tướng đối mặt. Hết nước hợp lệ thua dù chưa chiếu. Lặp thế ba lần: bên chiếu liên tục thua, còn lại hòa; chưa phân xử đuổi quân liên tục theo luật giải đấu. Hòa sau 120 nửa nước không ăn/đi tốt hoặc 300 nửa nước. Save phải replay được từ thế ban đầu.

## Kim cương

Hai người dùng chung bàn 8×8. Đổi hai ngọc kề hàng/cột để ghép từ ba viên; nước không tạo bộ bị từ chối, không mất lượt. Xử lý hết cascade trước khi đổi lượt. Bộ từ bốn viên, kể cả T/L giao nhau và bộ trong cascade, thưởng một lượt; hai bộ ba rời nhau không thưởng. Tối đa ba lượt thưởng liên tiếp, sau đó chuyển lượt.

- Tấn công: 45 sát thương/viên, từ cascade thứ hai cộng `10 × (combo − 1)` cho cả đợt có ngọc tấn công.
- Hồi máu: 24/viên, tối đa 1000 máu.
- Năng lượng: 12/viên, tối đa 100 mana.
- Bảo vệ: 18/viên, tối đa 300 giáp; giáp hấp thụ trước máu.
- Bất ngờ: mỗi đợt chọn một hiệu ứng hồi máu/mana/giáp cho ngọc tím, ghi `luckReward` để UI giải thích.
- Nhân điểm: `10 × số viên × combo`, nhân đôi khi có ngọc vàng; điểm không quyết định thắng và không thưởng tiền.

Phép tốn 60 mana, gây 210 sát thương và kết thúc lượt. Đối thủ về 0 máu kết thúc ngay. Không còn nước hoặc đạt 32 cascade thì sinh bàn mới hợp lệ, báo `reshuffled`. Thắng +cược, thua −cược.

Engine lưu ghế chủ là `player`, ghế thứ hai là `bot`; ở bàn cược cả hai đều là người thật. Snapshot ghế thứ hai đổi fighters, lượt, won/lost và actor trong các bước để UI vẫn hiểu mình là player. Seed không xuất hiện trong snapshot/kết quả. Bot chỉ tự đi trong luyện tập, chọn theo ngọc đang thấy và không nhìn ngọc sắp rơi.

Hình ngọc giữ WebP tham chiếu và vùng alpha để căn giữa. Replay có các pha đổi/chuẩn bị/xóa/rơi/nghỉ, dùng cùng metadata cascade cho cả hai phía; giảm chuyển động tắt animation nhưng giữ thông báo. Khu GAME chỉ phát SFX qua âm lượng hiệu ứng chung, không chạy nhạc nền.

## Bầu cua và Xèng

Mỗi thành viên gọi `configureArcadeTable` để lưu cược riêng, cùng cửa 0–5 nếu là Bầu cua, rồi đánh dấu họ sẵn sàng. Chủ bàn đặt mặc định của bàn và cược của mình; không chỉnh cược hoặc cửa người khác. Có thể hủy sẵn sàng để đổi cửa. Chỉ chủ bàn roll/spin khi mọi người đủ xu và sẵn sàng.

Một kết quả chung cho cả bàn, thanh toán từng người với nhà cái:

| Trò | Kết quả | Delta theo cược riêng |
| --- | --- | --- |
| Bầu cua | Không trùng cửa | −cược |
| Bầu cua | Trùng k xúc xắc (1–3) | +k × cược |
| Xèng | Ba biểu tượng khác nhau | −cược |
| Xèng | Đúng một cặp | +cược (trả 2× gồm vốn) |
| Xèng | Bộ ba thường | +4 × cược (trả 5×) |
| Xèng | Ba kim cương | +9 × cược (trả 10×) |

Ba xúc xắc/cuộn độc lập, sáu biểu tượng đồng xác suất. `settlement: house` cho phép tổng delta khác 0; `housePayouts` ghi delta và số dư của từng tài khoản. Mọi ví, ván và receipt cập nhật trong cùng transaction qua `pay`. UI không tự tạo kết quả hoặc đổi ví. `next-round` do chủ bàn gửi, giữ bàn và receipt, xóa kết quả/thanh toán và reset sẵn sàng của tất cả thành viên. Không có độ khó/gợi ý cho hai trò này; luyện tập giữ mô phỏng cược bot cũ và không đổi xu thật.

## SDK và kiểm tra

Engine thuần nằm ở `@chibi-town/arcade-games`, luật bàn ở `@chibi-town/game-service`, UI/locale ở `@chibi-town/arcade-games-react`. App chỉ đăng ký module và inject SDK/realtime/assets/avatar/navigation. Storage bàn và transaction ở `apps/api/src/modules/arcade/tables/service.ts`.

HTTP: GET `/arcade` cho Kim cương, `/arcade/tien-len`, `/arcade/phom`, `/arcade/mini/:gameId` cho các trò khác. POST start/play giữ các đường dẫn hiện có. Play Kim cương dùng `battleId`, còn lại `matchId`; mọi lệnh có revision và requestId. Configure/member/leave dùng `/arcade/table/*`. Một requestId thử lại trả đúng kết quả cũ; cùng ID khác nội dung hoặc revision cũ bị từ chối. WebSocket chỉ đẩy thông báo thay đổi, client đọc snapshot riêng qua SDK.

Test API trên PGlite: `tables.test.ts`, `tables-phom.test.ts`, `tables-chess.test.ts`, `tables-chinese-chess.test.ts`, `tables-diamonds.test.ts`, `tables-bau-cua.test.ts`, `tables-slots.test.ts`. Kiểm tra ván đầy đủ/số xu, dữ liệu kín/seed, lượt và nước bất hợp lệ, retry một lần, giữ cược, bỏ cuộc và timeout bằng sweep; các trò cờ thêm hòa lặp thế, Cờ vua thêm chiếu hết bởi đen. Test engine/local/HTTP và audit hiện có tiếp tục kiểm tra luật, bảo toàn bài, bot và save luyện tập.

API hỗ trợ nhiều process qua `REDIS_URL`: pub/sub thông báo, lease map/presence, join khu nguyên tử và bộ đếm đăng nhập dùng chung. Sweep bàn giữ advisory transaction lock trong Postgres, không thanh toán chồng; phòng luyện tập vẫn nguyên luồng save/bot riêng. Test hai API dùng chung DB/bus trong bộ nhớ và test Redis tùy chọn có trong API. Còn lại: bảng xếp hạng trực tuyến và sổ biến động xu. Xem [backend.md](backend.md).
