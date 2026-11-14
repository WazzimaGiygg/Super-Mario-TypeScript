/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Web Audio API Synthesizer for Authentic NES Chiptune Music & Sound Effects

type Note = [freq: number, duration: number];

// Standard Note Frequencies (Hz)
const N = {
  REST: 0,
  G2: 98.00,
  C3: 130.81, D3: 146.83, Ds3: 155.56, E3: 164.81, F3: 174.61, Fs3: 185.00, G3: 196.00, Gs3: 207.65, A3: 220.00, As3: 233.08, B3: 246.94,
  C4: 261.63, Cs4: 277.18, D4: 293.66, Ds4: 311.13, E4: 329.63, F4: 349.23, Fs4: 369.99, G4: 392.00, Gs4: 415.30, A4: 440.00, As4: 466.16, B4: 493.88,
  C5: 523.25, Cs5: 554.37, D5: 587.33, Ds5: 622.25, E5: 659.25, F5: 698.46, Fs5: 739.99, G5: 783.99, Gs5: 830.61, A5: 880.00, As5: 932.33, B5: 987.77,
  C6: 1046.50, D6: 1174.66, Ds6: 1244.51, E6: 1318.51, F6: 1396.91, Fs6: 1479.98, G6: 1567.98, Gs6: 1661.22, A6: 1760.00, As6: 1864.66, B6: 1975.53,
};

export class SoundEngine {
  private static instance: SoundEngine;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private isMuted: boolean = false;
  private volume: number = 0.6;
  private musicEnabled: boolean = true;
  private currentTrack: 'overworld' | 'underground' | 'underwater' | 'castle' | 'none' = 'none';

  // Music sequence playback state
  private musicTimer: number | null = null;
  private musicStep: number = 0;
  private musicPaused: boolean = false;
  private currentScore: Note[] = [];
  private currentBass: Note[] = [];

  private constructor() {
    // Lazy init on first user touch/click
  }

  public static get(): SoundEngine {
    if (!SoundEngine.instance) {
      SoundEngine.instance = new SoundEngine();
    }
    return SoundEngine.instance;
  }

  private init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);
    } catch {
      // AudioContext not supported or blocked
    }
  }

  public resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public toggleMusic(): boolean {
    this.musicEnabled = !this.musicEnabled;
    if (!this.musicEnabled) {
      this.stopMusic();
    } else {
      if (this.currentTrack === 'overworld') this.playMusic('overworld');
      else if (this.currentTrack === 'underground') this.playMusic('underground');
      else if (this.currentTrack === 'underwater') this.playMusic('underwater');
      else if (this.currentTrack === 'castle') this.playMusic('castle');
    }
    return this.musicEnabled;
  }

  public getStatus() {
    return {
      muted: this.isMuted,
      volume: this.volume,
      musicEnabled: this.musicEnabled,
    };
  }

  // --- SOUND EFFECTS ---

  public playJumpSmall() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(560, now + 0.14);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.16);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playJumpSuper() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.2);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.22);
  }

  public playSwim() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.11);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playCoin() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(N.B5, now);
    osc.frequency.setValueAtTime(N.E6, now + 0.08);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.setValueAtTime(0.3, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  public playStomp() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playKick() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.15);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playBump() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(50, now + 0.1);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playBrickBreak() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // Noise buffer burst
    const bufferSize = this.ctx.sampleRate * 0.18;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.linearRampToValueAtTime(150, now + 0.18);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.18);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
  }

  public playPowerUpAppear() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const notes = [N.C4, N.E4, N.G4, N.C5, N.E5, N.G5, N.C6];
    const duration = 0.05;
    const now = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const start = now + idx * duration;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.25, start);
      gain.gain.linearRampToValueAtTime(0.01, start + duration);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(start);
      osc.stop(start + duration);
    });
  }

  public playPowerUpEat() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const notes = [
      N.B4, N.A4, N.B4, N.C5, N.D5, N.E5, N.F5, N.G5, N.A5, N.B5, N.C6
    ];
    const duration = 0.045;
    const now = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      const start = now + idx * duration;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.3, start);
      gain.gain.linearRampToValueAtTime(0.01, start + duration);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(start);
      osc.stop(start + duration);
    });
  }

  public playPipe() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.35);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  public playFireball() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.linearRampToValueAtTime(250, now + 0.09);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playBowserFire() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const bufferSize = Math.floor(this.ctx.sampleRate * 0.28);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.28);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start(now);
  }

  public playBridgeCollapse() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.55);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.55);
  }

  public playFlagpole() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(150, now + 0.8);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.85);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.85);
  }

  public playStageClear() {
    this.stopMusic();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const melody: Note[] = [
      [N.G4, 0.12], [N.C5, 0.12], [N.E5, 0.12], [N.G5, 0.12], [N.C6, 0.12], [N.E6, 0.24],
      [N.G6, 0.24], [N.E6, 0.3], [N.Gs4, 0.12], [N.C5, 0.12], [N.Ds5, 0.12], [N.Gs5, 0.12],
      [N.C6, 0.12], [N.Ds6, 0.24], [N.Gs6, 0.24], [N.Ds6, 0.3], [N.As4, 0.12], [N.D5, 0.12],
      [N.F5, 0.12], [N.As5, 0.12], [N.D6, 0.12], [N.F6, 0.24], [N.As6, 0.24], [N.B6, 0.5],
    ];

    let t = now;
    melody.forEach(([freq, dur]) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.linearRampToValueAtTime(0.01, t + dur);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(t);
      osc.stop(t + dur);
      t += dur + 0.02;
    });
  }

  public playCountTick() {
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.linearRampToValueAtTime(440, now + 0.022);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.022);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.022);
  }

  public playDeath() {
    this.stopMusic();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const notes: Note[] = [
      [N.B4, 0.12], [N.F5, 0.12], [N.REST, 0.08], [N.F5, 0.12],
      [N.F5, 0.15], [N.E5, 0.15], [N.D5, 0.15], [N.C5, 0.3],
    ];

    let t = now;
    notes.forEach(([freq, dur]) => {
      if (freq > 0) {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.linearRampToValueAtTime(0.01, t + dur);

        osc.connect(gain);
        gain.connect(this.sfxGain!);

        osc.start(t);
        osc.stop(t + dur);
      }
      t += dur + 0.02;
    });
  }

  public playGameOver() {
    this.stopMusic();
    this.resume();
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    const notes: Note[] = [
      [N.C5, 0.15], [N.G4, 0.15], [N.E4, 0.2],
      [N.A4, 0.15], [N.B4, 0.15], [N.A4, 0.15], [N.Gs4, 0.15],
      [N.As4, 0.15], [N.Gs4, 0.15], [N.G4, 0.3],
    ];

    let t = now;
    notes.forEach(([freq, dur]) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.linearRampToValueAtTime(0.01, t + dur);

      osc.connect(gain);
      gain.connect(this.sfxGain!);

      osc.start(t);
      osc.stop(t + dur);
      t += dur + 0.03;
    });
  }

  public playPause() {
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    this.resume();
    const notes = [1318.51, 1046.5, 1318.51, 1046.5];
    let t = this.ctx.currentTime;
    notes.forEach(freq => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.055);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(t);
      osc.stop(t + 0.06);
      t += 0.06;
    });
  }

  public setMusicPaused(paused: boolean) {
    if (paused) {
      this.musicPaused = true;
      this.stopMusicSequence();
    } else if (this.musicPaused) {
      this.musicPaused = false;
      if (this.musicEnabled && this.currentTrack !== 'none') {
        this.playNextMusicSlice();
      }
    }
  }

  // --- BACKGROUND MUSIC ENGINE ---

  public playMusic(track: 'overworld' | 'underground' | 'underwater' | 'castle') {
    this.currentTrack = track;
    this.musicPaused = false;
    if (!this.musicEnabled) return;
    this.stopMusicSequence();
    this.resume();

    if (track === 'overworld') {
      this.initOverworldMusic();
    } else if (track === 'underground') {
      this.initUndergroundMusic();
    } else if (track === 'underwater') {
      this.initUnderwaterMusic();
    } else if (track === 'castle') {
      this.initCastleMusic();
    }
  }

  public stopMusic() {
    this.currentTrack = 'none';
    this.musicPaused = false;
    this.stopMusicSequence();
  }

  private stopMusicSequence() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private initOverworldMusic() {
    // Iconic Super Mario Bros Overworld Main Melody
    const E = 0.13; // eighth note duration
    const Q = 0.26; // quarter note
    const H = 0.52; // half note

    // Lead melody pattern
    this.currentScore = [
      // Intro riff
      [N.E5, E], [N.E5, E], [N.REST, E], [N.E5, E], [N.REST, E], [N.C5, E], [N.E5, Q],
      [N.G5, Q], [N.REST, Q], [N.G4, Q], [N.REST, Q],

      // Section A
      [N.C5, Q], [N.REST, E], [N.G4, E], [N.REST, E], [N.E4, Q],
      [N.REST, E], [N.A4, E], [N.B4, E], [N.As4, E], [N.A4, E],
      [N.G4, E], [N.E5, E], [N.G5, E], [N.A5, Q], [N.F5, E], [N.G5, E],
      [N.REST, E], [N.E5, E], [N.C5, E], [N.D5, E], [N.B4, Q],

      // Repeat Section A
      [N.C5, Q], [N.REST, E], [N.G4, E], [N.REST, E], [N.E4, Q],
      [N.REST, E], [N.A4, E], [N.B4, E], [N.As4, E], [N.A4, E],
      [N.G4, E], [N.E5, E], [N.G5, E], [N.A5, Q], [N.F5, E], [N.G5, E],
      [N.REST, E], [N.E5, E], [N.C5, E], [N.D5, E], [N.B4, Q],

      // Section B (Castle approach bridge)
      [N.REST, Q], [N.G5, E], [N.Fs5, E], [N.F5, E], [N.Ds5, E], [N.E5, E],
      [N.REST, E], [N.Gs4, E], [N.A4, E], [N.C5, E], [N.REST, E], [N.A4, E], [N.C5, E], [N.D5, E],
      [N.REST, Q], [N.G5, E], [N.Fs5, E], [N.F5, E], [N.Ds5, E], [N.E5, E],
      [N.C6, E], [N.REST, E], [N.C6, E], [N.C6, Q],
    ];

    // Bassline pattern (triangle wave)
    this.currentBass = [
      [N.D3, E], [N.D3, E], [N.REST, E], [N.D3, E], [N.REST, E], [N.D3, E], [N.D3, Q],
      [N.G3, Q], [N.REST, Q], [N.G2, Q], [N.REST, Q],

      [N.G3, E], [N.C4, E], [N.E3, E], [N.G3, E], [N.C3, E],
      [N.F3, E], [N.C4, E], [N.F3, E], [N.C4, E],
      [N.C3, E], [N.G3, E], [N.C4, E], [N.F3, E], [N.C4, E],
      [N.G3, E], [N.D4, E], [N.G3, E], [N.B3, E],

      [N.G3, E], [N.C4, E], [N.E3, E], [N.G3, E], [N.C3, E],
      [N.F3, E], [N.C4, E], [N.F3, E], [N.C4, E],
      [N.C3, E], [N.G3, E], [N.C4, E], [N.F3, E], [N.C4, E],
      [N.G3, E], [N.D4, E], [N.G3, E], [N.B3, E],

      [N.C3, E], [N.G3, E], [N.C4, E], [N.G3, E],
      [N.F3, E], [N.C4, E], [N.F3, E], [N.C4, E],
      [N.C3, E], [N.G3, E], [N.C4, E], [N.G3, E],
      [N.G3, E], [N.G3, E], [N.G3, E], [N.G3, Q],
    ];

    this.musicStep = 0;
    this.playNextMusicSlice();
  }

  private initUndergroundMusic() {
    const E = 0.14;
    this.currentScore = [
      [N.C4, E], [N.C5, E], [N.A3, E], [N.A4, E], [N.As3, E], [N.As4, E], [N.REST, E * 4],
      [N.C4, E], [N.C5, E], [N.A3, E], [N.A4, E], [N.As3, E], [N.As4, E], [N.REST, E * 4],
      [N.F3, E], [N.F4, E], [N.D3, E], [N.D4, E], [N.Ds3, E], [N.Ds4, E], [N.REST, E * 4],
      [N.F3, E], [N.F4, E], [N.D3, E], [N.D4, E], [N.Ds3, E], [N.Ds4, E], [N.REST, E * 4],
    ];
    this.currentBass = this.currentScore;
    this.musicStep = 0;
    this.playNextMusicSlice();
  }

  private initUnderwaterMusic() {
    // Classic 3/4 underwater waltz feel
    const E = 0.18;
    const Q = 0.36;
    const H = 0.72;

    this.currentScore = [
      // Phrase 1
      [N.D4, E], [N.E4, E], [N.Fs4, E], [N.G4, E], [N.A4, E], [N.As4, E],
      [N.B4, Q], [N.B4, E], [N.B4, Q], [N.G4, E],
      [N.E5, H], [N.D5, Q],
      [N.C5, Q], [N.A4, E], [N.F4, Q], [N.D4, E],
      [N.B4, H], [N.REST, Q],

      // Phrase 2
      [N.B4, Q], [N.B4, E], [N.B4, Q], [N.G4, E],
      [N.F5, H], [N.E5, Q],
      [N.D5, Q], [N.B4, E], [N.G4, Q], [N.E4, E],
      [N.A4, H], [N.REST, Q],

      // Phrase 3 (lift)
      [N.D5, E], [N.E5, E], [N.F5, E], [N.G5, Q], [N.E5, E],
      [N.C5, Q], [N.A4, E], [N.G4, Q], [N.E4, E],
      [N.C5, H], [N.B4, Q],
      [N.G4, H], [N.REST, Q],
    ];

    this.currentBass = [
      // 3/4 waltz bass accompaniment
      [N.G3, E], [N.REST, E], [N.D3, E], [N.G3, E], [N.REST, E], [N.D3, E],
      [N.G3, Q], [N.D4, E], [N.G3, Q], [N.D4, E],
      [N.C3, H], [N.G3, Q],
      [N.F3, Q], [N.C4, E], [N.D3, Q], [N.A3, E],
      [N.G3, H], [N.D3, Q],

      [N.G3, Q], [N.D4, E], [N.G3, Q], [N.B3, E],
      [N.D3, H], [N.A3, Q],
      [N.G3, Q], [N.D4, E], [N.E3, Q], [N.B3, E],
      [N.D3, H], [N.A3, Q],

      [N.F3, E], [N.G3, E], [N.A3, E], [N.C4, Q], [N.G3, E],
      [N.F3, Q], [N.C4, E], [N.E3, Q], [N.C4, E],
      [N.D3, H], [N.G3, Q],
      [N.C3, H], [N.G3, Q],
    ];

    this.musicStep = 0;
    this.playNextMusicSlice();
  }

  private initCastleMusic() {
    // Tense, driving 8-bit Castle theme
    const S = 0.095;
    this.currentScore = [
      [N.D4, S], [N.G4, S], [N.Fs4, S], [N.G4, S], [N.Gs4, S], [N.G4, S], [N.Fs4, S], [N.G4, S],
      [N.D4, S], [N.G4, S], [N.Fs4, S], [N.G4, S], [N.As4, S], [N.A4, S], [N.Gs4, S], [N.G4, S],
      [N.Cs4, S], [N.Fs4, S], [N.F4, S], [N.Fs4, S], [N.G4, S], [N.Fs4, S], [N.F4, S], [N.Fs4, S],
      [N.Cs4, S], [N.Fs4, S], [N.F4, S], [N.Fs4, S], [N.A4, S], [N.Gs4, S], [N.G4, S], [N.Fs4, S],
      [N.E4, S], [N.A4, S], [N.Gs4, S], [N.A4, S], [N.B4, S], [N.A4, S], [N.Gs4, S], [N.A4, S],
      [N.F4, S], [N.As4, S], [N.A4, S], [N.As4, S], [N.C5, S], [N.B4, S], [N.As4, S], [N.A4, S],
    ];
    this.currentBass = [
      [N.G3, S], [N.REST, S], [N.G3, S], [N.D3, S], [N.G3, S], [N.REST, S], [N.G3, S], [N.D3, S],
      [N.G3, S], [N.REST, S], [N.G3, S], [N.D3, S], [N.As3, S], [N.A3, S], [N.Gs3, S], [N.G3, S],
      [N.Fs3, S], [N.REST, S], [N.Fs3, S], [N.Cs4, S], [N.Fs3, S], [N.REST, S], [N.Fs3, S], [N.Cs4, S],
      [N.Fs3, S], [N.REST, S], [N.Fs3, S], [N.Cs4, S], [N.A3, S], [N.Gs3, S], [N.G3, S], [N.Fs3, S],
      [N.A3, S], [N.REST, S], [N.A3, S], [N.E3, S], [N.A3, S], [N.REST, S], [N.A3, S], [N.E3, S],
      [N.As3, S], [N.REST, S], [N.As3, S], [N.F3, S], [N.C4, S], [N.B3, S], [N.As3, S], [N.A3, S],
    ];
    this.musicStep = 0;
    this.playNextMusicSlice();
  }

  private playNextMusicSlice() {
    if (this.musicPaused || !this.musicEnabled || !this.ctx || !this.musicGain || this.currentScore.length === 0) return;

    const [noteFreq, noteDur] = this.currentScore[this.musicStep % this.currentScore.length];
    const [bassFreq] = this.currentBass[this.musicStep % this.currentBass.length];

    const now = this.ctx.currentTime;

    // Lead pulse voice
    if (noteFreq > 0) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(noteFreq, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + noteDur * 0.9);

      osc.connect(gain);
      gain.connect(this.musicGain);

      osc.start(now);
      osc.stop(now + noteDur);
    }

    // Bass triangle voice
    if (bassFreq > 0) {
      const bOsc = this.ctx.createOscillator();
      const bGain = this.ctx.createGain();
      bOsc.type = 'triangle';
      bOsc.frequency.setValueAtTime(bassFreq, now);

      bGain.gain.setValueAtTime(0.25, now);
      bGain.gain.exponentialRampToValueAtTime(0.01, now + noteDur * 0.9);

      bOsc.connect(bGain);
      bGain.connect(this.musicGain);

      bOsc.start(now);
      bOsc.stop(now + noteDur);
    }

    this.musicStep++;
    this.musicTimer = window.setTimeout(() => {
      this.playNextMusicSlice();
    }, noteDur * 1000);
  }
}
