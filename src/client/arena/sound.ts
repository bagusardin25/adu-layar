// Procedural Web Audio API sound effects for Adu Layangan.
//
// All sounds are generated in code using oscillators, filters, and noise buffers.
// Zero external audio files (.mp3/.wav), zero network requests, zero latency.
// Fully compliant with Reddit Devvit sandbox rules and mobile webview restrictions.

const MUTE_KEY = 'adu_sound_muted';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted: boolean = false;
  private initialized: boolean = false;

  // Continuous sound nodes
  private windSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;

  private frictionOsc: OscillatorNode | null = null;
  private frictionFilter: BiquadFilterNode | null = null;
  private frictionGain: GainNode | null = null;
  private frictionNoiseSource: AudioBufferSourceNode | null = null;
  private frictionNoiseGain: GainNode | null = null;

  constructor() {
    if (typeof window === 'undefined') return;
    try {
      this.muted = window.localStorage.getItem(MUTE_KEY) === 'true';
    } catch {
      this.muted = false;
    }

    // Suspend or mute on visibility change to avoid background drone
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.pause();
        } else {
          this.resume();
        }
      });
    }
  }

  /** Unlocks AudioContext on user gesture. Safe to call multiple times. */
  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(
        this.muted ? 0 : 1,
        this.ctx.currentTime
      );
      this.masterGain.connect(this.ctx.destination);
      this.setupNoiseBuffer();
      this.setupContinuousNodes();
      this.initialized = true;
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    return this.setMuted(!this.muted);
  }

  public setMuted(muted: boolean): boolean {
    this.muted = muted;
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(MUTE_KEY, muted ? 'true' : 'false');
      }
    } catch {
      // ignore storage errors
    }

    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 1, now, 0.05);
    }
    return this.muted;
  }

  private pause(): void {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  private resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /** Generates a 2-second looped pink/white noise buffer for wind and friction */
  private setupNoiseBuffer(): void {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    // Pinkish noise approximation
    let b0 = 0,
      b1 = 0,
      b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
    }
    this.noiseBuffer = buffer;
  }

  private setupContinuousNodes(): void {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

    // 1. Wind loop
    this.windSource = this.ctx.createBufferSource();
    this.windSource.buffer = this.noiseBuffer;
    this.windSource.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.setValueAtTime(260, this.ctx.currentTime);
    this.windFilter.Q.setValueAtTime(1.5, this.ctx.currentTime);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    this.windSource.start(0);

    // 2. Friction / Sawing loop
    this.frictionOsc = this.ctx.createOscillator();
    this.frictionOsc.type = 'sawtooth';
    this.frictionOsc.frequency.setValueAtTime(420, this.ctx.currentTime);

    this.frictionFilter = this.ctx.createBiquadFilter();
    this.frictionFilter.type = 'bandpass';
    this.frictionFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
    this.frictionFilter.Q.setValueAtTime(4.0, this.ctx.currentTime);

    this.frictionGain = this.ctx.createGain();
    this.frictionGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.frictionOsc.connect(this.frictionFilter);
    this.frictionFilter.connect(this.frictionGain);
    this.frictionGain.connect(this.masterGain);
    this.frictionOsc.start(0);

    // Friction grit (high noise)
    this.frictionNoiseSource = this.ctx.createBufferSource();
    this.frictionNoiseSource.buffer = this.noiseBuffer;
    this.frictionNoiseSource.loop = true;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(2200, this.ctx.currentTime);

    this.frictionNoiseGain = this.ctx.createGain();
    this.frictionNoiseGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.frictionNoiseSource.connect(noiseFilter);
    noiseFilter.connect(this.frictionNoiseGain);
    this.frictionNoiseGain.connect(this.masterGain);
    this.frictionNoiseSource.start(0);
  }

  /**
   * Updates wind whoosh intensity.
   * Rises when pulling or diving, drops to gentle breeze when drifting.
   */
  public updateWind(pull: boolean, vy: number): void {
    if (!this.ctx || !this.windFilter || !this.windGain || !this.initialized)
      return;
    const now = this.ctx.currentTime;
    const diveFactor = Math.max(0, vy / 300);
    const targetFreq = pull
      ? 550 + diveFactor * 400
      : 220 + diveFactor * 180;
    const targetVol = pull
      ? 0.28 + diveFactor * 0.15
      : 0.06 + diveFactor * 0.08;

    this.windFilter.frequency.setTargetAtTime(targetFreq, now, 0.08);
    this.windGain.gain.setTargetAtTime(targetVol, now, 0.08);
  }

  /**
   * Updates friction / sawing sound when two strings rub each other.
   * @param rub Relative velocity of rubbing between strings (0 when separated)
   */
  public updateFriction(rub: number): void {
    if (
      !this.ctx ||
      !this.frictionGain ||
      !this.frictionOsc ||
      !this.frictionFilter ||
      !this.frictionNoiseGain ||
      !this.initialized
    )
      return;

    const now = this.ctx.currentTime;
    if (rub <= 0.01) {
      this.frictionGain.gain.setTargetAtTime(0, now, 0.03);
      this.frictionNoiseGain.gain.setTargetAtTime(0, now, 0.03);
      return;
    }

    // Scale intensity by rub velocity (typically 20 - 250)
    const intensity = Math.min(1, rub / 180);
    const targetVol = 0.15 + intensity * 0.25;
    const freq = 360 + intensity * 380;
    const filterFreq = 1200 + intensity * 1200;

    this.frictionOsc.frequency.setTargetAtTime(freq, now, 0.03);
    this.frictionFilter.frequency.setTargetAtTime(filterFreq, now, 0.03);
    this.frictionGain.gain.setTargetAtTime(targetVol, now, 0.03);
    this.frictionNoiseGain.gain.setTargetAtTime(targetVol * 0.7, now, 0.03);
  }

  /**
   * Sound of a string snapping.
   * @param mine True if player cut a rival; false if player's own string snapped.
   */
  public playCut(mine: boolean): void {
    if (!this.ctx || !this.masterGain || !this.initialized) return;
    this.unlock();
    const now = this.ctx.currentTime;

    // 1. Sharp transient snap / crack (filtered noise burst)
    if (this.noiseBuffer) {
      const snapSource = this.ctx.createBufferSource();
      snapSource.buffer = this.noiseBuffer;
      const snapFilter = this.ctx.createBiquadFilter();
      snapFilter.type = 'bandpass';
      snapFilter.frequency.setValueAtTime(mine ? 2800 : 1800, now);
      snapFilter.Q.setValueAtTime(3.5, now);

      const snapGain = this.ctx.createGain();
      snapGain.gain.setValueAtTime(0.7, now);
      snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      snapSource.connect(snapFilter);
      snapFilter.connect(snapGain);
      snapGain.connect(this.masterGain);
      snapSource.start(now);
      snapSource.stop(now + 0.1);
    }

    // 2. Whip-like pitch sweep
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = mine ? 'triangle' : 'sawtooth';

    const startFreq = mine ? 1100 : 450;
    const endFreq = mine ? 220 : 70;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.12);

    oscGain.gain.setValueAtTime(mine ? 0.45 : 0.6, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);

    // 3. Triumphant high shimmer if player scored
    if (mine) {
      const shimmer = this.ctx.createOscillator();
      const shimmerGain = this.ctx.createGain();
      shimmer.type = 'sine';
      shimmer.frequency.setValueAtTime(880, now + 0.03);
      shimmer.frequency.exponentialRampToValueAtTime(1320, now + 0.18);

      shimmerGain.gain.setValueAtTime(0.001, now);
      shimmerGain.gain.linearRampToValueAtTime(0.25, now + 0.04);
      shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      shimmer.connect(shimmerGain);
      shimmerGain.connect(this.masterGain);
      shimmer.start(now);
      shimmer.stop(now + 0.26);
    }
  }

  /** Sound of kite glancing off / bumping into roof tiles */
  public playRoofHit(): void {
    if (!this.ctx || !this.masterGain || !this.initialized) return;
    this.unlock();
    const now = this.ctx.currentTime;

    // Deep ceramic thud
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.1);

    oscGain.gain.setValueAtTime(0.5, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.13);

    // Tile scuff / dust noise
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      noise.start(now);
      noise.stop(now + 0.1);
    }
  }

  /** Sound of crashing / getting tangled in roof */
  public playCrash(): void {
    if (!this.ctx || !this.masterGain || !this.initialized) return;
    this.unlock();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);

    oscGain.gain.setValueAtTime(0.6, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  /** Warm pentatonic victory chime when the sky is completely cleared */
  public playCleared(): void {
    if (!this.ctx || !this.masterGain || !this.initialized) return;
    this.unlock();
    const now = this.ctx.currentTime;

    // Pentatonic notes: D5 (587Hz), G5 (784Hz), A5 (880Hz), D6 (1175Hz)
    const notes = [587.33, 783.99, 880.0, 1174.66];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const noteTime = now + i * 0.11;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.001, noteTime);
      gain.gain.linearRampToValueAtTime(0.32, noteTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.6);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(noteTime);
      osc.stop(noteTime + 0.65);
    });
  }

  /** Round time over chime */
  public playTimeUp(): void {
    if (!this.ctx || !this.masterGain || !this.initialized) return;
    this.unlock();
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(330, now + 0.4);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.55);
  }

  /** Stops all ongoing continuous sounds (e.g. at end of round) */
  public stopAll(): void {
    if (!this.ctx || !this.initialized) return;
    const now = this.ctx.currentTime;
    if (this.windGain) {
      this.windGain.gain.setTargetAtTime(0, now, 0.05);
    }
    if (this.frictionGain) {
      this.frictionGain.gain.setTargetAtTime(0, now, 0.02);
    }
    if (this.frictionNoiseGain) {
      this.frictionNoiseGain.gain.setTargetAtTime(0, now, 0.02);
    }
  }
}

export const sound = new SoundEngine();
