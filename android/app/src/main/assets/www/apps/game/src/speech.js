/**
 * Hệ thống Giọng Dẫn Chuyện Lạc Lạc (Web Speech Synthesis API).
 *
 * Tự động đọc lời dẫn truyện bằng giọng tiếng Việt truyền cảm khi người chơi đi bộ,
 * tái hiện trọn vẹn trải nghiệm cốt truyện sống động của Zombies, Run! mà không cần file audio nặng.
 */

class SpeechEngine {
          synth                         = null;
          viVoice                              = null;
          enabled = true;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoice();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoice();
      }
    }
  }

          loadVoice()       {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    this.viVoice =
      voices.find((v) => v.lang.toLowerCase().startsWith('vi')) ??
      voices.find((v) => v.lang.toLowerCase().includes('vn')) ??
      null;
  }

         setEnabled(enabled         )       {
    this.enabled = enabled;
    if (!enabled) this.stop();
  }

         isEnabled()          {
    return this.enabled;
  }

  /** Đọc đoạn thoại dẫn chuyện của Lạc Lạc. */
         speak(text        )       {
    if (!this.enabled || !this.synth) return;

    this.synth.cancel(); // Dừng câu cũ nếu còn

    const cleanText = text.replace(/[*_#`~]/g, ''); // Bỏ ký tự markdown
    const utter = new SpeechSynthesisUtterance(cleanText);

    if (this.viVoice) {
      utter.voice = this.viVoice;
      utter.lang = this.viVoice.lang;
    } else {
      utter.lang = 'vi-VN';
    }

    utter.rate = 1.15; // Tăng tốc độ nói ~1.2 lần so với ban đầu (0.95 -> 1.15), vừa vặn và dễ nghe
    utter.pitch = 1.05; // Cao độ thân thiện của trợ lý Lạc Lạc
    utter.volume = 0.9;

    this.synth.speak(utter);
  }

         stop()       {
    if (this.synth) {
      this.synth.cancel();
    }
  }
}

export const speech = new SpeechEngine();
