                                                      
import { getPetCombatBonus } from './pets.js';

                             
                 
                 
                
                    
                      
                             
                          
             
                
                             
                   
                  
 

                           
                 
                  
             
                
                      
                         
 

                                                                                   

                                   
                 
                         
                        
 

                           
                 
                      
                                                      
                                              
                        
                        
                        
                
                        
 

                             
                 
                                           
                        
 

/**
 * Khởi tạo phòng Đấu Boss Trăng Máu Co-op Cục bộ (Local Co-op).
 */
export function createCoopRoom(
  roomId        ,
  hostPeerId        ,
  hostProfile             ,
  difficulty                                  = 'normal',
  nowMs         = Date.now(),
)           {
  const hostPet = hostProfile.player.pets?.find((p) => p.isActive)?.petId ?? null;
  const hostWeapon                = hostProfile.player.inventory.find((i) => i.itemId.includes('spear') || i.itemId.includes('axe') || i.itemId.includes('bow'))?.itemId ?? null;

  const hostMember             = {
    peerId: hostPeerId,
    nameVi: hostProfile.name || 'Thợ Săn Cổ Đại',
    level: hostProfile.level,
    campLevel: hostProfile.camp.level,
    campDefense: hostProfile.camp.defense,
    activePetId: hostPet,
    weaponId: hostWeapon,
    hp: hostProfile.player.hp,
    maxHp: 100,
    damageContribution: 0,
    isReady: true,
    isHost: true,
  };

  return {
    roomId,
    createdAtMs: nowMs,
    status: 'lobby',
    difficulty,
    members: [hostMember],
    boss: null,
    sharedDefense: hostMember.campDefense,
    round: 0,
    battleLogVi: [`Phòng chiến Co-op #${roomId} đã sẵn sàng. Chờ đồng đội tiếp ứng!`],
  };
}

/**
 * Đồng đội tham gia phòng Co-op qua kết nối cục bộ.
 */
export function joinCoopRoom(
  room          ,
  peerId        ,
  profile             ,
)           {
  if (room.status !== 'lobby') {
    throw new Error('Trận chiến đã bắt đầu hoặc đã kết thúc, không thể tham gia!');
  }
  if (room.members.some((m) => m.peerId === peerId)) {
    return room;
  }
  if (room.members.length >= 4) {
    throw new Error('Phòng Co-op đã đủ 4 người chơi!');
  }

  const pet = profile.player.pets?.find((p) => p.isActive)?.petId ?? null;
  const weapon                = profile.player.inventory.find((i) => i.itemId.includes('spear') || i.itemId.includes('axe') || i.itemId.includes('bow'))?.itemId ?? null;

  const newMember             = {
    peerId,
    nameVi: profile.name || `Chiến Binh ${room.members.length + 1}`,
    level: profile.level,
    campLevel: profile.camp.level,
    campDefense: profile.camp.defense,
    activePetId: pet,
    weaponId: weapon,
    hp: profile.player.hp,
    maxHp: 100,
    damageContribution: 0,
    isReady: false,
    isHost: false,
  };

  const updatedMembers = [...room.members, newMember];
  const totalDefense = updatedMembers.reduce((sum, m) => sum + m.campDefense, 0);

  return {
    ...room,
    members: updatedMembers,
    sharedDefense: totalDefense,
    battleLogVi: [
      ...room.battleLogVi,
      `Chiến binh ${newMember.nameVi} đã gia nhập trận địa! Tổng điểm thủ trại: ${totalDefense}.`,
    ],
  };
}

/**
 * Bắt đầu trận chiến Boss Trăng Máu Co-op.
 */
export function startCoopBattle(room          )           {
  const memberCount = Math.max(1, room.members.length);
  const diffMultiplier = room.difficulty === 'nightmare' ? 2.5 : room.difficulty === 'hard' ? 1.6 : 1.0;

  const baseHp = (350 + memberCount * 250) * diffMultiplier;
  const attackPower = Math.round((25 + memberCount * 12) * diffMultiplier);

  const boss           = {
    nameVi: room.difficulty === 'nightmare' ? 'Chúa Tể Hắc Ám Cổ Đại' : 'Cự Thú Huyết Nguyệt Đột Biến',
    titleVi: 'Kẻ Gieo Rắc Cơn Thịnh Nộ Trăng Đỏ',
    hp: baseHp,
    maxHp: baseHp,
    attackPower,
    specialSkillVi: 'Tiếng Hú Chấn Động Đại Ngàn & Quét Móng Sấm Sét',
  };

  return {
    ...room,
    status: 'fighting',
    boss,
    round: 1,
    battleLogVi: [
      ...room.battleLogVi,
      `⚠️ TRĂNG MÁU ĐÃ LÊN! ${boss.nameVi} (${boss.hp} HP) xuất hiện gầm thét! Hãy cùng nhau chiến đấu!`,
    ],
  };
}

/**
 * Xử lý một hiệp đấu Co-op (tất cả thành viên ra chiêu phối hợp).
 */
export function processCoopRound(
  room          ,
  actions                    ,
)           {
  if (room.status !== 'fighting' || !room.boss) {
    return room;
  }

  let currentBossHp = room.boss.hp;
  let currentSharedDef = room.sharedDefense;
  const newLogs           = [];
  const updatedMembers = room.members.map((m) => ({ ...m }));

  // 1. Lượt của các thành viên
  let teamTotalDmg = 0;
  for (const act of actions) {
    const member = updatedMembers.find((m) => m.peerId === act.peerId);
    if (!member || member.hp <= 0) continue;

    if (act.action === 'attack') {
      const weaponDmg = member.weaponId?.includes('iron') ? 35 : member.weaponId?.includes('stone') ? 22 : 12;
      const petBuff = getPetCombatBonus(member.activePetId);
      const totalDmg = Math.round(weaponDmg * petBuff.atkMultiplier + Math.floor(Math.random() * 10));

      currentBossHp = Math.max(0, currentBossHp - totalDmg);
      member.damageContribution += totalDmg;
      teamTotalDmg += totalDmg;
      newLogs.push(`⚔️ ${member.nameVi} vung vũ khí chém trúng ${room.boss.nameVi}, gây ${totalDmg} sát thương!`);
    } else if (act.action === 'reinforce') {
      const defAdd = 20;
      currentSharedDef += defAdd;
      newLogs.push(`🛡️ ${member.nameVi} dựng rào chắn cọc gỗ gai, tăng +${defAdd} điểm thủ trại chung!`);
    } else if (act.action === 'heal_team') {
      for (const m of updatedMembers) {
        if (m.hp > 0) m.hp = Math.min(m.maxHp, m.hp + 30);
      }
      newLogs.push(`✨ ${member.nameVi} tung Bụi Thảo Dược Hồi Sinh, hồi +30 HP cho toàn thể chiến binh!`);
    } else if (act.action === 'arrow_volley') {
      const volleyDmg = 25;
      currentBossHp = Math.max(0, currentBossHp - volleyDmg);
      member.damageContribution += volleyDmg;
      teamTotalDmg += volleyDmg;
      newLogs.push(`🏹 ${member.nameVi} bắn Mưa Tên Cổ Sinh, gây ${volleyDmg} sát thương và làm suy yếu bầy thú!`);
    }
  }

  // 2. Kiểm tra nếu Boss bị tiêu diệt
  if (currentBossHp <= 0) {
    return {
      ...room,
      status: 'victory',
      boss: { ...room.boss, hp: 0 },
      sharedDefense: currentSharedDef,
      round: room.round + 1,
      members: updatedMembers,
      battleLogVi: [
        ...room.battleLogVi,
        ...newLogs,
        `🎉 CHIẾN THẮNG VANG DỘI! ${room.boss.nameVi} đã gục ngã dưới sự đoàn kết của bộ tộc!`,
      ],
    };
  }

  // 3. Boss phản công
  const bossDmg = room.boss.attackPower;
  if (currentSharedDef > 0) {
    const absorbed = Math.min(currentSharedDef, bossDmg);
    currentSharedDef -= absorbed;
    const remainingDmg = bossDmg - absorbed;
    newLogs.push(`🛡️ Hàng rào phòng thủ đỡ được ${absorbed} sát thương từ ${room.boss.nameVi}!`);

    if (remainingDmg > 0) {
      const perPlayerDmg = Math.ceil(remainingDmg / updatedMembers.filter((m) => m.hp > 0).length);
      for (const m of updatedMembers) {
        if (m.hp > 0) m.hp = Math.max(0, m.hp - perPlayerDmg);
      }
      newLogs.push(`💥 Sát thương xuyên thủng! Mỗi chiến binh chịu ${perPlayerDmg} sát thương.`);
    }
  } else {
    // Không có thủ trại -> chia đều sát thương lớn
    const perPlayerDmg = Math.ceil(bossDmg / updatedMembers.filter((m) => m.hp > 0).length);
    for (const m of updatedMembers) {
      if (m.hp > 0) m.hp = Math.max(0, m.hp - perPlayerDmg);
    }
    newLogs.push(`💥 ${room.boss.nameVi} quét đòn sấm sét! Mỗi chiến binh chịu ${perPlayerDmg} sát thương!`);
  }

  // Kiểm tra nếu toàn đội ngất
  const allDown = updatedMembers.every((m) => m.hp <= 0);

  return {
    ...room,
    status: allDown ? 'defeat' : 'fighting',
    boss: { ...room.boss, hp: currentBossHp },
    sharedDefense: currentSharedDef,
    round: room.round + 1,
    members: updatedMembers,
    battleLogVi: [
      ...room.battleLogVi,
      ...newLogs,
      allDown ? `💀 TOÀN ĐỘI BỊ ĐÁNH BẠI! Hãy nâng cấp trại và chuẩn bị lại cho lần sau.` : `--- Hết Hiệp ${room.round} ---`,
    ],
  };
}

/**
 * Trao thưởng rương Co-op chiến thắng cho toàn bộ thành viên.
 */
export function resolveCoopRewards(room          )               {
  if (room.status !== 'victory') return [];

  return room.members.map((m) => {
    const isMvp = m.damageContribution === Math.max(...room.members.map((x) => x.damageContribution));
    const items                                    = [
      { itemId: 'iron_ore', qty: isMvp ? 10 : 6 },
      { itemId: 'upgrade_core', qty: isMvp ? 3 : 2 },
      { itemId: 'wild_berry', qty: 15 },
    ];

    return {
      peerId: m.peerId,
      items,
      bonusTitleVi: isMvp ? 'Chiến Thần Diệt Boss Trăng Máu' : 'Dũng Sĩ Tiền Sử Bất Khuất',
    };
  });
}
