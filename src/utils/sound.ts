class SoundSystem {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private voices: SpeechSynthesisVoice[] = [];
  private voicesLoaded: boolean = false;

  constructor() {
    // Sound enabled by default
    const saved = localStorage.getItem('snowman_sound_enabled');
    if (saved !== null) {
      this.enabled = saved === 'true';
    }
    this.initVoices();
  }

  private initVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const loadVoices = () => {
      try {
        const v = window.speechSynthesis.getVoices();
        if (v && v.length > 0) {
          this.voices = v;
          this.voicesLoaded = true;
        }
      } catch {
        // ignore
      }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(val: boolean): void {
    this.enabled = val;
    localStorage.setItem('snowman_sound_enabled', String(val));
  }

  private initCtx(): AudioContext | null {
    if (!this.enabled) return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  // 1. Crystal Chime: 5 minutes before entry
  public playBeforeEntry(): void {
    const ctx = this.initCtx();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

      gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.08);
      osc.stop(ctx.currentTime + idx * 0.08 + 0.45);
    });
  }

  // 2. Spawn Window Entry: Boss can spawn now!
  public playEntryReached(): void {
    const ctx = this.initCtx();
    if (!ctx) return;

    const chords = [587.33, 880, 1174.66]; // D5, A5, D6
    chords.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.1);

      gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + idx * 0.1 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.1 + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.1);
      osc.stop(ctx.currentTime + idx * 0.1 + 0.65);
    });
  }

  // 3. Guaranteed Reached: Red urgent alert
  public playGuaranteedReached(): void {
    const ctx = this.initCtx();
    if (!ctx) return;

    const pulses = [0, 0.2, 0.4];
    pulses.forEach((timeOffset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime + timeOffset);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + timeOffset + 0.15);

      gain.gain.setValueAtTime(0, ctx.currentTime + timeOffset);
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + timeOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + timeOffset + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + timeOffset);
      osc.stop(ctx.currentTime + timeOffset + 0.2);
    });
  }

  // Action Click feedback
  public playClick(): void {
    const ctx = this.initCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  }

  // Female voice selection helper
  public getFemaleZhVoice(): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    let list = this.voices;
    if (!list || list.length === 0) {
      try {
        list = window.speechSynthesis.getVoices();
        this.voices = list;
      } catch {
        list = [];
      }
    }
    if (!list || list.length === 0) return null;

    // Filter Chinese voices (zh-CN, zh-TW, zh-HK, cmn, etc.)
    const zhVoices = list.filter((v) => {
      const lang = (v.lang || '').toLowerCase().replace('_', '-');
      return lang.startsWith('zh') || lang.startsWith('cmn');
    });

    // Preferred female Chinese voice models (e.g. Edge Xiaoxiao/Xiaoyi, Windows Huihui/Yaoyao, Apple Ting-Ting/Sin-ji/Meijia)
    const preferredFemaleNames = [
      'xiaoxiao',
      'xiaoyi',
      'ting-ting',
      'tingting',
      'huihui',
      'yaoyao',
      'meijia',
      'mei-jia',
      'sin-ji',
      'sinji',
      'natural',
      'female',
      '女',
      'woman'
    ];

    const matchPreferred = zhVoices.find((v) => {
      const name = (v.name || '').toLowerCase();
      return preferredFemaleNames.some((kw) => name.includes(kw));
    });

    if (matchPreferred) return matchPreferred;

    // Next preference: zh-CN voice
    const zhCn = zhVoices.find((v) => {
      const lang = (v.lang || '').toLowerCase();
      return lang.includes('cn') || lang.includes('hans');
    });
    if (zhCn) return zhCn;

    // Fallback to any Chinese voice
    if (zhVoices.length > 0) return zhVoices[0];

    return null;
  }

  // Core Speech Synthesis method
  public speak(text: string, isFemale: boolean = true): void {
    if (!this.enabled) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    try {
      // Resume if paused
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 1.0; // Natural pace
      utterance.pitch = isFemale ? 1.2 : 1.0; // 1.2 gives a distinct, clear and sweet female pitch
      utterance.volume = 1.0;

      const voice = this.getFemaleZhVoice();
      if (voice) {
        utterance.voice = voice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis playback error:', err);
    }
  }

  // 1. 进刷时间倒计时完毕: 女声语音播报“XX频道已进入刷时间，请注意蹲守击杀”
  public speakEntryReached(channelNo: number): void {
    if (!this.enabled) return;
    this.playEntryReached();
    this.speak(`${channelNo}频道已进入刷时间，请注意蹲守击杀`, true);
  }

  // 2. 进刷时间倒计时仅剩5分钟: 女声语音播报“XX频道距离进入刷时间仅剩5分钟”
  public speakBeforeEntry(channelNo: number): void {
    if (!this.enabled) return;
    this.playBeforeEntry();
    this.speak(`${channelNo}频道距离进入刷时间仅剩5分钟`, true);
  }

  // Helper to test voice broadcast
  public testVoice(type: 'entry' | 'before_5m', channelNo: number = 1): void {
    if (type === 'entry') {
      this.speakEntryReached(channelNo);
    } else {
      this.speakBeforeEntry(channelNo);
    }
  }
}

export const sound = new SoundSystem();

// Browser desktop notifications helper
export function sendDesktopNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/src/assets/images/snowman_boss_emblem_1793630816599.jpg',
      });
    } catch {
      // ignore
    }
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission !== 'denied') {
    const res = await Notification.requestPermission();
    return res === 'granted';
  }
  return false;
}
