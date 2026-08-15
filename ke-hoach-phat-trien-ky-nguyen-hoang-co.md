# KẾ HOẠCH PHÁT TRIỂN GAME — KỶ NGUYÊN HOANG CỔ (PRIMITIVE REALM)
# BẢN OFFLINE — PHIÊN BẢN 2.0

**Phiên bản 2.0 — 14/08/2026 (thay thế bản 1.0 định hướng online)**
**Định hướng:** Game offline — không máy chủ, không tài khoản, chơi không cần Internet
**Thể loại:** Location-based Survival RPG chơi đơn (GPS + đi bộ thực tế)
**Nền tảng:** Android trước, iOS theo sau

---

## 0. ĐỊNH NGHĨA "OFFLINE" CỦA DỰ ÁN

M��i logic game, dữ liệu bản đồ và tiến trình người chơi nằm hoàn toàn trên máy. GPS là tín hiệu vệ tinh và cảm biến đếm bước là phần cứng — cả hai hoạt động không cần Internet, nên vòng lặp cốt lõi "đi bộ nhặt tài nguyên" không bị ảnh hưởng gì.

Chỉ hai thời điểm cần mạng (không thể tránh với mọi ứng dụng): tải app cùng gói dữ liệu khu vực lần đầu, và lúc thanh toán mở khóa qua cửa hàng ứng dụng. Ngoài ra không có gì gửi đi hay tải về. Các tính năng online của bản 1.0 (co-op qua Internet, thời tiết thật, bảng xếp hạng, sự kiện đẩy từ server) hoặc bị loại, hoặc được chuyển thành cơ chế chạy trên máy — chi tiết ở mục 2.

---

## 1. TẦM NHÌN VÀ TRỤ CỘT THIẾT KẾ

**Câu định vị:** Biến mỗi bước chân quanh khu phố và mỗi chuyến xe buýt thành tài nguyên sinh tồn trong thế giới 10.000 năm trước — một cuộc phiêu lưu trọn vẹn nằm gọn trong túi bạn, không cần mạng, không cần server.

Năm trụ cột thiết kế:

1. **Bước chân là tài nguyên tinh — Chuyến đi là tài nguyên mở:** Đi bộ để thu hoạch sâu đồ quý; Đi xe buýt/xe máy để mở rộng bản đồ và thu thập thụ động.
2. **Thế giới thật là bản đồ:** Công viên, hồ nước, trạm xe buýt quanh nhà là nội dung game.
3. **An toàn trên hết:** Tự động rảnh tay (Hands-free) khi đi xe; khóa mọi tương tác phức tạp khi đang di chuyển nhanh, chỉ mở tương tác nhanh 30s khi xe đỗ tại trạm.
4. **Sinh tồn cùng mái nhà:** Trải nghiệm gia đình đến từ việc chơi cạnh nhau; co-op cục bộ qua Wi-Fi/Bluetooth (vẫn không cần Internet) dự kiến ở bản 1.1.
5. **Kể chuyện dẫn lối:** AI Lạc Lạc vừa dẫn chuyện theo bước chân đi bộ, vừa đóng vai trò Radio cổ đại thuyết minh khi đi xe buýt. *(Chi tiết kịch bản xem tại [kich-ban-game-da-phuong-thuc.md](docs/kich-ban-game-da-phuong-thuc.md))*.

---

## 2. BẢNG QUYẾT ĐỊNH: TỪ ONLINE (v1.0) SANG OFFLINE (v2.0)

| Hạng mục bản 1.0 | Bản 2.0 offline | Ghi chú |
|---|---|---|
| Backend Nakama + PostGIS + Redis | **Bỏ hoàn toàn** | Tiết kiệm 1 vị trí backend dev và toàn bộ chi phí hạ tầng |
| Tài khoản + lưu đám mây | Lưu cục bộ; xuất/nhập file sao lưu; tùy chọn cloud save của Google Play Games/iCloud khi có mạng | Đổi máy vẫn giữ được tiến trình |
| POI truy vấn từ server | Gói dữ liệu OSM lọc sẵn theo tỉnh/thành (ước 5–40 MB/khu vực), tải một lần; kèm sẵn Hà Nội, TP.HCM, Đà Nẵng trong app | Pipeline lọc chạy lúc build, không cần server |
| Bản đồ tile online | Renderer vector cách điệu tự dựng từ gói dữ liệu | Phong cách "tiền sử hóa" vốn không cần bản đồ chi tiết — đây là lợi thế, không phải hạn chế |
| Thời tiết thật qua API | Hệ thống thời tiết trong game theo mùa Việt Nam; tự đồng bộ thời tiết thật nếu tình cờ có mạng (tùy chọn) | Game không bao giờ phụ thuộc mạng |
| Trăng Máu co-op qua server | Trận boss chơi đơn theo đồng hồ máy (thứ Bảy 19:00–22:00); co-op cục bộ Wi-Fi/Bluetooth ở bản 1.1 | Vẫn đúng tinh thần "cả nhà đánh boss" trong một mái nhà |
| Chống gian lận server-authoritative | Kiểm tra hợp lý trên máy: trần 15.000 bước/ngày, lọc máy lắc, chống lùi đồng hồ | Game đơn: gian lận chỉ tự lừa mình — chấp nhận |
| Giấy phép G1 + phê duyệt kịch bản | Loại **G4** (tải về qua mạng, không tương tác qua máy chủ): thủ tục nhẹ hơn nhiều | Chi tiết mục 6 |
| Battle pass + cửa hàng trực tuyến | Chơi thử 3 ngày đầu miễn phí → mở khóa trọn đời mua một lần; DLC theo bản cập nhật | Chi tiết mục 9 |
| Telemetry bắt buộc từ server | Analytics tối giản dạng opt-in (hoặc bỏ hẳn); bù bằng playtest trực tiếp | Chi tiết mục 10 |

---

## 3. PHẠM VI MVP OFFLINE

**Bắt buộc có:**

- Đếm bước chạy nền bằng cảm biến, đồng bộ khi mở app
- Bản đồ cách điệu + POI offline 3 loại (Rừng, Nước, Thương nhân) + Vùng hoang dã thủ tục cho nơi thưa POI hoặc chưa tải gói chi tiết
- 3 chỉ số sinh tồn; khoảng 30 công thức chế tạo; doanh trại 3 cấp
- Chu kỳ ngày đêm theo đồng hồ máy + Phòng thủ trại ban đêm
- Đêm Trăng Máu hằng tuần (trận boss đơn, có đánh bù)
- **Cốt truyện 8 chương do Lạc Lạc dẫn chuyện** (audio + text khi đi bộ) — với game offline, nội dung phải gánh vai trò giữ chân mà cộng đồng online thường đảm nhiệm
- Tutorial 3 ngày đầu, mở màn bằng nhiệm vụ "Đốt lửa trước khi trời tối"
- 2 hồ sơ người chơi trên một máy (anh em dùng chung điện thoại)
- Lưu cục bộ có checksum + xuất/nhập file sao lưu

**Nên có (bản 1.1–1.3):** co-op cục bộ Wi-Fi/Bluetooth cho Trăng Máu; thú cưng tiền sử; trồng trọt quanh trại; chương truyện mới theo quý; chế độ chụp ảnh AR.

**Không làm:** mọi thứ cần máy chủ — bảng xếp hạng online, clan, chợ giao dịch, sự kiện đẩy từ xa.

---

## 4. KIẾN TRÚC KỸ THUẬT OFFLINE

### 4.1 Lựa chọn công nghệ

| Hạng mục | Đề xuất | Ghi chú |
|---|---|---|
| Engine | Unity 6 (C#) | Một codebase cho Android và iOS |
| Bản đồ | Renderer vector cách điệu tự viết: đường thành đường mòn đất, polygon nước và cây theo art style tiền sử | Không SDK bản đồ online, không phí tile, không phụ thuộc bên thứ ba |
| Dữ liệu POI | Tool chạy lúc build: OSM Việt Nam (Geofabrik) → lọc tag → gói nhị phân theo tỉnh, đặt trên CDN tĩnh | Bảng ánh xạ tag giữ như bản 1.0 (leisure=park, natural=water, shop=...) |
| Định vị | GPS hệ thống — hoạt động không cần mạng (có mạng thì khóa vệ tinh nhanh hơn nhờ A-GPS) | Chỉ đọc khi app mở |
| Đếm bước | Android: TYPE_STEP_COUNTER (+ Health Connect tùy chọn); iOS: CMPedometer (+ HealthKit tùy chọn) | Xử lý 100% trên máy |
| Thời gian, sự kiện | Đồng hồ và lịch của máy; Trăng Máu = thứ Bảy 19:00–22:00 giờ máy | Kèm chống lùi đồng hồ (mục 4.3) |
| Lưu trữ | File save JSON nén + checksum; xuất/nhập file; tùy chọn cloud save nền tảng | |
| Thanh toán | IAP mở khóa một lần (Google Play Billing / StoreKit) | Chỉ cần mạng đúng lúc mua |
| Analytics | Không bắt buộc; nếu có thì opt-in và chỉ gửi khi có mạng | |

### 4.2 Pipeline dữ liệu bản đồ (chạy lúc build, không có server)

1. Tải extract OpenStreetMap Việt Nam từ Geofabrik.
2. Script lọc tag và đơn giản hóa hình học (giảm điểm của polygon và đường).
3. Đóng gói thành file nhị phân theo tỉnh/thành, nén; ước tính 5–40 MB mỗi khu vực.
4. Đưa lên CDN tĩnh; app kèm sẵn 3 thành phố lớn, khu vực khác tải một lần khi người chơi chọn.

Vùng hoang dã thủ tục (lưới ô 200 m, hệ số 1,2×) giữ nguyên và càng quan trọng hơn: nó bảo đảm game chơi tốt ở cả nơi chưa có gói dữ liệu chi tiết. PoC trong tháng đầu phải trả lời hai câu hỏi: gói Hà Nội nặng bao nhiêu MB, và renderer chạy 60 fps trên máy Android tầm trung không.

### 4.3 Kiểm tra hợp lý trên máy (thay cho chống gian lận server)

- Trần thưởng 15.000 bước/ngày; lọc mẫu gia tốc của máy lắc điện thoại.
- Chống lùi đồng hồ: lưu "mốc thời gian lớn nhất từng thấy"; nếu giờ máy nhỏ hơn mốc này thì tạm khóa các sự kiện theo lịch cho tới khi vượt mốc.
- Save có checksum để chống hỏng file. Không cần mã hóa nặng: với game chơi đơn, người muốn sửa save chỉ tự phá trải nghiệm của chính họ — không đáng đánh đổi độ phức tạp.

### 4.4 Chi phí vận hành

Gần như bằng không: CDN tĩnh cho gói bản đồ cộng trang giới thiệu, ước 0,5–3 triệu đồng/tháng — so với 15–40 triệu/tháng của bản online ở quy mô soft launch. Không có server nghĩa là không có sự cố nửa đêm, không cần trực vận hành.

---

## 5. HỆ THỐNG GAME VÀ SỐ LIỆU CÂN BẰNG

### 5.1 Chỉ số sinh tồn (giữ nguyên từ bản 1.0)

| Chỉ số | Suy giảm | Hồi phục | Khi cạn |
|---|---|---|---|
| Đói | -5%/giờ khi thức; +1% mỗi 1.000 bước | Quả dại +10%, cá nướng +30%, thịt nướng +40% | HP tụt 5% mỗi 10 phút |
| Khát | -8%/giờ | Nước sôi +50%; nước thô +20% nhưng 40% bị bệnh (mất 15% HP) | HP tụt nhanh hơn đói |
| HP / Thể lực | Chiến đấu, bệnh | Ngủ tại trại hồi đầy, bình hồi máu | Ngất, tỉnh ở trại, rơi 30% tài nguyên đang mang (kho trại không mất) |

Nguyên tắc vàng: 4.000–6.000 bước/ngày là "đủ sống và có tích lũy"; 10.000 bước tích lũy nhanh gấp khoảng 2,5 lần. Người đi bộ nhiều không bao giờ thiệt hơn người đứng yên.

### 5.2 Quy đổi bước chân thành tài nguyên (giữ nguyên)

| Bối cảnh | Cơ chế | Sản lượng |
|---|---|---|
| Đường mòn (mọi nơi) | 100 bước = 1 lượt nhặt tự động | 1–2 cành khô / 1 đá nhọn / 1 dây leo (50/30/20) |
| Rừng (công viên, vùng cây) | Lượt nhặt nhân đôi + hành động chủ động | Chặt gỗ minigame 45 giây: 5–9 gỗ lớn; tối đa 3 lượt/POI/ngày, tăng thành 4 / 5 / 6 khi đạt 6.000 / 10.000 / 15.000 bước; hái 10 quả/POI/ngày; bẫy thỏ thu sau 2 giờ |
| Vùng nước | Trong phạm vi 20 m mép nước | Múc 3 bình nước thô (hồi chiêu 30 phút); câu cá minigame |
| Thương nhân cổ (cửa hàng, chợ) | 1 lượt đổi mỗi POI mỗi ngày | Thịt đổi hạt giống, quặng, bản vẽ |
| Vùng hoang dã thủ tục | Như đường mòn, hệ số 1,2× | Chạy được ở mọi nơi trên bản đồ |

### 5.3 Cây chế tạo và doanh trại (giữ nguyên)

- **Cấp 1 — Túp Lều Tranh:** Rìu đá (3 cành + 2 đá + 2 dây), Đuốc, Giáo đá, Bẫy thỏ, Lửa trại, Giá phơi.
- **Cấp 2 — Nhà Sàn Gỗ (mở Lò nung):** nâng cấp tốn 70 gỗ lớn + 40 đá + 20 dây (3–4 ngày chơi đều). Mở: Cung tên, Bình đất nung, Bình hồi máu, Tường gỗ, Khiên.
- **Cấp 3 — Pháo Đài Đá Cổ (mở Lò rèn):** 300 gỗ + 200 đá + 30 quặng (khoảng 2 tuần). Mở: vũ khí sắt, tường đá, tháp canh, ballista.

### 5.4 Ban đêm: Phòng thủ doanh trại

Khung 20:00–24:00 theo giờ máy: các đợt quái tấn công trại trong game; người chơi bố trí bẫy, tường, tháp bằng tài nguyên gom ban ngày — chơi hoàn toàn tại nhà, chất kinh dị đến từ âm thanh và nhịp rung. Cơ chế này vốn đã không cần mạng nên chuyển sang offline không mất gì. Offline ban đêm thì trại tự thủ theo chỉ số công trình; thua chỉ mất tài nguyên ngoài két an toàn.

### 5.5 Đêm Trăng Máu phiên bản offline (thứ Bảy 19:00–22:00 giờ máy)

- Trận boss chơi đơn: HP và độ khó của boss tính theo cấp doanh trại, kèm 3 mức độ khó tự chọn.
- Công trình phòng thủ đã xây (tường, tháp, ballista) đóng vai "đồng đội", tự động góp sát thương — người chơi vẫn có cảm giác chỉ huy một trận công thành.
- Bỏ lỡ khung giờ? Sáng Chủ nhật boss "vây trại", cho đánh bù với phần thưởng giảm 30% — đời thật bận rộn, không phạt nặng.
- Bản 1.1: co-op cục bộ 2–6 máy trong cùng nhà qua Wi-Fi/Bluetooth (Nearby Connections trên Android, Multipeer Connectivity trên iOS) — cả nhà cùng đánh boss mà vẫn không cần Internet. Đây là cách giữ được tính năng "đinh" của kịch bản gốc trong khuôn khổ offline.

### 5.6 Cốt truyện 8 chương — xương sống của bản offline

M��i chương kéo dài một tuần, mở khóa sau mỗi Trăng Máu: từ "3 ngày đầu sống sót" đến bí ẩn về Đứt Gãy Không Gian, và kết thúc ở chương 8 bằng nghi lễ "Vá Đứt Gãy" — game offline nên có một cái kết trọn vẹn thay vì cày vô hạn, sau đó mở chế độ vô tận cho ai muốn chơi tiếp. Lạc Lạc dẫn chuyện bằng audio khi người chơi đang đi bộ (bài học từ Zombies, Run!): mỗi đoạn 60–90 giây, kích hoạt theo cột mốc số bước, biến buổi đi bộ thành một tập phim.

### 5.7 Vòng lặp một ngày (giữ nguyên)

Sáng mở app nhận tài nguyên từ bước hôm qua, đặt bẫy trên đường đi làm. Trưa ghé thương nhân đổi đồ. Chiều qua công viên chặt gỗ, thu bẫy, múc nước, nghe một đoạn chuyện của Lạc Lạc. Tối đun nước, chế tạo, phòng thủ trại. Thứ Bảy đánh Trăng Máu. Mỗi điểm chạm 2–5 phút.

---

## 6. AN TOÀN VÀ PHÁP LÝ — NHẸ HƠN HẲN BẢN ONLINE

### 6.1 An toàn người chơi (giữ nguyên, không thương lượng)

Khóa nhặt và tương tác khi tốc độ vượt 12 km/h; không cơ chế rượt đuổi ngoài đời; không thưởng thêm cho việc ra đường ban đêm; không đặt POI ở đường lớn, bờ vực, đất tư; màn hình nhắc "quan sát xung quanh" ở phiên đầu mỗi ngày.

### 6.2 Thủ tục pháp lý tại Việt Nam

- Game tải về qua mạng, không có tương tác giữa người chơi với nhau hay với máy chủ, thuộc loại **G4** theo Nghị định 147/2024/NĐ-CP. Doanh nghiệp cần Giấy chứng nhận cung cấp dịch vụ trò chơi điện tử trên mạng và làm thủ tục thông báo phát hành cho từng game — **không phải qua vòng phê duyệt nội dung, kịch bản như G1**, thời gian tính bằng tuần thay vì nhiều tháng. Xác nhận chi tiết hồ sơ với tư vấn pháp lý (đầu mối quản lý game đã chuyển về Bộ Văn hóa, Thể thao và Du lịch sau đợt tái cơ cấu 2025).
- Không có hệ thống tài khoản nên không phát sinh nghĩa vụ định danh bằng số điện thoại hay hệ thống giới hạn giờ chơi trực tuyến; vẫn nên tự nguyện làm tính năng nhắc nghỉ cho trẻ em — vừa tử tế vừa đẹp hình ảnh với phụ huynh.
- Tự phân loại và hiển thị độ tuổi (dự kiến 12+ do có chiến đấu quái vật hoạt hình).
- Lưu ý cho tương lai: nếu bản 1.1 thêm co-op cục bộ không qua máy chủ, game chuyển sang nhóm **G3** (người chơi tương tác với nhau nhưng không qua máy chủ) — vẫn thuộc nhóm thủ tục chứng nhận nhẹ, không phải G1.

### 6.3 Dữ liệu cá nhân: không thu thập

Vị trí và số bước được xử lý và lưu ngay trên máy, không gửi đi đâu. Nghĩa vụ còn lại rất gọn: chính sách quyền riêng tư khai báo trung thực "không thu thập dữ liệu" trên App Store và Google Play (mục App Privacy / Data Safety), và nếu sau này bật analytics opt-in thì khai báo riêng phần đó. Gánh nặng tuân thủ Luật Bảo vệ dữ liệu cá nhân gần như biến mất so với bản online — và "không server, không thu thập dữ liệu" còn là một thông điệp bán hàng mạnh.

---

## 7. LỘ TRÌNH PHÁT TRIỂN (10–12 THÁNG)

| Giai đoạn | Thời gian | Mục tiêu chính | Cổng nghiệm thu (go/no-go) |
|---|---|---|---|
| 0. Tiền sản xuất | Tháng 1 | GDD offline, style guide art, và 3 PoC quyết định: gói dữ liệu Hà Nội, renderer bản đồ, đếm bước đo pin | Gói Hà Nội tối đa 40 MB; render mượt trên máy tầm trung; pin nền xấp xỉ 0 |
| 1. Prototype | Tháng 2–3 | Vòng lặp bước → nhặt → chế rìu chạy trên bản đồ cách điệu | Test 10 người trong 2 tuần: ít nhất 6 người tự tăng số bước từ 20% |
| 2. Vertical Slice | Tháng 4–5,5 | 3 ngày đầu hoàn chỉnh + Trăng Máu đầu tiên + chương 1 có thoại Lạc Lạc | Hoàn thành tutorial từ 70%; "muốn chơi tiếp" từ 60% |
| 3. Alpha nội dung | Tháng 6–8,5 | Đủ 8 chương, 30 công thức, trại 3 cấp; bản iOS chạy được | Closed test 100 người qua APK/TestFlight: D7 từ 15% |
| 4. Beta và polish | Tháng 9–10,5 | Cân bằng, tối ưu pin còn tối đa 10%/giờ mở màn hình, hoàn tất thủ tục G4, trang store, bản demo/mở khóa | Crash-free từ 99,5%; tỉ lệ mua trong test từ 3% |
| 5. Ra mắt | Tháng 11–12 | Phát hành toàn quốc, chiến dịch "Đứt Gãy Không Gian" | — |

Sau ra mắt, cập nhật theo quý thay cho LiveOps: bản 1.1 (co-op cục bộ + thú cưng tiền sử), bản 1.2 (trồng trọt quanh trại + chương truyện mới), bản 1.3 (chế độ ảnh AR). Mỗi bản cập nhật là một đợt truyền thông mới.

---

## 8. ĐỘI NGŨ VÀ NGÂN SÁCH (ƯỚC TÍNH, SAI SỐ ±40%)

**Phương án khuyến nghị — 3 người, 11 tháng:**

| Vai trò | Lương gross/tháng (tham khảo thị trường VN) |
|---|---|
| Lập trình Unity (kiêm kỹ thuật trưởng) | 30–55 triệu |
| Game designer kiêm PM và QA | 25–45 triệu |
| Họa sĩ 2D/3D | 20–40 triệu |

Chi lương 75–140 triệu/tháng, cộng khoảng 22% nghĩa vụ bảo hiểm, nhân 11 tháng: khoảng 1,0–1,9 tỷ. Chi khác: âm thanh, nhạc và **thu âm thoại Lạc Lạc** 80–150 triệu (khoản này quan trọng hơn bản online vì kể chuyện là xương sống); playtest và QA thuê ngoài 30–80 triệu; pháp lý 20–60 triệu; công cụ và asset 15–40 triệu; CDN 5–20 triệu; marketing ra mắt 100–300 triệu.

**Tổng: khoảng 1,25–2,55 tỷ đồng (50–100 nghìn USD) — bằng khoảng 40% chi phí bản online**, chủ yếu nhờ bỏ vị trí backend, bỏ hạ tầng server và bỏ chi phí vận hành sau ra mắt.

**Phương án tối thiểu — 2 người:** hai founder (một lập trình, một thiết kế kiêm nội dung), thuê ngoài art và âm thanh theo gói; 14–18 tháng; chi tiền mặt 0,3–1,1 tỷ tùy mức tự trả lương. Khả thi vì bản offline không còn mảng backend và vận hành.

---

## 9. MÔ HÌNH KINH DOANH OFFLINE

- **Tải miễn phí, chơi trọn 3 ngày đầu của cốt truyện** — điểm cắt demo trùng khít với nhịp kịch bản gốc "3 ngày trước Đêm Trăng Máu đầu tiên": người chơi bị cắt đúng lúc gay cấn nhất, ngay trước trận boss đầu đời.
- **Mở khóa trọn đời, mua một lần: 99.000–149.000 đồng.** Không quảng cáo, không battle pass, không bán tài nguyên, không năng lượng chờ. Chỉ cần mạng đúng lúc thanh toán.
- DLC tùy chọn đi kèm bản cập nhật lớn: gói chương truyện mới, skin doanh trại, thú cưng (49.000–79.000 đồng) — nguồn thu nối dài sau ra mắt.
- Bài toán hòa vốn (phương án 3 người): thu ròng mỗi lượt mua khoảng 70–85 nghìn sau chiết khấu cửa hàng (30%, hoặc 15% nếu đủ điều kiện chương trình doanh nghiệp nhỏ) → cần khoảng **15–35 nghìn lượt mua**; với tỉ lệ chuyển đổi demo sang mua 3–5%, tương đương 400 nghìn tới 1,2 triệu lượt cài. Tham vọng nhưng trong tầm với nếu làm tốt ba kênh: TikTok với format "đi bộ ngoài đời nhặt đồ trong game", cộng đồng đi bộ và chạy bộ, và ASO quanh cụm từ khóa "game đi bộ".
- Lợi thế truyền thông riêng của offline, nên khai thác triệt để trong marketing: "không server, không thu thập dữ liệu, không mạng vẫn chơi, mua một lần chơi mãi" — thông điệp cực kỳ được lòng phụ huynh và người chơi ngán game hút tiền.

---

## 10. KPI VÀ CÁCH ĐO KHI KHÔNG CÓ SERVER

| Nhóm | Chỉ số | Mục tiêu |
|---|---|---|
| Hành vi cốt lõi | Bước trung bình/ngày của người chơi; hoàn thành tutorial 3 ngày | Từ 3.500 bước; từ 65% |
| Giữ chân | D1 / D7 / D30 (đo trên mẫu opt-in và nhóm test) | Từ 38% / 16% / 7% |
| Kinh doanh | Chuyển đổi demo sang mua; điểm đánh giá store | Từ 3%; từ 4,4 sao |
| Kỹ thuật | Crash-free; pin mỗi giờ mở màn hình; dung lượng app | Từ 99,5%; tối đa 10%; tối đa 300 MB |

Không có telemetry server nghĩa là đo lường khó hơn — bù bằng kỷ luật playtest: tối thiểu 3 vòng test có quan sát trực tiếp (mỗi vòng 10–20 người, có phỏng vấn sau 1 tuần chơi), cộng số liệu sẵn có của Google Play Console và App Store Connect (lượt cài, giữ chân thiết bị, crash, doanh thu).

---

## 11. RỦI RO CHÍNH VÀ GIẢM THIỂU (BẢN OFFLINE)

| Rủi ro | Mức độ | Giảm thiểu |
|---|---|---|
| Không có cộng đồng online giữ chân — người chơi bỏ sau 2 tuần | Cao | Cốt truyện 8 chương có cái kết thật; nhịp tuần Trăng Máu; cập nhật chương mới theo quý; co-op cục bộ ở bản 1.1 |
| Nơi thưa POI (nông thôn) | Cao | Vùng hoang dã thủ tục hoạt động ở mọi nơi, không cần gói dữ liệu |
| Gói dữ liệu bản đồ quá nặng | Trung bình | PoC tháng 1 quyết định; phương án dự phòng: bỏ lớp đường sá, chỉ giữ POI và vùng hoang dã |
| Crack, sửa save | Trung bình | Chấp nhận với game chơi đơn giá thấp; giá trị nằm ở bản cập nhật chính chủ và cloud save |
| Đổi giờ máy để né hoặc triệu boss | Thấp | Chống lùi đồng hồ đơn giản; còn lại là quyền tự lừa mình của người chơi |
| Thiếu số liệu để cân bằng game | Trung bình | 3 vòng playtest quan sát trực tiếp; analytics opt-in |
| Trần doanh thu thấp hơn mô hình online | Trung bình | Đổi lại chi phí bằng 40% và không tốn vận hành; DLC nối dài nguồn thu |

---

## 12. VIỆC CẦN LÀM TRONG 30 NGÀY TỚI (BẢN OFFLINE)

1. Chốt định nghĩa offline (mục 0) và phạm vi MVP (mục 3) — một buổi họp quyết định.
2. Viết GDD offline v2 (25–35 trang), trong đó có hẳn một chương "Cốt truyện 8 chương và kịch bản thoại Lạc Lạc".
3. PoC 1: tool lọc OSM thành gói dữ liệu Hà Nội, đo kích thước thực tế.
4. PoC 2: renderer bản đồ cách điệu trong Unity đọc gói trên, đo FPS trên một máy Android tầm trung phổ biến.
5. PoC 3: đếm bước nền bằng TYPE_STEP_COUNTER, đo tiêu thụ pin trong 24 giờ.
6. Quyết định giá mở khóa (99 hay 149 nghìn) và chốt điểm cắt demo ở cuối ngày thứ 3.
7. Đặt 3 concept art: doanh trại 3 cấp, một quái đêm, HUD sinh tồn.
8. Casting giọng Lạc Lạc, thu 2–3 mẫu thoại — linh hồn của bản offline, chọn kỹ.
9. Hỏi tư vấn pháp lý về thủ tục G4 (và G3 cho co-op cục bộ sau này) — nhẹ nhưng nên biết sớm hồ sơ cần gì.
10. Ghép đội 3 người; giao owner cụ thể cho các mục 4, 5 và 9 của kế hoạch này.

---

## PHỤ LỤC A — KHUNG GDD OFFLINE (MỤC LỤC ĐỀ XUẤT)

1. Tổng quan và trụ cột thiết kế
2. Chân dung người chơi (học sinh thích RPG, dân văn phòng muốn đi bộ nhiều hơn, gia đình có con 8–14 tuổi)
3. Vòng lặp cốt lõi và sơ đồ trạng thái theo ngày/tuần
4. Đặc tả hệ thống: bước chân, POI offline, sinh tồn, chế tạo, doanh trại, đêm, Trăng Máu
5. **Cốt truyện 8 chương và kịch bản thoại Lạc Lạc** (chương riêng, viết sớm)
6. Kinh tế game và bảng cân bằng (spreadsheet riêng)
7. Nội dung: quái, vật phẩm, chuỗi nhiệm vụ
8. UX/UI: flow màn hình và wireframe
9. Âm thanh: đêm kinh dị sống bằng âm thanh; thoại dẫn chuyện khi đi bộ
10. Kỹ thuật: renderer bản đồ, pipeline gói dữ liệu, save, kiểm tra hợp lý
11. An toàn và tuân thủ
12. Kế hoạch cập nhật theo quý cho năm đầu

## PHỤ LỤC B — LỘ TRÌNH MỞ RỘNG SAU RA MẮT

- **Bản 1.1:** co-op cục bộ Trăng Máu qua Wi-Fi/Bluetooth (cả nhà cùng đánh boss, vẫn không cần Internet); thú cưng tiền sử ấp trứng bằng bước chân.
- **Bản 1.2:** trồng trọt quanh trại (mưa trong game tự tưới cây); gói chương truyện 9–12.
- **Bản 1.3:** chế độ chụp ảnh AR với quái vật; sự kiện theo lịch âm (Tết, Trung thu) tính hoàn toàn trên máy bằng lịch hệ thống.
