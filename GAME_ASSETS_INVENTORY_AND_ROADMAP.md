# 🦖 KỶ NGUYÊN HOANG CỔ (THE PRIMEVAL ERA)
## 📦 TÀI LIỆU QUẢN LÝ TÀI NGUYÊN 3D, KIỂM KÊ THỰC TẾ & LỘ TRÌNH ASSETS
*(Cập nhật tiến độ thực tế: Models, Animations, Quần Xã Khủng Long, Đầm Lầy Hoang Cổ & Công Trình Đế Chế)*

---

## 🟢 PHẦN 1: BẢNG KIỂM KÊ 62 ASSETS 3D ĐÃ NẠP TRỰC TIẾP VÀO ENGINE
*Toàn bộ 62 files (12 FBX Animations + 50 GLB Models) hiện đang nằm trong thư mục `/models` và `/apps/game/models`, đã được kết nối hoàn chỉnh vào `index.html`:*

### A. Hệ Thống Nhân Vật & Hoạt Ảnh Modular FBX (12 Files FBX):
> [!IMPORTANT]
> **TÌNH TRẠNG VẬN HÀNH THỰC TẾ:**
> * Nhân vật người chơi (Nam / Nữ), Đồng đội Co-op, Trưởng lão Mo và Dân làng hiện đang vận hành **100% bằng hệ thống 12 File Modular FBX** (có đầy đủ xương Rigging & Animation Clips chuẩn hóa).

* **6 Hoạt Cảnh Modular FBX cho Dũng Sĩ Nam (Tỉ lệ chuẩn 1.85m):**
  1. `warrior_idle.fbx`: Mô hình gốc Dũng Sĩ Nam + Đứng thở nhịp nhàng.
  2. `warrior_walk.fbx`: Bước chân dứt khoát (Tự động đồng bộ tần số bước theo tốc độ di chuyển).
  3. `warrior_attack.fbx`: Vung đòn chém quét diện rộng.
  4. `warrior_hit_reaction.fbx`: Giật lùi phản ứng khi trúng đòn dã thú.
  5. `warrior_picking_up.fbx`: Cúi người nhặt tài nguyên / hái thảo dược / thu lưới cá.
  6. `warrior_death.fbx`: Gục ngã khi cạn kiệt sinh lực.
* **6 Hoạt Cảnh Modular FBX cho Dũng Sĩ Nữ (Tỉ lệ chuẩn 1.75m):**
  1. `female_warrior_idle.fbx`: Mô hình gốc Dũng Sĩ Nữ + Đứng thở nhẹ nhàng.
  2. `female_warrior_walk.fbx`: Bước chân nhanh nhẹn, thanh thoát.
  3. `female_warrior_attack.fbx`: Vung kiếm chém bão táp liên hoàn.
  4. `female_warrior_hit_reaction.fbx`: Phản ứng né giật khi dính sát thương.
  5. `female_warrior_picking_up.fbx`: Động tác cúi thu hái / mổ xẻ chiến lợi phẩm.
  6. `female_warrior_death.fbx`: Gục ngã khi hết máu.

---

### B. Quần Xã Dã Thú & Khủng Long 3D Animated (8 Loài Cốt Lõi - 9 Files GLB):
1. 🦖 `trex.glb`: **Đại Bạo Long T-Rex (Boss Thung Lũng)** — 1500 HP, 42 DMG, 3 Phase Progression & Gầm thét làm chậm 50%.
2. 🐆 `Velociraptor.glb`: **Velociraptor Săn Mồi Bầy Đàn (x3 con)** — 220 HP, 15 DMG, Tốc độ 6.2 m/s.
3. 🦏 `Triceratops.glb` & `triceratops_dinosaur.glb`: **Khủng Long Tam Sừng Alpha & Beta** — 650 HP, 22 DMG.
4. 🌾 `Stegosaurus.glb`: **Khủng Long Phiến Gai** — 550 HP, 20 DMG, phản kích khi bị tấn công.
5. 🦕 `Apatosaurus.glb`: **Đại Khủng Long Cổ Dài** — 1200 HP, 25 DMG, cự thú hiền lành khổng lồ.
6. 🎺 `Parasaurolophus.glb`: **Khủng Long Mào** — 300 HP, 12 DMG, AI Nhút nhát bỏ chạy tốc độ cao khi bị tấn công.
7. 🦅 `animated_flying_pteradactal_dinosaur_loop.glb`: **Dực Long Bay Pterodactyl** — Bay lượn tuần tra bầu trời tiền sử.
8. 🐊 `dinosaur.glb`: **Đại Ngạc Bạo Chúa Deinosuchus (Sát Thủ Đầm Lầy)** — 700 HP, 30 DMG, Ambush AI lặn sâu dưới nước và phóng vọt lên phục kích khi người chơi tới gần $\le 8\text{m}$.

---

### C. Công Trình Đế Chế, Tiền Đồn & Di Tích 3D (20 Files GLB):
1. 🏕️ `building_townhall_era1.glb`: **Nhà Chính Đời I (Thời Đồ Đá)** — Túp lều cỏ khởi nguyên (Size 5.0m).
2. 🪵 `building_townhall_era2.glb`: **Nhà Chính Đời II (Thời Đồ Gỗ)** — Doanh trại tiền đồn vững chắc (Size 6.0m).
3. 🏰 `building_townhall_era3.glb`: **Nhà Chính Đời III (Thời Đồ Đá Cự Thạch)** — Pháo đài thành đá kiên cố (Size 7.0m).
4. 🏛️ `building_townhall_era4.glb`: **Nhà Chính Đời IV (Thời Đồ Đồng Thau)** — Điện thờ hoàng kim uy nghiêm (Size 8.0m).
5. ⚒️ `building_forge.glb`: **Lò Rèn Thần Binh Thợ Kra** — Xưởng rèn đúc vũ khí than hồng rực lửa.
6. 🔨 `tool_hammer.glb`: **Búa Rèn Cổ Thạch** — Đặt cạnh đe đá của thợ Kra.
7. 🍖 `building_meat_smoker.glb`: **Giàn Hun Khói Thịt** — Chế biến thịt tươi thành lương thực dự trữ lâu dài.
8. 🏹 `building_crossbow_tower.glb`: **Tháp Canh Nỏ Đá (x2 Tháp Đông/Tây)** — Tự động quay ngắm bắn quái vật bán kính 18m.
9. 🎯 `prop_ballista.glb`: **Bệ Nỏ Bắn Đá** — Đặt trên nóc 2 tháp canh nỏ.
10. 🔭 `prop_wooden_watchtower.glb`: **Chòi Canh Gỗ Tiền Tuyến** — Trạm trinh sát báo động phía Bắc.
11. 🪵 `prop_wooden_wall.glb`: **Hàng Rào Cọc Gỗ** — Bao quanh bán kính 15m bảo vệ căn cứ.
12. 🚪 `prop_wooden_gate.glb`: **Cổng Trại Gỗ Phía Nam** — Cửa ngõ xuất chinh của dũng sĩ.
13. 🚩 `prop_tribal_banner.glb`: **Cờ Hiệu Bộ Tộc** — Cắm trang nghiêm hai bên cổng Nam.
14. 🏮 `prop_lantern.glb`: **Đèn Lồng Tiền Đồn** — Thắp sáng 4 góc căn cứ ban đêm.
15. 📦 `prop_storage_chest.glb`: **Két An Toàn / Rương Rơi Xác Quái** — Cất giữ tài nguyên & rơi chiến lợi phẩm.
16. 💧 `prop_water_well.glb`: **Giếng Nước Tiền Đồn** — Hồi phục 100% Cơn Khát & Thể Lực.
17. 🛒 `prop_supply_cart.glb`: **Xe Kéo Tiếp Tế Viễn Chinh** — Kho lưu động đồng hành.
18. 🏪 `prop_merchant_stall.glb`: **Quầy Hàng Thương Nhân Grug** — Điểm giao thương buôn bán.
19. 🧪 `prop_potion.glb`: **Bình Thần Dược** — Bày bán trên quầy thương nhân Grug.
20. 🪨 `structure_stonehenge.glb`: **Trận Đồ Cự Thạch Stonehenge** — Tế đàn phong ấn Huyết Ngữ cổ đại.

---

### D. Hệ Sinh Thái Đầm Lầy, Bến Nước & Thám Hiểm (4 Files GLB):
1. 🛶 `prop_fishing_boat.glb`: **Bến Thuyền Độc Mộc Đầm Lầy** — Tương tác câu cá / thu lưới $+3$ Cá Tươi.
2. 🐟 `resource_fish.glb`: **Cá Tươi Thực Phẩm** — Rải sinh động quanh bến thuyền.
3. ⚓ `prop_shipwreck.glb`: **Xác Thuyền Đắm Hoang Cổ** — Nửa chìm nghiêng trong đầm lầy Tây Nam & tàn tích Đông Nam.
4. 👑 `prop_ancient_treasure.glb`: **Rương Cổ Báu Hoang Cổ** — Điểm khai quật Cổ Đồ Tầm Bảo với cột sáng vàng vút trời.

---

### E. Công Cụ Lao Động & Tài Nguyên Rơi Thực Địa (5 Files GLB):
1. 🪓 `tool_axe.glb`: **Rìu Đốn Củi** — Gắn trực tiếp vào tay Dân Làng Tiều Phu.
2. ⛏️ `tool_pickaxe.glb`: **Cuốc Đập Đá** — Gắn trực tiếp vào tay Dân Làng Thợ Mỏ.
3. 🌾 `tool_hoe.glb`: **Liềm Hái Thuốc** — Gắn trực tiếp vào tay Dân Làng Dược Sĩ.
4. 🪵 `drop_wood.glb`: **Khối Gỗ Rơi 3D** — Văng ra và bay về phía người chơi khi đốn cây.
5. 🪨 `drop_stone.glb`: **Khối Đá Rơi 3D** — Văng ra và bay về phía người chơi khi đập đá.

---

### F. Môi Trường, Thực Vật & Địa Hình Thực Địa (12 Files GLB):
1. 🌴 `stylized_palm_tree_1k_pbr.glb`: Cây cọ cổ thụ nhiệt đới khai thác Gỗ.
2. 🪵 `fallen_stump_tree_optimized.glb`: Thân cây cổ thụ đổ ngang.
3. 🪵 `tree_stump_model.glb`: Gốc cây mục khai thác Gỗ Rừng.
4. 🪵 `prop_fallen_log.glb`: Cành cây khô rải rác thu thập củi.
5. 🪨 `stylized_rock.glb`: Mỏ đá nhọn khai thác Đá xây dựng.
6. 🪨 `stylized_stones_minipack.glb`: Cụm đá cuội ven đường mòn.
7. 🪨 `prop_rock_large.glb`: Cự thạch lớn viền quanh bờ hồ đầm lầy & bìa rừng.
8. 🍄 `low_poly_mushroom_pack.glb`: Bụi nấm rừng phát quang hái lương thực.
9. 🌸 `anemone_flower_low_poly.glb`: Hoa phong quỳ thảo dược / Vườn ươm.
10. 🌼 `generic_ranunculus_flower.glb`: Hoa mao lương thảo dược / Vườn ươm.
11. 🌿 `peace_lily_plants__flower.glb`: Cây hoa lan ý dược liệu.
12. 🌿 `stylized_tropical_pack.glb`: Bụi cây nhiệt đới làm thảm thực vật tiền sử.

---

## 🔴 PHẦN 2: DANH MỤC ĐỐI TƯỢNG CÒN THIẾU FILE .GLB & HOẠT CẢNH (CẦN BỔ SUNG)

*Mặc dù game đã vận hành $100\%$ mượt mà nhờ các cơ chế tái sử dụng khung xương và Procedural System, để đạt chất lượng AAA / Hoàn hảo nhất, dưới đây là danh sách chính xác các assets còn thiếu file chuyên biệt:*

### 🗡️ I. THIẾU MÔ HÌNH 3D CHO 5 BẬC THẦN BINH (WEAPON PROPS):
*(Hiện tại Dũng Sĩ đánh bằng hoạt ảnh tay không / vệt chém hào quang, chưa có model 3D vũ khí gắn vào xương bàn tay `mixamorig:RightHand`)*

| Cấp Bậc (Tier) | Tên File Cần Tìm | Tên Thần Binh | Mô Tả Ngoại Hình 3D Đề Xuất | Từ Khóa Sketchfab / Kenney |
| :---: | :--- | :--- | :--- | :--- |
| **Tier 1** | `weapon_tier1_stone_spear.glb` | **Giáo Gỗ Mũi Đá** | Cán gỗ thô quấn dây da, mũi đá phiến vót nhọn. | `stone spear`, `primitive spear` |
| **Tier 2** | `weapon_tier2_tri_lance.glb` | **Xuyên Vân Thương Tam Sừng**| Cán thương quấn lông chim, mũi thương vuốt từ Sừng Khủng Long. | `bone spear`, `horn lance` |
| **Tier 3** | `weapon_tier3_bronze_sword.glb`| **Cự Kiếm Đồng Đỏ** | Đại kiếm bản rộng đúc bằng Đồng Đỏ nguyên khối. | `bronze sword`, `tribal greatsword` |
| **Tier 4** | `weapon_tier4_trex_glaive.glb` | **Đại Giáo Nanh Quỷ T-Rex** | Đại giáo lưỡi cong uốn từ Nanh Bạo Chúa T-Rex tỏa sắc đỏ. | `dinosaur fang glaive`, `dragon spear` |
| **Tier 5** | `weapon_tier5_thunder_spear.glb`| **Thánh Khí Lôi Thần Huyết Thạch** | Thánh trượng cổ đại khảm ngọc phát sáng tia sét. | `thunder spear`, `lightning staff` |

---

### 👤 II. THIẾU MÔ HÌNH NPC & DÂN LÀNG RIÊNG BIỆT (CUSTOM CHARACTER MESHES):
*(Hiện tại game đang dùng chung mô hình Warrior FBX đổi màu áo / gắn Billboard 3D để phân biệt)*

| Tên File Cần Tìm | Định Dạng | Đối Tượng Hiện Tại Đang Tạm Dùng | Ngoại Hình Đề Xuất | Từ Khóa Tìm Kiếm |
| :--- | :---: | :--- | :--- | :--- |
| `npc_elder_shaman.glb` | `.glb` | FBX Warrior Nam + Áo choàng xanh + Billboard 3D | Ông lão thổ dân râu bạc, áo da thú, tay cầm trượng gỗ. | `shaman npc`, `druid elder` |
| `villager_male.glb` | `.glb` | Clone từ Player Nam + Đổi màu áo | Nam thổ dân mặc khố da, dáng vóc người lao động. | `caveman`, `tribal peasant` |
| `villager_female.glb` | `.glb` | Clone từ Player Nữ + Đổi màu áo | Nữ thổ dân đội vòng lá, gùi giỏ hái thuốc sau lưng. | `cavewoman`, `gatherer female` |
| `dino_pet_baby.glb` | `.glb` | Velociraptor thu nhỏ 0.45m | Khủng long con / thú cưng nhỏ mập mạp đáng yêu. | `baby dinosaur`, `cute raptor` |
| `prop_hunting_trap.glb` | `.glb` | Tạo hình tạm bằng cọc gỗ đan dây | Khung bẫy kẹp thú bằng ngà voi / cọc gỗ có mồi thịt. | `hunting trap`, `bear trap low poly` |

---

### 🎬 III. THIẾU HOẠT CẢNH (ANIMATION CLIPS FBX):
*(Có thể tải miễn phí định dạng `.fbx` Without Skin từ [Mixamo.com](https://www.mixamo.com))*

1. **Hoạt cảnh mở rộng cho Dũng Sĩ (Player):**
   * `warrior_run.fbx` / `female_warrior_run.fbx`: Hoạt cảnh **Chạy Nước Rút (Sprint)** (Hiện tại đang tăng tốc hoạt ảnh đi bộ `walk` $1.875\times$).
   * `warrior_dodge_roll.fbx` / `female_warrior_dodge_roll.fbx`: Hoạt cảnh **Lộn Nhào Né Đòn (Dodge Roll)** (Hiện tại đang lướt trượt ngang).
   * `warrior_chop_wood.fbx`: Hoạt cảnh **Vung rìu đốn củi chuyên biệt** (Mixamo: `Wood Cutting`).
   * `warrior_mine_rock.fbx`: Hoạt cảnh **Bổ cuốc đập đá chuyên biệt** (Mixamo: `Mining`).
   * `warrior_cheer_victory.fbx`: Hoạt cảnh **Hò reo ăn mừng chiến thắng khi hạ T-Rex** (Mixamo: `Cheering`).

2. **Hoạt cảnh cho Dân Làng (Villagers):**
   * `villager_carry.fbx`: Hoạt cảnh **Vác bao tải / bó củi trên vai** về nhà kho (Mixamo: `Carrying Heavy Box`).
   * `villager_panic.fbx`: Hoạt cảnh **Chạy tán loạn ôm đầu** khi bị dã thú đột kích (Mixamo: `Terrified Run`).

3. **Hoạt cảnh cho Quần Xã Khủng Long:**
   * `dino_roar.glb`: Hoạt cảnh **Khủng Long ngửa cổ gầm thét** kích hoạt hiệu ứng sóng âm (Dinosaur Roar).
   * `dino_tail_whip.glb`: Hoạt cảnh **Quật đuôi gai 360 độ** của Stegosaurus / Apatosaurus.

---

## 🚀 PHẦN 3: BẢNG THEO DÕI TIẾN ĐỘ TÍNH NĂNG (GDD PROGRESS TRACKER)

| Hạng Mục Tính Năng | Trạng Thái Code | Mô Tả Chi Tiết Hoạt Động |
| :--- | :---: | :--- |
| **AoE Economy HUD** | ✅ Hoàn thành | HUD hiển thị Thực phẩm, Gỗ, Đá, Thuốc, Vàng, Nanh Thú & Ngày Sinh Tồn. |
| **Nhà Chính 4 Đời** | ✅ Hoàn thành | Tự động thay đổi 4 mô hình 3D `era1.glb` $\rightarrow$ `era4.glb` khi nâng cấp Đời. |
| **Quản Lý 4 Nghề Dân Làng** | ✅ Hoàn thành | Tiều phu, Thợ mỏ, Dược sĩ, Dân binh; Tự động cầm công cụ 3D lao động thực địa. |
| **Thu Hoạch Ngoại Tuyến** | ✅ Hoàn thành | Mô phỏng sản lượng khi tắt game (tối đa 8h), Báo cáo Thu hoạch Ngoại Tuyến khi mở lại. |
| **Quần Xã 8 Loài Khủng Long**| ✅ Hoàn thành | T-Rex (Boss 3 Phase), Velociraptor, Triceratops, Stegosaurus, Apatosaurus, Parasaurolophus, Pterodactyl & Deinosuchus. |
| **Hệ Sinh Thái Đầm Lầy 3D** | ✅ Hoàn thành | Hồ nước Tây Nam `(-18, 18)` với hiệu ứng sóng nước, làm chậm $-40\%$ khi lội nước. |
| **Đại Ngạc Deinosuchus Ambush**| ✅ Hoàn thành | Cá sấu lặn sâu dưới nước, phóng vọt lên phục kích khi người chơi tới gần $\le 8\text{m}$. |
| **Bến Thuyền & Nguồn Nước** | ✅ Hoàn thành | Câu cá $+3$ Cá Tươi tại Bến Thuyền; Uống nước đầm lầy $+35\%$ Khát (kèm tỷ lệ đau bụng). |
| **Chuỗi 4 Sắc Lệnh Đầm Lầy** | ✅ Hoàn thành | Sắc lệnh 5 (Diệt Ngạc), Sắc lệnh 6 (Ngư nghiệp), Sắc lệnh 7 (Xác tàu đắm), Sắc lệnh 8 (Giải độc). |
| **Cây Chế Tác Bạo Ngạc (Tech)**| ✅ Hoàn thành | Giáp Vảy Bạo Ngạc (+200 HP, miễn chậm nước); Đại Thương Răng Cá Sấu (55 ATK + Xuất huyết -12 HP/s). |
| **Mùa Mưa Bão Tiền Sử (Monsoon)**| ✅ Hoàn thành | Kích hoạt chu kỳ mưa bão, sấm chớp, sản lượng cá x2, vườn ươm x2, cá sấu tăng tốc x1.2. |
| **Bào Chế Thuốc Giải Độc** | ✅ Hoàn thành | Bào chế từ 3 Thảo Dược tại Quầy Grug / Vườn Ươm (+30 Vàng, hồi phục giải độc). |
| **Lò Rèn Kra 5 Tier** | ✅ Hoàn thành | Đúc thần binh 5 Tier, nâng cấp giáp hộ thể và cường hóa tháp nỏ lửa. |
| **Giàn Hun Khói Thịt** | ✅ Hoàn thành | Hun khói thịt sống thành thịt chín bảo quản lâu dài chống thối rữa. |
| **Két An Toàn Tiền Đồn** | ✅ Hoàn thành | Bảo toàn 100% tài nguyên cất giữ khi dũng sĩ ngất ngoài hoang dã. |
| **Tháp Canh Nỏ Đá Phòng Thủ**| ✅ Hoàn thành | 2 tháp canh nỏ đá tự động quay ngắm và bắn tên quái vật trong tầm 18m ($35\text{ DMG}$). |
| **Vườn Ươm Nông Nghiệp 3D** | ✅ Hoàn thành | 4 ô ươm hoa thảo dược GLB, sinh trưởng $\times 2$ khi trời mưa, thu hoạch $\times 3$. |
| **Cổ Đồ Tầm Bảo & Cự Thạch** | ✅ Hoàn thành | La bàn tầm bảo 4 rương báu 3D; Tế đàn Stonehenge phát sáng phong ấn Huyết Ngữ. |
| **Đồng Đội Co-op & Linh Thú** | ✅ Hoàn thành | Dũng sĩ song hành phòng thủ $+50$ Thủ Trại; Bé Raptor hộ vệ theo sau dũng sĩ. |
| **Thời Tiết & Chu Kỳ Ngày Đêm**| ✅ Hoàn thành | Bình minh, Hoàng hôn, Đêm Trăng Máu (Blood Moon), Mưa giông tự động tưới cây. |
| **Hệ Thống Âm Thanh Đa Tầng** | ✅ Hoàn thành | Web Audio API tổng hợp: Chém (`hit`), Thu hoạch (`harvest`), Đun nước (`drink`), Bắn nỏ (`shoot`), Gầm (`roar`). |
| **Khung Giờ Vàng (Soft-Cap)** | ✅ Hoàn thành | Đếm thời gian $90 - 120\text{ phút/ngày}$, giảm rơi tài nguyên tránh cày kiệt sức. |
| **Chiến Dịch 5 Chương (Campaign)** | ✅ Hoàn thành | 5 Chương 90 ngày (Tiền Đồn, Raptor, Khổng Lồ, Pháo Đài, Huyết Long). |
| **Chế Độ Vô Tận (Endless Mode)** | ✅ Hoàn thành | Đại chiến thắng, sương tan, pháo hoa mừng công, mở Sandbox không giới hạn. |
| **Bẫy Thú Dã Ngoại (Trapping)** | ✅ Hoàn thành | Chế tác & đặt bẫy 3D ngoài thực địa, tự sập sau $25\text{s}$, thu $+3\text{ Thịt} + 1\text{ Da} + 1\text{ Nanh}$. |
| **Mùi Máu Tươi & Túi Ngải Cứu**| ✅ Hoàn thành | $\ge 10$ Thịt sống ban đêm tăng $40\%$ tầm dã thú; mua Túi Ngải Cứu để triệt tiêu. |
| **Chế Độ Viễn Chinh (Transit)**| ✅ Hoàn thành | Bật/tắt du hành xe buýt trong Cài Đặt: Linh Điểu tự thu rương tiếp tế mỗi $25\text{s}$. |
| **Sự Kiện Dã Ngoại Cuối Tuần**| ✅ Hoàn thành | Nhận diện Thứ Bảy/Chủ Nhật, 3 nhiệm vụ dã ngoại săn thưởng Vàng & Nanh Thú lớn. |
| **Kiểm Thử & Đóng Gói iOS** | ✅ Hoàn thành | Đồng bộ `apps/game/index.html`, đóng gói `ios/App/App/www`, **251/251 Tests PASS 100%**. |

