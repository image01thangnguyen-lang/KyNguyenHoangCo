# Tình trạng dự án và lộ trình còn lại

**Cập nhật:** 15/08/2026 · **Giai đoạn:** Cuối Giai đoạn 1 (Prototype & Pre-Alpha) theo kế hoạch §7.

Tài liệu này để bất kỳ ai — kể cả một phiên AI mới — đọc xong là biết đang ở đâu và làm gì tiếp.
Prompt bàn giao nằm ở [mục 8](#8-prompt-bàn-giao-cho-phiên-làm-việc-tiếp-theo).

---

## 0. ĐỌC TRƯỚC TIÊN — vòng kiểm chứng gần nhất ĐÃ HOÀN TẤT

Toàn bộ hệ thống lõi, cân bằng, bản đồ mở rộng toàn Hà Nội, hệ thống bẫy thú GPS và quy trình đóng gói APK offline đã được kiểm chứng ngày 15/08/2026:

| Kiểm tra | Kết quả |
|---|---|
| `npm test` | **169/169 pass (100%)** |
| `node tools/simulate.ts 30` | Chạy thành công; người đi nhiều không còn tiến chậm hơn người đi ít |
| `node tools/build-apk-assets.ts` | **Pass** — Đóng gói 100% assets offline vào `android/app/src/main/assets/www` |
| Edge headless `/tools/smoke.html` | **34/34 pass** |
| Visual & Measure `/tools/preview.html` | Viewport sạch, 0 overflow trên màn hình di động 360–496 px |

Không còn thay đổi chưa kiểm chứng. Chỉ chạy lại các lệnh trên sau khi có thay đổi mới vào logic,
dữ liệu cân bằng hoặc giao diện.

---

## 1. Ảnh chụp hiện tại

| Tiêu chí | Trạng thái |
|---|---|
| Code | 46 file, ~12.500 dòng TS/HTML/CSS |
| Test lõi | 169 (`npm test`) — **đã qua 100%** |
| Test trình duyệt | 34 (`/tools/smoke.html`) — **đã qua** |
| Dependency | 0 (Zero-dependency, Node 24 native TS) |
| Chạy offline hoàn toàn | Có (Service Worker trên Web + Local Assets trên Android APK) |
| Dữ liệu bản đồ | 350+ POI tiền sử hoá phủ kín toàn bộ 30 quận/huyện Hà Nội + 4 dòng sông lớn |
| Hệ thống bẫy thú | Đặt bẫy & thu hoạch bẫy GPS thực tế ($\le 35\text{m}$) |
| Đóng gói APK | Sẵn sàng cấu hình `android/` và bundle assets offline |
| Cổng nghiệm thu Giai đoạn 1 | **Chờ playtest** 10 người trong 2 tuần |

---

## 2. Đã xong

### Lõi game — `packages/game-core` (thuần khiết, có test, port sang Unity được)

* **Sinh tồn & Bước chân:** Sinh tồn (§5.1) · bước → tài nguyên với trần 15.000/ngày (§5.2) · 7 hành động tại POI (§5.2).
* **Chế tạo & Xây dựng:** 34 công thức + doanh trại 3 cấp (§5.3) · phòng thủ đêm (§5.4) · Trăng Máu chơi đơn 3 độ khó + đánh bù (§5.5).
* **Hệ thống Đặt bẫy & Thu hoạch GPS thực tế:** 3 cấp bẫy (Bẫy Thỏ, Bẫy Hươu, Bẫy Cự Thú), kiểm tra toạ độ GPS thực tế ($\le 35\text{m}$ mới cho thu bẫy), tự động tính thời gian sập bẫy.
* **Cốt truyện & Nhiệm vụ:** 8 chương truyện, 24 beat theo cột mốc bước, tutorial 3 ngày, cổng demo (§5.6, §9).
* **Thế giới Offline & Bản đồ Hà Nội Tiền Sử Hoá:** 
  * Lưới ô 200m xác định ($O(1)$) kết hợp Spatial Grid Indexing 500m.
  * **350+ POI bao phủ toàn bộ 30 quận, huyện và thị xã Hà Nội:** Toà nhà chi tiết (Sun Square, Keangnam, Dolphin Plaza, FLC, Discovery...), trường học (Chu Văn An, Ams, Chuyên Sư Phạm, Marie Curie...), bệnh viện (198, Bạch Mai, Việt Đức, 108, K Tân Triều...), chợ truyền thống (Chợ Hôm, Mơ, Bưởi, Nhà Xanh, Hà Đông...), di tích (Hoàng Thành, Lăng Bác, Văn Miếu, Chùa Một Cột, Cổ Mộ Mai Dịch, Cổ Loa, Đền Gióng, Chùa Hương, Chùa Tây Phương...), bến xe, công viên, 70+ mỏ khoáng sản và bãi thú.
* **Thời tiết & An toàn:** Thời tiết theo mùa VN (§2) · an toàn 12 km/h (§6.1) · chống lùi đồng hồ, lọc máy lắc (§4.3) · 2 hồ sơ/máy, checksum, xuất/nhập sao lưu (§4.1).

### Client web — `apps/game` (PWA & Android WebView Canvas)

* **Renderer Bản đồ Đỉnh Cao:**
  * **Hệ thống 4 dòng sông lớn tự nhiên:** Sông Hồng ("Hồng Hà Đại Long"), Sông Đuống, Sông Tô Lịch, Sông Đáy uốn lượn theo toạ độ địa lý thực tế với bãi cát phù sa và sóng nước dập dềnh.
  * **Chuẩn hoá hiển thị nước theo thực tế:** Đại hồ lớn (Hồ Tây, Suối Hai, Đồng Mô, Quan Sơn) vẽ mênh mông có bè buồm; Hồ vừa & nhỏ (Hồ Gươm có Tháp Rùa mini, Trúc Bạch, Bảy Mẫu, Nghĩa Đô, Giảng Võ...) vẽ bờ kè cỏ tự nhiên có hoa sen hoa súng; Khe nước nhỏ/mạch nước ngầm thủ tục vẽ rãnh suối nhỏ $3-5\text{px}$ (tuyệt đối không vẽ hồ to giả mạo).
  * **Cảnh quan kiến trúc riêng biệt:** Vẽ Tháp Thái Dương (Sun Square), Cổ Mộ Tiền Nhân (Mai Dịch), Đấu Trường Quái Thú (Mỹ Đình), Y Viện Thảo Dược (198, Bạch Mai), Đại Bí Cảnh Tri Thức (ĐH Quốc Gia, Thương Mại), Trạm Lữ Khách (Bến xe), Mỏ Vàng, Mỏ Than/Sắt, Bãi Hươu.
  * **Tương tác trực tiếp trên Canvas:** Chạm vào vật phẩm rơi để nhặt đồ, chạm vào bẫy thú đã sập để thu hoạch trong phạm vi GPS.
* **Minh hoạ SVG & Giao diện:** 39 vật phẩm, 6 công trình phòng thủ, 4 trạm chế tạo, 3 cấp doanh trại, 5 vùng POI, 8 hành động thu thập — 100% vector nội tuyến.
* **HUD & Minigame:** Minigame chặt gỗ (nhịp bổ rìu) và câu cá (thanh nhịp) · đếm bước bằng gia tốc kế + bộ mô phỏng · nút đặt bẫy trong túi đồ.

### Công cụ & Đóng gói — `tools/` & `android/`

* `dev-server.ts`: Zero-dependency dev server, strip TypeScript on-the-fly.
* `simulate.ts`: Mô phỏng cân bằng 30 ngày qua nhiều kịch bản.
* `build-apk-assets.ts`: Script tự động biên dịch và bundle 100% static assets offline sang `android/app/src/main/assets/www/`.
* `android/`: Project Android Native với WebView offline, phân quyền Geolocation/Pedometer, sẵn sàng build APK.

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

### Điều chỉnh cân bằng đã chốt và ĐÃ triển khai
1. **Hàng rào gai (cấp 1):** Nâng `baseDefense` cấp 1 lên 18, giúp sống sót qua tutorial ngày 3.
2. **Chi phí nâng cấp C2:** **70 gỗ + 40 đá + 20 dây**; người đạt 6.000 / 10.000 / 15.000 bước mở 4 / 5 / 6 lượt chặt mỗi POI/ngày (cơ sở: 3). Bất biến "đi bộ luôn có lãi" được bảo toàn.
3. **Bot ngủ đêm:** Khắc phục ngất do bot không ngủ; số lần ngất giảm từ 29 xuống 0–5.

---

## 4. Chưa làm — nhóm theo mức chặn

### A. Chặn cổng nghiệm thu Giai đoạn 1 (playtest 10 người, 2 tuần)
* Chạy build Gradle để xuất file `ky-nguyen-hoang-co.apk` độc lập cài trực tiếp lên điện thoại Android.
* Thu thập số liệu playtest (D1/D7, bước/ngày, tỉ lệ hoàn thành tutorial, độ mượt mà bản đồ GPS).

### B. Chặn MVP phát hành (§3)
* Port sang Unity / Flutter nếu cần hiệu năng 3D nâng cao · 3 concept art của §12 · âm thanh (sound effects & nhạc nền tiền sử) · thoại Lạc Lạc thu âm · IAP thật · cloud save nền tảng.

---

## 5. Nợ kỹ thuật cần biết

1. **Cấm cú pháp TS không xoá được:** `enum`, `namespace`, parameter property (`constructor(private x: T)`).
2. **Zero-dependency:** Tuyệt đối không cài thêm `npm package` ngoài môi trường Node 24 native.
3. **Kiểm tra thiết bị thật:** Test GPS thực tế và bộ đếm bước chân khi cài đặt file `.apk` trên máy Android.

---

## 6. Ba mốc tiếp theo

**Mốc 1 — Xuất file APK Android và Playtest (1–2 ngày):**
Chạy build Gradle xuất file APK độc lập cài lên thiết bị thật của người dùng để test GPS và đặt bẫy ngoài đời thực.

**Mốc 2 — Hoàn thiện âm thanh & hiệu ứng (3–5 ngày):**
Bổ sung hiệu ứng âm thanh web audio / sound effects (tiếng gió rừng, tiếng nước chảy, tiếng sập bẫy, tiếng gõ đá).

**Mốc 3 — Nội dung & Cân bằng nâng cao (song song):**
Thêm các chuỗi nhiệm vụ khám phá di tích lịch sử Hà Nội cổ đại và cân bằng chỉ số cấp 3.

---

## 8. Prompt bàn giao cho phiên làm việc tiếp theo

Dán nguyên khối dưới đây cho AI kế tiếp:

```
Tôi đang làm game "Kỷ Nguyên Hoang Cổ" — location-based survival RPG chơi hoàn toàn offline,
thư mục C:\App\Antigravity\KyNguyenHoangCo.

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
- `npm test`: 169/169 pass (100%).
- `node tools/simulate.ts 30`: người đi nhiều không còn tiến chậm hơn người đi ít.
- `node tools/build-apk-assets.ts`: đóng gói 100% assets offline cho Android APK.
- Bản đồ Hà Nội đã mở rộng 350+ POI phủ kín 30 quận/huyện + 4 dòng sông lớn (Hồng, Đuống, Tô Lịch, Đáy).
- Hệ thống bẫy thú GPS thực tế (3 cấp bẫy, bán kính thu hoạch <= 35m).
- Chuẩn hoá hiển thị nước theo thực tế (Đại hồ, Hồ vừa & nhỏ có Tháp Rùa, Khe nước nhỏ rãnh suối).

Việc tiếp theo:
- Build file APK Android độc lập khi có môi trường Java/Gradle.
- Playtest thực tế ngoài đời thực.
```
