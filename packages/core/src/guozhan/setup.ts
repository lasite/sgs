/**
 * Build a starting GameState for a Guozhan game.
 *
 * Each player is supplied with two general ids (chosen by the user
 * outside this function) plus a name.  HP is `floor((mainHp + subHp) / 2)`
 * — equal floor rule.  Both slots start 暗置.  Players draw 4 cards each.
 *
 * The deck and rng seed are externally constructed so callers can fix
 * them for tests/replays.
 */

import type { Card, CardId } from '../model/card.js';
import type { Player, PlayerId } from '../model/player.js';
import type { GameState } from '../model/state.js';
import type { GeneralId } from '../model/general.js';
import { ALL_GENERALS } from '../data/generals.js';
import { shuffle } from '../engine/rng.js';

export interface PlayerSpec {
  readonly id: PlayerId;
  readonly name: string;
  readonly main: GeneralId;
  readonly sub: GeneralId;
}

const generalById = (id: GeneralId) => {
  const g = ALL_GENERALS.find((x) => x.id === id);
  if (!g) throw new Error(`unknown general ${id}`);
  return g;
};

export const createGuozhanState = (
  specs: readonly PlayerSpec[],
  deck: readonly Card[],
  seed = 1,
  initialDraw = 4,
): GameState => {
  const cards = new Map<CardId, Card>();
  for (const c of deck) cards.set(c.id, c);

  const initialPile: CardId[] = deck.map((c) => c.id);
  const { arr: shuffled, rng: rngAfter } = shuffle(initialPile, { seed, cursor: 0 });

  // Drawing puts the top of the pile (= end of array) into the player's
  // hand.  We pop `initialDraw` × n cards off the end, distributing them
  // round-robin.
  const totalDraw = initialDraw * specs.length;
  const drawn = shuffled.slice(-totalDraw);
  const remainingPile = shuffled.slice(0, shuffled.length - totalDraw);

  const players: Player[] = specs.map((spec, seat) => {
    const main = generalById(spec.main);
    const sub = generalById(spec.sub);
    const hp = Math.floor((main.hp + sub.hp) / 2);
    const hand: CardId[] = [];
    for (let i = 0; i < initialDraw; i++) {
      const idx = drawn.length - 1 - (i * specs.length + seat);
      const cid = drawn[idx];
      if (cid) hand.push(cid);
    }
    return {
      id: spec.id,
      seat,
      name: spec.name,
      main: { general: spec.main, revealed: false },
      sub: { general: spec.sub, revealed: false },
      hp,
      maxHp: hp,
      hand,
      equipment: {},
      judgeArea: [],
      isAmbitionist: false,
      alive: true,
      flags: {},
    };
  });

  return {
    tick: 0,
    players,
    cards,
    drawPile: remainingPile,
    discardPile: [],
    currentPlayerSeat: 0,
    phase: 'start',
    turnNumber: 1,
    eventLog: [],
    rng: rngAfter,
    victory: { ended: false },
  };
};
