/**
 * Hệ thống Mua Bán Thương Nhân NPC (NPC Merchant Trading System)
 * Tiền tệ: Đồng Vàng Cổ (ancient_coin) — có thể tích luỹ, an toàn không rơi khi thua đêm.
 * Chức năng:
 *  - Bán tài nguyên thu thập / săn bắn / chế tạo để kiếm Đồng Vàng Cổ.
 *  - Mua các vật phẩm quý hiếm, thuốc men, bản vẽ, hạt giống và linh thú bằng Đồng Vàng Cổ.
 */

import type { ItemId, ItemStack, PlayerState } from './types.ts';
import { addItems, removeItems, countOf, hasAll } from './inventory.ts';

export interface ShopItem {
  id: string;
  itemId: ItemId;
  nameVi: string;
  tagVi?: string;
  descVi: string;
  priceGold: number;
  qty: number;
  category: 'consumable' | 'tool' | 'seed' | 'blueprint' | 'special';
  stockDaily?: number;
}

/** Danh mục hàng hoá NPC Thương Nhân chào bán */
export const NPC_SHOP_CATALOG: ShopItem[] = [
  // --- 1. Nhu yếu phẩm & Thuốc men cơ bản ---
  {
    id: 'shop_health_potion',
    itemId: 'health_potion',
    nameVi: 'Bình Hồi Máu',
    tagVi: '❤️ HỒI 35 HP',
    descVi: 'Hồi phục ngay 35 điểm thể lực/HP.',
    priceGold: 6,
    qty: 1,
    category: 'consumable',
  },
  {
    id: 'shop_greater_potion',
    itemId: 'greater_potion',
    nameVi: 'Bình Hồi Máu Lớn',
    tagVi: '❤️ HỒI 70 HP',
    descVi: 'Hồi phục ngay 70 điểm thể lực/HP.',
    priceGold: 12,
    qty: 1,
    category: 'consumable',
  },
  {
    id: 'shop_antidote',
    itemId: 'antidote',
    nameVi: 'Thuốc Giải Độc Trị Bệnh',
    tagVi: '💊 CHỮA BỆNH ĐAU BỤNG',
    descVi: 'Chữa lành cơn đau bụng do uống nước thô nhiễm khuẩn.',
    priceGold: 8,
    qty: 1,
    category: 'consumable',
  },
  {
    id: 'shop_dried_meat',
    itemId: 'dried_meat',
    nameVi: 'Thịt Khô Dự Trữ (x2)',
    tagVi: '🍗 HỒI 25 ĐÓI / MIẾNG',
    descVi: 'Thịt hun khói bảo quản vĩnh viễn, hồi 25 độ no mỗi miếng.',
    priceGold: 5,
    qty: 2,
    category: 'consumable',
  },

  // --- 2. Hạt giống & Nông nghiệp ---
  {
    id: 'shop_seed_corn',
    itemId: 'seed_corn' as ItemId,
    nameVi: 'Hạt Giống Ngô Rừng',
    tagVi: '🌱 NÔNG NGHIỆP',
    descVi: 'Hạt giống quý gieo tại trại, cho bắp ngô giàu năng lượng.',
    priceGold: 4,
    qty: 2,
    category: 'seed',
  },
  {
    id: 'shop_seed_herb',
    itemId: 'seed_herb' as ItemId,
    nameVi: 'Hạt Giống Dược Thảo',
    tagVi: '🌱 DƯỢC LIỆU',
    descVi: 'Cây thuốc quý dùng để bào chế linh dược hồi máu.',
    priceGold: 5,
    qty: 2,
    category: 'seed',
  },

  // --- 3. Bảo bối hoá giải cơ chế phạt & Sinh tồn nâng cao ---
  {
    id: 'shop_giant_backpack',
    itemId: 'giant_backpack' as ItemId,
    nameVi: 'Ba Lô Da Voi Thượng Hạng',
    tagVi: '⚖️ +30KG TẢI TRỌNG',
    descVi: 'Tăng vĩnh viễn sức chứa ba lô từ 45kg ➜ 75kg (+30kg). Không còn lo quá tải khi chặt gỗ, đào đá.',
    priceGold: 45,
    qty: 1,
    category: 'tool',
  },
  {
    id: 'shop_mineral_salt',
    itemId: 'mineral_salt' as ItemId,
    nameVi: 'Túi Muối Mỏ Cổ Đại (x5)',
    tagVi: '🍖 ƯỚP THỊT 7 NGÀY',
    descVi: 'Tẩm ướp thịt sống và cá tươi trong túi, kéo dài độ tươi ngon lên 7 ngày (thay vì 36h) không lo ôi thiu.',
    priceGold: 12,
    qty: 5,
    category: 'consumable',
  },
  {
    id: 'shop_rain_fur_cloak',
    itemId: 'rain_fur_cloak' as ItemId,
    nameVi: 'Áo Tơi Lá Cọ Cổ Điển',
    tagVi: '🌧️ MIỄN NHIỄM CẢM LẠNH',
    descVi: 'Miễn nhiễm 100% cảm lạnh khi đi bộ dưới trời mưa to. Đi mưa không bị tụt thêm độ đói.',
    priceGold: 20,
    qty: 1,
    category: 'tool',
  },
  {
    id: 'shop_sun_hat',
    itemId: 'sun_hat' as ItemId,
    nameVi: 'Nón Lá Rừng Rậm',
    tagVi: '☀️ MIỄN NHIỄM SAY NẮNG',
    descVi: 'Che chắn nắng gắt. Miễn nhiễm 100% say nắng vào khung giờ trưa gắt 11:00 – 14:00.',
    priceGold: 18,
    qty: 1,
    category: 'tool',
  },
  {
    id: 'shop_ginger_tea',
    itemId: 'ginger_tea' as ItemId,
    nameVi: 'Trà Gừng Nóng Giữ Nhiệt (x3)',
    tagVi: '🍵 GIẢI CẢM TỨC THÌ',
    descVi: 'Uống vào giải sạch cơn cảm lạnh do dầm mưa ngay tức khắc, hồi 35 nước và giữ ấm cơ thể trong 6 giờ.',
    priceGold: 8,
    qty: 3,
    category: 'consumable',
  },
  {
    id: 'shop_bamboo_scare_chime',
    itemId: 'bamboo_scare_chime' as ItemId,
    nameVi: 'Chuông Tre Đuổi Quạ',
    tagVi: '🔔 BẢO VỆ BẪY 100%',
    descVi: 'Bảo hộ bẫy săn ngoài đời. Dù để quên quá 24h – 48h cũng không bị quạ/dã thú ăn vụng mất thịt.',
    priceGold: 15,
    qty: 1,
    category: 'tool',
  },
  {
    id: 'shop_traveler_bedroll',
    itemId: 'traveler_bedroll' as ItemId,
    nameVi: 'Túi Ngủ Dã Ngoại Gấp Gọn',
    tagVi: '⛺ NGỦ MỌI NƠI NGOÀI TRỜI',
    descVi: 'Cho phép bạn bấm "Đi Ngủ" hồi phục thể lực & giải kiệt sức tại bất kỳ đâu ngoài trời mà không cần về Trại.',
    priceGold: 30,
    qty: 1,
    category: 'tool',
  },
  {
    id: 'shop_divine_tea',
    itemId: 'divine_tea' as ItemId,
    nameVi: 'Trà Cổ Thụ Thần Nông (x2)',
    tagVi: '☕ ĐẬP TAN KIỆT SỨC',
    descVi: 'Uống vào đập tan ngay trạng thái Kiệt Sức do thức đêm quá 36h, hồi 40 nước mà không cần ngủ.',
    priceGold: 10,
    qty: 2,
    category: 'consumable',
  },
  {
    id: 'shop_herb_scent_pouch',
    itemId: 'herb_scent_pouch' as ItemId,
    nameVi: 'Túi Hương Ngải Cứu Khử Mùi',
    tagVi: '🌿 TRIỆT TIÊU MÙI MÁU',
    descVi: 'Túi hương thảo mộc át mùi máu tanh. Thoải mái mang nhiều thịt sống đêm 20:00 mà không sợ quái tràn vào.',
    priceGold: 15,
    qty: 1,
    category: 'tool',
  },
  {
    id: 'shop_beast_repellent_powder',
    itemId: 'beast_repellent_powder' as ItemId,
    nameVi: 'Bột Lưu Huỳnh Xua Quái (x2)',
    tagVi: '🔥 GIẢM 30% ĐE DỌA ĐÊM',
    descVi: 'Rắc quanh hàng rào Doanh Trại trước 20:00 giúp xua đuổi dã thú, giảm 30% sức tấn công của bầy quái đêm.',
    priceGold: 18,
    qty: 2,
    category: 'consumable',
  },

  // --- 4. Vũ khí, Công cụ & Linh thú, Bản vẽ quý ---
  {
    id: 'shop_iron_axe',
    itemId: 'iron_axe',
    nameVi: 'Rìu Sắt Thượng Đẳng',
    tagVi: '🪓 CHẶT GỖ x1.8',
    descVi: 'Lưỡi rìu rèn từ sắt non, đốn gỗ nhanh gấp 1.8 lần và cực bền.',
    priceGold: 22,
    qty: 1,
    category: 'tool',
  },
  {
    id: 'shop_bow',
    itemId: 'bow',
    nameVi: 'Cung Tên Thợ Săn',
    tagVi: '🏹 TẦM XA +14 CÔNG',
    descVi: 'Vũ khí tầm xa uy lực tiêu diệt dã thú và boss Trăng Máu.',
    priceGold: 18,
    qty: 1,
    category: 'tool',
  },
  {
    id: 'shop_arrows',
    itemId: 'arrow',
    nameVi: 'Bó Mũi Tên Săn (x15)',
    tagVi: '🎯 ĐẠN CUNG',
    descVi: 'Mũi tên bịt đồng sắc bén dành cho Cung.',
    priceGold: 6,
    qty: 15,
    category: 'tool',
  },
  {
    id: 'shop_egg_forest',
    itemId: 'egg_forest',
    nameVi: 'Trứng Linh Thú Rừng Cổ',
    tagVi: '🥚 ẤP 3.000 BƯỚC',
    descVi: 'Quả trứng cổ sinh phát sáng. Đi bộ 3.000 bước để ấp nở linh thú!',
    priceGold: 28,
    qty: 1,
    category: 'special',
  },
  {
    id: 'shop_egg_mountain',
    itemId: 'egg_mountain',
    nameVi: 'Trứng Thạch Cốt Sơn',
    tagVi: '🥚 ẤP 5.000 BƯỚC',
    descVi: 'Trứng voi ma mút cổ đại. Đi bộ 5.000 bước để ấp nở trợ thủ phòng ngự!',
    priceGold: 35,
    qty: 1,
    category: 'special',
  },
  {
    id: 'shop_blueprint',
    itemId: 'blueprint',
    nameVi: 'Bản Vẽ Chế Tạo Cổ Xưa',
    tagVi: '📜 CÔNG TRÌNH HIẾM',
    descVi: 'Mở khoá các công thức công trình phòng thủ và lò luyện kim.',
    priceGold: 25,
    qty: 1,
    category: 'blueprint',
  },
  {
    id: 'shop_upgrade_core',
    itemId: 'upgrade_core',
    nameVi: 'Lõi Nâng Cấp Doanh Trại',
    tagVi: '💎 NÂNG CẤP TRẠI',
    descVi: 'Tinh thể quý giá gia cố lều trại thành Nhà Sàn Gỗ & Pháo Đài Đá.',
    priceGold: 40,
    qty: 1,
    category: 'special',
  },
];

/** Bảng giá NPC thu mua tài nguyên từ túi người chơi (quy đổi ra Đồng Vàng Cổ) */
export const ITEM_SELL_PRICES: Record<string, number> = {
  // Thực phẩm & Săn bắn
  raw_meat: 2,
  grilled_meat: 4,
  dried_meat: 3,
  raw_fish: 2,
  grilled_fish: 3,
  wild_berry: 1,
  red_mushroom: 2,
  crop_corn: 3,
  crop_herb: 4,
  crop_root: 2,

  // Nguyên liệu khoáng sản & Thu thập
  gold_ore: 12,
  iron_ore: 3,
  iron_ingot: 8,
  coal: 2,
  leather: 4,
  log: 1,
  stone_block: 1,
  fired_brick: 3,
  clay: 1,
  rope: 2,
  fiber: 1,
  dry_branch: 1,
  sharp_stone: 1,
  vine: 1,

  // Bẫy & Vũ khí
  rabbit_trap: 3,
  deer_trap: 6,
  beast_trap: 10,
  spike_trap: 5,
  stone_spear: 4,
  iron_spear: 12,
  iron_sword: 16,
  wooden_shield: 4,
  iron_shield: 10,
  torch: 2,
};

export interface TradeResult {
  success: boolean;
  messageVi: string;
  player: PlayerState;
  goldChange: number;
}

/**
 * Người chơi mua một vật phẩm từ NPC Thương Nhân bằng Đồng Vàng Cổ
 */
export function buyItemFromNpc(player: PlayerState, shopItemId: string): TradeResult {
  const shopItem = NPC_SHOP_CATALOG.find((i) => i.id === shopItemId);
  if (!shopItem) {
    return { success: false, messageVi: 'Vật phẩm không tồn tại trong tiệm.', player, goldChange: 0 };
  }

  const currentGold = countOf(player.carried, 'ancient_coin');
  if (currentGold < shopItem.priceGold) {
    return {
      success: false,
      messageVi: `Không đủ Đồng Vàng Cổ! Cần ${shopItem.priceGold} 🪙 (Hiện có: ${currentGold} 🪙). Hãy bán bớt đồ để kiếm thêm vàng!`,
      player,
      goldChange: 0,
    };
  }

  // Trừ vàng
  const nextCarried = removeItems(player.carried, [{ itemId: 'ancient_coin', qty: shopItem.priceGold }]);
  // Thêm đồ mua vào túi
  const finalCarried = addItems(nextCarried, [{ itemId: shopItem.itemId, qty: shopItem.qty }]);

  const updatedPlayer: PlayerState = {
    ...player,
    carried: finalCarried,
  };

  return {
    success: true,
    messageVi: `Mua thành công ${shopItem.qty}x ${shopItem.nameVi} với giá ${shopItem.priceGold} 🪙!`,
    player: updatedPlayer,
    goldChange: -shopItem.priceGold,
  };
}

/**
 * Người chơi bán một vật phẩm từ túi cho NPC Thương Nhân để nhận Đồng Vàng Cổ
 */
export function sellItemToNpc(player: PlayerState, itemId: ItemId, qty: number = 1): TradeResult {
  if (qty <= 0) return { success: false, messageVi: 'Số lượng không hợp lệ.', player, goldChange: 0 };

  const unitPrice = ITEM_SELL_PRICES[itemId];
  if (!unitPrice || unitPrice <= 0) {
    return { success: false, messageVi: 'Thương nhân không thu mua loại vật phẩm này.', player, goldChange: 0 };
  }

  const countHave = countOf(player.carried, itemId);
  if (countHave < qty) {
    return { success: false, messageVi: `Không đủ số lượng trong túi (Có: ${countHave}, Muốn bán: ${qty}).`, player, goldChange: 0 };
  }

  const totalGold = unitPrice * qty;

  // Trừ vật phẩm bán
  const nextCarried = removeItems(player.carried, [{ itemId, qty }]);
  // Thêm Đồng Vàng Cổ vào túi
  const finalCarried = addItems(nextCarried, [{ itemId: 'ancient_coin', qty: totalGold }]);

  const updatedPlayer: PlayerState = {
    ...player,
    carried: finalCarried,
  };

  return {
    success: true,
    messageVi: `Đã bán ${qty}x vật phẩm và nhận được +${totalGold} Đồng Vàng Cổ 🪙!`,
    player: updatedPlayer,
    goldChange: totalGold,
  };
}
