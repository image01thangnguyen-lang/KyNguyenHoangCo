// ====================================================
// MODULE: DialogueOverlay.ts — HỘP THOẠI ĐIỆN ẢNH ĐÔNG SƠN & 11 PHÂN CẢNH
// ====================================================

export const DIALOGUE_SCENES = {
  1: {
    speaker: 'Trưởng Lão Mo',
    role: 'Tộc Trưởng',
    avatar: '👴',
    lines: [
      'Hỡi dũng sĩ trẻ! Cơn bão cát tiền sử đã qua đi, hãy thức tỉnh...',
      'Hãy đến bên Bờ Suối thu lượm 15 Gỗ Mục và 10 Khối Đá để dựng lại Lều Tranh.'
    ]
  },
  2: {
    speaker: 'Trưởng Lão Mo',
    role: 'Tộc Trưởng',
    avatar: '👴',
    lines: [
      'Tốt lắm! Giờ hãy vào Lò Rèn chế tạo Rìu Đá để khai hoang mở rộng doanh trại.'
    ]
  },
  3: {
    speaker: 'Thợ Săn A Thao',
    role: 'Nữ Thợ Săn',
    avatar: '🏹',
    lines: [
      'Chào dũng sĩ! Ta là A Thao, người canh giữ sườn đồi phía Tây.',
      'Phía Tây Nam là Đầm Lầy Cá Sấu Deinosuchus cực kỳ nguy hiểm, hãy cẩn trọng!'
    ]
  },
  10: {
    speaker: 'Thợ Săn A Thao',
    role: 'Nữ Thợ Săn',
    avatar: '🏹',
    lines: [
      'Đại Bạo Long T-Rex đã xuất hiện tại Cự Thạch Trận Stonehenge!',
      'Hãy dùng Thần Binh T-Rex Godblade và né tránh những đợt Gầm Choáng để tiêu diệt bạo chúa!'
    ]
  },
  11: {
    speaker: 'Trưởng Lão Mo',
    role: 'Tộc Trưởng',
    avatar: '👴',
    lines: [
      'Bạo chúa đã ngã xuống! Hoàng Thành Cự Thạch vĩnh hằng đã được thiết lập!',
      'Hỡi dũng sĩ, người đã trở thành Huyền Thoại của Kỷ Nguyên Hoang Cổ!'
    ]
  }
};

let currentSceneId = 1;
let currentLineIdx = 0;
let isTypewriting = false;
let typeTimer = null;

export function showDialogue(sceneId, callbacks = {}) {
  const sceneData = DIALOGUE_SCENES[sceneId];
  if (!sceneData) return;

  currentSceneId = sceneId;
  currentLineIdx = 0;
  window.isDialogueActive = true;

  const overlay = document.getElementById('cinematic-dialogue-overlay');
  if (overlay) overlay.style.display = 'flex';

  renderCurrentLine(callbacks);
}

function renderCurrentLine(callbacks = {}) {
  const sceneData = DIALOGUE_SCENES[currentSceneId];
  if (!sceneData || currentLineIdx >= sceneData.lines.length) {
    closeDialogue(callbacks);
    return;
  }

  const elSpeaker = document.getElementById('dialogue-speaker-name');
  const elText = document.getElementById('dialogue-content-text');
  const elAvatar = document.getElementById('dialogue-avatar-img');

  if (elSpeaker) elSpeaker.textContent = sceneData.avatar + ' ' + sceneData.speaker + ' (' + sceneData.role + ')';
  if (elAvatar) elAvatar.textContent = sceneData.avatar;

  const fullText = sceneData.lines[currentLineIdx];
  if (elText) {
    elText.textContent = '';
    let charIdx = 0;
    isTypewriting = true;
    clearInterval(typeTimer);
    typeTimer = setInterval(() => {
      if (charIdx < fullText.length) {
        elText.textContent += fullText[charIdx];
        charIdx++;
      } else {
        clearInterval(typeTimer);
        isTypewriting = false;
      }
    }, 18);
  }
}

export function advanceDialogue(callbacks = {}) {
  if (isTypewriting) {
    clearInterval(typeTimer);
    const sceneData = DIALOGUE_SCENES[currentSceneId];
    const elText = document.getElementById('dialogue-content-text');
    if (sceneData && elText) elText.textContent = sceneData.lines[currentLineIdx];
    isTypewriting = false;
    return;
  }
  currentLineIdx++;
  renderCurrentLine(callbacks);
}

export function closeDialogue(callbacks = {}) {
  clearInterval(typeTimer);
  window.isDialogueActive = false;
  const overlay = document.getElementById('cinematic-dialogue-overlay');
  if (overlay) overlay.style.display = 'none';
  if (callbacks.onDialogueComplete) callbacks.onDialogueComplete(currentSceneId);
}
