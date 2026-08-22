/**
 * Cốt truyện 12 chương sử thi và giọng dẫn của Lạc Lạc.
 *
 * Đây là XƯƠNG SỐNG của trải nghiệm game sinh tồn hoang cổ.
 * Mỗi beat kích hoạt theo cột mốc tiến trình thám hiểm và sinh tồn TRONG CHƯƠNG,
 * đưa người chơi qua từng giai đoạn lịch sử hào hùng của bộ tộc.
 */

import { STORY } from './balance.js';
                                                    

                            
             
                       
                 
                   
                                                                   
 

                          
                
             
                  
                      
                       
                                
                    
                     
                   
 

export const CHAPTERS = STORY.chapters             ;

                             
                       
                                                                                        
                            
                          
                              
                                            
                      
                              
                           
                                                      
                    
 

export function createStoryState()             {
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

export function chapter(index        )                      {
  return CHAPTERS.find((c) => c.index === index);
}

/**
 * Các beat đủ điều kiện phát ngay bây giờ, theo thứ tự cột mốc.
 * Trả về nhiều beat cùng lúc nếu người chơi đi một mạch rất xa — tầng UI sẽ xếp hàng phát lần lượt.
 */
export function pendingBeats(state            , lifetimeSteps        )              {
  const current = chapter(state.chapterIndex);
  if (!current) return [];

  const stepsInChapter = Math.max(0, lifetimeSteps - state.chapterStartSteps);
  return current.beats
    .filter((b) => b.triggerSteps <= stepsInChapter && !state.playedBeatIds.includes(b.id))
    .sort((a, b) => a.triggerSteps - b.triggerSteps);
}

export function markBeatPlayed(state            , beatId        )             {
  if (state.playedBeatIds.includes(beatId)) return state;
  return { ...state, playedBeatIds: [...state.playedBeatIds, beatId] };
}

/** Bước tới chương kế tiếp sau mỗi Trăng Máu (§5.6: mỗi chương kéo dài một tuần). */
export function advanceAfterBloodMoon(state            , lifetimeSteps        )   
                    
                                  
  {
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
export function completeStory(state            )             {
  return { ...state, endlessUnlocked: true };
}

// ------------------------------------------------------------------ tutorial & chapter quests

                            
                                                    
                                       
                                        
                                        
                                               
                                  
                                         
                                              

                        
             
                  
                 
                     
                                                 
                            
                      
                        
                         
 

                              
              
                  
                  
 

export const TUTORIAL_DAYS = STORY.tutorial.days                            ;

/** Ảnh chụp tiến độ người chơi để chấm nhiệm vụ. Dùng số liệu TÍCH LUỸ, không phải kho hiện tại. */
                                
                                            
                             
                         
                               
                           
                        
                        
                    
                               
 

export function questProgress(
  quest       ,
  snap               ,
)                                                {
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

export function currentDay(state            )                     {
  if (state.tutorialDay === 0) return null;
  return TUTORIAL_DAYS.find((d) => d.day === state.tutorialDay) ?? null;
}

                                          
                
               
               
                   
 

export function questBoard(state            , snap               )              {
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

                                  
                    
                              
                       
                       
                     
 

/**
 * Chấm toàn bộ nhiệm vụ của ngày hoặc chương hiện tại và trả thưởng cho những nhiệm vụ vừa xong.
 * Xong hết nhiệm vụ trong ngày thì sang ngày tutorial kế tiếp; hết ngày 3 thì tutorial đóng lại.
 */
export function settleQuests(state            , snap               )                  {
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

                           
                 
                  
                    
                     
                         
 

/**
 * Điểm cắt demo nằm đúng cuối ngày 3, ngay trước Đêm Trăng Máu đầu tiên — người chơi bị
 * dừng đúng lúc gay cấn nhất (§9). Toàn bộ tiến trình 3 ngày được giữ nguyên sau khi mua.
 */
export function demoGate(state            , dayNumber        )           {
  const demo = STORY.demo;
  return {
    gated: !state.unlocked && dayNumber > demo.freeThroughDay,
    titleVi: demo.cutTitleVi,
    messageVi: demo.cutMessageVi,
    priceVnd: demo.unlockPriceVnd,
    freeThroughDay: demo.freeThroughDay,
  };
}

export function unlockFullGame(state            )             {
  return { ...state, unlocked: true };
}

export const NARRATOR = STORY.narrator;
