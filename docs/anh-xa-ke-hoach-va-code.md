# Ánh xạ kế hoạch → code

Bảng tra cứu: mỗi mục trong `ke-hoach-phat-trien-ky-nguyen-hoang-co.md` (bản 2.0 offline) nằm ở đâu
trong repo. Phần cuối liệt kê những chỗ code **cố ý khác** kế hoạch, kèm lý do — đọc phần đó trước khi
kết luận là code sai.

---

## §0 — Định nghĩa offline

| Cam kết | Nơi thực thi |
|---|---|
| Không lệnh gọi mạng nào lúc chạy | `packages/game-core/**` không import `fetch`; `apps/game/sw.js` phục vụ mọi thứ từ cache |
| Chỉ cần mạng lúc tải app | `apps/game/sw.js` precache toàn bộ module + dữ liệu |
| Thời tiết thật là tuỳ chọn, mặc định tắt | `src/weather.ts` → `applyRealWeather()`; `settings.realWeatherSync = false` |

Kiểm chứng: tải trang, ngắt Wi-Fi, F5.

---

## §4 — Kiến trúc offline

| Mục | File |
|---|---|
| §4.2 Ánh xạ tag OSM → vùng game | `data/poi-mapping.json` |
| §4.2 Gói POI đóng sẵn theo tỉnh | `src/world.ts` → `PoiPack`, `buildPackIndex`, `poisNear` |
| §4.2 Vùng hoang dã thủ tục, lưới 200 m, hệ số 1,2× | `src/world.ts` → `cellAt`, `proceduralZone`, `locationAt` |
| §4.1 Renderer bản đồ cách điệu | `apps/game/src/mapView.ts` |
| §4.1 GPS chỉ đọc khi app mở | `apps/game/src/platform.ts` → `GeoWatcher` |
| §4.1 Save JSON + checksum, xuất/nhập | `src/save.ts` |
| §4.3 Chống lùi đồng hồ | `src/clock.ts` |
| §4.3 Trần 15.000 bước, lọc máy lắc | `src/stepFilter.ts` |

**Chỉ mục ô 500 m** trong `PoiPack` là chi tiết đáng chú ý: gói Hà Nội có thể chứa hàng chục nghìn POI,
quét tuyến tính mỗi khung hình sẽ giết fps trên máy tầm trung. Tra cứu qua chỉ mục là O(1) theo ô.

---

## §5 — Hệ thống game

| Mục | File | Test |
|---|---|---|
| §5.1 Ba chỉ số sinh tồn | `src/survival.ts`, `data/survival.json` | `survival.test.ts` |
| §5.2 Bước → tài nguyên | `src/gathering.ts`, `data/gathering.json` | `gathering.test.ts` |
| §5.2 Hành động tại POI (chặt gỗ, múc nước, câu, bẫy, đổi hàng) | `src/gathering.ts` → `performGatherAction` | `gathering.test.ts` |
| §5.3 33 công thức, doanh trại 3 cấp | `src/crafting.ts`, `data/recipes.json`, `data/camp.json` | `crafting.test.ts` |
| §5.4 Phòng thủ đêm | `src/nightDefense.ts`, `data/monsters.json` | `bloodmoon.test.ts` |
| §5.5 Trăng Máu chơi đơn + đánh bù | `src/bloodMoon.ts` | `bloodmoon.test.ts` |
| §5.6 Cốt truyện 8 chương, beat theo cột mốc bước | `src/story.ts`, `data/story.json` | `story-save.test.ts` |
| §5.7 Vòng lặp một ngày | `src/game.ts` → `openApp` | `loop.test.ts` |

### Con số ở đâu

Không có số cân bằng nào nằm trong code. Tất cả ở `packages/game-core/data/*.json`, và
`validateBalance()` chạy lúc khởi động lẫn trong test để một `itemId` viết sai không lọt ra bản
phát hành — không có server để hotfix, mọi lỗi dữ liệu đều phải đi qua cửa hàng ứng dụng.

---

## §6 — An toàn và pháp lý

| Mục | Nơi thực thi |
|---|---|
| §6.1 Khoá tương tác trên 12 km/h | `src/safety.ts` → `checkSpeed`; chặn trong `src/game.ts` → `gather()` |
| §6.1 Không cơ chế rượt đuổi ngoài đời | Toàn bộ chiến đấu nằm trong `nightDefense.ts`/`bloodMoon.ts`, không hàm nào đọc vị trí |
| §6.1 Không thưởng thêm cho ban đêm | `data/gathering.json` → `nightWalking.pickupMultiplier: 1.0` |
| §6.1 Nhắc quan sát xung quanh mỗi ngày | `src/safety.ts` → `dueReminders` |
| §6.1 Báo cáo POI nguy hiểm | `src/game.ts` → `hidePoi()`; ẩn ngay trên máy |
| §6.2 Nhắc nghỉ, không cưỡng chế | `data/device-checks.json` → `wellbeing.enforceHardLimit: false` |
| §6.3 Không thu thập dữ liệu | `data/device-checks.json` → `privacy`; hiện trong tab Cài đặt |

Bốn điểm an toàn có test riêng trong `world.test.ts` và `loop.test.ts`, vì đây là phần **không được
phép hỏng âm thầm**.

---

## §9 — Kinh doanh

| Mục | Nơi thực thi |
|---|---|
| Demo 3 ngày, cắt trước Trăng Máu đầu tiên | `src/story.ts` → `demoGate()`; `data/story.json` → `demo` |
| Mở khoá trọn đời giữ nguyên tiến trình | `src/story.ts` → `unlockFullGame()`; có test trong `loop.test.ts` |

IAP thật chưa nối — nút mở khoá trong prototype chỉ đặt cờ trong save.

---

## Những chỗ code cố ý khác kế hoạch

**1. Mức sàn khi vắng mặt lâu: 20/20/30 thay vì để người chơi ngất.**
Kế hoạch chỉ nói "đóng băng chỉ số ở mức sàn". Lần chạy test đầu tiên cho thấy người vắng một tuần
quay lại sẽ ngất ngay và mất 30% đồ đang mang. Đó là trừng phạt người có cuộc sống ngoài game — đi
ngược trụ cột thiết kế. Nay sàn được đặt bằng đúng mức hồi sau khi ngất, và trạng thái ngất bị huỷ khi
quãng vắng vượt 24 giờ. Ngất vẫn xảy ra bình thường với quãng vắng ngắn hơn.
→ `data/survival.json` → `offlineCatchUp`, test trong `loop.test.ts`.

**2. Khoá POI ban đêm cho trẻ em là tuỳ chọn, không mặc định.**
Bản 1.0 khoá cứng cho tài khoản dưới 18 tuổi. Bản offline không có tài khoản nên game **không thể biết
ai là trẻ em**; khoá cứng chỉ làm phiền người lớn. Nay là công tắc trong Cài đặt để phụ huynh tự bật.
→ `src/time.ts` → `outdoorPolicy(ms, parentalLockEnabled)`.

**3. Bỏ shadow-nerf.**
Đây là cơ chế chống gian lận server-authoritative của bản 1.0. Với game chơi đơn, âm thầm giảm hệ số
nhặt của người chơi chỉ tạo ra một trải nghiệm khó hiểu mà không bảo vệ ai. Thay bằng: trần ngày, lọc
máy lắc, và trần mỗi mẻ đồng bộ — phần vượt ngưỡng được **hoãn lại** chứ không bị xoá.
→ `src/stepFilter.ts`.

**4. Bảng cân bằng có 33 công thức, không phải đúng 30.**
Kế hoạch ghi "khoảng 30". 33 là con số vừa đủ để mỗi cấp trại mở ra một nhóm công thức trọn vẹn.

**5. Vật phẩm có cờ `safe` không bao giờ rơi.**
Kế hoạch nói ngất rơi 30% tài nguyên đang mang. Bản vẽ và lõi nâng cấp trại được miễn: mất bản vẽ là
mất nhiều ngày tiến độ, quá nặng tay với một game định vị là "sinh tồn cùng mái nhà".
→ `src/inventory.ts` → `dropFraction()`.

**6. Prototype chạy trên web, không phải Unity.**
Xem [`quyet-dinh-ky-thuat.md`](quyet-dinh-ky-thuat.md).
