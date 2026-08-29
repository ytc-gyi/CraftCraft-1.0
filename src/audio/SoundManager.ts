// Procedural sound effects via Web Audio API

import { BlockType } from '../world/Block';

export class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.4;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  private getOut(): AudioNode {
    this.getCtx();
    return this.master!;
  }

  setEnabled(v: boolean): void { this.enabled = v; }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private noise(duration: number, color: 'white' | 'pink', freq?: number): void {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    const bufLen = ctx.sampleRate * duration;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);

    if (color === 'white') {
      for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    } else {
      // Pink noise approximation
      let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
      for (let i = 0; i < bufLen; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886*b0 + w*0.0555179; b1 = 0.99332*b1 + w*0.0750759;
        b2 = 0.96900*b2 + w*0.1538520; b3 = 0.86650*b3 + w*0.3104856;
        b4 = 0.55000*b4 + w*0.5329522; b5 = -0.7616*b5 - w*0.0168980;
        data[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    if (freq) {
      const bpf = ctx.createBiquadFilter();
      bpf.type = 'bandpass';
      bpf.frequency.value = freq;
      bpf.Q.value = 1.0;
      src.connect(bpf);
      bpf.connect(this.getOut());
    } else {
      src.connect(this.getOut());
    }

    const env = ctx.createGain();
    env.gain.setValueAtTime(1, ctx.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    src.connect(env);
    env.connect(this.getOut());
    src.start();
    src.stop(ctx.currentTime + duration);
  }

  private tone(freq: number, type: OscillatorType, duration: number, gainVal = 0.3): void {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(gainVal, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.getOut());
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  private thud(freq: number, duration: number): void {
    if (!this.enabled) return;
    const ctx = this.getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 2, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.getOut());
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  // ─── Sound Events ─────────────────────────────────────────────────────────

  playStep(block: BlockType): void {
    if (!this.enabled) return;
    switch (block) {
      case BlockType.Stone:
      case BlockType.Cobblestone:
      case BlockType.Bedrock:
        this.noise(0.08, 'white', 900 + Math.random()*200);
        break;
      case BlockType.Grass:
        this.noise(0.1, 'pink', 400 + Math.random()*100);
        break;
      case BlockType.Wood:
      case BlockType.OakLog:
      case BlockType.Planks:
        this.thud(180 + Math.random()*40, 0.1);
        break;
      case BlockType.Sand:
      case BlockType.Gravel:
        this.noise(0.07, 'white', 600 + Math.random()*150);
        break;
      default:
        this.noise(0.07, 'pink', 500);
    }
  }

  playBreak(block: BlockType): void {
    if (!this.enabled) return;
    switch (block) {
      case BlockType.Stone:
      case BlockType.Cobblestone:
      case BlockType.Bedrock:
        this.noise(0.15, 'white', 800);
        this.thud(120, 0.15);
        break;
      case BlockType.Grass:
      case BlockType.Dirt:
        this.noise(0.13, 'pink', 300);
        this.thud(100, 0.13);
        break;
      case BlockType.Wood:
      case BlockType.OakLog:
      case BlockType.Planks:
        this.thud(200, 0.18);
        this.noise(0.1, 'pink', 250);
        break;
      case BlockType.Leaves:
        this.noise(0.1, 'pink', 350);
        break;
      case BlockType.Glass:
        this.noise(0.12, 'white', 3000);
        this.tone(1200, 'sine', 0.05, 0.15);
        break;
      case BlockType.Sand:
      case BlockType.Gravel:
        this.noise(0.12, 'white', 500);
        break;
      default:
        this.noise(0.12, 'pink', 500);
    }
  }

  playPlace(block: BlockType): void {
    if (!this.enabled) return;
    switch (block) {
      case BlockType.Stone:
      case BlockType.Cobblestone:
        this.thud(150, 0.12);
        this.noise(0.06, 'white', 700);
        break;
      case BlockType.Grass:
      case BlockType.Dirt:
        this.thud(90, 0.12);
        this.noise(0.08, 'pink', 320);
        break;
      case BlockType.Wood:
      case BlockType.OakLog:
      case BlockType.Planks:
        this.thud(220, 0.1);
        break;
      case BlockType.Glass:
        this.tone(1800, 'sine', 0.06, 0.12);
        break;
      case BlockType.Sand:
      case BlockType.Gravel:
        this.noise(0.09, 'white', 450);
        break;
      default:
        this.thud(130, 0.1);
    }
  }

  playJump(): void {
    if (!this.enabled) return;
    this.tone(220, 'sine', 0.08, 0.15);
    this.tone(330, 'triangle', 0.05, 0.08);
  }

  playLand(): void {
    if (!this.enabled) return;
    this.thud(80, 0.15);
    this.noise(0.08, 'white', 400);
  }
}