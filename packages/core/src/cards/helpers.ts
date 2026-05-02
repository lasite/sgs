/**
 * Common helpers shared across card behaviours.
 */

import type { Card, CardId } from '../model/card.js';
import type { Player, PlayerId } from '../model/player.js';
import type { GameState } from '../model/state.js';
import type { Effect } from '../engine/effects.js';
import type { DecisionId } from '../engine/decisions.js';

let _decisionSeq = 0;
export const newDecisionId = (): DecisionId =>
  `card-dec-${++_decisionSeq}` as DecisionId;

export const livingExcept = (
  state: GameState,
  excluded: PlayerId,
): readonly PlayerId[] =>
  state.players.filter((p) => p.alive && p.id !== excluded).map((p) => p.id);

export const livingAll = (state: GameState): readonly PlayerId[] =>
  state.players.filter((p) => p.alive).map((p) => p.id);

/** Move a card to the discard pile via the standard event sequence. */
export const moveToDiscard = (
  player: PlayerId,
  cards: readonly CardId[],
  reason: string,
): Effect[] => [
  { kind: 'discard-cards', player, cards, reason: 'card' as const },
];

export const findCardOf = (
  state: GameState,
  player: Player,
  predicate: (c: Card) => boolean,
): CardId | undefined => {
  for (const cid of player.hand) {
    const c = state.cards.get(cid);
    if (c && predicate(c)) return cid;
  }
  return undefined;
};

export const cardName = (state: GameState, id: CardId): string => {
  const c = state.cards.get(id);
  return c ? c.name : '?';
};
