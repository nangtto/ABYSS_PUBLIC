import { GameSettings } from './types';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private settings: GameSettings;
  private droneOsc: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private currentDroneFreq = 0;

  constructor(settings: GameSettings) {
    this.settings = settings;
  }

  public updateSettings(settings: GameSettings): void {
    this.settings = settings;
    if (this.droneGain && this.ctx) {
      const target = this.settings.muted
        ? 0
        : this.settings.masterVolume * this.settings.bgmVolume * 0.08;
      this.droneGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.settings.muted) return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getSfxGain(): number {
    if (this.settings.muted) return 0;
    return Math.max(0, Math.min(1, this.settings.masterVolume * this.settings.sfxVolume));
  }

  public startBiomeDrone(freq: number): void {
    if (this.settings.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (this.droneOsc && Math.abs(this.currentDroneFreq - freq) < 0.5) {
      return;
    }
    this.stopBiomeDrone();
    this.currentDroneFreq = freq;

    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = freq;

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = freq * 1.5;

    const targetGain = this.settings.masterVolume * this.settings.bgmVolume * 0.065;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, targetGain), ctx.currentTime + 0.8);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();

    this.droneOsc = osc1;
    this.droneOsc2 = osc2;
    this.droneGain = gain;
  }

  public stopBiomeDrone(): void {
    try {
      this.droneOsc?.stop();
      this.droneOsc2?.stop();
    } catch {
      // ignore already stopped
    }
    this.droneOsc = null;
    this.droneOsc2 = null;
    this.droneGain = null;
    this.currentDroneFreq = 0;
  }

  public playAttack(kind: 'slash' | 'heavy' | 'stab' | 'magic' | 'bow' = 'slash'): void {
    const ctx = this.ensureContext();
    const vol = this.getSfxGain();
    if (!ctx || vol <= 0) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (kind === 'heavy') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.16);
      gain.gain.setValueAtTime(0.22 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    } else if (kind === 'magic') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.11);
      gain.gain.setValueAtTime(0.16 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    } else if (kind === 'bow') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);
      gain.gain.setValueAtTime(0.18 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.09);
      gain.gain.setValueAtTime(0.18 * vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playHit(isCrit = false): void {
    const ctx = this.ensureContext();
    const vol = this.getSfxGain();
    if (!ctx || vol <= 0) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isCrit ? 'square' : 'sawtooth';
    osc.frequency.setValueAtTime(isCrit ? 290 : 170, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + (isCrit ? 0.13 : 0.08));

    gain.gain.setValueAtTime((isCrit ? 0.24 : 0.15) * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isCrit ? 0.14 : 0.09));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playPlayerHurt(): void {
    const ctx = this.ensureContext();
    const vol = this.getSfxGain();
    if (!ctx || vol <= 0) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(70, now + 0.18);
    gain.gain.setValueAtTime(0.25 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  public playEnemyDeath(): void {
    const ctx = this.ensureContext();
    const vol = this.getSfxGain();
    if (!ctx || vol <= 0) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.16);
    gain.gain.setValueAtTime(0.14 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  public playDodge(): void {
    const ctx = this.ensureContext();
    const vol = this.getSfxGain();
    if (!ctx || vol <= 0) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.09);
    gain.gain.setValueAtTime(0.14 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playSkill(): void {
    const ctx = this.ensureContext();
    const vol = this.getSfxGain();
    if (!ctx || vol <= 0) return;

    const now = ctx.currentTime;
    [392, 523.25, 659.25].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.03);
      gain.gain.setValueAtTime(0.12 * vol, now + i * 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.03 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.03);
      osc.stop(now + i * 0.03 + 0.2);
    });
  }

  public playPickup(rare = false): void {
    const ctx = this.ensureContext();
    const vol = this.getSfxGain();
    if (!ctx || vol <= 0) return;

    const now = ctx.currentTime;
    const notes = rare ? [587.33, 783.99, 1046.5] : [659.25, 880];
    notes.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.05);
      gain.gain.setValueAtTime(0.14 * vol, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.14);
    });
  }

  public playLevelUp(): void {
    const ctx = this.ensureContext();
    const vol = this.getSfxGain();
    if (!ctx || vol <= 0) return;

    const now = ctx.currentTime;
    [440, 554.37, 659.25, 880].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.07);
      gain.gain.setValueAtTime(0.18 * vol, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.28);
    });
  }

  public playBossIntro(): void {
    const ctx = this.ensureContext();
    const vol = this.getSfxGain();
    if (!ctx || vol <= 0) return;

    const now = ctx.currentTime;
    [110, 103.83, 98].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now + i * 0.16);
      gain.gain.setValueAtTime(0.2 * vol, now + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.16 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.16);
      osc.stop(now + i * 0.16 + 0.38);
    });
  }

  public playClick(): void {
    const ctx = this.ensureContext();
    const vol = this.getSfxGain();
    if (!ctx || vol <= 0) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.04);
    gain.gain.setValueAtTime(0.09 * vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }
}
