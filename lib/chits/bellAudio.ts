'use client';

const BELL_MUTE_STORAGE_KEY = 'zolofund:chit-bell-muted';

let sharedAudioCtx: AudioContext | null = null;

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
  // Multi-harmonic brass chime partials (fundamental + bright bronze overtones)
  const partials = [
    { freq: 1046.5, amp: 0.24 * accentScale, decay: 1.05 }, // C6 fundamental
    { freq: 2093.0, amp: 0.14 * accentScale, decay: 0.85 }, // C7 octave
    { freq: 2888.0, amp: 0.09 * accentScale, decay: 0.55 }, // metallic bronze mode
    { freq: 4259.0, amp: 0.05 * accentScale, decay: 0.35 }, // crisp shimmer
  ];

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, startAt);
  master.gain.exponentialRampToValueAtTime(0.8, startAt + 0.008);
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

function triggerGavelKnock(ctx: AudioContext, startAt: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(175, startAt);
  osc.frequency.exponentialRampToValueAtTime(58, startAt + 0.14);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.32, startAt + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.2);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + 0.22);
}

/**
 * Plays a realistic multi-harmonic brass auction bell chime:
 * - Bell 1 ("Going Once"): 1 strike
 * - Bell 2 ("Going Twice"): 2 strikes
 * - Final Bell 3 ("Sold!"): 3 rapid strikes + firm gavel knock
 */
export function playAuctionBellChime(
  bellNumber: number,
  totalBells = 3,
  opts?: { force?: boolean },
): boolean {
  if (!opts?.force && isBellSoundMuted()) return false;
  const ctx = getAudioContext();
  if (!ctx) return false;
  const now = ctx.currentTime + 0.02;

  try {
    if (bellNumber >= totalBells) {
      triggerBrassBellStrike(ctx, now, 1.0);
      triggerBrassBellStrike(ctx, now + 0.21, 1.05);
      triggerBrassBellStrike(ctx, now + 0.42, 1.12);
      triggerGavelKnock(ctx, now + 0.68);
    } else if (bellNumber === totalBells - 1) {
      triggerBrassBellStrike(ctx, now, 0.95);
      triggerBrassBellStrike(ctx, now + 0.26, 1.0);
    } else {
      triggerBrassBellStrike(ctx, now, 0.92);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Plays a crisp countdown tick during the final 5 seconds before an automatic auction bell.
 * Final 1s plays a higher urgent pitch so bidders know the bell is about to strike.
 */
export function playBellCountdownTick(secondLeft: number): boolean {
  if (isBellSoundMuted()) return false;
  if (!(secondLeft >= 1 && secondLeft <= 5)) return false;
  const ctx = getAudioContext();
  if (!ctx) return false;
  const now = ctx.currentTime + 0.01;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(secondLeft <= 1 ? 1174.66 : secondLeft === 2 ? 987.77 : 880, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(secondLeft <= 1 ? 0.14 : 0.09, now + 0.008);
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
      gain.gain.exponentialRampToValueAtTime(0.16, start + 0.015);
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
