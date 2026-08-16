import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDynamicBeastPack,
  updateDynamicBeastPacks,
  huntDynamicBeastPack,
  huntDynamicBeastRanged,
  createProfile,
} from '../src/index.js';

describe('HỆ THỐNG DÃ THÚ TRUY ĐUỔI TRONG PHẠM VI & SĂN BẮT SINH TỒN', () => {
  it('1. Khởi tạo thuộc tính và bảng chiến lợi phẩm (Loot Table) cho các loài dã thú', () => {
    const wolf = createDynamicBeastPack('wolf_1', 'wolf', 100, 200);
    assert.equal(wolf.species, 'wolf');
    assert.equal(wolf.isPredator, true);
    assert.equal(wolf.maxHp, 160);
    assert.equal(wolf.currentHp, 160);
    assert.equal(wolf.aggroRadiusMeters, 25.0);
    assert.equal(wolf.leashRadiusMeters, 45.0);
    assert.ok(wolf.lootTable.some(item => item.itemId === 'raw_meat'));
    assert.ok(wolf.lootTable.some(item => item.itemId === 'leather'));

    const deer = createDynamicBeastPack('deer_1', 'deer', 300, 400);
    assert.equal(deer.species, 'deer');
    assert.equal(deer.isPredator, false);
    assert.equal(deer.maxHp, 80);
    assert.ok(deer.lootTable.some(item => item.itemId === 'raw_meat'));

    const mammoth = createDynamicBeastPack('mammoth_1', 'mammoth', 500, 600);
    assert.equal(mammoth.maxHp, 600);
    assert.ok(mammoth.lootTable.some(item => item.itemId === 'raw_meat'));
    assert.ok(mammoth.lootTable.some(item => item.itemId === 'leather'));
  });

  it('2. Dã thú kích động (Aggro) và truy đuổi dũng sĩ khi vào bán kính phát hiện (<= 25m)', () => {
    const wolf = createDynamicBeastPack('wolf_aggro', 'wolf', 0, 0);
    const packs = new Map([['wolf_aggro', wolf]]);

    // Người chơi đứng cách 15m (trong tầm 25m)
    const playerX = 15;
    const playerY = 0;

    updateDynamicBeastPacks(packs, playerX, playerY, 1.0, 1000);

    assert.equal(wolf.isAggro, true);
    assert.equal(wolf.isChasing, true);
    // Vị trí sói phải di chuyển lại gần người chơi (currentWorldX > 0)
    assert.ok(wolf.currentWorldX > 0);
    assert.ok(wolf.currentWorldX < 15);
  });

  it('3. Dã thú ngừng truy đuổi và quay về tổ khi người chơi chạy thoát ra ngoài phạm vi lãnh địa (Leash Range > 45m)', () => {
    const wolf = createDynamicBeastPack('wolf_leash', 'wolf', 0, 0);
    const packs = new Map([['wolf_leash', wolf]]);

    // Giả lập sói đã bị kéo ra xa 40m
    wolf.currentWorldX = 40;
    wolf.currentWorldY = 0;
    wolf.isAggro = true;
    wolf.isChasing = true;

    // Người chơi chạy xa tít tắp 80m (vượt quá bán kính Leash 45m từ tổ gốc)
    const playerX = 80;
    const playerY = 0;

    updateDynamicBeastPacks(packs, playerX, playerY, 1.0, 2000);

    assert.equal(wolf.isAggro, false);
    assert.equal(wolf.isChasing, false);
    // Sói phải quay đầu di chuyển ngược về tổ 0,0 (currentWorldX giảm dần < 40)
    assert.ok(wolf.currentWorldX < 40);
  });

  it('4. Dã thú tấn công cắn xé người chơi khi vào cự ly cận chiến (<= 6m)', () => {
    const wolf = createDynamicBeastPack('wolf_bite', 'wolf', 0, 0);
    const packs = new Map([['wolf_bite', wolf]]);

    wolf.currentWorldX = 4;
    wolf.currentWorldY = 0;

    let attackTriggered = false;
    let damageDealt = 0;

    updateDynamicBeastPacks(packs, 5, 0, 0.5, 3000, (_beast, dmg) => {
      attackTriggered = true;
      damageDealt = dmg;
    });

    assert.equal(attackTriggered, true);
    assert.equal(damageDealt, wolf.damage);
  });

  it('5. Thú ăn cỏ (Hươu sao) bỏ chạy (Flee) khi người chơi lại gần', () => {
    const deer = createDynamicBeastPack('deer_flee', 'deer', 0, 0);
    const packs = new Map([['deer_flee', deer]]);

    // Người chơi đứng ở tọa độ (5, 0)
    updateDynamicBeastPacks(packs, 5, 0, 1.0, 4000);

    assert.equal(deer.isFleeing, true);
    // Hươu phải chạy ngược hướng người chơi (currentWorldX < 0)
    assert.ok(deer.currentWorldX < 0);
  });

  it('6. Người chơi tấn công và săn bắt dã thú thành công, thu về Thịt Tươi 🥩 và Da Thú 🦣', () => {
    const profile = createProfile('Dũng Sĩ Tiền Sử', 1000, 'male');
    const wolf = createDynamicBeastPack('wolf_hunt', 'wolf', 10, 10);

    // Trang bị rìu đá
    profile.player.carried['stone_axe'] = 1;

    // Đòn 1: Gây sát thương
    const hit1 = huntDynamicBeastPack(wolf, profile.player, 5000);
    assert.equal(hit1.ok, true);
    assert.ok(hit1.damageDealt >= 15);
    assert.equal(hit1.isDefeated, false);
    assert.ok(wolf.currentHp < wolf.maxHp);

    // Đòn 2..4: Đánh đến khi hạ gục hoàn toàn
    wolf.currentHp = 10;
    const finalHit = huntDynamicBeastPack(wolf, hit1.nextPlayer, 5100);

    assert.equal(finalHit.ok, true);
    assert.equal(finalHit.isDefeated, true);
    assert.equal(finalHit.beastRemainingHp, 0);
    assert.ok(finalHit.lootGained && finalHit.lootGained.length > 0);

    // Kiểm tra túi đồ người chơi đã được nhận Thịt Tươi
    const meatCount = finalHit.nextPlayer.carried['raw_meat'] ?? 0;
    assert.ok(meatCount >= 1, `Người chơi phải nhận được ít nhất 1 Thịt tươi, thực tế: ${meatCount}`);
  });

  it('7. Người chơi Bắn Cung từ xa tiêu hao Mũi Tên và gây sát thương cân bằng (28-42 DMG)', () => {
    const profile = createProfile('Cung Thủ Lạc Việt', 1000, 'female');
    const lion = createDynamicBeastPack('lion_range', 'lion', 20, 20);

    // Chuẩn bị Cung và 5 Mũi Tên
    profile.player.carried['bow'] = 1;
    profile.player.carried['arrow'] = 5;

    const shot1 = huntDynamicBeastRanged(lion, profile.player, 6000, 'bow');
    assert.equal(shot1.ok, true);
    assert.equal(shot1.weaponUsed, 'bow');
    assert.equal(shot1.ammoConsumed, 'arrow');
    assert.ok(shot1.damageDealt >= 26, `Sát thương bắn cung phải >= 26, thực tế: ${shot1.damageDealt}`);
    assert.equal(shot1.nextPlayer.carried['arrow'], 4, 'Số lượng mũi tên phải giảm từ 5 xuống 4');
    assert.equal(lion.isAggro, true, 'Dã thú bị bắn trúng phải kích động đuổi theo');
  });

  it('8. Người chơi Ném Đá Nhọn từ xa khi không có Cung, tiêu hao 1 Đá Nhọn', () => {
    const profile = createProfile('Dũng Sĩ Tiền Sử', 1000, 'male');
    const boar = createDynamicBeastPack('boar_range', 'boar', 20, 20);

    // Chỉ có 3 Đá Nhọn, không có Cung
    profile.player.carried['sharp_stone'] = 3;

    const throw1 = huntDynamicBeastRanged(boar, profile.player, 7000, 'stone');
    assert.equal(throw1.ok, true);
    assert.equal(throw1.weaponUsed, 'stone');
    assert.equal(throw1.ammoConsumed, 'sharp_stone');
    assert.ok(throw1.damageDealt >= 11, `Sát thương ném đá phải >= 11, thực tế: ${throw1.damageDealt}`);
    assert.equal(throw1.nextPlayer.carried['sharp_stone'], 2, 'Số đá nhọn phải giảm từ 3 xuống 2');
    assert.equal(boar.isAggro, true);
  });
});

