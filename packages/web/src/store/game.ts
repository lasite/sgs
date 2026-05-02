/**
 * Zustand store wrapping a `Session` from @sgs/core.
 *
 * The store exposes:
 *   - `state`:    current GameState (subscribe-able)
 *   - `pending`:  current PendingDecision (or null) for the human
 *   - `start()`:  bootstrap a 3-player demo game with two AI opponents
 *   - `reveal/playHand/endTurn/respond`: human actions
 *
 * AI seats are pumped by `pumpAi` which drains until either the queue
 * is empty or the next decision belongs to the human.
 */

import { create } from 'zustand';
import {
  TriggerRegistry,
  HeuristicAi,
  buildDefaultCardRegistry,
  buildStandardDeck,
  installGuozhanRules,
  createGuozhanState,
  createSession,
  drain,
  enqueue,
  respond as sessionRespond,
  buildRevealEffects,
  playCard,
  refreshVictory,
  serialize,
  deserialize,
  type GameState,
  type PendingDecision,
  type Session,
  type DecisionResponse,
  type CardId,
  type GeneralId,
  type PlayerId,
} from '@sgs/core';

interface GameStore {
  session: Session | null;
  ai: HeuristicAi | null;
  state: GameState | null;
  pending: PendingDecision | null;
  humanId: PlayerId | null;
  log: string[];

  start: () => void;
  reveal: (slot: 'main' | 'sub') => void;
  playHand: (card: CardId, targets: PlayerId[]) => void;
  endTurn: () => void;
  respond: (response: DecisionResponse) => void;
  saveGame: () => void;
  loadGame: () => boolean;
}

const SAVE_KEY = 'sgs.guozhan.save.v1';

const id = <T extends string>(s: string): T => s as unknown as T;

const HUMAN: PlayerId = id<PlayerId>('p1');
const aiSeats: readonly PlayerId[] = [
  id<PlayerId>('p2'),
  id<PlayerId>('p3'),
];

const pumpAi = (
  session: Session,
  ai: HeuristicAi,
  humanId: PlayerId,
): PendingDecision | null => {
  let pending = drain(session);
  while (pending && pending.request.player !== humanId) {
    pending = sessionRespond(session, ai.decide(pending.request));
  }
  return pending;
};

const tail = <T>(arr: readonly T[], n: number): T[] => arr.slice(Math.max(0, arr.length - n));

export const useGame = create<GameStore>((set, get) => ({
  session: null,
  ai: null,
  state: null,
  pending: null,
  humanId: null,
  log: [],

  start: () => {
    const reg = new TriggerRegistry();
    installGuozhanRules(reg);
    const initial = createGuozhanState(
      [
        { id: HUMAN, name: '玩家',
          main: id<GeneralId>('cao-cao'),
          sub: id<GeneralId>('zhang-liao') },
        { id: aiSeats[0]!, name: 'AI 1',
          main: id<GeneralId>('liu-bei'),
          sub: id<GeneralId>('guan-yu') },
        { id: aiSeats[1]!, name: 'AI 2',
          main: id<GeneralId>('sun-quan'),
          sub: id<GeneralId>('lu-meng') },
      ],
      buildStandardDeck(),
      Date.now() & 0xffff,
      4,
    );
    const session = createSession(initial, reg);
    const ai = new HeuristicAi({ stateRef: () => session.state });
    const pending = pumpAi(session, ai, HUMAN);
    set({
      session,
      ai,
      humanId: HUMAN,
      state: refreshVictory(session.state),
      pending,
      log: ['新对局开始'],
    });
  },

  reveal: (slot) => {
    const { session, ai, humanId, log } = get();
    if (!session || !ai || !humanId) return;
    enqueue(session, buildRevealEffects(session.state, humanId, slot));
    const pending = pumpAi(session, ai, humanId);
    set({
      state: refreshVictory(session.state),
      pending,
      log: tail([...log, `亮${slot === 'main' ? '主' : '副'}将`], 50),
    });
  },

  playHand: (card, targets) => {
    const { session, ai, humanId, log } = get();
    if (!session || !ai || !humanId) return;
    const cardReg = buildDefaultCardRegistry();
    const cardName = session.state.cards.get(card)?.name ?? '?';
    try {
      const eff = playCard(session.state, humanId, card, targets, cardReg);
      enqueue(session, eff);
    } catch (e) {
      set({ log: tail([...log, `出牌失败: ${(e as Error).message}`], 50) });
      return;
    }
    const pending = pumpAi(session, ai, humanId);
    set({
      state: refreshVictory(session.state),
      pending,
      log: tail([...log, `打出 ${cardName}`], 50),
    });
  },

  endTurn: () => {
    const { session, ai, humanId, log } = get();
    if (!session || !ai || !humanId) return;
    // Walk discard → end → next turn.  For the MVP we hand-craft the
    // pipeline including AI 1's draw, then let pumpAi handle the rest.
    const nextSeat = session.state.players.find((p) => p.id !== humanId && p.alive)?.id;
    enqueue(session, [
      { kind: 'phase-change', to: 'discard' },
      { kind: 'phase-change', to: 'end' },
      { kind: 'turn-advance' },
      { kind: 'phase-change', to: 'start' },
      { kind: 'phase-change', to: 'judge' },
      { kind: 'phase-change', to: 'draw' },
      ...(nextSeat
        ? [{ kind: 'draw-cards' as const, player: nextSeat, count: 2,
              reason: 'phase' as const }]
        : []),
      { kind: 'phase-change', to: 'play' },
    ]);
    const pending = pumpAi(session, ai, humanId);
    set({
      state: refreshVictory(session.state),
      pending,
      log: tail([...log, '结束回合'], 50),
    });
  },

  respond: (response) => {
    const { session, ai, humanId, log } = get();
    if (!session || !ai || !humanId) return;
    sessionRespond(session, response);
    const pending = pumpAi(session, ai, humanId);
    set({
      state: refreshVictory(session.state),
      pending,
      log: tail([...log, '响应已提交'], 50),
    });
  },

  saveGame: () => {
    const { session, pending, log } = get();
    if (!session) return;
    if (pending || session.queue.length > 0) {
      set({ log: tail([...log, '存档失败：当前有未完成动作'], 50) });
      return;
    }
    try {
      window.localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({ state: serialize(session.state), log }),
      );
      set({ log: tail([...log, '已存档到本地'], 50) });
    } catch (e) {
      set({ log: tail([...log, `存档失败: ${(e as Error).message}`], 50) });
    }
  },

  loadGame: (): boolean => {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw) as { state: string; log?: string[] };
      const restored = deserialize(parsed.state);
      const reg = new TriggerRegistry();
      installGuozhanRules(reg);
      const session = createSession(restored, reg);
      const ai = new HeuristicAi({ stateRef: () => session.state });
      const pending = pumpAi(session, ai, HUMAN);
      set({
        session,
        ai,
        humanId: HUMAN,
        state: refreshVictory(session.state),
        pending,
        log: [...(parsed.log ?? []), '已读取存档'],
      });
      return true;
    } catch (e) {
      set({ log: [`读档失败: ${(e as Error).message}`] });
      return false;
    }
  },
}));
