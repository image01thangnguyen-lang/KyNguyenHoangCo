/**
 * Hệ thống Nhiệm vụ Dã Ngoại Cuối Tuần Hà Nội (Thứ Bảy & Chủ Nhật).
 *
 * Khuyến khích người chơi ra ngoài vận động, khám phá các danh lam thắng cảnh,
 * công viên, hồ nước, làng nghề cổ truyền và quán cà phê nổi tiếng của Hà Nội.
 * Phần thưởng phong phú: Đồng Vàng Cổ, Trứng Linh Thú, Lõi nâng cấp và Bản vẽ chế tạo.
 */

import { toLocalTime, VN_UTC_OFFSET_MINUTES } from './time.ts';
import type { ItemStack, PlayerState } from './types.ts';
import type { PoiEntry } from './world.ts';

export interface WeekendQuestDef {
  id: string;
  icon: string;
  titleVi: string;
  descVi: string;
  hintVi: string;
  poiKeywords: string[];
  requiresSteps?: number;
  isCafeCheck?: boolean;
  rewards: ItemStack[];
}

export const WEEKEND_QUESTS: readonly WeekendQuestDef[] = [
  {
    id: 'wq_tay_ho',
    icon: '🌊',
    titleVi: 'Dã Ngoại Hồ Tây Lộng Gió',
    descVi: 'Ghé thăm Hồ Tây, Phủ Tây Hồ, Chùa Trấn Quốc hoặc Đường Thanh Niên để đón gió mát ngày cuối tuần.',
    hintVi: 'Đến trong phạm vi ~100m quanh Hồ Tây, Phủ Tây Hồ, Chùa Trấn Quốc hoặc Lotte Mall Tây Hồ.',
    poiKeywords: ['hồ tây', 'tây hồ', 'phủ tây hồ', 'trấn quốc', 'trúc bạch', 'thanh niên', 'lotte mall tây hồ', 'sen tây hồ'],
    rewards: [
      { itemId: 'ancient_coin', qty: 20 },
      { itemId: 'wild_berry', qty: 3 },
    ],
  },
  {
    id: 'wq_ho_guom',
    icon: '🚶‍♂️',
    titleVi: 'Dạo Bước Phố Đi Bộ & Hồ Gươm',
    descVi: 'Đến khu vực Hồ Gươm, Tháp Rùa, Đền Ngọc Sơn, Nhà Hát Lớn, Tràng Tiền hoặc Phố Cổ cuối tuần.',
    hintVi: 'Đến khu vực Phố Đi Bộ Hoàn Kiếm, Tháp Rùa, Đền Ngọc Sơn hoặc Nhà Thờ Lớn.',
    poiKeywords: ['hồ gươm', 'tháp rùa', 'ngọc sơn', 'tràng tiền', 'nhà hát lớn', 'nhà thờ lớn', 'đinh tiên hoàng', 'hàng bông', 'hàng gai', 'hàng mã', 'đồng xuân'],
    rewards: [
      { itemId: 'ancient_coin', qty: 25 },
      { itemId: 'egg_forest', qty: 1 },
    ],
  },
  {
    id: 'wq_thang_long',
    icon: '🏛️',
    titleVi: 'Di Tích Thăng Long & Lăng Bác',
    descVi: 'Ghé thăm Hoàng Thành Thăng Long, Cột Cờ Hà Nội, Văn Miếu Quốc Tử Giám hoặc Lăng Bác.',
    hintVi: 'Đến khu vực Hoàng Thành Thăng Long, Lăng Chủ Tịch, Văn Miếu hoặc Cột Cờ Hà Nội.',
    poiKeywords: ['hoàng thành', 'lăng bác', 'văn miếu', 'cột cờ', 'chùa một cột', 'quốc tử giám', 'ba đình'],
    rewards: [
      { itemId: 'ancient_coin', qty: 25 },
      { itemId: 'seed_herb', qty: 2 },
    ],
  },
  {
    id: 'wq_cong_vien',
    icon: '🌳',
    titleVi: 'Picnic Thư Giãn Công Viên Xanh',
    descVi: 'Ghé thăm một trong các công viên lớn tại Hà Nội (Thống Nhất, Yên Sở, Cầu Giấy, Bách Thảo, Nghĩa Đô, Thủ Lệ, Hòa Bình...).',
    hintVi: 'Đến một công viên hoặc vườn bách thảo bất kỳ trên bản đồ.',
    poiKeywords: ['công viên', 'bách thảo', 'thủ lệ', 'nghĩa đô', 'cầu giấy', 'yên sở', 'thống nhất', 'hòa bình'],
    rewards: [
      { itemId: 'ancient_coin', qty: 20 },
      { itemId: 'grilled_meat', qty: 3 },
    ],
  },
  {
    id: 'wq_lang_nghe',
    icon: '🏺',
    titleVi: 'Du Khảo Làng Nghề Cổ Truyền',
    descVi: 'Đến Làng Gốm Bát Tràng, Làng Lụa Vạn Phúc, Lò Rèn Đa Sỹ, Làng Thêu Quất Động, Mộc Chàng Sơn hoặc Mây Tre Phú Vinh.',
    hintVi: 'Ghé thăm một làng nghề truyền thống ngoại thành trên bản đồ.',
    poiKeywords: ['bát tràng', 'vạn phúc', 'đa sỹ', 'quất động', 'phú vinh', 'kim lan', 'la phù', 'chàng sơn', 'phù lỗ', 'cự đà', 'nhân hiền'],
    rewards: [
      { itemId: 'ancient_coin', qty: 30 },
      { itemId: 'blueprint', qty: 1 },
    ],
  },
  {
    id: 'wq_ba_vi',
    icon: '🏕️',
    titleVi: 'Cắm Trại Rừng Xanh Ba Vì / Ngoại Thành',
    descVi: 'Đến Vườn Quốc Gia Ba Vì, Hồ Suối Hai, Hồ Tiên Sa, Đền Sóc, Núi Sóc hoặc khu du lịch sinh thái.',
    hintVi: 'Đến khu vực núi Ba Vì, hồ Suối Hai, Tiên Sa hoặc Sóc Sơn.',
    poiKeywords: ['ba vì', 'suối hai', 'tiên sa', 'sóc sơn', 'đền sóc', 'đồng mô'],
    rewards: [
      { itemId: 'ancient_coin', qty: 35 },
      { itemId: 'egg_mountain', qty: 1 },
    ],
  },
  {
    id: 'wq_cafe',
    icon: '☕',
    titleVi: 'Thảnh Thơi Cà Phê / Trà Quán',
    descVi: 'Ghé thăm bất kỳ quán Cà phê, Trà quán cổ hoặc tiệm đồ uống nào trên bản đồ để thư giãn.',
    hintVi: 'Đứng gần một quán Cà phê (Highlands, Phúc Long, Cộng, Trung Nguyên, Yên, Giảng...) hoặc Trà quán.',
    poiKeywords: ['highlands', 'coffee', 'cà phê', 'trà', 'phúc long', 'trung nguyên', 'cộng', 'giảng', 'đinh', 'yên', 'tch'],
    isCafeCheck: true,
    rewards: [
      { itemId: 'ancient_coin', qty: 15 },
      { itemId: 'boiled_water', qty: 2 },
    ],
  },
  {
    id: 'wq_steps',
    icon: '👟',
    titleVi: 'Vận Động 6.000 Bước Cuối Tuần',
    descVi: 'Đi bộ tích lũy đạt mốc 6.000 bước chân ngoài trời trong ngày cuối tuần để rèn luyện thể lực.',
    hintVi: 'Đi bộ thêm ngoài trời để thanh bước đạt 6.000 bước.',
    poiKeywords: [],
    requiresSteps: 6000,
    rewards: [
      { itemId: 'ancient_coin', qty: 30 },
      { itemId: 'upgrade_core', qty: 2 },
    ],
  },
];

/** Kiểm tra thời điểm hiện tại có phải là cuối tuần (Thứ Bảy = 6 hoặc Chủ Nhật = 0). */
export function isWeekend(nowMs: number, offsetMinutes = VN_UTC_OFFSET_MINUTES): boolean {
  const local = toLocalTime(nowMs, offsetMinutes);
  return local.dayOfWeek === 0 || local.dayOfWeek === 6;
}

/** Tạo khoá định danh cho đợt cuối tuần hiện tại (ví dụ: 2026-08-15-weekend) để reset sau mỗi tuần. */
export function getWeekendKey(nowMs: number, offsetMinutes = VN_UTC_OFFSET_MINUTES): string {
  const local = toLocalTime(nowMs, offsetMinutes);
  const d = new Date(nowMs + offsetMinutes * 60_000);
  // Đưa về ngày Thứ Bảy đầu đợt cuối tuần
  const diffToSaturday = (local.dayOfWeek === 0 ? -1 : 0);
  d.setUTCDate(d.getUTCDate() + diffToSaturday);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}-weekend`;
}

export interface WeekendQuestStatus {
  quest: WeekendQuestDef;
  done: boolean;
  claimed: boolean;
  progressText: string;
}

/** Kiểm tra và trả về trạng thái của tất cả nhiệm vụ cuối tuần cho người chơi. */
export function getWeekendQuestBoard(
  player: PlayerState,
  nowMs: number,
  currentPoi: PoiEntry | null = null,
  offsetMinutes = VN_UTC_OFFSET_MINUTES,
): { isWeekendActive: boolean; weekendKey: string; quests: WeekendQuestStatus[] } {
  const active = isWeekend(nowMs, offsetMinutes);
  const weekendKey = getWeekendKey(nowMs, offsetMinutes);
  const claimedList = (player as any).weekendQuestsClaimed?.[weekendKey] ?? [];

  const poiNameLower = currentPoi?.nameVi?.toLowerCase() ?? '';
  const stepsToday = player.steps.totalSteps ?? 0;

  const quests: WeekendQuestStatus[] = WEEKEND_QUESTS.map((q) => {
    const claimed = claimedList.includes(q.id);
    let done = claimed;

    if (!done) {
      if (q.requiresSteps) {
        done = stepsToday >= q.requiresSteps;
      } else if (q.isCafeCheck) {
        done = q.poiKeywords.some((kw) => poiNameLower.includes(kw));
      } else {
        done = q.poiKeywords.some((kw) => poiNameLower.includes(kw));
      }
    }

    let progressText = '';
    if (claimed) {
      progressText = '✅ Đã nhận thưởng';
    } else if (done) {
      progressText = '🎉 Đã hoàn thành! Bấm để nhận thưởng';
    } else if (q.requiresSteps) {
      progressText = `Tiến độ: ${stepsToday.toLocaleString('vi-VN')} / ${q.requiresSteps.toLocaleString('vi-VN')} bước`;
    } else {
      progressText = 'Chưa ghé thăm địa điểm này';
    }

    return {
      quest: q,
      done,
      claimed,
      progressText,
    };
  });

  return {
    isWeekendActive: active,
    weekendKey,
    quests,
  };
}

/** Nhận phần thưởng cho nhiệm vụ dã ngoại cuối tuần. */
export function claimWeekendQuest(
  player: PlayerState,
  questId: string,
  nowMs: number,
  currentPoi: PoiEntry | null = null,
  offsetMinutes = VN_UTC_OFFSET_MINUTES,
): { player: PlayerState; ok: boolean; messageVi: string; rewards: ItemStack[] } {
  if (!isWeekend(nowMs, offsetMinutes)) {
    return { player, ok: false, messageVi: 'Sự kiện chỉ diễn ra vào Thứ Bảy và Chủ Nhật!', rewards: [] };
  }

  const quest = WEEKEND_QUESTS.find((q) => q.id === questId);
  if (!quest) {
    return { player, ok: false, messageVi: 'Nhiệm vụ không tồn tại.', rewards: [] };
  }

  const weekendKey = getWeekendKey(nowMs, offsetMinutes);
  const claimedMap = (player as any).weekendQuestsClaimed ?? {};
  const claimedList = claimedMap[weekendKey] ?? [];

  if (claimedList.includes(questId)) {
    return { player, ok: false, messageVi: 'Bạn đã nhận thưởng nhiệm vụ này rồi!', rewards: [] };
  }

  // Kiểm tra điều kiện hoàn thành
  const poiNameLower = currentPoi?.nameVi?.toLowerCase() ?? '';
  const stepsToday = player.steps.totalSteps ?? 0;
  let done = false;

  if (quest.requiresSteps) {
    done = stepsToday >= quest.requiresSteps;
  } else if (quest.isCafeCheck) {
    done = quest.poiKeywords.some((kw) => poiNameLower.includes(kw));
  } else {
    done = quest.poiKeywords.some((kw) => poiNameLower.includes(kw));
  }

  if (!done) {
    return {
      player,
      ok: false,
      messageVi: `Chưa hoàn thành mục tiêu: ${quest.hintVi}`,
      rewards: [],
    };
  }

  // Trao thưởng vào carried inventory
  const updatedCarried = { ...player.carried };
  for (const r of quest.rewards) {
    updatedCarried[r.itemId] = (updatedCarried[r.itemId] ?? 0) + r.qty;
  }

  const updatedPlayer: PlayerState = {
    ...player,
    carried: updatedCarried,
    ...({
      weekendQuestsClaimed: {
        ...claimedMap,
        [weekendKey]: [...claimedList, questId],
      },
    } as any),
  };

  const rewardSummary = quest.rewards.map((r) => `+${r.qty} ${r.itemId}`).join(', ');

  return {
    player: updatedPlayer,
    ok: true,
    messageVi: `🎉 Chúc mừng! Hoàn thành "${quest.titleVi}" nhận: ${rewardSummary}!`,
    rewards: quest.rewards,
  };
}
