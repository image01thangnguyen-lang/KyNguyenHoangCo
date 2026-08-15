import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCarriedWeight,
  maxWeightCapacity,
  isOverburdened,
  checkFoodSpoilage,
  createSurvivalState,
  tickSurvival,
  createInitialFarmPlots,
  plantInPlot,
  fertilizePlot,
  waterPlot,
  harvestPlot,
  tickFarmPlots,
  tickTraps,
  hasBloodScent,
  playerCombatPower,
  resolveNightDefense,
} from '../src/index.ts';
import type { CampState } from '../src/index.ts';

describe('CƠ CHẾ PHẠT SINH TỒN & TƯƠNG TÁC SÂU', () => {
  it('1. Trọng lượng ba lô & Quá tải làm tụt Đói gấp đôi khi đi bộ', () => {
    const lightBag = { dry_branch: 5, sharp_stone: 5 }; // 5*1 + 5*1 = 10kg
    assert.equal(calculateCarriedWeight(lightBag), 10);
    assert.equal(isOverburdened(lightBag, 45), false);

    const heavyBag = { log: 15, stone_block: 10 }; // 15*3 + 10*4 = 85kg
    assert.equal(calculateCarriedWeight(heavyBag), 85);
    assert.equal(isOverburdened(heavyBag, 45), true);

    // Đi bộ 1.000 bước khi bình thường vs khi quá tải
    const now = Date.now();
    const state1 = createSurvivalState(now);
    const resNormal = tickSurvival(state1, now + 10 * 60_000, { steps: 1000, isOverburdened: false });

    const state2 = createSurvivalState(now);
    const resOverburdened = tickSurvival(state2, now + 10 * 60_000, { steps: 1000, isOverburdened: true });

    // Quá tải tiêu hao đói nhiều hơn
    assert.ok(resOverburdened.survival.satiety < resNormal.survival.satiety);
  });

  it('2. Thức ăn tươi sống để lâu bị ôi thiu & Bón phân luống đất', () => {
    const freshCarried = { raw_meat: 6, raw_fish: 4, dried_meat: 10 };
    // Dưới 36h: không bị ôi thiu
    const check1 = checkFoodSpoilage(freshCarried, 20);
    assert.equal(check1.spoiledCount, 0);
    assert.equal(check1.carried.raw_meat, 6);

    // Sau 40h: thịt tươi và cá tươi chuyển thành spoiled_meat
    const check2 = checkFoodSpoilage(freshCarried, 40);
    assert.equal(check2.spoiledCount, 10);
    assert.equal(check2.carried.raw_meat, undefined);
    assert.equal(check2.carried.raw_fish, undefined);
    assert.equal(check2.carried.spoiled_meat, 10);
    assert.equal(check2.carried.dried_meat, 10); // Thịt khô không bao giờ ôi thiu!

    // Bón phân cho luống đất nông trại
    let plots = createInitialFarmPlots(1);
    const now = Date.now();
    const plantRes = plantInPlot(plots, 0, 'wild_berry_crop', now);
    plots = plantRes.plots;

    const fertRes = fertilizePlot(plots, 0);
    assert.equal(fertRes.ok, true);
    assert.equal(fertRes.plots[0].fertilized, true);
  });

  it('3. Cây héo khi quá hạn 48h & Tưới nước hồi sinh cây', () => {
    let plots = createInitialFarmPlots(1);
    const now = 1000000;
    plots = plantInPlot(plots, 0, 'wild_berry_crop', now).plots;
    plots = waterPlot(plots, 0, now).plots;
    plots = waterPlot(plots, 0, now).plots;

    // Tiến thời gian qua lúc chín (4h) thêm 50h (tổng 54h) -> Cây bị héo
    const lateMs = now + 54 * 3600_000;
    plots = tickFarmPlots(plots, 1, lateMs, false);
    assert.equal(plots[0].readyToHarvest, true);
    assert.equal(plots[0].wilted, true);

    // Thu hoạch lúc héo bị giảm 50%
    const harvestWilted = harvestPlot(plots, 0);
    assert.equal(harvestWilted.ok, true);
    assert.ok(harvestWilted.rewards.wild_berry <= 4);

    // Nếu tưới nước trước khi thu hoạch -> Cây hồi sinh
    let plots2 = createInitialFarmPlots(1);
    plots2 = plantInPlot(plots2, 0, 'wild_berry_crop', now).plots;
    plots2 = waterPlot(plots2, 0, now).plots;
    plots2 = waterPlot(plots2, 0, now).plots;
    plots2 = tickFarmPlots(plots2, 1, lateMs, false);
    assert.equal(plots2[0].wilted, true);

    const revived = waterPlot(plots2, 0, lateMs);
    assert.equal(revived.plots[0].wilted, false);
  });

  it('4. Bẫy thú để quá 24h bị dã thú hoang cắn trộm 50% thịt', () => {
    const placedTime = 1000000;
    const initialTraps = [
      {
        id: 'trap_1',
        trapItemId: 'rabbit_trap' as const,
        nameVi: 'Bẫy thỏ',
        tier: 'small' as const,
        lat: 21.0,
        lon: 105.0,
        placedAtMs: placedTime,
        readyAtMs: placedTime + 2 * 3600_000,
        caughtItem: null,
        collected: false,
      },
    ];

    // Sau 3 giờ: bắt được thỏ nguyên vẹn
    const ticked1 = tickTraps(initialTraps, placedTime + 3 * 3600_000);
    assert.ok(ticked1[0].caughtItem !== null);
    assert.equal(ticked1[0].scavenged, false);
    const initialQty = ticked1[0].caughtItem.qty;

    // Để quên sau 30 giờ (quá 24h sau khi sập): bị dã thú ăn vụng 50%
    const ticked2 = tickTraps(ticked1, placedTime + 30 * 3600_000);
    assert.equal(ticked2[0].scavenged, true);
    assert.ok(ticked2[0].caughtItem.qty <= initialQty);
  });

  it('5. Kiệt sức khi thức đêm > 36h làm giảm 30% sức đánh, ngủ tại trại hồi phục', () => {
    const carried = { iron_spear: 1 };
    const normalPower = playerCombatPower(carried, 1, false);
    const fatiguedPower = playerCombatPower(carried, 1, true);

    assert.equal(Math.round(fatiguedPower), Math.round(normalPower * 0.7));

    // Ngủ tại trại xoá bỏ kiệt sức
    const now = Date.now();
    const state = createSurvivalState(now);
    state.fatiguedUntilMs = now + 4 * 3600_000;
    state.asleep = true;

    const res = tickSurvival(state, now + 60 * 60_000, { atCamp: true });
    assert.equal(res.survival.fatiguedUntilMs, null);
  });

  it('6. Mùi máu tươi (>= 10 thịt sống) tăng 40% đe doạ quái vật đêm', () => {
    const safeBag = { grilled_meat: 20, boiled_water: 5 };
    assert.equal(hasBloodScent(safeBag), false);

    const bloodyBag = { raw_meat: 12, raw_fish: 3 };
    assert.equal(hasBloodScent(bloodyBag), true);

    const camp: CampState = {
      level: 1,
      stations: ['fire_pit'],
      defenseStructures: {},
      upgradeCompleteAtMs: null,
      homeCell: null,
    };
    const now = new Date('2026-08-15T20:30:00+07:00').getTime();

    const normalDef = resolveNightDefense({
      camp,
      carried: safeBag,
      nowMs: now,
      online: true,
      rng: () => 0.5,
      ignoreWindow: true,
    });

    const bloodyDef = resolveNightDefense({
      camp,
      carried: bloodyBag,
      nowMs: now,
      online: true,
      rng: () => 0.5,
      ignoreWindow: true,
    });

    // Mùi máu làm tăng mức đe doạ quái vật
    assert.ok(bloodyDef.monsterThreat > normalDef.monsterThreat);
    assert.ok(bloodyDef.logVi.some((log) => log.includes('Mùi máu tươi')));
  });

  it('7. BẢO BỐI NPC: Ba Lô Da Voi tăng tải trọng lên 75kg', () => {
    const bagWithItem = { giant_backpack: 1, log: 15, stone_block: 5 }; // 15*3 + 5*4 + 1 = 66kg
    const maxCapacity = maxWeightCapacity([], bagWithItem);
    assert.equal(maxCapacity, 75); // 45 + 30
    assert.equal(isOverburdened(bagWithItem, maxCapacity), false); // 66kg < 75kg => Không quá tải!
  });

  it('8. BẢO BỐI NPC: Muối Mỏ Cổ Đại bảo quản thịt tươi suốt 7 ngày', () => {
    const saltedBag = { mineral_salt: 1, raw_meat: 10 };
    // Sau 3 ngày (72h): nếu có muối mỏ thì KHÔNG bị ôi thiu
    const check1 = checkFoodSpoilage(saltedBag, 72);
    assert.equal(check1.spoiledCount, 0);
    assert.equal(check1.carried.raw_meat, 10);
  });

  it('9. BẢO BỐI NPC: Chuông Tre bảo vệ bẫy thú không bị ăn vụng', () => {
    const placedTime = 1000000;
    const trap = {
      id: 'trap_chime',
      trapItemId: 'rabbit_trap' as const,
      nameVi: 'Bẫy thỏ',
      tier: 'small' as const,
      lat: 21.0,
      lon: 105.0,
      placedAtMs: placedTime,
      readyAtMs: placedTime + 2 * 3600_000,
      caughtItem: { itemId: 'raw_meat' as any, nameVi: 'Thịt', qty: 2 },
      collected: false,
    };

    // Để quên sau 48h nhưng có Chuông Tre (hasScareChime = true)
    const ticked = tickTraps([trap], placedTime + 48 * 3600_000, 1, true);
    assert.equal(ticked[0].scavenged, false);
    assert.equal(ticked[0].caughtItem?.qty, 2);
  });

  it('10. BẢO BỐI NPC: Túi Hương Ngải Cứu triệt tiêu Mùi Máu', () => {
    const bloodyBagWithPouch = { raw_meat: 20, raw_fish: 10, herb_scent_pouch: 1 };
    assert.equal(hasBloodScent(bloodyBagWithPouch), false);
  });
});
