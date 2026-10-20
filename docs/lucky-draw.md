# Vòng quay khu giải trí

Người dùng chốt dùng vé quay, **15.000 xu / 1 vé**, và yêu cầu tạo Cánh Tiểu Tiên độc quyền quay số. Bấm quầy phần thưởng/vòng quay trên `/play/fun/entertainment-street` để mở popup. Mua 1 hoặc 5 vé, quay một lượt dùng 1 vé. Vé và xu dùng chung tài khoản, không tự cấp vé khởi đầu. Không dùng lượng hoặc tiền thật.

Bản đầu dùng tám phần thưởng được cấu hình ở `packages/game-content/src/lucky-draw.ts`: 1.000 xu (25%), 3.000 xu (24%), 5.000 xu (20%), 1 vé (15%), 10.000 xu (7%), 2 vé (4%), 30.000 xu (3%), Cánh Tiểu Tiên (2%). Đây là cấu hình triển khai đầu, chưa được người dùng chốt riêng tỷ lệ. Mỗi lượt độc lập, chưa có bảo hiểm/pity. Các ô có diện tích bằng nhau nhưng xác suất khác nhau; giao diện công khai điều đó trong tab Tỷ lệ.

Cánh có ID riêng `item/wings.pixie`, không ảnh hưởng cánh cũ. Shop không liệt kê hoặc bán trực tiếp item này, kể cả gọi command bằng ID. Thưởng được ghi cùng transaction trừ vé và tạo receipt, tự vào giỏ hoặc kho nếu giỏ đầy. Có thể trang bị bằng cơ chế kho đồ đang có. Trúng cánh đã sở hữu nhận 30.000 xu; không tạo item trùng. Nguồn art, prompt và exporter ở `tools/lucky-draw/`; chưa có duyệt mỹ thuật của người dùng.

Tự quay dùng vé đang có, giữ khoảng nghỉ giữa kết quả, dừng khi hết vé, trúng cánh, gặp lỗi, đóng popup hoặc chuyển tab trình duyệt ra nền. Không tự mua thêm vé. Đóng khi đang quay không hoàn tác giao dịch; thưởng đã được lưu, lịch sử hiển thị 10 lượt gần nhất khi mở lại. Retry lỗi mạng giữ request ID để service trả lại cùng kết quả thay vì tiêu vé/quay thêm.

`GameSdk.getLuckyDraw()` gọi `GET /api/lucky-draw`; `executeLuckyDraw({type:'buy-tickets',count,requestId})` hoặc `{type:'spin',drawId,requestId}` gọi POST cùng URL. Session xác định player, không nhận giá, kết quả, tỷ lệ hoặc player ID từ client. API dùng `withCharacterInventory` để giữ row lock của ví và hydrate/lưu inventory chuẩn hóa trong cùng transaction. Shared service được dùng bởi cả server và local adapter; server dùng crypto entropy mới cho từng lượt, test có thể inject random. Không dùng animation để quyết định phần thưởng.

Receipt lưu fingerprint và kết quả theo tài khoản; cùng ID cùng command replay, khác command trả conflict. Không prune receipt của giao dịch mua vé/quay để retry cũ không thể tạo giao dịch mới. Hiện log receipt tăng theo tổng số giao dịch, có thể cần tách ledger khi lưu lượng lớn. Số xu đang giữ cho bàn arcade không thể dùng mua vé.

Kiểm chứng: `pnpm check` qua; 6 test mới cho service/local, 2 test HTTP với PGlite bao gồm concurrent retry, tài khoản riêng, giả giá/phần thưởng, thiếu tiền/vé, cánh độc quyền, trang bị và bù trùng. Tất cả 8 khoảng xác suất và góc dừng của wheel đều được kiểm tra. Production build qua. Browser đã thử mua 5 vé, quay/nhận, đối chiếu ô dừng, popup ngang và dọc. Preview local dùng môi trường API rỗng; không sửa `.env.local` hay ví người dùng thật.
