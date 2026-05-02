/**
 * Top-level immutable game state.
 *
 * Conventions:
 *  - All collections are `readonly`; engine helpers return a new state.
 *  - `eventLog` is the source of truth for replay & AI lookahead — every
 *    state-changing engine step must append to it.
 *  - `rng` is a serializable PRNG seed cursor so the whole simulation is
 *    deterministic from `(seed, eventLog)`.
 */

import type { CardId, Card } from './card.js';
import type { Player, PlayerId } from './player.js';

/** Standard turn phases (国战 — 起始/判定/摸牌/出牌/弃牌/结束). */
export type TurnPhase =
  | 'start'   // 准备
  | 'judge'   // 判定
  | 'draw'    // 摸牌
  | 'play'    // 出牌
  | 'discard' // 弃牌
  | 'end';    // 结束

export const TURN_PHASES: readonly TurnPhase[] = [
  'start', 'judge', 'draw', 'play', 'discard', 'end',
] as const;

/** A single recorded event — populated in Phase 2. */
export interface GameEventBase {
  readonly type: string;
  readonly tick: number;
}

export interface VictoryState {
  readonly ended: boolean;
  readonly winners?: readonly PlayerId[];
  readonly reason?: string;
}

export interface GameState {
  readonly tick: number;
  readonly players: readonly Player[];
  /** Map: cardId -> Card.  Cards are immutable; ownership tracked elsewhere. */
  readonly cards: ReadonlyMap<CardId, Card>;
  /** Draw pile (top of stack = end of array). */
  readonly drawPile: readonly CardId[];
  /** Discard pile (most recent at end). */
  readonly discardPile: readonly CardId[];
  /** Index into `players` of the active turn-taker. */
  readonly currentPlayerSeat: number;
  readonly phase: TurnPhase;
  readonly turnNumber: number;
  readonly eventLog: readonly GameEventBase[];
  readonly rng: { readonly seed: number; readonly cursor: number };
  readonly victory: VictoryState;
}

export const playerById = (s: GameState, id: PlayerId): Player => {
  const found = s.players.find((p) => p.id === id);
  if (!found) throw new Error(`unknown player ${id}`);
  return found;
};

export const currentPlayer = (s: GameState): Player => {
  const p = s.players[s.currentPlayerSeat];
  if (!p) throw new Error(`no player at seat ${s.currentPlayerSeat}`);
  return p;
};

export const cardById = (s: GameState, id: CardId): Card => {
  const c = s.cards.get(id);
  if (!c) throw new Error(`unknown card ${id}`);
  return c;
};

export const livingPlayers = (s: GameState): readonly Player[] =>
  s.players.filter((p) => p.alive);
