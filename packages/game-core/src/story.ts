/**
 * Cốt truyện 8 chương và giọng dẫn của Lạc Lạc (§5.6).
 *
 * Đây là XƯƠNG SỐNG của bản offline. Game online giữ chân bằng cộng đồng và sự kiện đẩy từ
 * server; game offline không có cả hai, nên nội dung phải làm việc đó — bài học lấy thẳng từ
 * Zombies, Run! (§1). Mỗi beat kích hoạt theo cột mốc số bước TRONG CHƯƠNG, để buổi đi bộ
 * biến thành một tập phim thay vì một màn hình chờ.
 */

import { STORY } from './balance.ts';
import type { ItemStack, ZoneId } from './types.ts';

export interface StoryBeat {
  id: string;
  triggerSteps: number;
  textVi: string;
  voStatus: string;
  mood?: 'worried' | 'calm' | 'determined' | 'surprised' | 'proud';
}

export interface Chapter {
  index: number;
  id: string;
  titleVi: string;
  epigraphVi?: string;
  caveArtIcon?: string;
  unlockAfterBloodMoons: number;
  summaryVi: string;
  beats: StoryBeat[];
  quests?: Quest[];
}

export const CHAPTERS = STORY.chapters as Chapter[];

export interface StoryState {
  chapterIndex: number;
  /** Tổng số bước ở thời điểm mở chương hiện tại — beat tính theo bước TRONG chương. */
  chapterStartSteps: number;
  playedBeatIds: string[];
  bloodMoonsCompleted: number;
  /** 1..3 trong tutorial, 0 khi đã xong. */
  tutorialDay: number;
  completedQuestIds: string[];
  endlessUnlocked: boolean;
  /** Người chơi đã mua mở khoá trọn đời chưa (§9). */
  unlocked: boolean;
}

export function createStoryState(): StoryState {
  return {
    chapterIndex: 1,
    chapterStartSteps: 0,
    playedBeatIds: [],
    bloodMoonsCompleted: 0,
    tutorialDay: 1,
    completedQuestIds: [],
    endlessUnlocked: false,
    unlocked: false,
  };
}

export function chapter(index: number): Chapter | undefined {
  return CHAPTERS.find((c) => c.index === index);
}

/**
 * Các beat đủ điều kiện phát ngay bây giờ, theo thứ tự cột mốc.
 * Trả về nhiều beat cùng lúc nếu người chơi đi một mạch rất xa — tầng UI sẽ xếp hàng phát lần lượt.
 */
export function pendingBeats(state: StoryState, lifetimeSteps: number): StoryBeat[] {
  const current = chapter(state.chapterIndex);
  if (!current) return [];

  const stepsInChapter = Math.max(0, lifetimeSteps - state.chapterStartSteps);
  return current.beats
    .filter((b) => b.triggerSteps <= stepsInChapter && !state.playedBeatIds.includes(b.id))
    .sort((a, b) => a.triggerSteps - b.triggerSteps);
}

export function markBeatPlayed(state: StoryState, beatId: string): StoryState {
  if (state.playedBeatIds.includes(beatId)) return state;
  return { ...state, playedBeatIds: [...state.playedBeatIds, beatId] };
}

/** Bước tới chương kế tiếp sau mỗi Trăng Máu (§5.6: mỗi chương kéo dài một tuần). */
export function advanceAfterBloodMoon(state: StoryState, lifetimeSteps: number): {
  state: StoryState;
  unlockedChapter: Chapter | null;
} {
  const completed = state.bloodMoonsCompleted + 1;
  const next = CHAPTERS.find(
    (c) => c.index > state.chapterIndex && c.unlockAfterBloodMoons <= completed,
  );

  if (!next) {
    return { state: { ...state, bloodMoonsCompleted: completed }, unlockedChapter: null };
  }

  const isFinal = next.index === CHAPTERS.length;
  return {
    state: {
      ...state,
      bloodMoonsCompleted: completed,
      chapterIndex: next.index,
      chapterStartSteps: lifetimeSteps,
      tutorialDay: 0,
      endlessUnlocked: state.endlessUnlocked || isFinal,
    },
    unlockedChapter: next,
  };
}

/** Hoàn tất chương 8 → mở Chế độ Vô Tận. Game offline nên có một cái kết thật (§5.6). */
export function completeStory(state: StoryState): StoryState {
  return { ...state, endlessUnlocked: true };
}

// ------------------------------------------------------------------ tutorial & chapter quests

export type QuestObjective =
  | { kind: 'collect'; itemId: string; qty: number }
  | { kind: 'craft'; recipeId: string }
  | { kind: 'visit_zone'; zone: ZoneId }
  | { kind: 'action'; actionId: string }
  | { kind: 'night_defense'; survive: boolean }
  | { kind: 'steps'; qty: number }
  | { kind: 'camp_level'; level: number }
  | { kind: 'blood_moon_win'; count: number };

export interface Quest {
  id: string;
  titleVi: string;
  descVi: string;
  ruleTipVi?: string;
  shortcutTab?: 'craft' | 'camp' | 'bag' | 'map';
  objective: QuestObjective;
  reward: ItemStack[];
  deadlineHour?: number;
  failMessageVi?: string;
}

export interface TutorialDay {
  day: number;
  titleVi: string;
  quests: Quest[];
}

export const TUTORIAL_DAYS = STORY.tutorial.days as unknown as TutorialDay[];

/** Ảnh chụp tiến độ người chơi để chấm nhiệm vụ. Dùng số liệu TÍCH LUỸ, không phải kho hiện tại. */
export interface QuestSnapshot {
  lifetimeCollected: Record<string, number>;
  craftedRecipeIds: string[];
  visitedZones: ZoneId[];
  performedActionIds: string[];
  nightDefenseWins: number;
  lifetimeSteps: number;
  chapterSteps?: number;
  campLevel: number;
  bloodMoonsCompleted?: number;
}

export function questProgress(
  quest: Quest,
  snap: QuestSnapshot,
): { done: boolean; have: number; need: number } {
  const o = quest.objective;
  switch (o.kind) {
    case 'collect': {
      const have = snap.lifetimeCollected[o.itemId] ?? 0;
      return { done: have >= o.qty, have, need: o.qty };
    }
    case 'craft': {
      const done = snap.craftedRecipeIds.includes(o.recipeId);
      return { done, have: done ? 1 : 0, need: 1 };
    }
    case 'visit_zone': {
      const done = snap.visitedZones.includes(o.zone);
      return { done, have: done ? 1 : 0, need: 1 };
    }
    case 'action': {
      const done = snap.performedActionIds.includes(o.actionId);
      return { done, have: done ? 1 : 0, need: 1 };
    }
    case 'night_defense': {
      const done = snap.nightDefenseWins > 0;
      return { done, have: snap.nightDefenseWins, need: 1 };
    }
    case 'steps': {
      const have = snap.chapterSteps !== undefined ? snap.chapterSteps : snap.lifetimeSteps;
      return { done: have >= o.qty, have, need: o.qty };
    }
    case 'camp_level': {
      const have = snap.campLevel ?? 1;
      return { done: have >= o.level, have, need: o.level };
    }
    case 'blood_moon_win': {
      const have = snap.bloodMoonsCompleted ?? 0;
      return { done: have >= o.count, have, need: o.count };
    }
  }
}

export function currentDay(state: StoryState): TutorialDay | null {
  if (state.tutorialDay === 0) return null;
  return TUTORIAL_DAYS.find((d) => d.day === state.tutorialDay) ?? null;
}

export interface QuestView extends Quest {
  done: boolean;
  have: number;
  need: number;
  claimed: boolean;
}

export function questBoard(state: StoryState, snap: QuestSnapshot): QuestView[] {
  // 1. Giai đoạn Tutorial 3 ngày đầu (Chương 1)
  if (state.tutorialDay > 0) {
    const day = currentDay(state);
    if (!day) return [];
    return day.quests.map((q) => {
      const p = questProgress(q, snap);
      return { ...q, ...p, claimed: state.completedQuestIds.includes(q.id) };
    });
  }

  // 2. Giai đoạn Nhiệm vụ Cốt Truyện Theo Chương (Chương 2..8)
  const currChapter = chapter(state.chapterIndex);
  if (!currChapter || !currChapter.quests || currChapter.quests.length === 0) return [];
  return currChapter.quests.map((q) => {
    const p = questProgress(q, snap);
    return { ...q, ...p, claimed: state.completedQuestIds.includes(q.id) };
  });
}

export interface QuestSettlement {
  state: StoryState;
  newlyCompleted: QuestView[];
  rewards: ItemStack[];
  dayAdvanced: boolean;
  messageVi?: string;
}

/**
 * Chấm toàn bộ nhiệm vụ của ngày hoặc chương hiện tại và trả thưởng cho những nhiệm vụ vừa xong.
 * Xong hết nhiệm vụ trong ngày thì sang ngày tutorial kế tiếp; hết ngày 3 thì tutorial đóng lại.
 */
export function settleQuests(state: StoryState, snap: QuestSnapshot): QuestSettlement {
  const board = questBoard(state, snap);
  const newlyCompleted = board.filter((q) => q.done && !q.claimed);

  if (newlyCompleted.length === 0) {
    return { state, newlyCompleted: [], rewards: [], dayAdvanced: false };
  }

  const completedQuestIds = [...state.completedQuestIds, ...newlyCompleted.map((q) => q.id)];
  const rewards = newlyCompleted.flatMap((q) => q.reward);

  // Xử lý chuyển ngày tutorial
  if (state.tutorialDay > 0) {
    const day = currentDay(state);
    const allDone = day ? day.quests.every((q) => completedQuestIds.includes(q.id)) : false;

    if (!allDone) {
      return {
        state: { ...state, completedQuestIds },
        newlyCompleted,
        rewards,
        dayAdvanced: false,
      };
    }

    const nextDay = state.tutorialDay + 1;
    const hasNextDay = TUTORIAL_DAYS.some((d) => d.day === nextDay);
    const nextDayDef = TUTORIAL_DAYS.find((d) => d.day === nextDay);

    return {
      state: { ...state, completedQuestIds, tutorialDay: hasNextDay ? nextDay : 0 },
      newlyCompleted,
      rewards,
      dayAdvanced: true,
      messageVi: hasNextDay
        ? `Xong ngày ${state.tutorialDay}. Mai là "${nextDayDef?.titleVi}".`
        : 'Ba ngày đầu đã qua. Bạn bước vào Chương 2 — Tiếng vọng từ lòng đất.',
    };
  }

  // Xử lý nhiệm vụ theo chương (Chương 2..8)
  const currChapter = chapter(state.chapterIndex);
  const allChapterDone = currChapter?.quests ? currChapter.quests.every((q) => completedQuestIds.includes(q.id)) : false;

  return {
    state: { ...state, completedQuestIds },
    newlyCompleted,
    rewards,
    dayAdvanced: false,
    messageVi: allChapterDone
      ? `Đã hoàn thành toàn bộ mục tiêu của ${currChapter?.titleVi}! Sẵn sàng cho Đêm Trăng Máu thứ Bảy.`
      : undefined,
  };
}

// ------------------------------------------------------------------ cổng demo (§9)

export interface DemoGate {
  gated: boolean;
  titleVi: string;
  messageVi: string;
  priceVnd: number[];
  freeThroughDay: number;
}

/**
 * Điểm cắt demo nằm đúng cuối ngày 3, ngay trước Đêm Trăng Máu đầu tiên — người chơi bị
 * dừng đúng lúc gay cấn nhất (§9). Toàn bộ tiến trình 3 ngày được giữ nguyên sau khi mua.
 */
export function demoGate(state: StoryState, dayNumber: number): DemoGate {
  const demo = STORY.demo;
  return {
    gated: !state.unlocked && dayNumber > demo.freeThroughDay,
    titleVi: demo.cutTitleVi,
    messageVi: demo.cutMessageVi,
    priceVnd: demo.unlockPriceVnd,
    freeThroughDay: demo.freeThroughDay,
  };
}

export function unlockFullGame(state: StoryState): StoryState {
  return { ...state, unlocked: true };
}

export const NARRATOR = STORY.narrator;
