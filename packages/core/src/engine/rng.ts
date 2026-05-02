/**
 * Deterministic PRNG.  We use a simple mulberry32 keyed by
 * `(seed, cursor)` so the entire game can be replayed bit-for-bit
 * given the same seed and decision log.
 */

import type { GameState } from '../model/state.js';

const mulberry32 = (s: number): number => {
  let t = (s + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export interface RngState {
  readonly seed: number;
  readonly cursor: number;
}

export const advanceRng = (rng: RngState): { rng: RngState; value: number } => {
  const value = mulberry32(rng.seed + rng.cursor);
  return { rng: { seed: rng.seed, cursor: rng.cursor + 1 }, value };
};

/** In-place-style helper that returns a new GameState with rng advanced. */
export const drawRandom = (state: GameState): { state: GameState; value: number } => {
  const { rng, value } = advanceRng(state.rng);
  return { state: { ...state, rng }, value };
};

export const shuffle = <T>(arr: readonly T[], rng: RngState): { arr: T[]; rng: RngState } => {
  const out = arr.slice();
  let cur = rng;
  for (let i = out.length - 1; i > 0; i--) {
    const { rng: next, value } = advanceRng(cur);
    cur = next;
    const j = Math.floor(value * (i + 1));
    const ti = out[i] as T;
    const tj = out[j] as T;
    out[i] = tj;
    out[j] = ti;
  }
  return { arr: out, rng: cur };
};
