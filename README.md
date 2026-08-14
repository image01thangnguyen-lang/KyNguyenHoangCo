# Kỷ Nguyên Hoang Cổ — prototype vòng lặp cốt lõi

Prototype chạy được của game trong `ke-hoach-phat-trien-ky-nguyen-hoang-co.md` (bản 2.0 — offline).
Mục tiêu của giai đoạn này đúng như cổng nghiệm thu Giai đoạn 1 trong kế hoạch: **chứng minh vòng
lặp "đi bộ → nhặt → chế tạo → phòng thủ" khép kín và đáng chơi**, trước khi bỏ tiền vào art và Unity.

```
npm test     # 162 test cho lõi game (không cần cài gì)
npm run dev  # mở http://localhost:5173
```

Không có `npm install`. Dự án **không có một dependency nào** — xem [Vì sao zero-dependency](#vì-sao-zero-dependency).

---

## Đã có gì

| Hệ thống | Mục kế hoạch | Trạng thái |
|---|---|---|
| Đếm bước → tài nguyên, trần 15.000/ngày | §5.2, §4.3 | Xong, có test |
| Ba chỉ số sinh tồn + mô phỏng quãng vắng mặt | §5.1 | Xong, có test |
| Thế giới offline: lưới ô 200 m thủ tục + gói POI | §4.2 | Xong, có test |
| 33 công thức chế tạo, doanh trại 3 cấp | §5.3 | Xong, có test |
| Phòng thủ trại ban đêm (chơi tại nhà) | §5.4 | Xong, có test |
| Đêm Trăng Máu chơi đơn, 3 độ khó, đánh bù -30% | §5.5 | Xong, có test |
| Cốt truyện 8 chương + dẫn chuyện theo cột mốc bước | §5.6 | Xong (thoại bản nháp, chưa thu âm) |
| Tutorial 3 ngày, mở màn "Đốt lửa trước khi trời tối" | §3 | Xong, có test |
| Thời tiết theo mùa Việt Nam, tính trên máy | §2, §4.1 | Xong, có test |
| Chống lùi đồng hồ, lọc máy lắc | §4.3 | Xong, có test |
| Khoá an toàn 12 km/h, nhắc nghỉ, ẩn POI nguy hiểm | §6.1 | Xong, có test |
| 2 hồ sơ/máy, save có checksum, xuất/nhập sao lưu | §3, §4.1 | Xong, có test |
| Cổng demo cuối ngày 3 + mở khoá trọn đời | §9 | Xong (mô phỏng, chưa nối IAP) |
| Renderer bản đồ cách điệu trên canvas | §4.1 | Xong |
| PWA chạy được khi ngắt hoàn toàn mạng | §0 | Xong |

**Chưa có:** art thật, âm thanh, thu âm thoại Lạc Lạc, tool đóng gói OSM từ dữ liệu Geofabrik thật,
IAP thật, co-op cục bộ (bản 1.1), thú cưng và trồng trọt (bản 1.2).

---

## Chạy thử

Cần **Node 22.18+** (khuyến nghị Node 24). Không cần gì khác.

```bash
node --version      # >= 22.18
npm test            # chạy toàn bộ test lõi
npm run dev         # dev server, mặc định cổng 5173
```

Mở `http://localhost:5173`, tạo một hồ sơ rồi:

1. Mở bảng **Nguồn bước** ở góc dưới trái, bấm **+1.000 bước** vài lần — tài nguyên chảy vào kho.
2. Vào tab **Chế tạo**, dựng **Lửa trại** rồi chế **Rìu đá**.
3. Bấm **Tới 20h** để nhảy tới khung phòng thủ đêm, rồi bấm **Thủ trại** trên tab Bản đồ.
4. Bấm **Tới Trăng Máu** để nhảy tới tối thứ Bảy và đánh boss.

Trên điện thoại (mở qua HTTPS hoặc localhost), bấm **Dùng cảm biến thật** để đếm bước bằng gia tốc kế
và cấp quyền vị trí để bản đồ bám theo chỗ bạn đang đứng thật.

**Kiểm chứng lời hứa offline:** tải trang xong, ngắt Wi-Fi, F5. Game vẫn chạy đầy đủ.

---

## Cấu trúc

```
packages/game-core/          Toàn bộ luật chơi. Thuần TypeScript, không đụng DOM/Node/mạng.
  data/*.json                Bảng cân bằng — designer sửa được mà không chạm code.
  src/*.ts                   Mô phỏng: sinh tồn, nhặt, chế tạo, đêm, Trăng Máu, cốt truyện, save.
  test/*.test.ts             162 test.

apps/game/                   Prototype web (PWA). Chỉ đọc cảm biến và vẽ — không chứa luật chơi.
  src/main.ts                Điểm khởi động và điều phối.
  src/mapView.ts             Renderer bản đồ cách điệu trên canvas.
  src/panels.ts              Vẽ HUD, chế tạo, trại, nhật ký, cài đặt.
  src/fights.ts              Lớp phủ phòng thủ đêm và Trăng Máu.
  src/platform.ts            localStorage, GPS, file sao lưu, rung.
  sw.js                      Service worker — thứ làm game chạy được khi mất mạng.

tools/dev-server.ts          Dev server tự viết, bóc kiểu TS on-the-fly.
tools/smoke.html             34 kiểm tra end-to-end chạy trên trình duyệt thật.
tools/preview.html           Dựng sẵn một ván chơi để soi giao diện và chụp ảnh.
docs/                        Ánh xạ kế hoạch → code, và các quyết định kỹ thuật.
```

**Ranh giới quan trọng nhất:** `packages/game-core` không import bất cứ thứ gì của trình duyệt và
không bao giờ gọi `Date.now()` — thời gian luôn được truyền vào. Nhờ vậy mô phỏng cả một tuần chơi
chỉ mất vài mili giây trong test, và khi dựng bản phát hành bằng Unity thì chỉ phải viết lại tầng
giao diện, còn `data/*.json` dùng lại nguyên vẹn.

---

## Vì sao zero-dependency

Hai lý do, một tình cờ một cố ý.

**Tình cờ:** npm registry trong môi trường này bị chặn TLS (`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, proxy
nội bộ), nên `npm install` không chạy được.

**Cố ý:** hoá ra không cần. Node 24 chạy thẳng file `.ts` (bóc kiểu sẵn), có `node:test`, và có
`module.stripTypeScriptTypes()` để dev server tự phục vụ TS cho browser. Việc duy nhất một bundler
cần làm ở đây là bóc kiểu — mà Node đã làm hộ.

Một game hứa "không server, không mạng" mà build lại phụ thuộc 400 gói npm thì hơi mâu thuẫn. Cái giá
phải trả: **không có bước kiểm tra kiểu tự động** (`tsc` cũng là một gói npm). Kiểu vẫn được viết đầy
đủ để IDE kiểm tra; test là lưới an toàn còn lại. Khi mạng thông, thêm `typescript` vào devDependencies
và chạy `tsc --noEmit` là đủ — `tsconfig.base.json` đã cấu hình sẵn.

> **Lưu ý khi sửa code:** vì chỉ bóc kiểu chứ không biên dịch, tránh cú pháp TypeScript không xoá được:
> `enum`, `namespace`, và **parameter property** (`constructor(private x: T)`). `erasableSyntaxOnly`
> trong tsconfig đã bật để IDE cảnh báo sớm.

---

## Test

```bash
npm test                                   # 162 test lõi
npm run dev                                # rồi mở /tools/smoke.html — 34 test trên trình duyệt thật
```

Vài test đáng chú ý, vì chúng khoá lại đúng những cam kết thiết kế của kế hoạch:

- `survival.test.ts` — **"đi bộ luôn có lãi"**: chi phí đói của 10.000 bước phải nhỏ hơn giá trị một
  quả dại nhặt được dọc đường. Đây là bất biến chống lại nghịch lý độ đói của kịch bản v0.
- `gathering.test.ts` — trần 15.000 bước dừng thưởng nhưng **vẫn đếm đủ bước**; hệ số 1,2× của vùng
  hoang dã không bị làm tròn xuống mất.
- `loop.test.ts` — mô phỏng cả một tuần chơi qua facade: vắng mặt 7 ngày không mất đồ, lùi đồng hồ thì
  thời gian game đứng yên, tới thứ Bảy đánh được boss và mở chương mới.

---

## Đọc tiếp

- [`docs/anh-xa-ke-hoach-va-code.md`](docs/anh-xa-ke-hoach-va-code.md) — mỗi mục trong kế hoạch nằm ở
  file nào, và những chỗ code cố ý khác kế hoạch (kèm lý do).
- [`docs/quyet-dinh-ky-thuat.md`](docs/quyet-dinh-ky-thuat.md) — các quyết định kỹ thuật và đánh đổi.
- [`ke-hoach-phat-trien-ky-nguyen-hoang-co.md`](ke-hoach-phat-trien-ky-nguyen-hoang-co.md) — kế hoạch gốc.
