/**
 * Snapshot helpers: serialize/deserialize a GameState to/from JSON.
 *
 * Only the data is serialized — Trigger registrations, decision-resume
 * callbacks, and AI providers must be reattached after a load.  Save/
 * load is therefore only valid when the session queue is empty and no
 * pending decision exists (callers should enforce this).
 */

import type { Card, CardId } from './model/card.js';
import type { GameState } from './model/state.js';

export interface Snapshot {
  readonly version: 1;
  readonly state: Omit<GameState, 'cards'> & {
    readonly cardsList: readonly Card[];
  };
}

export const toSnapshot = (state: GameState): Snapshot => {
  const cardsList = [...state.cards.values()];
  const { cards: _omit, ...rest } = state;
  void _omit;
  return {
    version: 1,
    state: { ...rest, cardsList },
  };
};

export const fromSnapshot = (snap: Snapshot): GameState => {
  if (snap.version !== 1) {
    throw new Error(`unsupported snapshot version ${snap.version}`);
  }
  const cards = new Map<CardId, Card>();
  for (const c of snap.state.cardsList) cards.set(c.id, c);
  const { cardsList: _omit, ...rest } = snap.state;
  void _omit;
  return { ...rest, cards };
};

export const serialize = (state: GameState): string =>
  JSON.stringify(toSnapshot(state));

export const deserialize = (json: string): GameState =>
  fromSnapshot(JSON.parse(json) as Snapshot);
