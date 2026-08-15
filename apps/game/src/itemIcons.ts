/**
 * Minh hoạ SVG nội tuyến cho vật phẩm, công trình, trạm chế tạo, vùng POI và hành động.
 * Chạy hoàn toàn từ cache offline, không tải ngoài, không phụ thuộc font/icon mạng.
 */

function svg(content: string, className = 'item-svg'): string {
  return `<svg class="${className}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">${content}</svg>`;
}

/** Biểu tượng Đồng Tiền Vàng Cổ Đông Sơn vector chuẩn xác (không lo lỗi font/vuông chữ nhật emoji). */
export function coinIconSvg(size = 16): string {
  return `<svg style="display:inline-block;vertical-align:-2.5px;width:${size}px;height:${size}px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="26" fill="#f59e0b" stroke="#fef08a" stroke-width="3.5"/><circle cx="32" cy="32" r="21" fill="#d97706" stroke="#b45309" stroke-width="2"/><rect x="23" y="23" width="18" height="18" rx="2.5" fill="#1c130c" stroke="#fef08a" stroke-width="2.5"/><path d="M32 11v7M32 46v7M11 32h7M46 32h7" stroke="#fef08a" stroke-width="2.5" stroke-linecap="round"/></svg>`;
}

/** Icon cho vật phẩm, công trình phòng thủ, trạm chế tạo, hoặc cấp doanh trại. */
export function itemIconSvg(id: string, className = 'item-svg'): string {
  switch (id) {
    // -------------------------------- Tiền tệ & Kim loại quý
    case 'ancient_coin':
    case 'gold':
    case 'gold_coin':
      return svg(
        '<circle cx="32" cy="32" r="26" fill="#f59e0b" stroke="#fef08a" stroke-width="3.5"/><circle cx="32" cy="32" r="21" fill="#d97706" stroke="#b45309" stroke-width="2"/><rect x="23" y="23" width="18" height="18" rx="2.5" fill="#1c130c" stroke="#fef08a" stroke-width="2.5"/><path d="M32 11v7M32 46v7M11 32h7M46 32h7" stroke="#fef08a" stroke-width="2.5" stroke-linecap="round"/>',
        className,
      );

    // -------------------------------- Vật liệu cơ bản & chế tác
    case 'log':
      return svg(
        '<path d="M9 19h36c7 0 10 6 7 11l-9 14c-2 4-6 6-11 6H12c-5 0-7-5-4-9l9-15c1-4 4-7 7-7Z" fill="#7a4529" stroke="#c77a42" stroke-width="3"/><path d="M40 19c6 2 9 7 9 12-2 7-7 11-14 11-5-1-9-4-11-8l8-15Z" fill="#d19a58" stroke="#f0c47d" stroke-width="2"/><circle cx="35" cy="31" r="5" fill="#8f5835"/><circle cx="35" cy="31" r="2" fill="#d6a267"/>',
        className,
      );

    case 'dry_branch':
      return svg(
        '<path d="M10 46 49 10M23 34l-5-13m13 1 10-1m-6-7 2-8m-3 27 12 5" fill="none" stroke="#b77945" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="m17 44 30-30" fill="none" stroke="#e3aa69" stroke-width="1.5" stroke-linecap="round"/><circle cx="10" cy="46" r="3" fill="#6f4428"/>',
        className,
      );

    case 'sharp_stone':
      return svg(
        '<path d="m12 43 15-29 20 7 6 21-20 8Z" fill="#8d9b9c" stroke="#cbd1c9" stroke-width="3" stroke-linejoin="round"/><path d="M27 14l6 36m14-29-20 7" fill="none" stroke="#e1e7df" stroke-width="2" opacity=".7"/>',
        className,
      );

    case 'stone_block':
      return svg(
        '<path d="m11 22 20-12 22 13-20 12Z" fill="#9c846d" stroke="#d8c2a5" stroke-width="2"/><path d="M11 22v21l22 12V35Zm42 1v20L33 55V35Z" fill="#705b49" stroke="#c2ab8e" stroke-width="2"/><path d="m33 35 20-12" stroke="#e0c8aa" stroke-width="2"/>',
        className,
      );

    case 'vine':
    case 'fiber':
      return svg(
        '<path d="M15 16c18-13 34 6 21 16-12 9-29-4-16-15 12-10 31 4 25 21-5 15-27 12-30 1" fill="none" stroke="#779449" stroke-width="5" stroke-linecap="round"/><path d="M13 42c9 7 22 7 34 0" fill="none" stroke="#bfd27b" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="18" r="3" fill="#9dbf5c"/>',
        className,
      );

    case 'rope':
      return svg(
        '<path d="M12 48c6-14 16-24 28-34m-22 38c6-14 16-24 28-34m-34 26c6-14 16-24 28-34" fill="none" stroke="#af854e" stroke-width="4" stroke-linecap="round"/><path d="M16 46c4-10 12-18 22-26" fill="none" stroke="#e2b474" stroke-width="2" stroke-linecap="round"/>',
        className,
      );

    case 'clay':
      return svg(
        '<path d="M14 38c-3-11 6-22 18-24 14-2 22 7 21 18-1 12-11 19-24 18-6 0-12-4-15-12Z" fill="#9d5538" stroke="#d48060" stroke-width="3"/><path d="M22 28c8-4 16 0 20 8m-24 4c6-2 14 2 16 6" fill="none" stroke="#e8a385" stroke-width="2" stroke-linecap="round"/>',
        className,
      );

    case 'fired_brick':
      return svg(
        '<path d="m12 24 20-11 20 11-20 11Z" fill="#b8583c" stroke="#f09072" stroke-width="2"/><path d="M12 24v19l20 11V35Zm40 0v19L32 54V35Z" fill="#843922" stroke="#d96a4a" stroke-width="2"/>',
        className,
      );

    case 'iron_ore':
      return svg(
        '<path d="m12 39 8-22 20-7 13 14-8 22-22 6Z" fill="#58636b" stroke="#a4b3b5" stroke-width="3"/><path d="m22 24 6 5m-2 10 14 3m-4-14 7 7" stroke="#d4a55e" stroke-width="3" stroke-linecap="round"/>',
        className,
      );

    case 'iron_ingot':
      return svg(
        '<path d="m15 25 14-8h16l-9 8Zm-3 17 5-15h26l-5 15Zm31-15 9-8v15l-9 8Z" fill="#7a8c96" stroke="#c0d1d9" stroke-width="2"/><path d="m15 26 23-1m-21 16 23-1" stroke="#e3eff5" stroke-width="1.5" stroke-linecap="round"/>',
        className,
      );

    case 'red_mushroom':
      return svg(
        '<path d="M25 33h14l4 16H21Z" fill="#e6d5b4" stroke="#a68d6e" stroke-width="2"/><path d="M12 33c2-14 10-22 20-22s18 8 20 22Z" fill="#c94f45" stroke="#ec8974" stroke-width="3"/><circle cx="23" cy="23" r="3" fill="#f2e6c7"/><circle cx="35" cy="19" r="3" fill="#f2e6c7"/><circle cx="43" cy="26" r="2.5" fill="#f2e6c7"/>',
        className,
      );

    case 'seed':
    case 'seed_herb':
    case 'seed_corn':
    case 'seed_berry':
      return svg(
        '<path d="M18 36c-5-8 2-16 10-14 6 2 8 10 2 15-4 4-8 2-12-1Z" fill="#8f5d34" stroke="#cca172" stroke-width="2"/><path d="M34 44c-4-7 1-15 9-13 5 2 7 9 2 14-4 4-7 2-11-1Z" fill="#6f4422" stroke="#ba8a58" stroke-width="2"/><path d="M28 22c-2-9 6-12 12-7 4 4 2 11-5 11-3 0-5-2-7-4Z" fill="#58853b" stroke="#90c26b" stroke-width="2"/>',
        className,
      );

    case 'blueprint':
      return svg(
        '<path d="M16 9h24l9 9v36H16Z" fill="#507888" stroke="#cbdde6" stroke-width="2"/><path d="M40 9v10h9M22 30h20M22 37h14M24 23l12 17m0-17L24 40" fill="none" stroke="#ecd798" stroke-width="2"/>',
        className,
      );

    case 'upgrade_core':
      return svg(
        '<path d="M32 8 52 20v24L32 56 12 44V20Z" fill="#3d281a" stroke="#e07a3c" stroke-width="3"/><circle cx="32" cy="32" r="11" fill="#e07a3c" stroke="#f6c268" stroke-width="2"/><path d="M32 23v18M23 32h18" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
        className,
      );

    // -------------------------------- Thức ăn & Đồ uống
    case 'wild_berry':
      return svg(
        '<path d="M31 10c4 5 9 7 13 8-4 4-9 4-14 2M31 18v9" fill="#779449" stroke="#b6d473" stroke-width="2"/><circle cx="20" cy="34" r="8" fill="#b8484a"/><circle cx="34" cy="31" r="9" fill="#d55e57"/><circle cx="42" cy="41" r="7" fill="#a83e43"/><circle cx="31" cy="42" r="8" fill="#d85d53"/>',
        className,
      );

    case 'raw_fish':
    case 'grilled_fish':
      return svg(
        `<path d="M12 32c9-15 26-16 34-4l8-8v24l-8-8c-9 12-26 11-34-4Z" fill="${id === 'grilled_fish' ? '#bb7440' : '#599ea5'}" stroke="${id === 'grilled_fish' ? '#e7b069' : '#b8e0d6'}" stroke-width="3"/><circle cx="25" cy="28" r="2.5" fill="#182226"/><path d="m34 24 5 16m-10-13 6 13" stroke="${id === 'grilled_fish' ? '#3d1e0d' : '#eaf4f4'}" stroke-width="2" opacity=".75"/>`,
        className,
      );

    case 'raw_meat':
    case 'grilled_meat':
    case 'dried_meat':
      return svg(
        `<path d="M15 20c5-10 19-12 28-4 10 9 6 26-7 30-11 4-25-3-25-14 0-4 1-8 4-12Z" fill="${id === 'raw_meat' ? '#bc5d55' : id === 'grilled_meat' ? '#8d4e2d' : '#693822'}" stroke="${id === 'raw_meat' ? '#f0a196' : id === 'grilled_meat' ? '#d89a57' : '#9e623f'}" stroke-width="3"/><path d="M23 24c8 1 14 5 18 12M20 34c6 0 11 3 15 8" fill="none" stroke="${id === 'raw_meat' ? '#ffd8d3' : '#e9b170'}" stroke-width="2" opacity=".8"/>`,
        className,
      );

    case 'raw_water':
    case 'boiled_water':
      return svg(
        `<path d="M32 9c9 12 14 20 14 28a14 14 0 1 1-28 0c0-8 5-16 14-28Z" fill="${id === 'boiled_water' ? '#68abb3' : '#477d8a'}" stroke="#d3f2f5" stroke-width="2.5"/><path d="M24 38c4 4 11 5 16 1" fill="none" stroke="#e2f5ee" stroke-width="2" stroke-linecap="round"/>${id === 'boiled_water' ? '<path d="M25 7c-2-3 2-5 0-7m7 7c-2-3 2-5 0-7m7 7c-2-3 2-5 0-7" fill="none" stroke="#f2d79d" stroke-width="2" stroke-linecap="round"/>' : ''}`,
        className,
      );

    case 'health_potion':
    case 'greater_potion':
      return svg(
        `<path d="M28 10h8v6h-8Zm-7 14c0-4 4-8 11-8s11 4 11 8l4 24a8 8 0 0 1-8 8H24a8 8 0 0 1-8-8Z" fill="${id === 'greater_potion' ? '#b02a2a' : '#8e2f2f'}" stroke="${id === 'greater_potion' ? '#f49494' : '#d87777'}" stroke-width="2.5"/><path d="M24 38h16m-8-8v16" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`,
        className,
      );

    case 'antidote':
      return svg(
        '<path d="M28 10h8v6h-8Zm-7 14c0-4 4-8 11-8s11 4 11 8l4 24a8 8 0 0 1-8 8H24a8 8 0 0 1-8-8Z" fill="#327c59" stroke="#79d1a3" stroke-width="2.5"/><path d="M32 26v18M26 34c3-4 6-4 12 0" fill="none" stroke="#d5f5e3" stroke-width="2.5" stroke-linecap="round"/>',
        className,
      );

    // -------------------------------- Công cụ, vũ khí & trang bị
    case 'torch':
      return svg(
        '<path d="m29 25 8 3-10 25-8-3Z" fill="#8b5935" stroke="#d69b58" stroke-width="2"/><path d="M31 7c10 9 5 18 0 20-8-5-8-12 0-20Z" fill="#ed803f"/><path d="M31 13c4 5 1 10-1 11-4-4-3-8 1-11Z" fill="#f6d571"/>',
        className,
      );

    case 'stone_axe':
    case 'iron_axe':
      return svg(
        `<path d="m29 13 8 3-12 35-8-3Z" fill="#a86a3c" stroke="#e2ad72" stroke-width="2"/><path d="m17 13 27 7-5 14-28-8Z" fill="${id === 'iron_axe' ? '#9eabb0' : '#899594'}" stroke="${id === 'iron_axe' ? '#e2ecf0' : '#d8e1d8'}" stroke-width="3" stroke-linejoin="round"/>`,
        className,
      );

    case 'fishing_rod':
      return svg(
        '<path d="M12 52 46 14" stroke="#9e663a" stroke-width="4" stroke-linecap="round"/><path d="M46 14c6 10 10 26-2 34m0 0c2 2 4 1 5-2" fill="none" stroke="#d0e2e8" stroke-width="2" stroke-linecap="round"/>',
        className,
      );

    case 'clay_pot':
      return svg(
        '<ellipse cx="32" cy="17" rx="10" ry="4" fill="#a65d3f" stroke="#e09477" stroke-width="2"/><path d="M22 17c-6 8-8 18-4 26 4 8 20 8 24 0 4-8 2-18-4-26" fill="#8b462a" stroke="#d9805f" stroke-width="2.5"/><path d="M18 24c-5 3-5 9 0 12m28-12c5 3 5 9 0 12" fill="none" stroke="#d9805f" stroke-width="2"/>',
        className,
      );

    case 'rabbit_trap':
    case 'deer_trap':
    case 'beast_trap':
      return svg(
        `<path d="M14 46 24 18h16l10 28Z" fill="${id === 'beast_trap' ? '#3d2b24' : '#4d3725'}" stroke="${id === 'beast_trap' ? '#d97706' : '#966d49'}" stroke-width="2.5"/><path d="M18 46V28h28v18M24 28v18M40 28v18M18 36h28" stroke="${id === 'beast_trap' ? '#fbbf24' : '#cf9e6b'}" stroke-width="2"/>`,
        className,
      );

    case 'fish_trap':
      return svg(
        '<ellipse cx="32" cy="32" rx="20" ry="12" fill="#1e3a5f" stroke="#38bdf8" stroke-width="2.5"/><path d="M12 32c6-10 34-10 40 0M12 32c6 10 34 10 40 0M22 22v20M32 20v24M42 22v20" stroke="#7dd3fc" stroke-width="2"/><circle cx="46" cy="32" r="3" fill="#facc15"/><path d="M12 32 6 24v16Z" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5"/>',
        className,
      );

    case 'spike_trap':
      return svg(
        '<path d="M10 50h44v4H10Z" fill="#523c2a"/><path d="m16 50 4-28 5 28m5 0 5-32 5 32m5 0 4-24 5 24" fill="#786049" stroke="#d6be9f" stroke-width="2" stroke-linejoin="round"/>',
        className,
      );

    case 'stone_spear':
    case 'iron_spear':
      return svg(
        `<path d="M14 50 42 22" stroke="#8c5832" stroke-width="4" stroke-linecap="round"/><path d="m38 26 14-14-3 17Z" fill="${id === 'iron_spear' ? '#9db0b8' : '#889493'}" stroke="${id === 'iron_spear' ? '#e2ecf0' : '#d2ded2'}" stroke-width="2.5" stroke-linejoin="round"/><path d="m36 28 8 8" stroke="#d19c62" stroke-width="3"/>`,
        className,
      );

    case 'bow':
      return svg(
        '<path d="M18 12c24 10 24 30 0 40" fill="none" stroke="#9e663a" stroke-width="4" stroke-linecap="round"/><path d="M18 12v40" stroke="#dfc498" stroke-width="2"/>',
        className,
      );

    case 'arrow':
      return svg(
        '<path d="M14 50 48 16" stroke="#9e663a" stroke-width="3" stroke-linecap="round"/><path d="m42 14 10-2-2 10Z" fill="#889493" stroke="#e0e8e0" stroke-width="2" stroke-linejoin="round"/><path d="m14 44 6 6m-6-2 2 6" stroke="#d14949" stroke-width="2.5" stroke-linecap="round"/>',
        className,
      );

    case 'iron_sword':
      return svg(
        '<path d="m16 48 6-6m-2 4 4-4m-1 7-4-4" stroke="#8c5a36" stroke-width="3" stroke-linecap="round"/><path d="m20 44 26-26 6-6-6 6-26 26" fill="#8ca0a8" stroke="#dbe7eb" stroke-width="3" stroke-linecap="round"/><path d="M18 40l6 6" stroke="#e0a343" stroke-width="3"/>',
        className,
      );

    case 'wooden_shield':
    case 'iron_shield':
      return svg(
        `<path d="M32 10c12 0 20 6 20 18 0 16-12 24-20 28-8-4-20-12-20-28 0-12 8-18 20-18Z" fill="${id === 'iron_shield' ? '#697b85' : '#7d5538'}" stroke="${id === 'iron_shield' ? '#c4d7e0' : '#c99163'}" stroke-width="3"/><circle cx="32" cy="28" r="7" fill="${id === 'iron_shield' ? '#8fa3ad' : '#4d3422'}" stroke="${id === 'iron_shield' ? '#e2ecf0' : '#dca678'}" stroke-width="2"/>`,
        className,
      );

    // -------------------------------- Công trình phòng thủ & Trạm chế tạo
    case 'thorn_fence':
      return svg(
        '<path d="M12 48 24 16m16 32L28 16m24 32L40 16" stroke="#7a5538" stroke-width="4" stroke-linecap="round"/><path d="M10 26h44M10 40h44" stroke="#48602a" stroke-width="3" stroke-linecap="round"/><path d="m18 22 4 8m14-8 4 8m-28 6 6 8m12-8 6 8" stroke="#9ec95f" stroke-width="2"/>',
        className,
      );

    case 'wooden_wall':
      return svg(
        '<path d="m14 50v-28l5-6 5 6v28Zm15 0v-32l5-6 5 6v32Zm15 0v-28l5-6 5 6v28Z" fill="#6d492e" stroke="#b88358" stroke-width="2"/><path d="M10 38h44" stroke="#452a16" stroke-width="3"/>',
        className,
      );

    case 'stone_wall':
      return svg(
        '<path d="M12 18h40v34H12Z" fill="#675a4d" stroke="#b09f8f" stroke-width="2.5"/><path d="M12 18v-4h8v4h8v-4h8v4h8v-4h8v4M12 30h40M12 42h40M32 18v12M22 30v12M42 30v12M32 42v10" stroke="#332a22" stroke-width="2"/>',
        className,
      );

    case 'watch_tower':
      return svg(
        '<path d="M18 52 24 22h16l6 30" stroke="#7d5332" stroke-width="3"/><path d="M18 22h28v-8H18Zm3-8 11-6 11 6" fill="#543720" stroke="#b37e52" stroke-width="2"/><path d="M21 34h22M19 44h26" stroke="#4d321d" stroke-width="2"/>',
        className,
      );

    case 'ballista':
      return svg(
        '<path d="M22 52 32 30l10 22M32 30v-16" stroke="#7a5538" stroke-width="3"/><path d="M12 24c16 8 24 8 40 0" fill="none" stroke="#9c6d48" stroke-width="4" stroke-linecap="round"/><path d="M12 24 32 34 52 24" stroke="#dfc498" stroke-width="1.5"/><path d="m32 10 3 24h-6Z" fill="#9db0b8" stroke="#dbe7eb" stroke-width="1.5"/>',
        className,
      );

    case 'campfire':
      return svg(
        '<ellipse cx="32" cy="48" rx="20" ry="7" fill="#4d3d30" stroke="#876d56" stroke-width="2"/><path d="m20 47 24-8m-24 0 24 8" stroke="#784825" stroke-width="4" stroke-linecap="round"/><path d="M32 14c8 8 10 18 4 24-4 4-12 4-16 0-6-6-2-16 12-24Z" fill="#e07a3c" stroke="#f6c268" stroke-width="2"/><path d="M32 23c4 4 5 9 2 12-2 2-6 2-8 0-3-3-1-8 6-12Z" fill="#f8df78"/>',
        className,
      );

    case 'drying_rack':
      return svg(
        '<path d="M14 50 22 18l8 32m12 0 8-32 8 32" stroke="#7d5332" stroke-width="3" stroke-linecap="round"/><path d="M18 24h32" stroke="#b88358" stroke-width="3" stroke-linecap="round"/><path d="M28 24c0 8-4 12-4 16s4 4 4 0v-16m12 0c0 8-4 12-4 16s4 4 4 0v-16" fill="#8d4e2d" stroke="#e9b170" stroke-width="2"/>',
        className,
      );

    case 'kiln':
      return svg(
        '<path d="M16 52c-2-16 4-32 16-32s18 16 16 32Z" fill="#824630" stroke="#d47959" stroke-width="2.5"/><path d="M24 52c0-8 4-12 8-12s8 4 8 12Z" fill="#1f1610"/><path d="M28 50c0-4 2-6 4-6s4 2 4 6Z" fill="#e07a3c"/>',
        className,
      );

    case 'forge':
      return svg(
        '<path d="M14 44h36v8H14Zm6-14h24l4 14H16Z" fill="#525d63" stroke="#9ba8ad" stroke-width="2.5"/><path d="M38 20 28 30m10-10 6 6-4 4-6-6Z" fill="#825633" stroke="#e0a56b" stroke-width="2"/><circle cx="28" cy="28" r="2" fill="#f6c268"/><path d="m27 24 2-3m3 4 3-2" stroke="#f6c268" stroke-width="1.5"/>',
        className,
      );

    // -------------------------------- Cấp doanh trại
    case 'camp_tier_1':
      return svg(
        '<path d="M14 52 32 14l18 38Z" fill="#5e4835" stroke="#b89368" stroke-width="3"/><path d="M26 52v-16l6-4 6 4v16Z" fill="#291e15"/><path d="M22 28h20M18 40h28" stroke="#876342" stroke-width="2"/><circle cx="32" cy="14" r="3" fill="#e07a3c"/>',
        className,
      );

    case 'camp_tier_2':
      return svg(
        '<path d="M16 52V36m32 16V36M24 52V36m16 52V36" stroke="#7a5538" stroke-width="3"/><path d="M12 36h40v-14H12Zm-2-14 22-10 22 10Z" fill="#6d492e" stroke="#d99b66" stroke-width="2.5"/><path d="M28 36v-8h8v8Z" fill="#24170d"/>',
        className,
      );

    case 'camp_tier_3':
      return svg(
        '<path d="M10 52h44V26H10Z" fill="#524a40" stroke="#a39686" stroke-width="2.5"/><path d="M10 26v-6h8v6h6v-6h8v6h6v-6h8v6h8v-6M24 52v-16c0-4 4-8 8-8s8 4 8 8v16Z" fill="#26211c" stroke="#827668" stroke-width="2"/><circle cx="32" cy="18" r="4" fill="#e07a3c" stroke="#f6c268" stroke-width="1.5"/>',
        className,
      );

    default:
      return svg(
        '<path d="m12 22 20-12 20 12v22L32 55 12 44Z" fill="#766449" stroke="#d2bb8c" stroke-width="3"/><path d="m12 22 20 12 20-12M32 34v21" fill="none" stroke="#e3d0a8" stroke-width="2"/>',
        className,
      );
  }
}

/** Icon minh hoạ cho các loại vùng POI trên bản đồ và thông tin vùng. */
export function zoneIconSvg(zone: string, className = 'zone-svg'): string {
  switch (zone) {
    case 'forest':
      return svg(
        '<path d="M32 10 18 32h7l-6 16h26l-6-16h7Z" fill="#3f5928" stroke="#86b856" stroke-width="2.5" stroke-linejoin="round"/><path d="M30 48v8h4v-8" fill="#4d3521" stroke="#7a5538" stroke-width="2"/>',
        className,
      );

    case 'water':
      return svg(
        '<path d="M12 40c8-4 16 4 24 0s16-4 16 0c0 8-12 14-20 14s-20-6-20-14Z" fill="#2a5a66" stroke="#68abb8" stroke-width="2.5"/><path d="M32 10c7 9 10 15 10 20a10 10 0 1 1-20 0c0-5 3-11 10-20Z" fill="#438a99" stroke="#9de3ee" stroke-width="2"/>',
        className,
      );

    case 'merchant':
      return svg(
        '<path d="M16 50V20h8v30Zm24 0V20h8v30ZM12 20h40v-6H12Z" fill="#574838" stroke="#ba9e80" stroke-width="2.5"/><path d="M26 38h12v-6H26Z" fill="#a87532" stroke="#f0c273" stroke-width="2"/><circle cx="32" cy="27" r="3" fill="#e07a3c"/>',
        className,
      );

    case 'trail':
      return svg(
        '<path d="M22 54c6-14 14-22 10-34s6-12 10-12" fill="none" stroke="#8c6f4e" stroke-width="8" stroke-linecap="round"/><path d="M22 54c6-14 14-22 10-34s6-12 10-12" fill="none" stroke="#d6ad7d" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 6"/>',
        className,
      );

    case 'camp':
      return itemIconSvg('camp_tier_1', className);

    case 'wilderness':
    default:
      return svg(
        '<path d="M10 48 26 22l14 26m-6-16 12-18 12 34Z" fill="#4a4435" stroke="#998e78" stroke-width="2.5" stroke-linejoin="round"/><path d="M18 42c4-4 8 0 12-2" stroke="#758a52" stroke-width="2" stroke-linecap="round"/>',
        className,
      );
  }
}

/** Icon minh hoạ cho các hành động tương tác tại vùng POI. */
export function actionIconSvg(actionId: string, className = 'action-svg'): string {
  switch (actionId) {
    case 'chop_wood':
      return svg(
        '<path d="m20 44 24-24m-4-4 8 8" stroke="#a66e42" stroke-width="4" stroke-linecap="round"/><path d="m38 14 14 6-6 14-8-4Z" fill="#8d9ea6" stroke="#e0edf2" stroke-width="2.5" stroke-linejoin="round"/><path d="M14 50h16" stroke="#c48a56" stroke-width="3" stroke-linecap="round"/>',
        className,
      );

    case 'forage_berries':
      return svg(
        '<circle cx="24" cy="36" r="7" fill="#b8484a"/><circle cx="38" cy="34" r="8" fill="#d55e57"/><circle cx="30" cy="46" r="7" fill="#a83e43"/><path d="M30 14c4 6 8 10 8 18M26 22c-4 2-8 2-10 0" stroke="#84ab4b" stroke-width="3" stroke-linecap="round"/>',
        className,
      );

    case 'set_rabbit_trap':
      return svg(
        '<path d="M16 46 26 18h12l10 28Z" fill="#543c2a" stroke="#b08358" stroke-width="2.5"/><path d="M20 46V28h24v18M28 28v18M36 28v18" stroke="#dfad77" stroke-width="2"/>',
        className,
      );

    case 'fetch_water':
      return svg(
        '<path d="M32 10c8 10 12 18 12 25a12 12 0 1 1-24 0c0-7 4-15 12-25Z" fill="#4d8f9c" stroke="#b6ebf2" stroke-width="2.5"/><path d="M26 36c3 3 9 4 13 1" fill="none" stroke="#def8fc" stroke-width="2" stroke-linecap="round"/>',
        className,
      );

    case 'fish':
      return svg(
        '<path d="M12 48 44 14" stroke="#996338" stroke-width="3.5" stroke-linecap="round"/><path d="M44 14c6 10 10 22 0 30" fill="none" stroke="#cde3e8" stroke-width="2"/><path d="m36 44 14-4-4 12c-4-2-7-5-10-8Z" fill="#589ea8" stroke="#b4e4eb" stroke-width="2"/>',
        className,
      );

    case 'merchant_trade':
      return svg(
        '<path d="M16 28h26m-6-6 6 6-6 6" fill="none" stroke="#d99943" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M48 38H22m6-6-6 6 6 6" fill="none" stroke="#5fa679" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>',
        className,
      );

    case 'night_defend':
      return svg(
        '<path d="M32 12c10 0 18 5 18 16 0 14-10 22-18 26-8-4-18-12-18-26 0-11 8-16 18-16Z" fill="#7a342b" stroke="#e07a3c" stroke-width="2.5"/><path d="M32 20c4 4 5 9 2 13-2 2-6 2-8 0-3-3-1-9 6-13Z" fill="#f8df78"/>',
        className,
      );

    case 'sleep':
      return svg(
        '<path d="M38 12a18 18 0 1 0 12 30 18 18 0 0 1-12-30Z" fill="#3b4b5e" stroke="#9cbcd9" stroke-width="2.5"/><path d="M18 48 30 28l12 20Z" fill="#4d3b2c" stroke="#8c684a" stroke-width="2"/>',
        className,
      );

    default:
      return itemIconSvg(actionId, className);
  }
}

/** Avatar nhân vật Thổ dân Tiền sử (Nam / Nữ) */
export function avatarSvg(gender: 'male' | 'female', className = 'avatar-svg'): string {
  if (gender === 'female') {
    return svg(
      `<!-- Nữ Thổ Dân Tiền Sử -->
      <circle cx="32" cy="32" r="30" fill="#2b221a" stroke="#876847" stroke-width="2"/>
      <!-- Tóc & bím tóc quàng vai -->
      <path d="M18 36 C14 44 14 56 22 60 C26 56 24 46 22 36 Z" fill="#231812"/>
      <path d="M46 36 C50 44 50 56 42 60 C38 56 40 46 42 36 Z" fill="#231812"/>
      <circle cx="32" cy="27" r="15" fill="#231812"/>
      <!-- Lông chim xanh ngọc cài đầu -->
      <path d="M42 16 Q54 6 50 20 Q44 22 42 16 Z" fill="#2ea890" stroke="#79dfc8" stroke-width="1"/>
      <path d="M40 18 Q50 10 46 22" fill="none" stroke="#e0f8f2" stroke-width="1"/>
      <!-- Mặt -->
      <ellipse cx="32" cy="29" rx="11" ry="12.5" fill="#c9956d"/>
      <!-- Mái tóc tiền sử -->
      <path d="M21 24 Q32 17 43 23 Q38 20 32 20 Q25 20 21 24 Z" fill="#231812"/>
      <!-- Băng đô da & chuỗi hạt -->
      <path d="M21 22 Q32 18 43 22" fill="none" stroke="#7e5436" stroke-width="2.5"/>
      <circle cx="32" cy="20" r="2" fill="#38b29a"/>
      <circle cx="27" cy="21" r="1.5" fill="#d99f43"/>
      <circle cx="37" cy="21" r="1.5" fill="#d99f43"/>
      <!-- Mắt & Lông mày -->
      <ellipse cx="27.5" cy="28" rx="1.5" ry="1.2" fill="#1f1610"/>
      <ellipse cx="36.5" cy="28" rx="1.5" ry="1.2" fill="#1f1610"/>
      <path d="M25.5 25.5 Q28 25 30 26" fill="none" stroke="#231812" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M38.5 25.5 Q36 25 34 26" fill="none" stroke="#231812" stroke-width="1.2" stroke-linecap="round"/>
      <!-- Vệt sơn chiến binh trên má -->
      <path d="M24 31 L28 32 M24 33.5 L27.5 34.5" stroke="#2ea890" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M40 31 L36 32 M40 33.5 L36.5 34.5" stroke="#2ea890" stroke-width="1.2" stroke-linecap="round"/>
      <!-- Miệng mỉm cười kiên định -->
      <path d="M30 36 Q32 38 34 36" fill="none" stroke="#783e28" stroke-width="1.2" stroke-linecap="round"/>
      <!-- Cổ & Vòng ngọc đá -->
      <path d="M28 40 L28 45 L36 45 L36 40 Z" fill="#b8835d"/>
      <path d="M24 44 Q32 49 40 44" fill="none" stroke="#4a3628" stroke-width="2"/>
      <circle cx="32" cy="46.5" r="2.5" fill="#38b29a" stroke="#d5f5ee" stroke-width="0.8"/>
      <!-- Thân & Yếm da thú -->
      <path d="M19 60 Q22 47 32 47 Q42 47 45 60 Z" fill="#6d432b" stroke="#9e6644" stroke-width="1.5"/>
      <path d="M26 47 L32 54 L38 47" fill="#b07d57" opacity="0.6"/>`,
      className,
    );
  }

  // Nam Thổ Dân Tiền Sử (mặc định)
  return svg(
    `<!-- Nam Thợ Săn Tiền Sử -->
    <circle cx="32" cy="32" r="30" fill="#2b221a" stroke="#876847" stroke-width="2"/>
    <!-- Tóc sau & Bờm tóc -->
    <path d="M16 28 C15 42 20 54 23 58 C20 48 21 36 21 28 Z" fill="#18120e"/>
    <path d="M48 28 C49 42 44 54 41 58 C44 48 43 36 43 28 Z" fill="#18120e"/>
    <circle cx="32" cy="27" r="16" fill="#18120e"/>
    <!-- Lông vũ đại bàng đỏ cài trán -->
    <path d="M20 18 Q10 6 15 20 Q20 22 20 18 Z" fill="#c43d31" stroke="#f0887d" stroke-width="1"/>
    <path d="M22 20 Q16 12 18 24" fill="none" stroke="#fae1de" stroke-width="1"/>
    <!-- Mặt dũng mãnh -->
    <path d="M20 24 Q32 18 44 24 L42 36 Q32 44 22 36 Z" fill="#b88056"/>
    <!-- Mái tóc gợn tiền sử -->
    <path d="M19 23 Q27 16 33 22 Q39 16 45 23 Q38 18 32 19 Q25 18 19 23 Z" fill="#18120e"/>
    <!-- Băng trùm đầu da đan -->
    <path d="M19 22 Q32 18 45 22" fill="none" stroke="#5a3821" stroke-width="3"/>
    <path d="M20 22 Q32 18 44 22" fill="none" stroke="#d99343" stroke-width="1" stroke-dasharray="2 3"/>
    <!-- Lông mày rậm & Mắt sắc bén -->
    <path d="M24 26 L29 27" stroke="#18120e" stroke-width="2" stroke-linecap="round"/>
    <path d="M40 26 L35 27" stroke="#18120e" stroke-width="2" stroke-linecap="round"/>
    <circle cx="27" cy="29" r="1.5" fill="#18120e"/>
    <circle cx="37" cy="29" r="1.5" fill="#18120e"/>
    <!-- Sơn mặt chiến binh màu đất nung -->
    <path d="M23 32 L28 33 M23 34.5 L28 35.5" stroke="#c43d31" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M41 32 L36 33 M41 34.5 L36 35.5" stroke="#c43d31" stroke-width="1.6" stroke-linecap="round"/>
    <!-- Miệng cương nghị -->
    <path d="M29 38 H35" stroke="#632e1d" stroke-width="1.6" stroke-linecap="round"/>
    <!-- Cổ & Vòng nanh thú -->
    <path d="M27 41 L27 46 L37 46 L37 41 Z" fill="#a67149"/>
    <path d="M23 45 Q32 50 41 45" fill="none" stroke="#3d2617" stroke-width="2"/>
    <path d="M30 46 L32 51 L34 46 Z" fill="#f0ebe1"/>
    <path d="M26 44 L27 48 L29 45 Z" fill="#f0ebe1"/>
    <path d="M38 44 L37 48 L35 45 Z" fill="#f0ebe1"/>
    <!-- Thân & Da thú vắt chéo vai -->
    <path d="M17 60 Q21 47 32 47 Q43 47 47 60 Z" fill="#4d3522" stroke="#7a5538" stroke-width="1.5"/>
    <path d="M18 49 L46 60 L42 60 L18 53 Z" fill="#805634"/>`,
    className,
  );
}


