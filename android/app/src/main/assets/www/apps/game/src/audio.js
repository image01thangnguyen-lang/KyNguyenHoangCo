/**
 * Hệ thống Âm Thanh Sinh Tồn & Nhạc Nền Hoang Cổ Procedural (Zero-dependency Web Audio API).
 *
 * Tổng hợp 100% âm thanh thực tế bằng sóng âm, bộ lọc và bộ tạo tiếng ồn ngẫu nhiên:
 *  - 0 KB tải mạng, chạy mượt mà trên cả Trình duyệt Web và Android APK WebView.
 *  - Tiếng nhặt đồ, bổ rìu, câu cá, sập bẫy, chế tạo, đe búa, uống nước, quái gầm, hoàn thành nhiệm vụ...
 *  - Nhạc nền Ambient hoang sơ tự động đổi theo Ban Ngày / Ban Đêm / Đêm Trăng Máu.
 */

                     
            
          
            
               
           
           
         
                    
                 
          
            
           
           

                                                                    

class SoundSynthesizer {
          ctx                      = null;
          masterGain                  = null;
          sfxGain                  = null;
          bgmGain                  = null;

          soundEnabled = true;
          musicEnabled = false;

          currentMood                     = null;
          ambientInterval                = null;
          activeBgmNodes              = [];

  constructor() {
    // Tự động khôi phục cấu hình từ localStorage (mặc định tắt nhạc nền)
    try {
      const sfxPref = localStorage.getItem('khc_sound_enabled');
      if (sfxPref !== null) this.soundEnabled = sfxPref === 'true';
      this.musicEnabled = false;
    } catch {
      /* chạy trong sandbox an toàn */
    }
  }

  /** Khởi tạo AudioContext khi có tương tác đầu tiên của người dùng. */
          ensureContext()                      {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window                                                          ).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.soundEnabled ? 1.0 : 0, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(this.musicEnabled ? 0.35 : 0, this.ctx.currentTime);
      this.bgmGain.connect(this.masterGain);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

         setSoundEnabled(enabled         )       {
    this.soundEnabled = enabled;
    try {
      localStorage.setItem('khc_sound_enabled', String(enabled));
    } catch {}
    if (this.ctx && this.sfxGain) {
      this.sfxGain.gain.setValueAtTime(enabled ? 1.0 : 0, this.ctx.currentTime);
    }
  }

         isSoundEnabled()          {
    return this.soundEnabled;
  }

         setMusicEnabled(enabled         )       {
    this.musicEnabled = enabled;
    try {
      localStorage.setItem('khc_music_enabled', String(enabled));
    } catch {}
    if (this.ctx && this.bgmGain) {
      this.bgmGain.gain.setValueAtTime(enabled ? 0.35 : 0, this.ctx.currentTime);
    }
    if (enabled && this.currentMood) {
      this.setAmbientMood(this.currentMood);
    } else if (!enabled) {
      this.stopAmbient();
    }
  }

         isMusicEnabled()          {
    return this.musicEnabled;
  }

  /** Phát hiệu ứng âm thanh (SFX). */
         play(sfx         )       {
    if (!this.soundEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;

    const t = ctx.currentTime;

    switch (sfx) {
      case 'click': {
        // Tiếng click tương tác giòn giã, rõ nét (tăng âm lượng gấp đôi)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const g = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(920, t);
        osc1.frequency.exponentialRampToValueAtTime(360, t + 0.05);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1450, t);
        osc2.frequency.exponentialRampToValueAtTime(580, t + 0.038);

        g.gain.setValueAtTime(0.68, t); // Tăng âm lượng gấp đôi (từ 0.3 lên 0.68)
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

        osc1.connect(g);
        osc2.connect(g);
        g.connect(this.sfxGain);

        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + 0.05);
        osc2.stop(t + 0.05);
        break;
      }

      case 'pickup': {
        // Tiếng leng keng sột soạt tươi vui
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const g = ctx.createGain();
        osc1.type = 'sine';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(520, t);
        osc1.frequency.exponentialRampToValueAtTime(880, t + 0.12);
        osc2.frequency.setValueAtTime(1040, t);
        osc2.frequency.exponentialRampToValueAtTime(1320, t + 0.12);
        g.gain.setValueAtTime(0.35, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        osc1.connect(g);
        osc2.connect(g);
        g.connect(this.sfxGain);
        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + 0.14);
        osc2.stop(t + 0.14);
        break;
      }

      case 'chop': {
        // Tiếng rìu bổ gỗ trầm đanh
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, t);
        osc.frequency.exponentialRampToValueAtTime(45, t + 0.15);
        g.gain.setValueAtTime(0.7, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.15);
        break;
      }

      case 'splash': {
        // Tiếng nước bắn tung tóe
        const noise = this.createNoiseBuffer(ctx, 0.2);
        const src = ctx.createBufferSource();
        src.buffer = noise;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, t);
        filter.frequency.exponentialRampToValueAtTime(250, t + 0.2);
        filter.Q.setValueAtTime(3, t);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.6, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
        src.connect(filter);
        filter.connect(g);
        g.connect(this.sfxGain);
        src.start(t);
        break;
      }

      case 'trap_snap': {
        // Tiếng sập bẫy đanh gọn
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(350, t);
        osc.frequency.exponentialRampToValueAtTime(70, t + 0.08);
        g.gain.setValueAtTime(0.6, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.08);
        break;
      }

      case 'craft': {
        // Tiếng đe búa kim khí vang vọng
        const freqs = [659.25, 987.77, 1318.51];
        freqs.forEach((f, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, t + i * 0.04);
          g.gain.setValueAtTime(0.35, t + i * 0.04);
          g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.04 + 0.25);
          osc.connect(g);
          g.connect(this.sfxGain );
          osc.start(t + i * 0.04);
          osc.stop(t + i * 0.04 + 0.25);
        });
        break;
      }

      case 'drink': {
        // Tiếng uống ừng ực sảng khoái
        [0, 0.12, 0.24].forEach((delay) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(320, t + delay);
          osc.frequency.exponentialRampToValueAtTime(480, t + delay + 0.09);
          g.gain.setValueAtTime(0.4, t + delay);
          g.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.09);
          osc.connect(g);
          g.connect(this.sfxGain );
          osc.start(t + delay);
          osc.stop(t + delay + 0.09);
        });
        break;
      }

      case 'eat': {
        // Tiếng nhai giòn tan
        [0, 0.07, 0.14].forEach((delay) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(220 + Math.random() * 80, t + delay);
          osc.frequency.exponentialRampToValueAtTime(80, t + delay + 0.05);
          g.gain.setValueAtTime(0.4, t + delay);
          g.gain.exponentialRampToValueAtTime(0.01, t + delay + 0.05);
          osc.connect(g);
          g.connect(this.sfxGain );
          osc.start(t + delay);
          osc.stop(t + delay + 0.05);
        });
        break;
      }

      case 'quest_complete': {
        // Hợp âm ngũ cung thăng hoa chúc mừng hoàn thành nhiệm vụ
        const notes = [440, 554.37, 659.25, 880, 1108.73];
        notes.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, t + idx * 0.08);
          g.gain.setValueAtTime(0.4, t + idx * 0.08);
          g.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.5);
          osc.connect(g);
          g.connect(this.sfxGain );
          osc.start(t + idx * 0.08);
          osc.stop(t + idx * 0.08 + 0.5);
        });
        break;
      }

      case 'beat_notify': {
        // Tiếng đài truyền thanh / tín hiệu của Lạc Lạc
        [659.25, 880].forEach((f, i) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, t + i * 0.1);
          g.gain.setValueAtTime(0.3, t + i * 0.1);
          g.gain.exponentialRampToValueAtTime(0.01, t + i * 0.1 + 0.12);
          osc.connect(g);
          g.connect(this.sfxGain );
          osc.start(t + i * 0.1);
          osc.stop(t + i * 0.1 + 0.12);
        });
        break;
      }

      case 'roar': {
        // Tiếng gầm quái thú rền vang
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, t);
        osc.frequency.exponentialRampToValueAtTime(55, t + 0.45);
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.45);
        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.45);
        break;
      }

      case 'strike': {
        // Tiếng vung kiếm / trúng đòn
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(480, t);
        osc.frequency.exponentialRampToValueAtTime(120, t + 0.1);
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.1);
        break;
      }

      case 'heal': {
        // Tiếng hồi phục ấm áp
        [330, 440, 550, 660].forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, t + idx * 0.07);
          g.gain.setValueAtTime(0.3, t + idx * 0.07);
          g.gain.exponentialRampToValueAtTime(0.01, t + idx * 0.07 + 0.35);
          osc.connect(g);
          g.connect(this.sfxGain );
          osc.start(t + idx * 0.07);
          osc.stop(t + idx * 0.07 + 0.35);
        });
        break;
      }
    }
  }

  /** Điều chỉnh nhạc nền Ambient theo thời gian thực (Đã tắt theo yêu cầu người dùng). */
         setAmbientMood(_mood             )       {
    this.stopAmbient();
  }

         stopAmbient()       {
    if (this.ambientInterval !== null) {
      clearInterval(this.ambientInterval);
      this.ambientInterval = null;
    }
  }

          createNoiseBuffer(ctx              , duration        )              {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}

export const audio = new SoundSynthesizer();
