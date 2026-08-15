/**
 * Hệ thống Mua Bán Thương Nhân NPC (NPC Merchant Trading System)
 * Tiền tệ: Đồng Vàng Cổ (ancient_coin) — có thể tích luỹ, an toàn không rơi khi thua đêm.
 * Chức năng:
 *  - Bán tài nguyên thu thập / săn bắn / chế tạo để kiếm Đồng Vàng Cổ.
 *  - Mua các vật phẩm quý hiếm, thuốc men, bản vẽ, hạt giống và linh thú bằng Đồng Vàng Cổ.
 */

                                                                 
import { addItems, removeItems, countOf, hasAll } from './inventory.js';

                           
             
                 
                 
                 
                    
              
                                                                     
                      
 

/** Danh mục hàng hoá NPC Thương Nhân chào bán */
export const NPC_SHOP_CATALOG             = [
  {
    id: 'shop_health_potion',
    itemId: 'health_potion',
    nameVi: 'Bình Hồi Máu',
    descVi: 'Hồi phục ngay 35 điểm thể lực/HP.',
    priceGold: 6,
    qty: 1,
    category: 'consumable',
  },
  {
    id: 'shop_greater_potion',
    itemId: 'greater_potion',
    nameVi: 'Bình Hồi Máu Lớn',
    descVi: 'Hồi phục ngay 70 điểm thể lực/HP.',
    priceGold: 12,
    qty: 1,
    category: 'consumable',
  },
  {
    id: 'shop_antidote',
    itemId: 'antidote',
    nameVi: 'Thuốc Giải Độc Trị Bệnh',
    descVi: 'Chữa lành cơn đau bụng do uống nước thô nhiễm khuẩn.',
    priceGold: 8,
    qty: 1,
    category: 'consumable',
  },
  {
    id: 'shop_dried_meat',
    itemId: 'dried_meat',
    nameVi: 'Thịt Khô Dự Trữ (x2)',
    descVi: 'Thịt hun khói bảo quản lâu, hồi 25 độ no mỗi miếng.',
    priceGold: 5,
    qty: 2,
    category: 'consumable',
  },
  {
    id: 'shop_seed_corn',
    itemId: 'seed_corn'          ,
    nameVi: 'Hạt Giống Ngô Rừng',
    descVi: 'Hạt giống quý gieo tại trại, cho bắp ngô giàu năng lượng.',
    priceGold: 4,
    qty: 2,
    category: 'seed',
  },
  {
    id: 'shop_seed_herb',
    itemId: 'seed_herb'          ,
    nameVi: 'Hạt Giống Dược Thảo',
    descVi: 'Cây thuốc quý dùng để bào chế linh dược hồi máu.',
    priceGold: 5,
    qty: 2,
    category: 'seed',
  },
  {
    id: 'shop_iron_axe',
    itemId: 'iron_axe',
    nameVi: 'Rìu Sắt Thượng Đẳng',
    descVi: 'Lưỡi rìu rèn từ sắt non, đốn gỗ nhanh gấp 1.8 lần và cực bền.',
    priceGold: 22,
    qty: 1,
    category: 'tool',
  },
  {
    id: 'shop_bow',
    itemId: 'bow',
    nameVi: 'Cung Tên Thợ Săn',
    descVi: 'Vũ khí tầm xa uy lực tiêu diệt dã thú và boss Trăng Máu.',
    priceGold: 18,
    qty: 1,
    category: 'tool',
  },
  {
    id: 'shop_arrows',
    itemId: 'arrow',
    nameVi: 'Bó Mũi Tên Săn (x15)',
    descVi: 'Mũi tên bịt đồng sắc bén dành cho Cung.',
    priceGold: 6,
    qty: 15,
    category: 'tool',
  },
  {
    id: 'shop_egg_forest',
    itemId: 'egg_forest',
    nameVi: 'Trứng Linh Thú Rừng Cổ',
    descVi: 'Quả trứng cổ sinh phát sáng. Đi bộ 3.000 bước để ấp nở linh thú!',
    priceGold: 28,
    qty: 1,
    category: 'special',
  },
  {
    id: 'shop_egg_mountain',
    itemId: 'egg_mountain',
    nameVi: 'Trứng Thạch Cốt Sơn',
    descVi: 'Trứng voi ma mút cổ đại. Đi bộ 5.000 bước để ấp nở trợ thủ phòng ngự!',
    priceGold: 35,
    qty: 1,
    category: 'special',
  },
  {
    id: 'shop_blueprint',
    itemId: 'blueprint',
    nameVi: 'Bản Vẽ Chế Tạo Cổ Xưa',
    descVi: 'Mở khoá các công thức công trình phòng thủ và lò luyện kim.',
    priceGold: 25,
    qty: 1,
    category: 'blueprint',
  },
  {
    id: 'shop_upgrade_core',
    itemId: 'upgrade_core',
    nameVi: 'Lõi Nâng Cấp Doanh Trại',
    descVi: 'Tinh thể quý giá gia cố lều trại thành Nhà Sàn Gỗ & Pháo Đài Đá.',
    priceGold: 40,
    qty: 1,
    category: 'special',
  },
];

/** Bảng giá NPC thu mua tài nguyên từ túi người chơi (quy đổi ra Đồng Vàng Cổ) */
export const ITEM_SELL_PRICES                         = {
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

                              
                   
                    
                      
                     
 

/**
 * Người chơi mua một vật phẩm từ NPC Thương Nhân bằng Đồng Vàng Cổ
 */
export function buyItemFromNpc(player             , shopItemId        )              {
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

  const updatedPlayer              = {
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
export function sellItemToNpc(player             , itemId        , qty         = 1)              {
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

  const updatedPlayer              = {
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
