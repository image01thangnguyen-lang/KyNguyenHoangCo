# Quyết định kỹ thuật và đánh đổi

Ghi lại **vì sao** chứ không phải **cái gì** — phần "cái gì" đã nằm trong code và trong
[`anh-xa-ke-hoach-va-code.md`](anh-xa-ke-hoach-va-code.md).

---

## 1. Prototype chạy trên web thay vì Unity

Kế hoạch chọn Unity 6 cho bản phát hành, và lựa chọn đó **không thay đổi**. Nhưng prototype này không
dựng bằng Unity, vì hai lý do:

- Máy phát triển không có Unity Editor, nên code Unity viết ra sẽ **không chạy và không test được** —
  một đống C# chưa từng biên dịch là tài sản âm, không phải tiến độ.
- Thứ cần chứng minh ở Giai đoạn 1 là **cân bằng và cảm giác của vòng lặp**, không phải đồ hoạ. Cả
  hai thứ đó nằm trong logic, không nằm trong engine.

Cách giảm thiểu rủi ro của quyết định này:

- Toàn bộ số liệu cân bằng nằm trong `packages/game-core/data/*.json`, **engine-neutral**. Unity đọc
  thẳng bằng `JsonUtility`/`Newtonsoft`, không phải chép tay lại.
- Lõi game thuần khiết, không đụng DOM, không đụng Node, không gọi `Date.now()`. Port sang C# là dịch
  1-1 từng hàm, có sẵn 162 test làm đặc tả hành vi.
- Ranh giới "lõi thuần khiết / tầng nền tảng bẩn" được giữ nghiêm ngặt: mọi thứ chạm localStorage, GPS,
  file, rung đều gom trong `apps/game/src/platform.ts`. Sang Unity chỉ phải viết lại đúng file đó.

**Rủi ro còn lại, cần biết:** prototype web không trả lời được hai câu hỏi PoC quan trọng của kế hoạch
(mục §7, Giai đoạn 0) — gói dữ liệu Hà Nội nặng bao nhiêu MB, và renderer có chạy 60 fps trên Android
tầm trung không. Hai câu đó phải đo bằng Unity trên máy thật.

---

## 2. Zero-dependency

Bắt đầu là do bị ép: npm registry trong môi trường này bị chặn TLS bởi proxy nội bộ
(`UNABLE_TO_GET_ISSUER_CERT_LOCALLY` — chứng chỉ tự ký của gateway, Node không đọc Windows cert store).

Nhưng sau khi thử thì hoá ra không cần npm thật:

| Thứ thường phải cài | Thay bằng |
|---|---|
| `typescript` + `ts-node`/`tsx` để chạy TS | Node 24 chạy thẳng `.ts` (type stripping sẵn có) |
| `vitest`/`jest` | `node:test` + `node:assert` |
| `vite`/`webpack` để browser hiểu TS | `module.stripTypeScriptTypes()` trong `tools/dev-server.ts` (~90 dòng) |
| `playwright` để test trình duyệt | `tools/smoke.html` chạy trong Edge headless qua `--dump-dom` |

**Cái giá phải trả, và nó có thật:** không có `tsc --noEmit` nghĩa là **không có kiểm tra kiểu tự
động**. Điều này đã trực tiếp gây ra một lỗi trong quá trình làm: `weather.ts` gọi
`rain.rawWaterPerHour` trong khi JSON định nghĩa `rawWaterPerHourAtCamp` — TypeScript sẽ bắt ngay, còn
ở đây phải đợi test chạy mới lộ. Khi mạng thông, việc đầu tiên nên làm là thêm `typescript` vào
devDependencies và chạy `tsc --noEmit` trong CI. `tsconfig.base.json` đã cấu hình sẵn cho việc đó.

**Ràng buộc cú pháp kèm theo:** type stripping chỉ *xoá* kiểu chứ không *biên dịch*, nên cú pháp
TypeScript cần sinh mã đều bị cấm — `enum`, `namespace`, và parameter property
(`constructor(private x: T)`). Lỗi này đã xảy ra một lần với `GeoWatcher` và làm cả app không khởi
động được. `erasableSyntaxOnly: true` trong tsconfig để IDE cảnh báo sớm.

---

## 3. Lõi game không được biết hôm nay là ngày nào

Không hàm nào trong `packages/game-core` gọi `Date.now()`. Thời gian luôn là tham số.

Điều này nghe như chuyện nhỏ nhưng quyết định rất nhiều thứ:

- `loop.test.ts` mô phỏng trọn một tuần chơi trong vài mili giây, gồm cả Trăng Máu tối thứ Bảy.
- Bộ chống lùi đồng hồ (§4.3) cài được ở đúng một chỗ (`clock.ts`) và mọi thứ khác tự động tuân theo.
- Nút "tua giờ" trong prototype chỉ là một biến offset, không phải hack xuyên hệ thống.

---

## 4. RNG xác định thay vì `Math.random()`

Mọi lượt nhặt sinh từ `hash(playerId, ngày, chỉ số lượt)`. Lý do:

- **Idempotent**: gọi lại cùng một lần đồng bộ không sinh thêm đồ. Quan trọng vì `openApp()` có thể
  chạy lại khi app quay lại foreground.
- **Tái lập được**: một báo cáo lỗi cân bằng có thể dựng lại chính xác trên máy khác.
- **Thế giới ổn định**: cùng một ô lưới cho cùng một vùng trên mọi máy, mãi mãi — nền tảng để hai
  người chơi cạnh nhau nhìn thấy cùng một cảnh, và cho co-op cục bộ ở bản 1.1.

---

## 5. Save có checksum nhưng không mã hoá

Checksum để phát hiện **file hỏng** (mất điện giữa lúc ghi), không phải để chống sửa.

Và khi checksum lệch, game **vẫn cho chơi tiếp**, chỉ hiện cảnh báo. Chặn ở đây nghĩa là xoá sạch tiến
trình của một người chơi có thể hoàn toàn vô tội — file lệch còn có thể do bản cập nhật đổi cấu trúc.
Cái giá của việc chặn nhầm cao hơn nhiều so với việc để một người tự sửa save chơi tiếp: đây là game
chơi đơn, họ chỉ tự phá trải nghiệm của chính họ.

---

## 6. Bản đồ vẽ tay trên canvas

Không dùng SDK bản đồ nào. Renderer đọc lưới ô và danh sách POI rồi vẽ blob, cây, đá — hình dạng sinh
từ hàm băm toạ độ nên cùng một chỗ luôn trông giống nhau.

Điều này biến hạn chế thành lợi thế: phong cách "tiền sử hoá" vốn **không cần** bản đồ chi tiết, nên
gói dữ liệu offline chỉ cần POI và vài polygon lớn thay vì toàn bộ hình học đường sá. Đây chính là
phương án dự phòng mà kế hoạch nêu ở §11 ("bỏ lớp đường sá, chỉ giữ POI và vùng hoang dã") — hoá ra
nên là phương án chính.

---

## 7. Những chỗ test bắt được lỗi thiết kế thật

Ghi lại vì chúng là lý do bộ test này đáng giá hơn con số 162:

1. **Mức sàn hồi sau khi vắng lâu quá khắt khe** — test vòng lặp cho thấy người vắng 3 ngày quay lại
   sẽ ngất sau 2 giờ và mất 30% đồ. Đã sửa cả dữ liệu lẫn logic.
2. **Trọng số vùng thủ tục bị hỏng bởi một khoá chú thích** — `_note` nằm lẫn trong
   `proceduralZoneWeights` khiến phép cộng trọng số ra `NaN` và **không ô nào** được gán vùng đường
   mòn. Test phân bố bắt được ngay.
3. **`#tab-map` đè mất `[hidden]`** — quy tắc CSS theo id thắng quy tắc theo class, làm bảng thông tin
   bản đồ nổi đè lên mọi tab khác. Ảnh chụp màn hình tự động phát hiện.
4. **Parameter property làm cả app không khởi động** — xem mục 2.

---

## 8. Việc nên làm tiếp, theo thứ tự

1. **Nối `tsc --noEmit` vào CI** ngay khi npm thông — đây là lỗ hổng lớn nhất hiện tại.
2. **PoC gói dữ liệu Hà Nội thật**: viết `tools/build-poi-pack.ts` đọc extract Geofabrik, áp
   `data/poi-mapping.json`, đo kích thước gói. Kế hoạch §7 đặt trần 40 MB.
3. **Playtest cân bằng bằng số liệu thật**: `expectedDailyYield()` và `projectDailyDrain()` đã có sẵn
   để dựng bảng tính; cần 10 người chơi 2 tuần theo cổng nghiệm thu Giai đoạn 1.
4. **Viết và thu âm thoại Lạc Lạc**: `data/story.json` đang có bản nháp 24 beat, tất cả
   `voStatus: "pending"`. Kế hoạch coi đây là xương sống của bản offline — nên casting sớm.
5. **Port sang Unity** sau khi cân bằng đã ổn, không phải trước.
