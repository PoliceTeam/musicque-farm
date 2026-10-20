# Nâng cấp ngoại hình

## Thiết kế

Nhân vật → Nâng cấp hiển thị cấp cao nhất đã sở hữu trong từng dòng đồ có nhiều cấp. Người chơi so sánh hai ngoại hình trước khi trả xu mở cấp tiếp theo. Tỷ lệ thành công 100%; không phá đồ, không rớt cấp. Đây là mở ngoại hình có sẵn, chưa thêm chỉ số chiến đấu hay vẽ thêm cấp.

Nghiên cứu tham khảo:
- [Guild Wars 2 — Fashion Templates](https://help.guildwars2.com/hc/en-us/articles/48794217062931-Feature-Explanation-Fashion-Templates): quản lý ngoại hình và các quyền đã mở. Áp dụng nguyên tắc giữ quyền sở hữu và xem trước, không sao chép giao diện.
- [Final Fantasy XIV — patch 6.5](https://na.finalfantasyxiv.com/lodestone/topics/detail/e17ce5b98068f6972379cef5adbc6c4b664f9780): có đường đổi trang bị nâng cấp xác định. Chọn nâng cấp chắc chắn để phù hợp hệ thống ngoại hình hiện tại; đây là quyết định thiết kế cho game này.

## Giá khởi điểm

Nguồn: `packages/game-content/src/cosmetic-upgrades.ts`. Server quyết định giá, cấp và quyền sở hữu.

| Cấp đích | Xu đồ thường |
| --- | ---: |
| 2 | 25.000 |
| 3 | 60.000 |
| 4 | 120.000 |
| 5 | 220.000 |
| 6 | 360.000 |

Premium và thú cưng nhân 2, không cộng dồn hai hệ số. Đây là cấu hình ban đầu để tiếp tục cân bằng theo thu nhập thực tế. Chỉ mở cấp thực sự có trong catalog. Dòng một cấp như Cánh Tiểu Tiên không có nâng cấp; đồ độc quyền quay số không thể mua qua đường nâng cấp.

## Sở hữu và giao dịch

- Giữ nguyên instance và quyền màu của cấp cũ. Cấp mới là một grant riêng, lưu cấp nguồn/đích và số xu thực trả.
- Chuyển toàn bộ màu đã sở hữu của cấp nguồn sang cấp mới nếu catalog có màu tương ứng, thêm màu chuẩn và giữ màu đang chọn.
- Đồ đang mặc được thay bằng cấp mới; đồ cũ về túi, đầy túi thì về kho. Đồ trong kho nâng cấp vẫn ở kho; đồ trong túi dùng túi hoặc kho theo sức chứa.
- Không cho bỏ cấp, nâng cấp instance của người khác, mở trùng cấp, hoặc tiêu xu đang giữ cược arcade.
- SDK local và API dùng chung game-service. API khóa inventory cùng ví trong một transaction. Request receipt ngăn trừ xu/nhận đồ hai lần; UI giữ requestId khi thử lại lỗi mạng/lưu trữ.
- Cửa hàng tiếp tục chỉ bán cấp đầu. Không bán lại, không thêm nguyên liệu hay cơ chế thất bại ở phiên bản này.

## Kiểm tra

`apps/game/tests/cosmetic-upgrade.test.ts` kiểm tra cấp kế tiếp, retry, màu, trang bị đang mặc, pet, túi đầy/kho, giá và xu giữ cược. `apps/api/tests/cosmetic-upgrade.test.ts` kiểm tra authentication, chủ sở hữu, hai request đồng thời và inventory chuẩn hóa.
