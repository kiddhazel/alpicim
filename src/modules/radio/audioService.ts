import { useSyncExternalStore } from 'react';

/** İç ses çalar: radyo ve podcast için tek HTML <audio> öğesi (ana pencerede tekil). */

export type AudioKind = 'radio' | 'podcast';

export interface AudioSource {
  kind: AudioKind;
  /** İstasyon / bölüm kimliği. */
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

export interface AudioSnapshot {
  source: AudioSource | null;
  playing: boolean;
  loading: boolean;
  error: string | null;
  positionSec: number;
  /** Canlı yayında null. */
  durationSec: number | null;
  rate: number;
  /** 0..1 */
  volume: number;
  muted: boolean;
}

type ProgressListener = (source: AudioSource, positionSec: number, durationSec: number | null) => void;

const VOLUME_KEY = 'alpicim.volume.internal';

const IDLE: AudioSnapshot = { source: null, playing: false, loading: false, error: null, positionSec: 0, durationSec: null, rate: 1, volume: loadVolume(), muted: false };

function loadVolume(): number {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY));
    return localStorage.getItem(VOLUME_KEY) !== null && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
  } catch {
    return 1;
  }
}

let audio: HTMLAudioElement | null = null;
let snap: AudioSnapshot = IDLE;
const subs = new Set<() => void>();
const progressListeners = new Set<ProgressListener>();
let lastSaved = 0;

function set(patch: Partial<AudioSnapshot>): void {
  snap = { ...snap, ...patch };
  subs.forEach((f) => f());
}

function emitProgress(force: boolean): void {
  const src = snap.source;
  if (!src || src.kind !== 'podcast') return;
  const now = Date.now();
  if (!force && now - lastSaved < 5000) return;
  lastSaved = now;
  progressListeners.forEach((f) => f(src, snap.positionSec, snap.durationSec));
}

function el(): HTMLAudioElement {
  if (audio) return audio;
  const a = new Audio();
  a.preload = 'none';
  a.volume = snap.volume;
  a.muted = snap.muted;
  a.addEventListener('playing', () => set({ playing: true, loading: false, error: null }));
  a.addEventListener('pause', () => {
    set({ playing: false });
    emitProgress(true);
  });
  a.addEventListener('waiting', () => set({ loading: true }));
  a.addEventListener('canplay', () => set({ loading: false }));
  a.addEventListener('ended', () => {
    const src = snap.source;
    set({ playing: false, positionSec: 0 });
    if (src?.kind === 'podcast') progressListeners.forEach((f) => f(src, 0, snap.durationSec));
  });
  a.addEventListener('error', () => set({ playing: false, loading: false, error: 'PLAYBACK' }));
  a.addEventListener('durationchange', () => set({ durationSec: Number.isFinite(a.duration) && a.duration > 0 ? a.duration : null }));
  a.addEventListener('timeupdate', () => {
    set({ positionSec: a.currentTime });
    emitProgress(false);
  });
  audio = a;
  return a;
}

export const audioService = {
  subscribe(fn: () => void): () => void {
    subs.add(fn);
    return () => subs.delete(fn);
  },
  getSnapshot(): AudioSnapshot {
    return snap;
  },
  onProgress(fn: ProgressListener): () => void {
    progressListeners.add(fn);
    return () => progressListeners.delete(fn);
  },
  /** Kaynağı çalar; aynı kaynaksa oynat/duraklat arasında geçer. */
  async play(source: AudioSource, startAtSec = 0): Promise<void> {
    const a = el();
    if (snap.source?.id === source.id && snap.source.kind === source.kind && !snap.error) {
      if (a.paused) await a.play().catch(() => set({ error: 'PLAYBACK' }));
      else a.pause();
      return;
    }
    emitProgress(true);
    a.pause();
    set({ source, playing: false, loading: true, error: null, positionSec: startAtSec, durationSec: null });
    a.src = source.url;
    a.playbackRate = snap.rate;
    if (startAtSec > 0) {
      a.addEventListener(
        'loadedmetadata',
        () => {
          a.currentTime = startAtSec;
        },
        { once: true },
      );
    }
    try {
      await a.play();
    } catch {
      set({ playing: false, loading: false, error: 'PLAYBACK' });
    }
  },
  toggle(): void {
    const a = el();
    if (!snap.source) return;
    if (a.paused) void a.play().catch(() => set({ error: 'PLAYBACK' }));
    else a.pause();
  },
  seek(sec: number): void {
    const a = el();
    if (!snap.source || snap.durationSec === null) return;
    a.currentTime = Math.min(Math.max(sec, 0), snap.durationSec);
    set({ positionSec: a.currentTime });
  },
  skip(deltaSec: number): void {
    audioService.seek(snap.positionSec + deltaSec);
  },
  setVolume(volume: number): void {
    const v = Math.min(1, Math.max(0, volume));
    el().volume = v;
    try {
      localStorage.setItem(VOLUME_KEY, String(v));
    } catch {
      /* kalıcılık yoksa yalnız bu oturumda */
    }
    set({ volume: v });
  },
  setMuted(muted: boolean): void {
    el().muted = muted;
    set({ muted });
  },
  setRate(rate: number): void {
    el().playbackRate = rate;
    set({ rate });
  },
  stop(): void {
    if (!audio) return;
    emitProgress(true);
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    set({ ...IDLE, rate: snap.rate, volume: snap.volume, muted: snap.muted });
  },
};

export function useAudio(): AudioSnapshot {
  return useSyncExternalStore(audioService.subscribe, audioService.getSnapshot, audioService.getSnapshot);
}

/** Mini oynatıcı iç sesi mi göstermeli: iç ses çalıyorsa, ya da kaynak varken SMTC oturumu çalmıyorsa. */
export function showInternalAudio(hasSource: boolean, internalPlaying: boolean, smtcPlaying: boolean): boolean {
  return hasSource && (internalPlaying || !smtcPlaying);
}
