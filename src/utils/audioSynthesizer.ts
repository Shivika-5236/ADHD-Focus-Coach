/**
 * Native Web Audio Ambient Soundscapes & Gentle Feedback Chimes
 * Specially designed for ADHD focus without any external audio asset dependencies.
 */

export type SoundscapeType = 'none' | 'whitenoise' | 'rain' | 'binaural40hz' | 'cafe';

class AmbientSoundEngine {
  private ctx: AudioContext | null = null;
  private currentType: SoundscapeType = 'none';
  private gainNode: GainNode | null = null;
  private activeNodes: (AudioNode | number)[] = [];
  private volume: number = 0.25;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public getCurrentType(): SoundscapeType {
    return this.currentType;
  }

  public playSoundscape(type: SoundscapeType) {
    this.stopSoundscape();
    if (type === 'none') {
      this.currentType = 'none';
      return;
    }

    this.initCtx();
    if (!this.ctx) return;

    this.currentType = type;
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    masterGain.connect(this.ctx.destination);
    this.gainNode = masterGain;

    if (type === 'whitenoise') {
      this.startWhiteNoise(masterGain);
    } else if (type === 'rain') {
      this.startRain(masterGain);
    } else if (type === 'binaural40hz') {
      this.startBinaural40Hz(masterGain);
    } else if (type === 'cafe') {
      this.startCafeWarmth(masterGain);
    }
  }

  public stopSoundscape() {
    this.activeNodes.forEach(node => {
      if (typeof node === 'number') {
        window.clearInterval(node);
      } else if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
        try {
          (node as AudioScheduledSourceNode).stop();
          node.disconnect();
        } catch {
          // ignore already stopped
        }
      } else {
        try {
          node.disconnect();
        } catch {
          // ignore
        }
      }
    });
    this.activeNodes = [];
    this.gainNode = null;
    this.currentType = 'none';
  }

  private startWhiteNoise(output: AudioNode) {
    if (!this.ctx) return;
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const outputData = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;

    // Pink-leaning filtered noise
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      outputData[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = outputData[i];
      outputData[i] *= 3.5;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(output);
    whiteNoise.start();

    this.activeNodes.push(whiteNoise, filter);
  }

  private startRain(output: AudioNode) {
    if (!this.ctx) return;
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const outputData = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      outputData[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(1200, this.ctx.currentTime);
    bandpass.Q.setValueAtTime(0.7, this.ctx.currentTime);

    noiseSource.connect(bandpass);
    bandpass.connect(output);
    noiseSource.start();

    this.activeNodes.push(noiseSource, bandpass);
  }

  private startBinaural40Hz(output: AudioNode) {
    if (!this.ctx) return;
    // 200 Hz Base Carrier + 40 Hz Gamma offset = 240 Hz
    const oscLeft = this.ctx.createOscillator();
    oscLeft.type = 'sine';
    oscLeft.frequency.setValueAtTime(200, this.ctx.currentTime);

    const oscRight = this.ctx.createOscillator();
    oscRight.type = 'sine';
    oscRight.frequency.setValueAtTime(240, this.ctx.currentTime);

    const pannerLeft = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (pannerLeft) pannerLeft.pan.setValueAtTime(-0.8, this.ctx.currentTime);

    const pannerRight = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (pannerRight) pannerRight.pan.setValueAtTime(0.8, this.ctx.currentTime);

    if (pannerLeft && pannerRight) {
      oscLeft.connect(pannerLeft);
      pannerLeft.connect(output);
      oscRight.connect(pannerRight);
      pannerRight.connect(output);
      this.activeNodes.push(oscLeft, oscRight, pannerLeft, pannerRight);
    } else {
      oscLeft.connect(output);
      oscRight.connect(output);
      this.activeNodes.push(oscLeft, oscRight);
    }

    oscLeft.start();
    oscRight.start();
  }

  private startCafeWarmth(output: AudioNode) {
    if (!this.ctx) return;
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const outputData = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      outputData[i] = (Math.random() * 2 - 1) * 0.4;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(450, this.ctx.currentTime);

    noiseSource.connect(lowpass);
    lowpass.connect(output);
    noiseSource.start();

    this.activeNodes.push(noiseSource, lowpass);
  }

  /**
   * Gentle pentatonic chime played upon completing a task or focus block
   */
  public playGentleChime() {
    this.initCtx();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.12);

      noteGain.gain.setValueAtTime(0, this.ctx.currentTime + idx * 0.12);
      noteGain.gain.linearRampToValueAtTime(0.18, this.ctx.currentTime + idx * 0.12 + 0.04);
      noteGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + idx * 0.12 + 1.2);

      osc.connect(noteGain);
      noteGain.connect(this.ctx.destination);

      osc.start(this.ctx.currentTime + idx * 0.12);
      osc.stop(this.ctx.currentTime + idx * 0.12 + 1.3);
    });
  }
}

export const soundEngine = new AmbientSoundEngine();
