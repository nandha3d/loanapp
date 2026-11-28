'use client';

import { withBasePath } from '@/lib/public-path';

const BELL_MUTE_STORAGE_KEY = 'zolofund:chit-bell-muted';
const BELL_MP3_PATH = '/assets/bell-sound.mp3';
const BELL_VOLUME_BOOST = 1.75;

let sharedAudioCtx: AudioContext | null = null;
let bellMp3Buffer: AudioBuffer | null = null;
let bellMp3FetchPromise: Promise<AudioBuffer | null> | null = null;
let activeBellSources: AudioBufferSourceNode[] = [];
let activeFallbackAudio: HTMLAudioElement | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new Ctor();
  }
  if (sharedAudioCtx.state === 'suspended') {
    void sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function preloadBellMp3Buffer(ctx: AudioContext): Promise<AudioBuffer | null> {
  if (bellMp3Buffer) return Promise.resolve(bellMp3Buffer);
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!bellMp3FetchPromise) {
    const url = withBasePath(BELL_MP3_PATH);
    bellMp3FetchPromise = fetch(url, { cache: 'force-cache' })
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .then((ab) => (ab ? ctx.decodeAudioData(ab.slice(0)) : null))
      .then((decoded) => {
        if (decoded) bellMp3Buffer = decoded;
        return decoded;
      })
      .catch(() => null)
      .finally(() => {
        bellMp3FetchPromise = null;
      });
  }
  return bellMp3FetchPromise;
}

function stopActiveBellPlayback(): void {
  for (const src of activeBellSources) {
    try {
      src.stop();
    } catch {
      // Ignore already stopped sources
    }
  }
  activeBellSources = [];
  if (activeFallbackAudio) {
    try {
      activeFallbackAudio.pause();
      activeFallbackAudio.currentTime = 0;
    } catch {
      // Ignore HTMLAudio cleanup error
    }
    activeFallbackAudio = null;
  }
}

export function isBellSoundMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(BELL_MUTE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setBellSoundMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BELL_MUTE_STORAGE_KEY, muted ? '1' : '0');
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

function triggerBrassBellStrike(ctx: AudioContext, startAt: number, accentScale = 1): void {
  // Fallback multi-harmonic brass chime partials if custom MP3 fails to decode
  const partials = [
    { freq: 1046.5, amp: 0.28 * accentScale, decay: 1.05 },
    { freq: 2093.0, amp: 0.16 * accentScale, decay: 0.85 },
    { freq: 2888.0, amp: 0.11 * accentScale, decay: 0.55 },
    { freq: 4259.0, amp: 0.06 * accentScale, decay: 0.35 },
  ];

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, startAt);
  master.gain.exponentialRampToValueAtTime(0.92, startAt + 0.008);
  master.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.15);
  master.connect(ctx.destination);

  for (const p of partials) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(p.freq, startAt);
    g.gain.setValueAtTime(p.amp, startAt);
    g.gain.exponentialRampToValueAtTime(0.0001, startAt + p.decay);
    osc.connect(g).connect(master);
    osc.start(startAt);
    osc.stop(startAt + p.decay + 0.05);
  }
}

function playBoostedBellBuffer(
  ctx: AudioContext,
  buffer: AudioBuffer,
  bellNumber: number,
  totalBells: number,
): boolean {
  stopActiveBellPlayback();

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-3, ctx.currentTime);
  compressor.knee.setValueAtTime(6, ctx.currentTime);
  compressor.ratio.setValueAtTime(6, ctx.currentTime);
  compressor.attack.setValueAtTime(0.003, ctx.currentTime);
  compressor.release.setValueAtTime(0.15, ctx.currentTime);
  compressor.connect(ctx.destination);

  const strikeCount =
    buffer.duration <= 1.8
      ? bellNumber >= totalBells
        ? 3
        : bellNumber === totalBells - 1
          ? 2
          : 1
      : 1;
  const baseGain =
    bellNumber >= totalBells ? BELL_VOLUME_BOOST + 0.15 : BELL_VOLUME_BOOST;
  const now = ctx.currentTime + 0.01;

  for (let i = 0; i < strikeCount; i++) {
    const startAt = now + i * 0.36;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(baseGain, startAt);
    src.connect(gain).connect(compressor);
    src.onended = () => {
      activeBellSources = activeBellSources.filter((item) => item !== src);
    };
    activeBellSources.push(src);
    src.start(startAt);
  }
  return true;
}

export function preloadAuctionBellSound(): void {
  const ctx = getAudioContext();
  if (ctx) void preloadBellMp3Buffer(ctx);
}

/**
 * Plays the custom auction bell sound (`/assets/bell-sound.mp3`) amplified via
 * a Web Audio GainNode + limiter, with HTMLAudio / synthesized brass fallbacks.
 */
export function playAuctionBellChime(
  bellNumber: number,
  totalBells = 3,
  opts?: { force?: boolean },
): boolean {
  if (!opts?.force && isBellSoundMuted()) return false;
  if (typeof window === 'undefined') return false;

  const ctx = getAudioContext();
  if (ctx && bellMp3Buffer) {
    try {
      return playBoostedBellBuffer(ctx, bellMp3Buffer, bellNumber, totalBells);
    } catch {
      // Fall through to HTMLAudio / synth fallback
    }
  }

  try {
    if (ctx) {
      void preloadBellMp3Buffer(ctx);
    }
    stopActiveBellPlayback();
    const audio = new Audio(withBasePath(BELL_MP3_PATH));
    audio.volume = 1.0;
    activeFallbackAudio = audio;
    void audio.play().catch(() => {
      if (ctx) {
        triggerBrassBellStrike(ctx, ctx.currentTime + 0.02, 1.0);
      }
    });
    return true;
  } catch {
    if (!ctx) return false;
    try {
      triggerBrassBellStrike(ctx, ctx.currentTime + 0.02, 1.0);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Plays a crisp countdown tick during the final 5 seconds before an automatic auction bell.
 * Also preloads `/assets/bell-sound.mp3` so the bell strike plays with zero network delay.
 */
export function playBellCountdownTick(secondLeft: number): boolean {
  if (isBellSoundMuted()) return false;
  if (!(secondLeft >= 1 && secondLeft <= 5)) return false;
  const ctx = getAudioContext();
  if (!ctx) return false;
  void preloadBellMp3Buffer(ctx);
  const now = ctx.currentTime + 0.01;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(secondLeft <= 1 ? 1174.66 : secondLeft === 2 ? 987.77 : 880, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(secondLeft <= 1 ? 0.2 : 0.13, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
    return true;
  } catch {
    return false;
  }
}

/** Plays an uplifting 4-note major arpeggio when an auction winner is confirmed. */
export function playWinnerConfirmedFanfare(opts?: { force?: boolean }): boolean {
  if (!opts?.force && isBellSoundMuted()) return false;
  const ctx = getAudioContext();
  if (!ctx) return false;
  const now = ctx.currentTime + 0.02;
  const notes = [523.25, 659.25, 783.99, 1046.5];

  try {
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.11;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.24, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.65);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.7);
    });
    return true;
  } catch {
    return false;
  }
}
