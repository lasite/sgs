/**
 * Pure state mutators.  Each one takes the current state plus parameters
 * and returns a new state along with the event it emitted.  Nothing else
 * in the engine writes to GameState fields directly.
 */

import type { CardId } from '../model/card.js';
import type { Player, PlayerId } from '../model/player.js';
import type { GameState, TurnPhase } from '../model/state.js';
import type { Kingdom } from '../model/general.js';
import { TURN_PHASES } from '../model/state.js';
import type {
  DamageEvent,
  DamageKind,
  DiscardCardEvent,
  DrawCardsEvent,
  EnterPileEvent,
  EquipCardEvent,
  GainCardsEvent,
  GameEvent,
  HealEvent,
  LoseCardsEvent,
  PhaseChangeEvent,
  RevealGeneralEvent,
  TurnEndEvent,
  TurnStartEvent,
  UnequipCardEvent,
} from './events.js';

const tick = (state: GameState): { state: GameState; tick: number } => {
  const t = state.tick + 1;
  return { state: { ...state, tick: t }, tick: t };
};

const log = <E extends GameEvent>(state: GameState, event: E): GameState => ({
  ...state,
  eventLog: [...state.eventLog, event],
});

const updatePlayer = (
  state: GameState,
  id: PlayerId,
  fn: (p: Player) => Player,
): GameState => ({
  ...state,
  players: state.players.map((p) => (p.id === id ? fn(p) : p)),
});

const findPlayer = (state: GameState, id: PlayerId): Player => {
  const p = state.players.find((x) => x.id === id);
  if (!p) throw new Error(`unknown player ${id}`);
  return p;
};

// ---- Mutators ---------------------------------------------------------------

export interface Result<E extends GameEvent> {
  readonly state: GameState;
  readonly event: E;
}

export const drawCards = (
  state: GameState,
  player: PlayerId,
  count: number,
  reason: DrawCardsEvent['reason'],
): Result<DrawCardsEvent> => {
  // Top of pile = end of array; drawing pops from the end, so the top
  // card is drawn first.  We record `drawn` in draw-order (top → next).
  const slice = state.drawPile.slice(-count);
  const drawn = slice.slice().reverse();
  const remaining = state.drawPile.slice(0, state.drawPile.length - slice.length);
  const t = tick(state);
  const event: DrawCardsEvent = {
    type: 'draw-cards',
    tick: t.tick,
    player,
    cards: drawn,
    reason,
  };
  let next: GameState = { ...t.state, drawPile: remaining };
  next = updatePlayer(next, player, (p) => ({ ...p, hand: [...p.hand, ...drawn] }));
  return { state: log(next, event), event };
};

export const loseCards = (
  state: GameState,
  player: PlayerId,
  cards: readonly CardId[],
  from: LoseCardsEvent['from'],
  reason: string,
): Result<LoseCardsEvent> => {
  const t = tick(state);
  const event: LoseCardsEvent = {
    type: 'lose-cards',
    tick: t.tick,
    player,
    cards,
    from,
    reason,
  };
  const next = updatePlayer(t.state, player, (p) => {
    if (from === 'hand') {
      const set = new Set(cards);
      return { ...p, hand: p.hand.filter((c) => !set.has(c)) };
    }
    if (from === 'equipment') {
      const eq = { ...p.equipment };
      for (const c of cards) {
        for (const slot of Object.keys(eq) as (keyof typeof eq)[]) {
          if (eq[slot] === c) delete eq[slot];
        }
      }
      return { ...p, equipment: eq };
    }
    // judge
    const set = new Set(cards);
    return { ...p, judgeArea: p.judgeArea.filter((c) => !set.has(c)) };
  });
  return { state: log(next, event), event };
};

export const gainCards = (
  state: GameState,
  player: PlayerId,
  cards: readonly CardId[],
  reason: string,
): Result<GainCardsEvent> => {
  const t = tick(state);
  const event: GainCardsEvent = {
    type: 'gain-cards',
    tick: t.tick,
    player,
    cards,
    reason,
  };
  const next = updatePlayer(t.state, player, (p) => ({
    ...p,
    hand: [...p.hand, ...cards],
  }));
  return { state: log(next, event), event };
};

export const discardToPile = (
  state: GameState,
  player: PlayerId,
  cards: readonly CardId[],
  reason: DiscardCardEvent['reason'],
): { state: GameState; events: readonly [DiscardCardEvent, EnterPileEvent] } => {
  const lossR = loseCards(state, player, cards, 'hand', `discard:${reason}`);
  const t = tick(lossR.state);
  const discardEv: DiscardCardEvent = {
    type: 'discard-card',
    tick: t.tick,
    player,
    cards,
    reason,
  };
  const t2 = tick(log(t.state, discardEv));
  const enterEv: EnterPileEvent = {
    type: 'enter-pile',
    tick: t2.tick,
    cards,
    pile: 'discard',
  };
  const next: GameState = {
    ...t2.state,
    discardPile: [...t2.state.discardPile, ...cards],
  };
  return { state: log(next, enterEv), events: [discardEv, enterEv] };
};

export const equipCard = (
  state: GameState,
  player: PlayerId,
  card: CardId,
): { state: GameState; events: readonly GameEvent[] } => {
  const c = state.cards.get(card);
  if (!c || c.category !== 'equipment') throw new Error(`not equipment: ${card}`);
  const p = findPlayer(state, player);
  const slot = c.slot;
  const replaced = p.equipment[slot];

  // Remove from hand first
  const lossR = loseCards(state, player, [card], 'hand', 'equip');
  const events: GameEvent[] = [lossR.event];
  let cur = lossR.state;

  // Kick out previous equipment to discard
  if (replaced) {
    const tk = tick(cur);
    const unequipEv: UnequipCardEvent = {
      type: 'unequip-card',
      tick: tk.tick,
      player,
      card: replaced,
    };
    const tkLogged = log(tk.state, unequipEv);
    events.push(unequipEv);
    const tk2 = tick(tkLogged);
    const enterEv: EnterPileEvent = {
      type: 'enter-pile',
      tick: tk2.tick,
      cards: [replaced],
      pile: 'discard',
    };
    cur = log({
      ...tk2.state,
      discardPile: [...tk2.state.discardPile, replaced],
    }, enterEv);
    events.push(enterEv);
  }

  const t = tick(cur);
  const equipEv: EquipCardEvent = {
    type: 'equip-card',
    tick: t.tick,
    player,
    card,
    ...(replaced ? { replaced } : {}),
  };
  cur = updatePlayer(t.state, player, (pp) => ({
    ...pp,
    equipment: { ...pp.equipment, [slot]: card },
  }));
  cur = log(cur, equipEv);
  events.push(equipEv);
  return { state: cur, events };
};

export const dealDamage = (
  state: GameState,
  source: PlayerId | null,
  target: PlayerId,
  amount: number,
  kind: DamageKind,
  card?: CardId,
): Result<DamageEvent> => {
  const t = tick(state);
  const event: DamageEvent = {
    type: 'damage',
    tick: t.tick,
    source,
    target,
    amount,
    kind,
    ...(card ? { card } : {}),
  };
  const next = updatePlayer(t.state, target, (p) => ({
    ...p,
    hp: p.hp - amount,
  }));
  return { state: log(next, event), event };
};

export const heal = (
  state: GameState,
  source: PlayerId | null,
  target: PlayerId,
  amount: number,
  reason: string,
): Result<HealEvent> => {
  const t = tick(state);
  const p = findPlayer(t.state, target);
  const actual = Math.max(0, Math.min(amount, p.maxHp - p.hp));
  const event: HealEvent = {
    type: 'heal',
    tick: t.tick,
    source,
    target,
    amount: actual,
    reason,
  };
  const next = updatePlayer(t.state, target, (pp) => ({ ...pp, hp: pp.hp + actual }));
  return { state: log(next, event), event };
};

export const toPile = (
  state: GameState,
  cards: readonly CardId[],
  pile: 'discard' | 'draw',
): Result<EnterPileEvent> => {
  const t = tick(state);
  const event: EnterPileEvent = { type: 'enter-pile', tick: t.tick, cards, pile };
  const next: GameState =
    pile === 'discard'
      ? { ...t.state, discardPile: [...t.state.discardPile, ...cards] }
      : { ...t.state, drawPile: [...cards, ...t.state.drawPile] };
  return { state: log(next, event), event };
};

export const setFlag = (
  state: GameState,
  player: PlayerId,
  flag: string,
  value: number | string | boolean | null,
): GameState =>
  updatePlayer(state, player, (p) => {
    const flags = { ...p.flags };
    if (value === null) {
      delete flags[flag];
    } else {
      flags[flag] = value;
    }
    return { ...p, flags };
  });

export const setKingdomChoice = (
  state: GameState,
  player: PlayerId,
  slot: 'main' | 'sub',
  kingdom: Kingdom,
): GameState =>
  updatePlayer(state, player, (p) => {
    if (slot === 'main') return { ...p, main: { ...p.main, kingdomChoice: kingdom } };
    return { ...p, sub: { ...p.sub, kingdomChoice: kingdom } };
  });

export const setAmbitionist = (
  state: GameState,
  player: PlayerId,
  value: boolean,
): GameState =>
  updatePlayer(state, player, (p) => ({ ...p, isAmbitionist: value }));

export const setMaxHp = (
  state: GameState,
  player: PlayerId,
  delta: number,
): GameState =>
  updatePlayer(state, player, (p) => ({
    ...p,
    maxHp: Math.max(0, p.maxHp + delta),
  }));

export const markDeath = (
  state: GameState,
  player: PlayerId,
  source: PlayerId | null,
): { state: GameState; events: readonly GameEvent[] } => {
  const t = tick(state);
  const ev: GameEvent = {
    type: 'death',
    tick: t.tick,
    target: player,
    source,
  };
  const next = updatePlayer(t.state, player, (p) => ({ ...p, alive: false }));
  return { state: log(next, ev), events: [ev] };
};

export const revealGeneral = (
  state: GameState,
  player: PlayerId,
  slot: 'main' | 'sub',
): Result<RevealGeneralEvent> => {
  const t = tick(state);
  const event: RevealGeneralEvent = {
    type: 'reveal-general',
    tick: t.tick,
    player,
    slot,
  };
  const next = updatePlayer(t.state, player, (p) => {
    if (slot === 'main') {
      return { ...p, main: { ...p.main, revealed: true } };
    }
    return { ...p, sub: { ...p.sub, revealed: true } };
  });
  return { state: log(next, event), event };
};

export const setPhase = (
  state: GameState,
  to: TurnPhase,
): Result<PhaseChangeEvent> => {
  const t = tick(state);
  const cur = state.players[state.currentPlayerSeat];
  if (!cur) throw new Error('no current player');
  const event: PhaseChangeEvent = {
    type: 'phase-change',
    tick: t.tick,
    player: cur.id,
    from: state.phase,
    to,
  };
  return { state: log({ ...t.state, phase: to }, event), event };
};

export const advanceTurn = (
  state: GameState,
): { state: GameState; events: readonly [TurnEndEvent, TurnStartEvent] } => {
  const tEnd = tick(state);
  const cur = state.players[state.currentPlayerSeat];
  if (!cur) throw new Error('no current player');
  const endEv: TurnEndEvent = {
    type: 'turn-end',
    tick: tEnd.tick,
    player: cur.id,
    turnNumber: state.turnNumber,
  };
  let next = log(tEnd.state, endEv);

  // Advance seat to next living player
  const n = state.players.length;
  let nextSeat = (state.currentPlayerSeat + 1) % n;
  for (let i = 0; i < n; i++) {
    if (state.players[nextSeat]?.alive) break;
    nextSeat = (nextSeat + 1) % n;
  }
  next = {
    ...next,
    currentPlayerSeat: nextSeat,
    turnNumber: state.turnNumber + 1,
    phase: TURN_PHASES[0]!,
  };

  const tStart = tick(next);
  const newCur = next.players[nextSeat];
  if (!newCur) throw new Error('no next player');
  const startEv: TurnStartEvent = {
    type: 'turn-start',
    tick: tStart.tick,
    player: newCur.id,
    turnNumber: next.turnNumber,
  };
  return { state: log(tStart.state, startEv), events: [endEv, startEv] };
};
