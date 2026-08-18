# TÀI LIỆU THIẾT KẾ TRÒ CHƠI (GAME DESIGN DOCUMENT)
## DỰ ÁN: KỶ NGUYÊN HOANG CỔ 3D (PRIMITIVE ERA 3D - JURASSIC SURVIVAL)

---

### MỤC LỤC
1. **Tổng Quan Dự Án (Executive Summary)**
2. **Cột Trụ Trải Nghiệm & Thể Loại (Core Pillars & Genre)**
3. **Cấu Trúc Trạng Thái Game (State Architecture Schema)**
4. **Hệ Thống Toán Học & Vật Lý Sinh Tồn (Survival Math & Systems)**
5. **Động Cơ Chiếu Sáng Quỹ Đạo Ngày - Đêm (Orbital Sun Engine)**
6. **Kinh Tế, Giao Thương & Nâng Cấp Trang Bị (NPCs & Economy Engine)**
7. **Hệ Sinh Thái Khủng Long & Quái Thú (Dinosaurs & Beast AI)**
8. **Quy Chuẩn 14 Mô Hình 3D & Phân Vùng Bản Đồ (3D Assets & Biome Map)**
9. **Giao Diện Người Dùng & Tương Tác (UI/UX Architecture)**
10. **Tối Ưu Hoá Hiệu Năng 60 FPS (Performance & Rendering Pipeline)**

---

### 1. TỔNG QUAN DỰ ÁN (EXECUTIVE SUMMARY)
* **Tên Dự Án:** Kỷ Nguyên Hoang Cổ 3D (Primitive Era 3D)
* **Nền Tảng Kỹ Thuật:** Three.js (r128), WebGL, HTML5/CSS3 Module, Web Audio API Synthesizer.
* **Môi Trường Chạy:** Web Browser (Desktop & Mobile Responsive, hỗ trợ Live Server).
* **Góc Nhìn (Perspective):** Isometric 3D (FOV 45°, nghiêng 45-50°, Smooth Camera Lerp).

---

### 2. CỘT TRỤ TRẢI NGHIỆM (CORE PILLARS)
1. **Sinh Tồn Khắc Nghiệt (Hardcore Survival):** 4 chỉ số sinh tồn liên tục biến thiên: Máu (HP), Độ No (Hunger), Độ Khát (Thirst), Thể Lực (Stamina).
2. **Hệ Sinh Thái Sống Động (Living Jurassic Biome):** 4 loài khủng long với tập tính sinh học riêng biệt (Bạo Long T-Rex, Khủng Long 3 Sừng, Khủng Long Săn Mồi/Cổ Dài, Pterodactyl bay liệng).
3. **Khai Thác & Chế Tác (Harvest & Craft):** Tương tác nhặt đá, cành cây, thảo dược, nấm; nâng cấp vũ khí tại Thợ Rèn, giao thương với Thương Nhân và nhận thưởng từ Trưởng Lão.
4. **Chu Kỳ Ngày - Đêm Tự Nhiên (Dynamic Sun & Day-Night Cycle):** Mặt trời quay quanh quỹ đạo 360°, màu sắc bầu trời và sương mù biến chuyển mượt mà, ban đêm cần thắp đuốc lửa sinh tồn.

---

### 3. CẤU TRÚC TRẠNG THÁI GAME (STATE SCHEMA)

```javascript
const GameState = {
    player: {
        gender: 'male',         // 'male' | 'female'
        mesh: null,
        mixer: null,
        actions: {},
        hp: 100,
        maxHp: 100,
        hunger: 100,            // 0 - 100 (giảm 1 điểm mỗi 4s)
        thirst: 100,            // 0 - 100 (giảm 1 điểm mỗi 3s)
        stamina: 100,           // 0 - 100 (hồi 15/s khi đứng yên, -20/s khi sprint, -15 khi đánh)
        maxStamina: 100,
        speed: 7.0,
        attackPower: 25,
        armor: 0,
        weaponLevel: 1          // 1: Giáo Gỗ, 2: Giáo Đá, 3: Đại Giáo Bọc Xương T-Rex
    },
    economy: {
        gold: 150,              // Đồng Vàng Cổ Đại 🪙
        fangs: 0                // Răng Nanh Khủng Long 🦷
    },
    inventory: {
        wood: 0,                // Cành cây khô (từ khúc gỗ mục)
        stone: 0,               // Đá nhọn (từ mỏ đá)
        mushroom: 0,            // Nấm rừng
        flower: 0,              // Thảo dược hoa dại
        meatRaw: 0,             // Thịt sống
        meatCooked: 2,          // Thịt chín (+30 Hunger, +20 HP)
        waterPouch: 2,          // Túi nước (+40 Thirst)
        torch: 1,               // Đuốc lửa (thắp sáng đêm)
        pelt: 0                 // Da thú
    },
    quests: [
        { id: 1, title: "Thu thập cành khô", targetType: "wood", current: 0, required: 5, rewardGold: 100, completed: false },
        { id: 2, title: "Khai thác đá nhọn", targetType: "stone", current: 0, required: 3, rewardGold: 120, completed: false },
        { id: 3, title: "Săn Bạo Chúa T-Rex", targetType: "kill_trex", current: 0, required: 1, rewardGold: 500, rewardFangs: 2, completed: false }
    ],
    time: {
        dayTime: 0.25,          // 0.0 -> 1.0 (0.25: Bình minh, 0.5: Trưa, 0.75: Hoàng hôn, 0.0/1.0: Đêm)
        daySpeed: 0.005,        // 1 chu kỳ ~3.5 phút thực tế
        isNight: false
    }
};
```

---

### 4. HỆ THỐNG TOÁN HỌC & VẬT LÝ SINH TỒN

1. **Quy Tắc Tiêu Hao (Survival Decay Formula):**
   $$\text{Hunger} = \max\left(0, \text{Hunger} - \frac{\Delta t}{4.0}\right)$$
   $$\text{Thirst} = \max\left(0, \text{Thirst} - \frac{\Delta t}{3.0}\right)$$
2. **Cơ Chế Trừ / Hồi Máu:**
   - Khi $\text{Hunger} = 0$ hoặc $\text{Thirst} = 0$: $\text{HP} = \max(0, \text{HP} - \Delta t \times 2.0)$ (Đói khát kiệt sức).
   - Khi $\text{Hunger} > 80$ và $\text{Thirst} > 80$: $\text{HP} = \min(\text{maxHP}, \text{HP} + \Delta t \times 1.5)$ (Hồi phục tự nhiên).
3. **Cơ Chế Thể Lực (Stamina Engine):**
   - Đứng yên / Đi bộ: $\text{Stamina} = \min(100, \text{Stamina} + \Delta t \times 15.0)$.
   - Tấn công: Tiêu tốn $15$ điểm Stamina. Không thể đánh nếu Stamina $< 15$.
   - Lướt né đòn (Dodge): Tiêu tốn $20$ điểm Stamina.

---

### 5. ĐỘNG CƠ CHIẾU SÁNG QUỸ ĐẠO NGÀY - ĐÊM (ORBITAL SUN ENGINE)

* **Góc Chiếu Mặt Trời:** $\theta = \text{dayTime} \times 2\pi$
* **Tọa Độ Mặt Trời:**
  $$\vec{P}_{\text{sun}} = (80 \cos\theta, 80 \sin\theta, 40)$$
* **Cường Độ Sáng:**
  $$I_{\text{sun}} = \max(0.08, 1.5 \sin\theta)$$
* **Bảng Chuyển Màu Bầu Trời & Sương Mù (Sky & Fog Palette):**
  * **Bình Minh ($\text{dayTime} \approx 0.25$):** Bầu trời vàng cam `0xfffaed`, Sương mù `0xfde68a`, Ambient `0xffedd5`.
  * **Chính Trưa ($\text{dayTime} \approx 0.50$):** Bầu trời xanh lam `0x87ceeb`, Sương mù `0xbae6fd`, Ambient `0xd9eafd`.
  * **Hoàng Hôn ($\text{dayTime} \approx 0.75$):** Bầu trời đỏ thẫm `0xff7e47`, Sương mù `0xfca5a5`, Ambient `0xfb923c`.
  * **Nửa Đêm ($\text{dayTime} \approx 0.0$ / $1.0$):** Bầu trời đen tím `0x0d0d1a`, Sương mù `0x111827`, Đèn đuốc lửa người chơi tự động bật sáng.

---

### 6. KINH TẾ, GIAO THƯƠNG & NÂNG CẤP TRANG BỊ

Đặt 3 NPC tại **Tiền Đồn Khởi Nguyên `(x: 0, z: 0)`** với vòng hào quang $3.5\text{m}$:

1. **🧙‍♂️ Trưởng Lão Bộ Tộc (Elder Mo) `(x: -3, z: 2)`:**
   * Quản lý hệ thống Nhiệm Vụ Sinh Tồn (Quests).
   * Kiểm tra điều kiện nộp tài nguyên $\rightarrow$ Phát thưởng Vàng 🪙 và Răng Nanh 🦷.

2. **🛒 Thương Nhân Du Mục (Merchant Grug) `(x: 3, z: 2)`:**
   * **Bảng Mua:**
     * Thịt Chín (+30 No, +20 Máu): $40$ Vàng 🪙
     * Túi Nước Suối (+40 Khát): $25$ Vàng 🪙
     * Đuốc Lửa (+Ánh sáng đêm): $35$ Vàng 🪙
     * Thuốc Đại Hồi Phục (+60 Máu): $80$ Vàng 🪙
   * **Bảng Bán:**
     * Cành Cây Khô: $+10$ Vàng 🪙 | Đá Nhọn: $+15$ Vàng 🪙
     * Nấm Rừng / Thảo Dược: $+20$ Vàng 🪙 | Da Thú: $+75$ Vàng 🪙
     * Răng Nanh Khủng Long: $+250$ Vàng 🪙

3. **⚒️ Thợ Rèn Đồ Đá (Blacksmith Kra) `(x: 0, z: 4)`:**
   * **Cấp 1 $\rightarrow$ Cấp 2 (Giáo Đá):** Yêu cầu $150$ Vàng + $5$ Đá + $5$ Gỗ $\rightarrow$ Sát thương $25 \rightarrow 45$.
   * **Cấp 2 $\rightarrow$ Cấp 3 (Đại Giáo Bọc Xương T-Rex):** Yêu cầu $500$ Vàng + $2$ Răng Nanh + $10$ Gỗ $\rightarrow$ Sát thương $45 \rightarrow 90$ + $30\%$ Bạo Kích.

---

### 7. HỆ SINH THÁI KHỦNG LONG & QUÁI THÚ (DINOSAUR AI)

| Sinh Vật | Model File | Chiều Cao (`Box3`) | Tọa Độ Sinh | Máu / Sát Thương | Tập Tính & Rơi Đồ Khi Hạ |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Bạo Long T-Rex** | `trex.glb` | $6.0\text{m}$ | `(25, 0, -40)` | $500\text{ HP}$ / $35\text{ DMG}$ | **Boss Hung Dữ:** Gầm $12\text{m}$, rượt đuổi $8\text{m}$, de-aggro khi xa $>15\text{m}$. Rơi $+150$ Vàng, $+1$ Răng Nanh, $+3$ Thịt, $+2$ Da. |
| **Khủng Long 3 Sừng** | `triceratops_dinosaur.glb` | $3.8\text{m}$ | `(35, 0, 20)` | $350\text{ HP}$ / $20\text{ DMG}$ | **Ăn Cỏ Hiền Lành:** Thong thả gặm cỏ, chỉ húc trả khi bị chém. Rơi $+80$ Vàng, $+4$ Thịt. |
| **Khủng Long Cổ Dài** | `dinosaur.glb` | $4.2\text{m}$ | `(-25, 0, -35)` | $350\text{ HP}$ / $18\text{ DMG}$ | **Khổng Lồ Hiền Hòa:** Dạo bước bìa rừng, ăn lá cây trên cao. Rơi $+60$ Vàng, $+2$ Thịt. |
| **Khủng Long Bay** | `animated_flying_...glb` | $3.5\text{m}$ | $Y = 15.0\text{m}$ | $250\text{ HP}$ | **Chúa Tể Bầu Trời:** Bay liệng quỹ đạo tròn $R=35\text{m}$, đổ bóng chuyển động rợp mặt đất. |

---

### 8. QUY CHUẨN 14 MÔ HÌNH 3D & PHÂN VÙNG BẢN ĐỒ

1. `models/warrior.glb`: Dũng Sĩ Nam (Cao $1.85\text{m}$).
2. `models/warrior_female.glb`: Dũng Sĩ Nữ (Cao $1.75\text{m}$).
3. `models/trex.glb`: Boss T-Rex ($6.0\text{m}$).
4. `models/triceratops_dinosaur.glb`: Khủng Long 3 Sừng ($3.8\text{m}$).
5. `models/dinosaur.glb`: Khủng Long Cổ Dài ($4.2\text{m}$).
6. `models/animated_flying_pteradactal_dinosaur_loop.glb`: Khủng Long Bay ($3.5\text{m}$).
7. `models/stylized_palm_tree_1k_pbr.glb`: $40$ Cây cọ cổ đại.
8. `models/stylized_tropical_pack.glb`: $30$ Cụm rừng nhiệt đới.
9. `models/stylized_stones_minipack.glb`: Di chỉ Cự Thạch Stonehenge `(-35, 0, -10)`.
10. `models/stylized_rock.glb`: $25$ Tảng đá nhọn (Tương tác 'NHẶT' $\rightarrow$ $+1$ Đá).
11. `models/fallen_stump_tree_optimized.glb`: $20$ Khúc gỗ mục (Tương tác 'NHẶT' $\rightarrow$ $+1$ Gỗ).
12. `models/tree_stump_model.glb`: $10$ Gốc cây cổ thụ (Tương tác 'NHẶT' $\rightarrow$ $+1$ Gỗ).
13. `models/anemone_flower_low_poly.glb` + `generic_ranunculus_flower.glb` + `peace_lily_plants__flower.glb`: $95$ Bụi hoa thảo dược (Tương tác 'NHẶT' $\rightarrow$ $+1$ Thảo Dược).
14. `models/low_poly_mushroom_pack.glb`: $35$ Khóm nấm rừng (Tương tác 'NHẶT' $\rightarrow$ $+1$ Nấm).
* **Biển Cỏ 3D:** $8.000$ ngọn cỏ bằng `THREE.InstancedMesh`.
* **Vùng An Toàn:** Bán kính $5.0\text{m}$ quanh Tiền Đồn Khởi Nguyên `(0, 0)` tuyệt đối không có chướng ngại vật cản trở.

---

### 9. GIAO DIỆN NGƯỜI DÙNG & TƯƠNG TÁC (UI/UX)
* **Modal Chọn Nhân Vật:** Xuất hiện đầu game chọn Nam/Nữ.
* **HUD 4 Thanh Chỉ Số:** HP (Đỏ), No (Cam), Khát (Lam), Thể Lực (Lục).
* **Bảng Túi Đồ (Inventory Modal):** Xem tài nguyên, bấm "Ăn Thịt Chín", "Uống Nước", "Nướng Thịt".
* **Nút Tương Tác Sáng Thông Minh (Contextual Action Button):** Tự động sáng đèn khi đứng gần NPC (Trò chuyện) hoặc gần Tài nguyên (Thu thập).
* **Chữ Sát Thương Nảy (Floating Damage Text):** Hiển thị số sát thương văng lên và mờ dần khi tấn công.

---

### 10. TỐI ƯU HÓA HIỆU NĂNG 60 FPS
* `THREE.InstancedMesh` cho 8.000 ngọn cỏ (Chỉ 1 Draw Call).
* Culling các đối tượng ngoài tầm nhìn camera.
* Tái sử dụng `THREE.Vector3` và `THREE.Matrix4` trong game loop, loại bỏ hoàn toàn việc cấp phát bộ nhớ rác (GC spikes).
* Web Audio Synthesizer không phụ thuộc file âm thanh ngoài, giảm thiểu tối đa độ trễ.
