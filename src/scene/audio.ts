/**
 * 100% Procedural Web Audio API sound synthesizer for KGF Quarry:
 * - Subtle dusty quarry wind & distant diesel truck hum (ambient)
 * - Explosive oil barrel blast (sub-bass thump + filtered noise roar)
 * - Wooden crate splinter crunch
 * - Sandbag burst thud
 * - Rock boulder fracture rumble
 * - Electrical generator arc zap
 */
export class QuarryAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private enabled = false;

  public setEnabled(next: boolean) {
    this.enabled = next;
    if (next) {
      this.ensureInitialized();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(0.65, this.ctx.currentTime, 0.12);
      }
    } else if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.12);
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private ensureInitialized() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.0;
    this.masterGain.connect(this.ctx.destination);

    // Pre-generate 2 seconds of white noise buffer for explosions, wind, and debris
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    // Continuous dusty quarry wind + subtle distant heavy diesel rumble
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.16;
    this.ambientGain.connect(this.masterGain);

    const windSrc = this.ctx.createBufferSource();
    windSrc.buffer = this.noiseBuffer;
    windSrc.loop = true;
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 320;
    windFilter.Q.value = 1.6;
    windSrc.connect(windFilter);
    windFilter.connect(this.ambientGain);
    windSrc.start();

    // Distant diesel truck engine drone
    const dieselOsc = this.ctx.createOscillator();
    dieselOsc.type = 'sawtooth';
    dieselOsc.frequency.value = 46;
    const dieselFilter = this.ctx.createBiquadFilter();
    dieselFilter.type = 'lowpass';
    dieselFilter.frequency.value = 110;
    const dieselGain = this.ctx.createGain();
    dieselGain.gain.value = 0.22;
    dieselOsc.connect(dieselFilter);
    dieselFilter.connect(dieselGain);
    dieselGain.connect(this.ambientGain);
    dieselOsc.start();
  }

  public playExplosion() {
    if (!this.enabled) return;
    this.ensureInitialized();
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

    const now = this.ctx.currentTime;

    // 1. Sub-bass shockwave boom
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(26, now + 0.55);
    oscGain.gain.setValueAtTime(0.85, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.68);

    // 2. Fiery roaring noise blast
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(160, now + 0.9);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.75, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 1.0);
  }

  public playWoodBreak() {
    if (!this.enabled) return;
    this.ensureInitialized();
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(780, now);
    bp.Q.value = 1.4;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    noise.connect(bp);
    bp.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 0.28);
  }

  public playRockShatter() {
    if (!this.enabled) return;
    this.ensureInitialized();
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

    const now = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(520, now);
    lp.frequency.exponentialRampToValueAtTime(120, now + 0.48);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.68, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
    noise.connect(lp);
    lp.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 0.55);
  }

  public playElectricZap() {
    if (!this.enabled) return;
    this.ensureInitialized();
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(880, now + 0.07);
    osc.frequency.linearRampToValueAtTime(140, now + 0.16);
    osc.frequency.linearRampToValueAtTime(640, now + 0.24);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  public dispose() {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
