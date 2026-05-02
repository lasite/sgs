/**
 * Effects are the *primitives* the engine schedules to mutate state.
 *
 * Anything that changes state — drawing cards, dealing damage, advancing
 * a phase — is expressed as an Effect.  The runner pops effects from a
 * queue, applies them (producing a new GameState + an emitted event),
 * runs matching triggers, and recurses on any follow-up effects.
 *
 * Trigger handlers return `Effect[]`.  Card definitions return `Effect[]`.
 * No-one else mutates state directly.
 */

import type { CardId } from '../model/card.js';
import type { PlayerId } from '../model/player.js';
import type { TurnPhase } from '../model/state.js';
import type { DamageKind } from './events.js';
import type { DecisionRequest } from './decisions.js';

export type Effect =
  | { readonly kind: 'phase-change'; readonly to: TurnPhase }
  | { readonly kind: 'turn-advance' }
  | { readonly kind: 'draw-cards'; readonly player: PlayerId; readonly count: number;
      readonly reason: 'phase' | 'skill' | 'card' | 'death-bonus' }
  | { readonly kind: 'discard-cards'; readonly player: PlayerId; readonly cards: readonly CardId[];
      readonly reason: 'phase' | 'skill' | 'card' }
  | { readonly kind: 'lose-cards'; readonly player: PlayerId; readonly cards: readonly CardId[];
      readonly from: 'hand' | 'equipment' | 'judge'; readonly reason: string }
  | { readonly kind: 'gain-cards'; readonly player: PlayerId; readonly cards: readonly CardId[];
      readonly reason: string }
  | { readonly kind: 'equip-card'; readonly player: PlayerId; readonly card: CardId }
  | { readonly kind: 'damage'; readonly source: PlayerId | null; readonly target: PlayerId;
      readonly amount: number; readonly damageKind: DamageKind; readonly card?: CardId }
  | { readonly kind: 'heal'; readonly source: PlayerId | null; readonly target: PlayerId;
      readonly amount: number; readonly reason: string }
  | { readonly kind: 'reveal-general'; readonly player: PlayerId; readonly slot: 'main' | 'sub' }
  | { readonly kind: 'to-pile'; readonly cards: readonly CardId[]; readonly pile: 'discard' | 'draw' }
  | { readonly kind: 'set-flag'; readonly player: PlayerId;
      readonly flag: string; readonly value: number | string | boolean | null }
  | RequestEffect
  | { readonly kind: 'sequence'; readonly effects: readonly Effect[] };

/**
 * A request to a player.  The `resume` continuation receives the
 * matched response plus the current state and produces follow-up
 * effects.  Resume runs *after* the engine validates the response id
 * matches.
 */
export interface RequestEffect {
  readonly kind: 'request';
  readonly request: DecisionRequest;
  readonly resume: (response: import('./decisions.js').DecisionResponse,
                    state: import('../model/state.js').GameState) => readonly Effect[];
}
