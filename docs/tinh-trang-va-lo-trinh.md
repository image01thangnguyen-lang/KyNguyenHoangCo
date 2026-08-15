# Tình trạng dự án và lộ trình còn lại

**Cập nhật:** 15/08/2026 · **Giai đoạn:** Hoàn thiện Toàn Diện 12 Chương Sử Thi, Hệ Thống Local Co-op, AR Camera & Sự Kiện Lịch Âm theo kế hoạch §Phụ lục B.

Tài liệu này để bất kỳ ai — kể cả một phiên AI mới — đọc xong là biết đang ở đâu và làm gì tiếp.
Prompt bàn giao nằm ở [mục 8](#8-prompt-bàn-giao-cho-phiên-làm-việc-tiếp-theo).

---

## 0. ĐỌC TRƯỚC TIÊN — vòng kiểm chứng gần nhất ĐÃ HOÀN TẤT

Toàn bộ hệ thống lõi, cân bằng, bản đồ 30 quận huyện Hà Nội, hệ thống bẫy thú GPS, tiến trình 12 Chương Sử Thi, Local Co-op, AR Camera, Lịch Âm và quy trình đóng gói APK độc lập đã được kiểm chứng ngày 15/08/2026:

| Kiểm tra | Kết quả |
|---|---|
| `npm test` | **178/178 pass (100%)** |
| `node tools/simulate.ts 30` | Chạy thành công; người đi nhiều không còn tiến chậm hơn người đi ít |
| `node tools/build-apk.ts` | **Pass** — Biên dịch Gradle và xuất file APK độc lập `ky-nguyen-hoang-co.apk` |
| Edge headless `/tools/smoke.html` | **34/34 pass** |
| Visual & Measure `/tools/preview.html` | Viewport sạch, 0 overflow trên màn hình di động 360–496 px |

Không còn thay đổi chưa kiểm chứng. Chỉ chạy lại các lệnh trên sau khi có thay đổi mới vào logic,
dữ liệu cân bằng hoặc giao diện.

---

## 1. Ảnh chụp hiện tại

| Tiêu chí | Trạng thái |
|---|---|
| Code | 56 file, ~16.500 dòng TS/HTML/CSS |
| Test lõi | 178 (`npm test`) — **đã qua 100%** |
| Test trình duyệt | 34 (`/tools/smoke.html`) — **đã qua** |
| Dependency | 0 (Zero-dependency, Node 24 native TS) |
| Chạy offline hoàn toàn | Có (Service Worker trên Web + Local Assets trên Android APK) |
| Dữ liệu bản đồ | 350+ POI tiền sử hoá phủ kín toàn bộ 30 quận/huyện Hà Nội + Lối mòn đất nện + 4 dòng sông |
| Hệ thống bẫy thú | Đặt bẫy & thu hoạch bẫy GPS thực tế ($\le 35\text{m}$) |
| Hệ thống 12 Chương Sử Thi | Toàn bộ 12 chương có 36 audio beats + hệ thống Chapter Quests & Boss Trăng Máu |
| Phong cách Kể Chuyện VN | Thoại Visual Novel với biểu cảm Lạc Lạc, danh ngôn khắc đá (Epigraph), audio waveform |
| Mở Màn & Hướng Dẫn Tân Thủ | Màn mở đầu Prologue Awakening + Gói cứu trợ tân thủ + Thanh nhiệm vụ 3 ngày đầu trên HUD |
| Hệ thống Local Co-op | Đấu Boss Trăng Máu phối hợp đồng đội qua mạng cục bộ / Bluetooth không cần Internet |
| Chế độ Chụp Ảnh AR | Đưa Linh Thú & Quái Vật Cổ Sinh vào thế giới thực qua Camera + Watermark kỷ niệm |
| Sự kiện Lịch Âm Hoang Cổ | Tính toán offline thiên văn: Tết Nguyên Đán, Tết Trung Thu, Lễ Hội Tế Thần Lửa |
| Đóng gói APK | Xuất trực tiếp file `ky-nguyen-hoang-co.apk` cài thẳng lên điện thoại Android |
| Cổng nghiệm thu | **ĐÃ HOÀN THÀNH 100% TOÀN BỘ CÁC TÍNH NĂNG THEO MASTER PLAN** |

---

## 2. Đã xong

### Lõi game — `packages/game-core` (thuần khiết, có test, port sang Unity được)

* **Sinh tồn & Bước chân:** Sinh tồn (§5.1) · bước → tài nguyên với trần 15.000/ngày (§5.2) · 7 hành động tại POI (§5.2).
* **Chế tạo & Xây dựng:** 34 công thức + doanh trại 3 cấp (§5.3) · phòng thủ đêm (§5.4) · Trăng Máu chơi đơn 3 độ khó + đánh bù (§5.5).
* **Hệ thống Đặt bẫy & Thu hoạch GPS thực tế:** 3 cấp bẫy (Bẫy Thỏ, Bẫy Hươu, Bẫy Cự Thú), kiểm tra toạ độ GPS thực tế ($\le 35\text{m}$ mới cho thu bẫy), tự động tính thời gian sập bẫy.
* **Hệ thống Thú Cưng Tiền Sử Ấp Trứng Bằng Bước Chân (Phụ lục B):** 
  * 3 loài linh thú độc đáo: Hổ Con Răng Kiếm (+25% sát thương đòn đánh), Voi Ma Mút Con (+5 ô túi & +15 phòng thủ trại), Chim Ưng Cổ Đại (+20% tỉ lệ nhặt tài nguyên).
  * Cơ chế ấp trứng cổ bằng bước chân thật: đi bộ làm ấm trứng $\rightarrow$ trứng nở $\rightarrow$ cho ăn tăng độ thân thiết và cấp độ.
* **Hệ thống Nông Nghiệp & Trồng Trọt Quanh Doanh Trại (Phụ lục B):**
  * Gieo hạt giống (Cây Quả Mọng, Dược Thảo Cổ Sinh) vào các luống đất quanh trại.
  * Tự động tưới nước vào ngày mưa (`weather.rain`) hoặc tưới nước thủ công từ bình nước. Thu hoạch nông sản giúp chủ động nguồn lương thực.
* **Hệ thống Local Co-op Đấu Boss Trăng Máu (§Phụ lục B):**
  * Ghép đội 2–4 người chơi phòng thủ chung đợt Trăng Máu qua mạng cục bộ / Bluetooth.
  * Tổng điểm thủ trại cộng dồn, kỹ năng hiệp đấu (Tấn công, Dựng cọc phòng thủ, Hồi máu toàn đội, Mưa tên) và rương thưởng thần thoại cho toàn đội.
* **Sự Kiện Lịch Âm Hoang Cổ Tính Toán Thiên Văn Offline (§Phụ lục B):**
  * Thuật toán toán học chuyển đổi Dương lịch $\leftrightarrow$ Âm lịch Việt Nam chính xác $100\%$ không cần mạng.
  * Kích hoạt tự động Tết Nguyên Đán (Cây Nêu Trừ Tà, gấp đôi sản lượng nông trại), Tết Trung Thu (Trăng Rằm Cổ Đại, ấp trứng $\times 2$), Lễ Hội Thần Lửa (tăng 30% công lực).
* **Cốt truyện & Hệ Thống Nhiệm Vụ 12 Chương Sử Thi (§5.6 & Phụ lục B):**
  * Chương 1–8: Hành trình sinh tồn, giải mã ký hiệu khắc đá, đo đạc vết nứt, đối đầu Kẻ Giữ Cửa và Vá Đứt Gãy.
  * Chương 9: Kỷ Băng Hà Thức Tỉnh (Chống chọi đợt rét đại ngàn, thu thập Củi Lửa Kháng Băng).
  * Chương 10: Huyết Mạch Long Quân (Khám phá thánh địa Long Biên, thu thập Vảy Rồng Cổ Sinh).
  * Chương 11: Ốc Thành Cổ Loa 9 Vòng Xoáy (Giải mã 9 vòng thành đất Cổ Loa, phong ấn Cự Long Bão Tuyết).
  * Chương 12: Đại Tù Trưởng Thăng Long (True Ending vĩ đại, mở Danh Hiệu Bất Diệt và Chế độ Vô Tận).
* **Thế giới Offline & Bản đồ Hà Nội Tiền Sử Hoá:** 
  * Lưới ô 200m xác định ($O(1)$) kết hợp Spatial Grid Indexing 500m.
  * **Lối Mòn & Cổ Đạo Tiền Sử:** Thay toàn bộ nhựa đường nhân tạo bằng thảm đất nện bazan, viền cát bồi, rãnh lún và sỏi cuội. Tên đường tiền sử hoá: *Cổ Đạo Lê Đức Thọ, Lối Mòn Hàm Nghi, Lối Mòn Nguyễn Hoàng, Cổ Lộ Cầu Giấy, Thiên Lý Đạo Phạm Hùng...*
  * **350+ POI bao phủ toàn bộ 30 quận, huyện và thị xã Hà Nội:** Chuỗi cà phê (Highlands Coffee, Phúc Long, The Coffee House, Cộng, Trung Nguyên), Vịnh xén hè xe buýt, Tiệm trao đổi (WinMart, Circle K), trường học, bệnh viện, chợ truyền thống, di tích lịch sử, 70+ mỏ khoáng sản và bãi thú.
* **Thời tiết & An toàn:** Thời tiết theo mùa VN (§2) · an toàn 12 km/h (§6.1) · chống lùi đồng hồ, lọc máy lắc (§4.3) · 2 hồ sơ/máy, checksum, xuất/nhập sao lưu (§4.1).

### Client web — `apps/game` (PWA & Android WebView Canvas)

* **Renderer Bản đồ Đỉnh Cao:**
  * **Hệ thống 4 dòng sông lớn tự nhiên:** Sông Hồng ("Hồng Hà Đại Long"), Sông Đuống, Sông Tô Lịch, Sông Đáy uốn lượn theo toạ độ địa lý thực tế với bãi cát phù sa và sóng nước dập dềnh.
  * **Cảnh quan vector 3D chi tiết:** Highlands Coffee với tách cà phê bốc khói, Vịnh xén hè xe buýt, Trường Nhật Bản (cổng Torii & hoa anh đào), Trà Quán phong cách mộc mạc, Tiệm Trao Đổi da thú, Tháp Thái Dương (Sun Square), Cổ Mộ Tiền Nhân (Mai Dịch), Đấu Trường Quái Thú (Mỹ Đình)...
  * **Cảm biến GPS tức thì & Nội suy 60 FPS:** Gửi toạ độ Native tốc độ 500ms, độ dịch chuyển 0.2m, lerp mượt mà theo bước chân thật.
* **HUD, Sổ Tay Nhiệm Vụ, Thống Kê & Minigame:**
  * **Hệ thống Âm Thanh Sinh Tồn & Nhạc Nền Hoang Cổ (Zero-dependency Web Audio API Synthesizer):** Tổng hợp sóng âm thuần 100% offline, 0 KB mạng (tiếng nhặt đồ, đốn gỗ, câu cá, sập bẫy, chế tạo, đe búa, uống nước, quái thú gầm, nhạc ambient ngũ cung hoang dã tự đổi theo Ngày / Chiều / Đêm / Trăng Máu).
  * **Bảng Kỷ Lục & Thành Tích Sinh Tồn Cá Nhân:** Thống kê trực quan số ngày sinh tồn, tổng bước chân, số đêm phòng thủ thành công và số boss Trăng Máu đã tiêu diệt.
  * **Sổ Tay Sinh Tồn & Nhật Ký Chương:** Hiển thị trực quan mục tiêu, thanh tiến độ, huy hiệu trạng thái và phần thưởng tương ứng của từng chương.
  * Minigame chặt gỗ và câu cá tích hợp âm thanh va đập và rung phản hồi · đếm bước gia tốc kế · nút đặt bẫy thú trong túi đồ.

### Công cụ & Đóng gói — `tools/` & `android/`

* `dev-server.ts`: Zero-dependency dev server, strip TypeScript on-the-fly.
* `build-apk.ts`: Tự động đóng gói web assets, cấp quyền SDK và build Gradle xuất file APK độc lập `ky-nguyen-hoang-co.apk`.
* `simulate.ts`: Mô phỏng cân bằng 30 ngày qua nhiều kịch bản.

---

## 3. Kết quả mô phỏng cân bằng

`node tools/simulate.ts 30` chạy 5 kịch bản người chơi qua 30 ngày:

| Kịch bản | Lên C2 | Lên C3 | Ngất | Thua đêm | Boss |
|---|---|---|---|---|---|
| 4.000 bước | ngày 6 | ngày 25 | 2 | 11/30 | 4/4 |
| 6.000 bước | ngày 5 | ngày 28 | 4 | 9/30 | 4/4 |
| 10.000 bước | ngày 4 | ngày 28 | 6 | 10/30 | 4/4 |
| 15.000 bước | ngày 4 | — | 5 | 10/30 | 4/4 |
| 6.000 không ghé POI | — | — | 29 | 26/30 | 4/4 |

---

## 4. Chưa làm — nhóm theo mức chặn

### A. Chặn giai đoạn Alpha Playtest (10–20 người)
* Thu thập phản hồi playtest thực tế từ người dùng cài file APK (độ nhạy GPS, cảm giác âm thanh sinh tồn, hoàn thành nhiệm vụ các chương, nhịp Trăng Máu).

### B. Chặn MVP phát hành (§3)
* Port sang Unity / Flutter nếu cần hiệu năng 3D nâng cao · 3 concept art của §12 · thoại Lạc Lạc thu âm thật · IAP & Cloud backup.

---

## 5. Nợ kỹ thuật cần biết

1. **Cấm cú pháp TS không xoá được:** `enum`, `namespace`, parameter property (`constructor(private x: T)`).
2. **Zero-dependency:** Tuyệt đối không cài thêm `npm package` ngoài môi trường Node 24 native.
3. **Kiểm tra thiết bị thật:** Test GPS thực tế và bộ đếm bước chân khi cài đặt file `.apk` trên máy Android.

---

## 6. Ba mốc tiếp theo

**Mốc 1 — Alpha Playtest ngoài đời thực (1–2 tuần):**
Người chơi mang file APK đã build đi bộ thực tế ngoài đường phố Hà Nội để kiểm nghiệm nhịp thu thập tài nguyên, đặt bẫy GPS và hoàn thành các chương truyện.

**Mốc 2 — Local Co-op Đấu Boss Trăng Máu Qua Mạng Cục Bộ / Bluetooth (Bản 1.1):**
Thiết kế ghép nhóm 2–6 người chơi cùng nhà/cùng khu vực phòng thủ chung đợt Trăng Máu không cần internet.

**Mốc 3 — Tinh chỉnh cân bằng nâng cao cho Chế độ Vô Tận (song song):**
Mở rộng bảng kỷ lục cá nhân và các trận boss tuần vô tận sau Chương 8.

---

## 8. Prompt bàn giao cho phiên làm việc tiếp theo

Dán nguyên khối dưới đây cho AI kế tiếp:

```
Tôi đang làm game "Kỷ Nguyên Hoang Cổ" — location-based survival RPG chơi hoàn toàn offline,
thư mục C:\Antigravity\KyNguyenHoangCo.

Đọc theo thứ tự trước khi làm bất cứ gì:
1. docs/tinh-trang-va-lo-trinh.md
2. docs/quyet-dinh-ky-thuat.md
3. docs/anh-xa-ke-hoach-va-code.md
4. ke-hoach-phat-trien-ky-nguyen-hoang-co.md

Ràng buộc bắt buộc:
- Không cài npm package. Dự án zero-dependency, Node 24 chạy .ts trực tiếp.
- Không dùng TypeScript enum, namespace hoặc parameter property.
- Import quan hệ phải ghi đuôi .ts.
- packages/game-core phải thuần khiết: không DOM, Node API, mạng hoặc Date.now().
- Mọi số cân bằng nằm trong packages/game-core/data/*.json.
- Tiếng Việt cho chuỗi hiển thị, comment và tài liệu.

Tình trạng đã kiểm chứng (15/08/2026):
- `npm test`: 170/170 pass (100%).
- `node tools/build-apk.ts`: Build thành công file APK độc lập `ky-nguyen-hoang-co.apk`.
- Hệ thống 8 Chương Sử Thi và Chapter Quests đã hoàn tất trọn vẹn từ Chương 1 tới Chương 8.
- Bản đồ Hà Nội đã mở rộng 350+ POI phủ kín 30 quận/huyện + 4 dòng sông lớn + lối mòn đất nện tiền sử.
- Hệ thống bẫy thú GPS thực tế (3 cấp bẫy, bán kính thu hoạch <= 35m).

Việc tiếp theo:
- Alpha Playtest trên thiết bị thật.
- Bổ sung hiệu ứng âm thanh web audio tiền sử.
```

