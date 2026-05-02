import { describe, it, expect } from 'vitest';
import {
  TriggerRegistry,
  createSession,
  drain,
  enqueue,
  respond,
  installGuozhanRules,
  buildRevealEffects,
  playerKingdom,
  computeVictory,
  refreshVictory,
  createGuozhanState,
  buildStandardDeck,
} from '../src/index.js';
import type {
  GeneralId,
  PlayerId,
} from '../src/model/index.js';

const id = <T extends string>(s: string): T => s as unknown as T;

const setup = () => {
  const reg = new TriggerRegistry();
  installGuozhanRules(reg);
  const state = createGuozhanState(
    [
      { id: id<PlayerId>('p1'), name: 'P1',
        main: id<GeneralId>('cao-cao'), sub: id<GeneralId>('zhang-liao') },
      { id: id<PlayerId>('p2'), name: 'P2',
        main: id<GeneralId>('liu-bei'), sub: id<GeneralId>('guan-yu') },
      { id: id<PlayerId>('p3'), name: 'P3',
        main: id<GeneralId>('xiao-qiao'), sub: id<GeneralId>('zhou-yu') },
    ],
    buildStandardDeck(),
    1,
    4,
  );
  return { reg, state };
};

describe('createGuozhanState', () => {
  it('creates 3 players with 4 cards each and floor((mainHp+subHp)/2)', () => {
    const { state } = setup();
    expect(state.players).toHaveLength(3);
    for (const p of state.players) {
      expect(p.hand).toHaveLength(4);
      expect(p.hp).toBe(p.maxHp);
    }
    // cao-cao=4, zhang-liao=4 → 4
    expect(state.players[0]!.hp).toBe(4);
    // liu-bei=4, guan-yu=4 → 4
    expect(state.players[1]!.hp).toBe(4);
    // xiao-qiao=3, zhou-yu=3 → 3
    expect(state.players[2]!.hp).toBe(3);
  });

  it('has all-hidden generals to start', () => {
    const { state } = setup();
    for (const p of state.players) {
      expect(p.main.revealed).toBe(false);
      expect(p.sub.revealed).toBe(false);
      expect(playerKingdom(p)).toBeNull();
    }
  });
});

describe('reveal — single-faction', () => {
  it('flips the slot and resolves to the right kingdom', () => {
    const { reg, state } = setup();
    const session = createSession(state, reg);
    enqueue(session, buildRevealEffects(state, id<PlayerId>('p1'), 'main'));
    drain(session);
    const p1 = session.state.players[0]!;
    expect(p1.main.revealed).toBe(true);
    expect(playerKingdom(p1)).toBe('wei');
  });
});

describe('reveal — double-faction prompts kingdom choice', () => {
  it('writes kingdomChoice on the slot after the prompt', () => {
    const { reg, state } = setup();
    const session = createSession(state, reg);
    // p3.main = xiao-qiao (wu/qun)
    enqueue(session, buildRevealEffects(state, id<PlayerId>('p3'), 'main'));
    let pending = drain(session)!;
    expect(pending.request.kind).toBe('choose-kingdom');
    pending = respond(session, {
      id: pending.request.id, kind: 'choose-kingdom', kingdom: 'qun',
    })!;
    expect(pending).toBeNull();
    const p3 = session.state.players[2]!;
    expect(p3.main.revealed).toBe(true);
    expect(p3.main.kingdomChoice).toBe('qun');
    expect(playerKingdom(p3)).toBe('qun');
  });
});

describe('珠联璧合 (companion bonus)', () => {
  it('grants +1 maxHp + heal + 1 draw when both revealed are companions', () => {
    const { reg, state } = setup();
    // p2 has liu-bei + guan-yu — they're companions
    const session = createSession(state, reg);
    enqueue(session, [
      ...buildRevealEffects(session.state, id<PlayerId>('p2'), 'main'),
      ...buildRevealEffects(session.state, id<PlayerId>('p2'), 'sub'),
    ]);
    drain(session);
    const p2 = session.state.players[1]!;
    expect(p2.maxHp).toBe(5);
    expect(p2.flags['__companion-bonus']).toBe(true);
    // 4 starting + 1 from bonus
    expect(p2.hand).toHaveLength(5);
  });

  it('skips companion bonus for non-pair generals', () => {
    const { reg, state } = setup();
    // p1: cao-cao + zhang-liao — not companions
    const session = createSession(state, reg);
    enqueue(session, [
      ...buildRevealEffects(session.state, id<PlayerId>('p1'), 'main'),
      ...buildRevealEffects(session.state, id<PlayerId>('p1'), 'sub'),
    ]);
    drain(session);
    const p1 = session.state.players[0]!;
    expect(p1.maxHp).toBe(4);
    expect(p1.flags['__companion-bonus']).toBeUndefined();
  });
});

describe('野心家 promotion', () => {
  it('flips isAmbitionist when both kingdoms are incompatible', () => {
    const { reg, state } = setup();
    // Construct a tailored player: main=cao-cao (wei), sub=guan-yu (shu)
    const altered = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0
          ? { ...p, sub: { ...p.sub, general: 'guan-yu' as GeneralId } }
          : p,
      ),
    };
    const session = createSession(altered, reg);
    enqueue(session, [
      ...buildRevealEffects(session.state, id<PlayerId>('p1'), 'main'),
      ...buildRevealEffects(session.state, id<PlayerId>('p1'), 'sub'),
    ]);
    drain(session);
    const p1 = session.state.players[0]!;
    expect(p1.isAmbitionist).toBe(true);
    expect(playerKingdom(p1)).toBeNull();
  });

  it('does NOT flip ambitionist for double-faction reconciled to same kingdom', () => {
    const { reg, state } = setup();
    // p3.sub = zhou-yu (wu); p3.main = xiao-qiao (wu/qun) → choose wu
    const session = createSession(state, reg);
    enqueue(session, [
      ...buildRevealEffects(session.state, id<PlayerId>('p3'), 'main'),
    ]);
    let pending = drain(session)!;
    pending = respond(session, {
      id: pending.request.id, kind: 'choose-kingdom', kingdom: 'wu',
    })!;
    enqueue(session, [
      ...buildRevealEffects(session.state, id<PlayerId>('p3'), 'sub'),
    ]);
    drain(session);
    const p3 = session.state.players[2]!;
    expect(p3.isAmbitionist).toBe(false);
    expect(playerKingdom(p3)).toBe('wu');
  });
});

describe('victory', () => {
  it('declares ambitionist solo win when alone', () => {
    const { state } = setup();
    const altered = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0
          ? { ...p, isAmbitionist: true, alive: true,
              main: { ...p.main, revealed: true },
              sub: { ...p.sub, revealed: true } }
          : { ...p, alive: false },
      ),
    };
    const v = computeVictory(altered);
    expect(v.ended).toBe(true);
    expect(v.winners).toEqual(['p1']);
    expect(v.reason).toBe('ambitionist-solo');
  });

  it('declares kingdom victory when only one kingdom remains', () => {
    const { state } = setup();
    const altered = {
      ...state,
      players: state.players.map((p, i) => {
        if (i === 0) {
          // p1 wei revealed, alive
          return { ...p,
            main: { ...p.main, revealed: true },
            sub: { ...p.sub, revealed: true } };
        }
        if (i === 1) {
          // p2 dead, never revealed
          return { ...p, alive: false };
        }
        // p3 flipped wu, alive
        return { ...p,
          main: { ...p.main, revealed: true, kingdomChoice: 'wu' as const },
          sub: { ...p.sub, revealed: true } };
      }),
    };
    // simulate: only p1 (wei) and p3 (wu) alive, both revealed and
    // different kingdoms → no victory yet
    const v0 = computeVictory(altered);
    expect(v0.ended).toBe(false);

    // Now mark p3 dead
    const after = {
      ...altered,
      players: altered.players.map((p, i) => i === 2 ? { ...p, alive: false } : p),
    };
    const v = refreshVictory(after).victory;
    expect(v.ended).toBe(true);
    expect(v.reason).toBe('kingdom-wei');
    expect(v.winners).toEqual(['p1']);
  });

  it('does not end while any living player is hidden', () => {
    const { state } = setup();
    // all alive, none revealed
    expect(computeVictory(state).ended).toBe(false);
  });
});
