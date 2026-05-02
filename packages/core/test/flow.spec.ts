/**
 * End-to-end multi-turn flow tests.
 *
 * Simulates exactly what the web store does — bootstrap a Guozhan
 * game, run AI seats autonomously, let "human" actions hit the
 * playCard / endTurn pipeline — and asserts the loop returns control
 * to the human and the game makes forward progress.
 *
 * These are the tests that catch *integration* bugs (a missing turn
 * advance, a stuck phase, AI never ending its turn) that the
 * per-card / per-skill specs don't.
 */

import { describe, it, expect } from 'vitest';
import {
  TriggerRegistry,
  HeuristicAi,
  buildStandardDeck,
  installGuozhanRules,
  createGuozhanState,
  createSession,
  drain,
  enqueue,
  respond as sessionRespond,
  buildPlayerPhasesUpToPlay,
  buildAiFullTurn,
  buildHumanEndTurnAndAdvance,
  type Session,
  type PlayerId,
  type GeneralId,
  type PendingDecision,
} from '../src/index.js';

const id = <T extends string>(s: string): T => s as unknown as T;

const HUMAN: PlayerId = id<PlayerId>('p1');

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

const setupGame = () => {
  const reg = new TriggerRegistry();
  installGuozhanRules(reg);
  const initial = createGuozhanState(
    [
      { id: HUMAN, name: '玩家',
        main: id<GeneralId>('cao-cao'), sub: id<GeneralId>('zhang-liao') },
      { id: id<PlayerId>('p2'), name: 'AI 1',
        main: id<GeneralId>('liu-bei'), sub: id<GeneralId>('guan-yu') },
      { id: id<PlayerId>('p3'), name: 'AI 2',
        main: id<GeneralId>('sun-quan'), sub: id<GeneralId>('lu-meng') },
    ],
    buildStandardDeck(),
    42,
    4,
  );
  const session = createSession(initial, reg);
  const ai = new HeuristicAi({ stateRef: () => session.state });
  return { session, ai };
};

/**
 * Drive AI turns until the active player is the human and they're in
 * the play phase — i.e. ready to receive UI input.
 */
const runUntilHuman = (session: Session, ai: HeuristicAi): void => {
  pumpAi(session, ai, HUMAN);
  while (true) {
    const cur = session.state.players[session.state.currentPlayerSeat];
    if (!cur || !cur.alive) return;
    if (cur.id === HUMAN) {
      enqueue(session, buildPlayerPhasesUpToPlay(HUMAN));
      pumpAi(session, ai, HUMAN);
      return;
    }
    enqueue(session, buildAiFullTurn(session.state, cur.id));
    pumpAi(session, ai, HUMAN);
  }
};

describe('multi-turn flow', () => {
  it('initial setup → human play phase → end turn → AI seats run → back to human', () => {
    const { session, ai } = setupGame();

    // Bootstrap: human's first turn up to play.
    runUntilHuman(session, ai);
    expect(session.state.currentPlayerSeat).toBe(0);
    expect(session.state.phase).toBe('play');
    // human drew 2 (4 starting + 2 phase = 6)
    expect(session.state.players[0]!.hand.length).toBe(6);

    // Human ends turn without playing
    enqueue(session, buildHumanEndTurnAndAdvance(session.state, HUMAN));
    runUntilHuman(session, ai);

    // After AI 1 + AI 2 turns, we should be back at human in play phase
    expect(session.state.currentPlayerSeat).toBe(0);
    expect(session.state.phase).toBe('play');
    expect(session.state.turnNumber).toBe(4); // T1 human, T2 ai1, T3 ai2, T4 human
    // Each AI drew 2 then auto-discarded to 4 (their max-hp). Their hands
    // should not exceed 4.
    // Hand limit at end of turn = current HP.
    // AI 1 = liu-bei(4)+guan-yu(4) → hp 4; AI 2 = sun-quan(4)+lu-meng(4) → hp 4.
    expect(session.state.players[1]!.hand.length).toBeLessThanOrEqual(4);
    expect(session.state.players[2]!.hand.length).toBeLessThanOrEqual(4);

    // Human ended their first turn at 6 cards; discard trigger drops to hp=4.
    // Then second turn's draw phase adds 2 → 6.
    expect(session.state.players[0]!.hand.length).toBe(6);
  });

  it('runs 3 full rounds without stalling', () => {
    const { session, ai } = setupGame();
    runUntilHuman(session, ai);
    for (let i = 0; i < 3; i++) {
      enqueue(session, buildHumanEndTurnAndAdvance(session.state, HUMAN));
      runUntilHuman(session, ai);
      expect(session.state.players[session.state.currentPlayerSeat]?.id).toBe(HUMAN);
      expect(session.state.phase).toBe('play');
    }
    // turnNumber should have advanced by 3 rounds × 3 players = 9
    // starting from T1 → T10
    expect(session.state.turnNumber).toBe(10);
  });

  it('reveals propagate to kingdom resolution mid-game', () => {
    const { session, ai } = setupGame();
    runUntilHuman(session, ai);
    // human reveals main (cao-cao = wei)
    enqueue(session, [{ kind: 'reveal-general', player: HUMAN, slot: 'main' }]);
    runUntilHuman(session, ai);
    expect(session.state.players[0]!.main.revealed).toBe(true);
  });
});

describe('human plays a card mid-turn', () => {
  it('杀 → AI auto-闪 (or take damage) and then human ends turn', async () => {
    const { session, ai } = setupGame();
    runUntilHuman(session, ai);

    // Find a 杀 in human's hand to play
    const human = session.state.players[0]!;
    let shaCard = null;
    for (const cid of human.hand) {
      const c = session.state.cards.get(cid);
      if (c?.name === '杀') { shaCard = cid; break; }
    }
    if (!shaCard) {
      // bail this case, deck shuffle didn't deal a 杀
      return;
    }

    // Import playCard dynamically to avoid circular deps
    const core = await import('../src/index.js');
    const cardReg = core.buildDefaultCardRegistry();
    const ai1 = session.state.players[1]!;
    const ai1HpBefore = ai1.hp;
    const ai1HandBefore = ai1.hand.length;

    enqueue(
      session,
      core.playCard(session.state, HUMAN, shaCard, [ai1.id], cardReg),
    );
    runUntilHuman(session, ai);

    const ai1After = session.state.players[1]!;
    // AI 1 either took damage (no 闪) or used a 闪 card (HP unchanged but
    // hand strictly smaller). Either way the action resolved.
    const tookDamage = ai1After.hp === ai1HpBefore - 1;
    const blocked = ai1After.hp === ai1HpBefore && ai1After.hand.length < ai1HandBefore;
    expect(tookDamage || blocked).toBe(true);
    expect(session.state.discardPile).toContain(shaCard);

    // End turn → loop should still bring us back to human in play
    enqueue(session, buildHumanEndTurnAndAdvance(session.state, HUMAN));
    runUntilHuman(session, ai);
    expect(session.state.players[session.state.currentPlayerSeat]?.id).toBe(HUMAN);
    expect(session.state.phase).toBe('play');
  });
});

describe('regression: endTurn does not stall mid-round', () => {
  it('after human endTurn, currentPlayerSeat eventually returns to human (no infinite stall)', () => {
    const { session, ai } = setupGame();
    runUntilHuman(session, ai);

    enqueue(session, buildHumanEndTurnAndAdvance(session.state, HUMAN));
    // Drain everything that AI can handle
    let safety = 0;
    while (safety++ < 200) {
      const pending = drain(session);
      if (pending) {
        if (pending.request.player === HUMAN) break;
        sessionRespond(session, ai.decide(pending.request));
        continue;
      }
      const cur = session.state.players[session.state.currentPlayerSeat];
      if (!cur) break;
      if (cur.id === HUMAN) {
        enqueue(session, buildPlayerPhasesUpToPlay(HUMAN));
        break;
      }
      enqueue(session, buildAiFullTurn(session.state, cur.id));
    }
    expect(safety).toBeLessThan(200); // no infinite loop
    expect(session.state.players[session.state.currentPlayerSeat]?.id).toBe(HUMAN);
  });
});
