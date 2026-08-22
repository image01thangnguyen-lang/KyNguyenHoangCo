export const ROLE_INFO = {
  LUMBERJACK: { name: 'Tiều Phu', icon: '🪓', rate: '+12 Gỗ / giờ', desc: 'Đốn hạ đại thụ xung quanh trại để tích lũy gỗ', toolName: 'Rìu Đốn Củi', maxDurability: 100 },
  MINER: { name: 'Thợ Mỏ', icon: '⛏️', rate: '+8 Đá / giờ', desc: 'Khai thác mỏ đá và quặng thô ở sườn đồi', toolName: 'Cuốc Khai Khoáng', maxDurability: 100 },
  FORAGER: { name: 'Hái Lượm', icon: '🌿', rate: '+4 Dược & +2 Thịt / giờ', desc: 'Thu gom nấm dại, thảo dược và quả rừng', toolName: 'Liềm Hái Cổ', maxDurability: 100 },
  RESTING: { name: 'Nghỉ Ngơi', icon: '💤', rate: '0 / giờ (Không mòn công cụ)', desc: 'Tĩnh dưỡng tại trại, giảm 50% tiêu thụ lương thực', toolName: 'Không trang bị', maxDurability: 100 }
};

export const ERA_CONFIG = {
  1: { name: 'Đời I: Tiền Đồn Lều Tranh', maxPop: 3, nextEra: 2, nextCost: { wood: 50, stone: 30, food: 30, gold: 100 }, modelEra: 1 },
  2: { name: 'Đời II: Doanh Trại Đồ Đồng', maxPop: 6, nextEra: 3, nextCost: { wood: 150, stone: 100, food: 80, gold: 300 }, modelEra: 2 },
  3: { name: 'Đời III: Pháo Đài Đồ Sắt', maxPop: 10, nextEra: 4, nextCost: { wood: 350, stone: 250, food: 200, gold: 800 }, modelEra: 3 },
  4: { name: 'Đời IV: Hoàng Thành Cự Thạch (Đỉnh Cao)', maxPop: 15, nextEra: null, nextCost: null, modelEra: 4 }
};

export const WEAPON_TIERS = {
  1: { tier: 1, name: 'Giáo Gỗ Tiền Sử', icon: '🪵', atk: 25, cost: null, glowColor: 0x8b5a2b, modelFile: 'wooden_spear.fbx' },
  2: { tier: 2, name: 'Giáo Đá Mài Nhọn', icon: '🪨', atk: 45, cost: { stone: 15, wood: 10, gold: 50 }, glowColor: 0x94a3b8, modelFile: 'stone_spear.fbx' },
  3: { tier: 3, name: 'Đại Đao Răng Khủng Long', icon: '🗡️', atk: 80, cost: { raptorFang: 3, wood: 20, gold: 150 }, glowColor: 0x38bdf8, bonusHp: 50, modelFile: 'dino_blade.fbx' },
  4: { tier: 4, name: 'Trọng Thương Xương Tam Sừng', icon: '🔱', atk: 135, cost: { triHorn: 2, stone: 35, gold: 350 }, glowColor: 0xa855f7, bonusHp: 120, modelFile: 'tri_spear.fbx' },
  5: { tier: 5, name: 'Thần Binh Hoàng Đế Bạo Long (T-Rex Godblade)', icon: '👑⚔️', atk: 250, cost: { trexTooth: 1, gold: 800, wood: 50, stone: 50 }, glowColor: 0xf59e0b, bonusHp: 300, modelFile: 'trex_godblade.fbx' }
};

export const GameState = {
  started: false,
  playTimeSeconds: 0,
  harvestMultiplier: 1.0,
  bloodMoonActive: false,
  bloodMoonDefended: false,
  petActive: true,
  transitExpedition: { active: false, timer: 0, lastRewardTime: 0 },
  player: {
    gender: 'male',
    hp: 100,
    maxHp: 100,
    hunger: 100,
    thirst: 100,
    stamina: 100,
    maxStamina: 100,
    speed: 5.2,
    attackPower: 25,
    armor: 0,
    weaponLevel: 1,
    weaponName: 'Giáo Gỗ Tiền Sử',
    isAttacking: false,
    attackTimer: 0,
    isPickingUp: false,
    pickupTimer: 0,
    isHitReacting: false,
    hitTimer: 0,
    isDead: false,
    isDodging: false,
    dodgeTimer: 0,
    dodgeDir: null,
    isSprinting: false,
    facingAngle: 0,
    moving: false,
    currentAnimName: 'idle',
    group: null,
    characters: {
      male: {
        type: 'fbx',
        files: {
          idle: 'warrior_idle.fbx',
          walk: 'warrior_walk.fbx',
          run: 'warrior_run.fbx',
          dodge: 'warrior_dodge_roll.fbx',
          attack: 'warrior_attack.fbx',
          death: 'warrior_death.fbx',
          pickup: 'warrior_picking_up.fbx',
          hit: 'warrior_hit_reaction.fbx'
        },
        targetHeight: 1.85,
        model: null,
        mixer: null,
        actions: {},
        currentAction: null,
        currentAnimName: 'idle'
      },
      female: {
        type: 'fbx',
        files: {
          idle: 'female_warrior_idle.fbx',
          walk: 'female_warrior_walk.fbx',
          run: 'female_warrior_run.fbx',
          dodge: 'female_warrior_dodge_roll.fbx',
          attack: 'female_warrior_attack.fbx',
          death: 'female_warrior_death.fbx',
          pickup: 'female_warrior_picking_up.fbx',
          hit: 'female_warrior_hit_reaction.fbx'
        },
        targetHeight: 1.75,
        model: null,
        mixer: null,
        actions: {},
        currentAction: null,
        currentAnimName: 'idle'
      }
    }
  },
  empire: {
    day: 1,
    maxDays: 90,
    era: 1,
    eraNameVi: 'Đời I: Lều Tranh',
    food: 40,
    wood: 35,
    stone: 25,
    herbs: 10,
    gold: 150,
    fangs: 0,
    maxPopulation: 3,
    isStarving: false
  },
  villagers: [
    { id: 'v1', name: 'A Lử', role: 'LUMBERJACK', hp: 100, toolDurability: 100, x: 2.0, z: -3.0, state: 'SEEKING_NODE', carriedAmount: 0, meshGroup: null, mixer: null },
    { id: 'v2', name: 'Mùa A Sùng', role: 'MINER', hp: 100, toolDurability: 100, x: 4.5, z: -4.0, state: 'SEEKING_NODE', carriedAmount: 0, meshGroup: null, mixer: null },
    { id: 'v3', name: 'Chờ A Dơ', role: 'FORAGER', hp: 100, toolDurability: 100, x: 1.5, z: -5.5, state: 'SEEKING_NODE', carriedAmount: 0, meshGroup: null, mixer: null }
  ],
  inventory: {
    wood: 12,
    stone: 8,
    meatRaw: 6,
    meatSmoked: 2,
    flower: 5,
    mushroom: 4,
    berry: 3,
    pelt: 2,
    bone: 1,
    saber_cub: 1,
    torch: 2,
    crocScale: 0,
    crocFang: 0,
    raptorFang: 0,
    triHorn: 0,
    stegoPlate: 0,
    trexTooth: 0
  },
  storageChest: {
    wood: 100,
    stone: 80,
    meatRaw: 20,
    meatSmoked: 15,
    flower: 30,
    gold: 500
  },
  dailyDecrees: [
    { id: 'd1', title: 'Thu thập 15 Gỗ Mục', targetType: 'wood', targetAmount: 15, current: 0, completed: false, rewardGold: 30, rewardFangs: 2 },
    { id: 'd2', title: 'Thu hoạch 10 Khối Đá', targetType: 'stone', targetAmount: 10, current: 0, completed: false, rewardGold: 40, rewardFangs: 2 },
    { id: 'd3', title: 'Săn 2 Dã Thú / Khủng Long', targetType: 'hunt_dino', targetAmount: 2, current: 0, completed: false, rewardGold: 80, rewardFangs: 5 }
  ],
  quests: [
    { id: 'ch1', title: 'Chế tạo Rìu Đá & Sống Sót 3 Ngày Đầu', targetType: 'craft_axe', targetAmount: 1, current: 0, completed: false, rewardGold: 100, rewardFangs: 5 },
    { id: 'ch2', title: 'Khai phá Đầm Lầy Cá Sấu & Thu hoạch 3 Vảy Bạo Ngạc', targetType: 'harvest_croc', targetAmount: 3, current: 0, completed: false, rewardGold: 200, rewardFangs: 10 },
    { id: 'ch3', title: 'Nâng Cấp Nhà Chính Lên Đời 2 & Xây Giàn Xông Khói', targetType: 'upgrade_era_2', targetAmount: 1, current: 0, completed: false, rewardGold: 300, rewardFangs: 15 },
    { id: 'ch4', title: 'Chiến Thắng Trận Tử Thủ Đêm Trăng Máu', targetType: 'blood_moon_win', targetAmount: 1, current: 0, completed: false, rewardGold: 500, rewardFangs: 25 },
    { id: 'ch5', title: 'Tiêu Diệt Đại Bạo Long T-Rex Tại Cự Thạch Stonehenge', targetType: 'kill_trex', targetAmount: 1, current: 0, completed: false, rewardGold: 1000, rewardFangs: 50 }
  ],
  campaign: {
    currentChapter: 1,
    unlockedEndlessMode: false
  },
  stonehenge: {
    activatedRunes: 0,
    bossSummoned: false,
    bossDefeated: false
  },
  time: {
    hours: 12,
    minutes: 0,
    seconds: 0,
    timeStr: '12:00:00',
    dateStr: '2026-08-22',
    isNight: false,
    isBloodMoon: false,
    phase: 'noon',
    phaseNameVi: 'Chính Ngọ'
  },
  weather: {
    condition: 'clear',
    nameVi: 'Trời Trong Xanh',
    temperature: 28,
    isRaining: false,
    rainIntensity: 0,
    icon: '☀️',
    desc: 'Thời tiết ấm áp lý tưởng cho việc đốn gỗ và xây dựng doanh trại.'
  },
  economy: {
    gold: 150,
    fangs: 0
  }
};

export const SAVE_KEY = 'KY_NGUYEN_HOANG_CO_SAVE_DATA';

export function saveGameState(questIndex = 0) {
  try {
    const dataToSave = {
      empire: GameState.empire,
      villagers: GameState.villagers.map((v) => ({
        id: v.id,
        name: v.name,
        role: v.role,
        hp: v.hp,
        toolDurability: v.toolDurability !== undefined ? v.toolDurability : 100,
        x: v.x,
        z: v.z
      })),
      inventory: GameState.inventory,
      storageChest: GameState.storageChest,
      dailyDecrees: GameState.dailyDecrees,
      campaign: GameState.campaign,
      stonehenge: GameState.stonehenge,
      playTimeSeconds: GameState.playTimeSeconds,
      weaponLevel: GameState.player.weaponLevel,
      hasCrocArmor: GameState.player.hasCrocArmor || false,
      hasGatorSpear: GameState.player.hasGatorSpear || false,
      gender: GameState.player.gender,
      questIndex: questIndex,
      saveTimestamp: Date.now()
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(dataToSave));
  } catch (e) {}
}

export function loadGameState() {
  try {
    const savedStr = localStorage.getItem(SAVE_KEY);
    if (!savedStr) return null;
    const data = JSON.parse(savedStr);
    if (!data) return null;

    if (data.empire) Object.assign(GameState.empire, data.empire);
    if (data.inventory) Object.assign(GameState.inventory, data.inventory);
    if (data.storageChest) Object.assign(GameState.storageChest, data.storageChest);
    if (data.dailyDecrees) GameState.dailyDecrees = data.dailyDecrees;
    if (data.campaign) Object.assign(GameState.campaign, data.campaign);
    if (data.stonehenge) Object.assign(GameState.stonehenge, data.stonehenge);
    if (data.playTimeSeconds) GameState.playTimeSeconds = data.playTimeSeconds;
    if (data.gender) GameState.player.gender = data.gender;
    if (data.hasCrocArmor) GameState.player.hasCrocArmor = true;
    if (data.hasGatorSpear) GameState.player.hasGatorSpear = true;
    if (data.weaponLevel) GameState.player.weaponLevel = data.weaponLevel;

    return data;
  } catch (e) {
    return null;
  }
}
