import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buyItemFromNpc,
  sellItemToNpc,
  NPC_SHOP_CATALOG,
  ITEM_SELL_PRICES,
  createProfile,
  addItems,
  countOf,
} from '../src/index.js';

test('THƯƠNG NHÂN NPC: Bán tài nguyên kiếm Đồng Vàng Cổ', () => {
  let player = createProfile('Thợ Săn', 1000).player;
  
  // Thêm 5 thịt nướng và 2 quặng vàng vào túi
  player.carried = addItems(player.carried, [
    { itemId: 'grilled_meat', qty: 5 },
    { itemId: 'gold_ore', qty: 2 },
  ]);

  assert.equal(countOf(player.carried, 'ancient_coin'), 0);

  // Bán 3 thịt nướng (giá 2 vàng / miếng = 6 vàng)
  const sell1 = sellItemToNpc(player, 'grilled_meat', 3);
  assert.equal(sell1.success, true);
  assert.equal(sell1.goldChange, 6);
  player = sell1.player;

  assert.equal(countOf(player.carried, 'grilled_meat'), 2);
  assert.equal(countOf(player.carried, 'ancient_coin'), 6);

  // Bán 2 quặng vàng (giá 4 vàng / quặng = 8 vàng)
  const sell2 = sellItemToNpc(player, 'gold_ore', 2);
  assert.equal(sell2.success, true);
  assert.equal(sell2.goldChange, 8);
  player = sell2.player;

  assert.equal(countOf(player.carried, 'gold_ore'), 0);
  assert.equal(countOf(player.carried, 'ancient_coin'), 14);
});

test('THƯƠNG NHÂN NPC: Bán đồ không hợp lệ hoặc không đủ số lượng', () => {
  const player = createProfile('Thợ Săn', 1000).player;
  
  // Bán đồ không có trong túi
  const res1 = sellItemToNpc(player, 'iron_sword', 1);
  assert.equal(res1.success, false);

  // Bán số lượng <= 0
  const res2 = sellItemToNpc(player, 'ancient_coin', 0);
  assert.equal(res2.success, false);
});

test('THƯƠNG NHÂN NPC: Mua vật phẩm từ NPC bằng Đồng Vàng Cổ', () => {
  let player = createProfile('Thợ Săn', 1000).player;
  
  // Cho người chơi 50 Đồng Vàng Cổ
  player.carried = addItems(player.carried, [{ itemId: 'ancient_coin', qty: 50 }]);

  // Mua Bình Hồi Máu (giá 6 vàng)
  const buy1 = buyItemFromNpc(player, 'shop_health_potion');
  assert.equal(buy1.success, true);
  assert.equal(buy1.goldChange, -6);
  player = buy1.player;

  assert.equal(countOf(player.carried, 'health_potion'), 1);
  assert.equal(countOf(player.carried, 'ancient_coin'), 44);

  // Mua Trứng Linh Thú Rừng Cổ (giá 28 vàng)
  const buy2 = buyItemFromNpc(player, 'shop_egg_forest');
  assert.equal(buy2.success, true);
  assert.equal(buy2.goldChange, -28);
  player = buy2.player;

  assert.equal(countOf(player.carried, 'egg_forest'), 1);
  assert.equal(countOf(player.carried, 'ancient_coin'), 16);

  // Mua Rìu Sắt (giá 22 vàng) trong khi chỉ còn 16 vàng -> Thất bại
  const buy3 = buyItemFromNpc(player, 'shop_iron_axe');
  assert.equal(buy3.success, false);
  assert.match(buy3.messageVi, /Không đủ Đồng Vàng Cổ/);
  assert.equal(countOf(player.carried, 'ancient_coin'), 16);
});
