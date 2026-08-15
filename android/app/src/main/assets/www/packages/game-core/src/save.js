/**
 * Lưu cục bộ (§3, §4.1, §4.3 bản 2.0).
 *
 * Không tài khoản, không đám mây bắt buộc. Một máy chứa tối đa 2 hồ sơ — thiết kế thẳng cho
 * tình huống rất Việt Nam: hai anh em dùng chung một cái điện thoại.
 *
 * Save có checksum để phát hiện file hỏng (mất điện giữa lúc ghi, storage đầy), KHÔNG phải để
 * chống sửa: với game chơi đơn giá thấp, người muốn sửa save chỉ tự phá trải nghiệm của họ,
 * và mã hoá nặng chỉ đổi lấy độ phức tạp cùng nguy cơ khoá nhầm người chơi thật.
 *
 * Module này thuần dữ liệu — không đụng localStorage hay filesystem. Tầng ứng dụng quyết định
 * lưu ở đâu, nhờ vậy cùng một code chạy được trên web, Unity và trong test.
 */

import { DEVICE_CHECKS } from './balance.js';
import { createCampState } from './crafting.js';
import { createStepLedger } from './gathering.js';
import { createSurvivalState } from './survival.js';
import { createStoryState } from './story.js';
import { createClockState } from './clock.js';
import { hashSeed } from './rng.js';
import { dayKey } from './time.js';
                                             
                                             
                                                     
                                                                                

                           
                   
                    
 

                               
             
                 
                    
                      
 

/** Số lần đã dùng mỗi hành động tại mỗi POI trong ngày, và mốc hồi chiêu. */
                           
              
                               
                                       
 

                           
                                                                            
                             
                                                                       
                           
                          
                   
                                                                                                
                         
                                                                        
                         
 

export function defaultSettings()           {
  return {
    parentalNightLock: false,
    realWeatherSync: false,
    narrationAudio: true,
    haptics: true,
    batterySaver: true,
    hiddenPoiIds: [],
  };
}

                              
                      
                    
                    
                     
                        
                        
                     
                                     
                                                                                                
                                          
                                                                                                 
                       
                                                                                      
                        
                       
 

                           
                        
                                       
                                   
                     
                    
                   
 

export function emptyLifetime()                {
  return {
    steps: 0,
    collected: {},
    craftedRecipeIds: [],
    visitedZones: [],
    performedActionIds: [],
    nightDefenseWins: 0,
    nightDefenseLosses: 0,
    bloodMoonWins: 0,
    daysPlayed: 1,
  };
}

export function createProfile(displayName        , nowMs        , gender         = 'male', id         )              {
  const player              = {
    id: id ?? `p${hashSeed(displayName, nowMs).toString(36)}`,
    displayName,
    gender,
    survival: createSurvivalState(nowMs),
    carried: {},
    safeStorage: {},
    camp: createCampState(nowMs),
    steps: createStepLedger(nowMs),
    lifetime: emptyLifetime(),
    knownRecipes: [],
    strengthLevel: 1,
    createdAtMs: nowMs,
  };

  return {
    player,
    story: createStoryState(),
    clock: createClockState(nowMs),
    settings: defaultSettings(),
    craftJobs: [],
    traps: [],
    poiUsage: { day: dayKey(nowMs), uses: {}, lastUsedAtMs: {} },
    activeFight: null,
    lastBloodMoonWeekStartMs: null,
    pendingSteps: 0,
    lastActiveDay: dayKey(nowMs),
    lastPlayedMs: nowMs,
  };
}

export function createSaveFile(nowMs        )           {
  return sign({
    formatVersion: DEVICE_CHECKS.save.formatVersion,
    profiles: Array.from({ length: DEVICE_CHECKS.save.profileSlots }, () => null),
    activeSlot: 0,
    savedAtMs: nowMs,
    checksum: '',
  });
}

// ------------------------------------------------------------------ checksum

/**
 * FNV-1a 32-bit trên bản JSON đã sắp xếp khoá.
 *
 * Phải sắp xếp khoá vì thứ tự thuộc tính của object có thể khác nhau giữa các lần chạy —
 * không sắp xếp thì save hợp lệ vẫn bị báo hỏng, đúng kiểu lỗi chỉ lộ ra sau khi phát hành.
 */
export function computeChecksum(save                            )         {
  return hashSeed(stableStringify(save)).toString(16).padStart(8, '0');
}

export function sign(save          )           {
  const { checksum: _ignored, ...rest } = save;
  return { ...save, checksum: computeChecksum(rest) };
}

                             
              
                        
                                                                             
                            
                     
 

/**
 * Nạp save.
 *
 * Checksum lệch KHÔNG chặn người chơi: file có thể lệch vì bản cập nhật đổi cấu trúc, vì
 * người chơi tự sửa, hoặc vì lỗi ghi. Chặn ở đây nghĩa là xoá sạch tiến trình của một người
 * chơi vô tội — cái giá đó cao hơn nhiều so với việc để một người tự sửa save chơi tiếp.
 */
export function loadSave(raw        )             {
  let parsed          ;
  try {
    parsed = JSON.parse(raw)            ;
  } catch {
    return { ok: false, save: null, checksumMismatch: false, messageVi: 'File save không đọc được.' };
  }

  if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.profiles)) {
    return { ok: false, save: null, checksumMismatch: false, messageVi: 'File save sai định dạng.' };
  }

  if (parsed.formatVersion > DEVICE_CHECKS.save.formatVersion) {
    return {
      ok: false,
      save: null,
      checksumMismatch: false,
      messageVi: `File save thuộc phiên bản ${parsed.formatVersion}, mới hơn bản game đang chạy. Hãy cập nhật game.`,
    };
  }

  const { checksum, ...rest } = parsed;
  const expected = computeChecksum(rest);
  const mismatch = checksum !== expected;

  return {
    ok: true,
    save: migrate(parsed),
    checksumMismatch: mismatch,
    messageVi: mismatch
      ? 'Save có dấu hiệu bị sửa hoặc ghi dở. Game vẫn chạy tiếp bình thường.'
      : undefined,
  };
}

export function serializeSave(save          , nowMs        )         {
  return JSON.stringify(sign({ ...save, savedAtMs: nowMs }));
}

/** Nâng cấp save cũ lên cấu trúc hiện tại. Mỗi bản phát hành đổi cấu trúc phải thêm một nhánh ở đây. */
function migrate(save          )           {
  let out = save;

  if (out.profiles.length < DEVICE_CHECKS.save.profileSlots) {
    const profiles = [...out.profiles];
    while (profiles.length < DEVICE_CHECKS.save.profileSlots) profiles.push(null);
    out = { ...out, profiles };
  }

  return { ...out, formatVersion: DEVICE_CHECKS.save.formatVersion };
}

// ------------------------------------------------------------------ xuất / nhập file sao lưu

                             
                      
                        
                       
                      
                 
 

/**
 * Xuất file sao lưu (§2: "đổi máy vẫn giữ được tiến trình").
 * Đây là mạng lưới an toàn duy nhất của người chơi khi không có cloud save.
 */
export function exportBackup(save          , nowMs        , gameVersion        )         {
  const backup             = {
    magic: 'KHC-BACKUP',
    formatVersion: DEVICE_CHECKS.save.formatVersion,
    exportedAtMs: nowMs,
    gameVersion,
    save: sign({ ...save, savedAtMs: nowMs }),
  };
  return JSON.stringify(backup, null, 2);
}

export function suggestBackupFileName(nowMs        )         {
  return `ky-nguyen-hoang-co-${dayKey(nowMs)}${DEVICE_CHECKS.save.backupFileExtension}`;
}

                               
              
                        
                    
 

export function importBackup(raw        )               {
  let backup            ;
  try {
    backup = JSON.parse(raw)              ;
  } catch {
    return { ok: false, save: null, messageVi: 'File sao lưu không đọc được.' };
  }

  if (backup?.magic !== 'KHC-BACKUP') {
    return { ok: false, save: null, messageVi: 'Đây không phải file sao lưu của Kỷ Nguyên Hoang Cổ.' };
  }

  const loaded = loadSave(JSON.stringify(backup.save));
  if (!loaded.ok || !loaded.save) {
    return { ok: false, save: null, messageVi: loaded.messageVi ?? 'File sao lưu hỏng.' };
  }

  const profileCount = loaded.save.profiles.filter(Boolean).length;
  return {
    ok: true,
    save: loaded.save,
    messageVi: loaded.checksumMismatch
      ? `Đã nhập ${profileCount} hồ sơ. Lưu ý: checksum không khớp, file có thể đã bị sửa.`
      : `Đã nhập ${profileCount} hồ sơ từ bản sao lưu ngày ${dayKey(backup.exportedAtMs)}.`,
  };
}

// ------------------------------------------------------------------ thao tác khe hồ sơ

export function putProfile(save          , slot        , profile                    )           {
  if (slot < 0 || slot >= save.profiles.length) {
    throw new Error(`Khe hồ sơ không hợp lệ: ${slot}`);
  }
  const profiles = [...save.profiles];
  profiles[slot] = profile;
  return sign({ ...save, profiles });
}

export function activeProfile(save          )                     {
  return save.profiles[save.activeSlot] ?? null;
}

export function setActiveSlot(save          , slot        )           {
  if (slot < 0 || slot >= save.profiles.length) {
    throw new Error(`Khe hồ sơ không hợp lệ: ${slot}`);
  }
  return sign({ ...save, activeSlot: slot });
}

/** Tổng quan các khe để vẽ màn hình chọn hồ sơ. */
                              
               
                 
                       
                  
                     
                        
                         
                        
 

export function slotSummaries(save          )                {
  return save.profiles.map((profile, slot) => {
    if (!profile) return { slot, empty: true };
    return {
      slot,
      empty: false,
      displayName: profile.player.displayName,
      gender: profile.player.gender ?? 'male',
      campLevel: profile.player.camp.level,
      chapterIndex: profile.story.chapterIndex,
      lifetimeSteps: profile.player.lifetime.steps,
      lastPlayedMs: profile.lastPlayedMs,
    };
  });
}

/** Số ngày hồ sơ đã tồn tại, tính từ 1 — dùng cho cổng demo (§9). */
export function profileDayNumber(profile             , nowMs        )         {
  const days = Math.floor((nowMs - profile.player.createdAtMs) / 86_400_000);
  return Math.max(1, days + 1);
}

export function totalInventory(profile             )            {
  const out            = { ...profile.player.carried };
  for (const [itemId, qty] of Object.entries(profile.player.safeStorage)) {
    out[itemId] = (out[itemId] ?? 0) + qty;
  }
  return out;
}

/** JSON có thứ tự khoá ổn định — điều kiện bắt buộc để checksum tái lập được. */
function stableStringify(value         )         {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  const entries = Object.entries(value                           )
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}
