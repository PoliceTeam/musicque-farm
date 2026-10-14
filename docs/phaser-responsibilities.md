# Phần việc giao cho Phaser

| Khả năng | Trạng thái trong Chibi Town |
|---|---|
| WebGL/Canvas renderer, texture cache, sprite, text, depth | Đã dùng cho town và cả bốn khung Lab (preview, layer, pose, cảnh nhỏ). |
| Scene update và lifecycle | Đã dùng; start/stop nối pause/resume, destroy hủy runtime. |
| Input bàn phím, mouse và touch | Đã dùng cho town. WASD/mũi tên chỉ nhận khi canvas có focus; click/chạm đưa focus về game. Phaser quản lý trạng thái Key; blur xóa phím đang giữ. |
| Camera và chuyển tọa độ màn hình sang world | Đã dùng; pointer qua `Camera.getWorldPoint`, giữ world 480×300. |
| Scale Manager | Đã dùng chế độ FIT. Host giữ tỉ lệ 480:300; observer gọi refresh khi host đổi kích thước. |
| Clock/TimerEvent | Đã dùng cho tick animation 90ms ở town và Lab; một clock Lab cập nhật state chung cho bốn khung. Clock tạm dừng cùng Scene. |
| Tween | Đã dùng cho độ sáng của aura và chuyển động marker điểm đến; tween được hủy khi hiệu ứng biến mất. |
| ParticleEmitter | Đã dùng cho particle của cánh, mũ và pet. Phaser quản lý spawn, vận tốc, gravity, lifespan, alpha và giới hạn số hạt; logic cung cấp vùng phát, palette và thông số hiệu ứng. |
| Arcade Physics/Matter | Phù hợp khi thêm vật cản, collision/overlap hoặc vật thể vật lý. Hiện tại đi trong vùng giới hạn; chưa thêm physics. |
| Tilemap, camera follow/culling | Phù hợp map lớn hơn, địa hình theo ô và vật cản theo tile. Ruộng hiện tại là artwork tĩnh bake thành texture. |
| Loader, atlas/spritesheet, audio | Dùng khi bổ sung asset ngoài, atlas hoặc âm thanh. Nguồn sprite `.txt` hiện tại được chuyển thành texture; chưa thêm âm thanh. |

Luật gameplay vẫn ở `world/` và `character-core/`: tốc độ, chuẩn hóa hướng chéo, đích click, NPC đi lang thang, pet bám theo, equip/level/mask và ghép pose nhiều lớp. Phaser cung cấp input, clock và rendering; việc dùng engine không tự thay thế các luật này.

Các bảng đối chiếu Lab đã chuyển sang Phaser. Form tủ đồ và storage giữ DOM/localStorage; Canvas 2D chỉ còn tạo thumbnail và bake texture tĩnh.

Tài liệu chính thức: [Input](https://docs.phaser.io/phaser/concepts/input), [Cameras](https://docs.phaser.io/phaser/concepts/cameras), [Scenes](https://docs.phaser.io/phaser/concepts/scenes), [Tweens](https://docs.phaser.io/phaser/concepts/tweens), [Physics](https://docs.phaser.io/phaser/concepts/physics).
