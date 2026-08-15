/**
 * Lọc bước chân trên máy (§4.3 bản 2.0) — thay cho chống gian lận server-authoritative.
 *
 * Tinh thần: game chơi đơn, gian lận chỉ tự lừa mình. Ta chỉ lọc những gì làm hỏng cảm giác
 * cân bằng (buộc máy lắc, nhồi một cục bước khổng lồ), và KHÔNG bao giờ xoá bước của người
 * đi bộ thật — phần vượt ngưỡng được để dành cho lần đồng bộ sau, không phải bị vứt đi.
 */

import { DEVICE_CHECKS } from './balance.js';

                                  
                                                          
                      
                                                           
                    
     
                                                                              
                                                                       
     
                             
 

                                   
                                                       
                   
                                                          
                   
                                                                    
                   
                        
                          
                  
 

export function filterSteps(input                 )                   {
  const cfg = DEVICE_CHECKS;
  const raw = Math.max(0, Math.floor(input.rawNewSteps));

  if (raw === 0) {
    return { accepted: 0, deferred: 0, rejected: 0, flaggedShake: false, flaggedCadence: false };
  }

  let flaggedShake = false;
  let rejected = 0;
  let working = raw;
  let noteVi                    ;

  if (input.stepIntervalsMs && input.stepIntervalsMs.length >= 12) {
    const shake = looksLikeShaking(input.stepIntervalsMs);
    if (shake) {
      flaggedShake = true;
      rejected = working;
      working = 0;
      noteVi = 'Nhịp rung quá đều để là dáng đi người. Số bước này không được tính.';
    }
  }

  const minutes = input.elapsedMs / 60_000;
  let flaggedCadence = false;

  if (working > 0 && minutes >= cfg.cadence.minSampleMinutes) {
    const perMinute = working / minutes;
    if (perMinute > cfg.cadence.implausibleStepsPerMinute) {
      flaggedCadence = true;
      // Không vứt đi: kẹp về nhịp đi bộ nhanh nhất còn hợp lý, phần dư chuyển sang deferred.
      const plausible = Math.floor(cfg.cadence.normalMaxStepsPerMinute * minutes);
      working = Math.min(working, plausible);
      noteVi ??= 'Nhịp bước cao bất thường — phần vượt ngưỡng được giữ lại cho lần sau.';
    }
  }

  const burstCap = cfg.stepReward.maxStepsPerSyncBurst;
  const accepted = Math.min(working, burstCap);
  const deferred = raw - accepted - rejected;

  if (deferred > 0) {
    noteVi ??= `${deferred.toLocaleString('vi-VN')} bước được để dành cho lần mở app sau.`;
  }

  return { accepted, deferred, rejected, flaggedShake, flaggedCadence, noteVi };
}

/**
 * Nhận diện máy lắc điện thoại.
 *
 * Hai dấu hiệu cùng lúc: phương sai khoảng cách giữa các bước quá thấp (đều như máy), và
 * điểm tuần hoàn quá cao. Dáng đi người luôn có nhiễu — dừng đèn đỏ, đổi nhịp, tránh người.
 * Cần CẢ HAI để tránh oan cho người chạy bộ trên máy chạy, vốn cũng khá đều.
 */
export function looksLikeShaking(intervalsMs          )          {
  const cfg = DEVICE_CHECKS.shakeDetection;
  const sample = intervalsMs.slice(-cfg.sampleWindowSteps);
  if (sample.length < 12) return false;

  const mean = sample.reduce((s, v) => s + v, 0) / sample.length;
  if (mean <= 0) return false;

  const variance = sample.reduce((s, v) => s + (v - mean) ** 2, 0) / sample.length;
  const lowVariance = variance < cfg.minStepIntervalVarianceMs;

  const periodicity = 1 - Math.min(1, Math.sqrt(variance) / mean);
  const tooPeriodic = periodicity > cfg.maxAllowedPeriodicityScore;

  return lowVariance && tooPeriodic;
}

/**
 * Trần thưởng ngày (§4.3): quá 15.000 bước thì ngừng cấp lượt nhặt, nhưng số bước VẪN được
 * đếm và hiển thị đủ. Người đi bộ nhiều không bao giờ bị xoá công sức.
 */
export function rewardableToday(rewardedSoFar        , newSteps        )   
                     
                  
                      
  {
  const cap = DEVICE_CHECKS.stepReward.dailyCap;
  const remaining = Math.max(0, cap - rewardedSoFar);
  const rewardable = Math.min(newSteps, remaining);
  return {
    rewardable,
    overCap: newSteps - rewardable,
    capReached: rewardedSoFar + rewardable >= cap,
  };
}
