import { describe, it, expect } from 'vitest';
import {
  TriggerRegistry,
  createSession,
  drain,
  enqueue,
  respond,
  type Trigger,
  type TriggerId,
  type Effect,
} from '../src/engine/index.js';
import type {
  Card,
  CardId,
  GameState,
  Player,
  PlayerId,
  GeneralId,
} from '../src/model/index.js';

const id = <T extends string>(s: string): T => s as unknown as T;

function makeState(overrides: Partial<GameState> = {}): GameState {
  const players: Player[] = [
    {
      id: id<PlayerId>('p1'),
      seat: 0,
      name: 'P1',
      main: { general: id<GeneralId>('g-cao'), revealed: false },
      sub: { general: id<GeneralId>('g-zhang'), revealed: false },
      hp: 4,
      maxHp: 4,
      hand: [],
      equipment: {},
      judgeArea: [],
      isAmbitionist: false,
      alive: true,
      flags: {},
    },
    {
      id: id<PlayerId>('p2'),
      seat: 1,
      name: 'P2',
      main: { general: id<GeneralId>('g-liu'), revealed: false },
      sub: { general: id<GeneralId>('g-guan'), revealed: false },
      hp: 4,
      maxHp: 4,
      hand: [],
      equipment: {},
      judgeArea: [],
      isAmbitionist: false,
      alive: true,
      flags: {},
    },
  ];

  // Build a small deck of 8 杀-shaped cards
  const cards = new Map<CardId, Card>();
  const deck: CardId[] = [];
  for (let i = 0; i < 8; i++) {
    const cid = id<CardId>(`c-${i}`);
    cards.set(cid, {
      id: cid,
      suit: 'spade',
      rank: '7',
      name: '杀',
      category: 'basic',
      subtype: 'sha',
      element: 'normal',
    });
    deck.push(cid);
  }

  return {
    tick: 0,
    players,
    cards,
    drawPile: deck,
    discardPile: [],
    currentPlayerSeat: 0,
    phase: 'start',
    turnNumber: 1,
    eventLog: [],
    rng: { seed: 1, cursor: 0 },
    victory: { ended: false },
    ...overrides,
  };
}

describe('session: damage + mandatory trigger', () => {
  it('runs a mandatory trigger automatically on damage', () => {
    const reg = new TriggerRegistry();
    // Mandatory: when target takes damage, target draws 1 card.
    const trig: Trigger = {
      id: id<TriggerId>('t1'),
      on: 'damage',
      owner: id<PlayerId>('p1'),
      mandatory: true,
      priority: 0,
      handler: (ctx) => {
        if (ctx.event.type !== 'damage') return [];
        return [{ kind: 'draw-cards', player: ctx.event.target, count: 1, reason: 'skill' }];
      },
    };
    reg.register(trig);

    const s = createSession(makeState(), reg);
    enqueue(s, [{
      kind: 'damage',
      source: id<PlayerId>('p1'),
      target: id<PlayerId>('p1'),
      amount: 1,
      damageKind: 'normal',
    }]);
    const pending = drain(s);

    expect(pending).toBeNull();
    const p1 = s.state.players.find((p) => p.id === id<PlayerId>('p1'))!;
    expect(p1.hp).toBe(3);            // damage applied
    expect(p1.hand).toHaveLength(1);  // mandatory trigger drew 1
  });
});

describe('session: optional trigger opt-in', () => {
  it('suspends with a trigger-opt-in request and resumes on accept', () => {
    const reg = new TriggerRegistry();
    const trig: Trigger = {
      id: id<TriggerId>('t-jianxiong'),
      on: 'damage',
      owner: id<PlayerId>('p1'),
      mandatory: false,
      priority: 0,
      skill: '奸雄',
      handler: (ctx) => {
        if (ctx.event.type !== 'damage') return [];
        // gain 1 card from draw pile
        return [{ kind: 'draw-cards', player: ctx.event.target, count: 1, reason: 'skill' }];
      },
    };
    reg.register(trig);

    const s = createSession(makeState(), reg);
    enqueue(s, [{
      kind: 'damage',
      source: id<PlayerId>('p2'),
      target: id<PlayerId>('p1'),
      amount: 1,
      damageKind: 'normal',
    }]);
    const pending = drain(s);

    expect(pending).not.toBeNull();
    expect(pending!.request.kind).toBe('trigger-opt-in');
    if (pending!.request.kind !== 'trigger-opt-in') throw new Error('kind');
    expect(pending!.request.skill).toBe('奸雄');

    const p1Before = s.state.players[0]!;
    expect(p1Before.hand).toHaveLength(0); // not drawn yet

    // Accept
    const next = respond(s, {
      id: pending!.request.id,
      kind: 'trigger-opt-in',
      accept: true,
    });

    expect(next).toBeNull();
    const p1 = s.state.players[0]!;
    expect(p1.hand).toHaveLength(1); // gained the card after opt-in
  });

  it('decline path skips the trigger handler', () => {
    const reg = new TriggerRegistry();
    const trig: Trigger = {
      id: id<TriggerId>('t2'),
      on: 'damage',
      owner: id<PlayerId>('p1'),
      mandatory: false,
      priority: 0,
      skill: '奸雄',
      handler: () => [{ kind: 'draw-cards', player: id<PlayerId>('p1'), count: 1, reason: 'skill' }],
    };
    reg.register(trig);

    const s = createSession(makeState(), reg);
    enqueue(s, [{
      kind: 'damage',
      source: id<PlayerId>('p2'),
      target: id<PlayerId>('p1'),
      amount: 1,
      damageKind: 'normal',
    }]);
    const pending = drain(s)!;
    expect(pending.request.kind).toBe('trigger-opt-in');
    const next = respond(s, { id: pending.request.id, kind: 'trigger-opt-in', accept: false });
    expect(next).toBeNull();
    const p1 = s.state.players[0]!;
    expect(p1.hand).toHaveLength(0);  // declined → no draw
    expect(p1.hp).toBe(3);            // damage still applied
  });
});

describe('session: trigger ordering', () => {
  it('mandatory triggers fire before optional ones', () => {
    const reg = new TriggerRegistry();
    const fired: string[] = [];
    reg.register({
      id: id<TriggerId>('opt'),
      on: 'damage',
      owner: id<PlayerId>('p1'),
      mandatory: false,
      priority: 10,
      handler: () => { fired.push('opt'); return []; },
      skill: 'opt',
    });
    reg.register({
      id: id<TriggerId>('mand'),
      on: 'damage',
      owner: id<PlayerId>('p1'),
      mandatory: true,
      priority: 0,
      handler: () => { fired.push('mand'); return []; },
    });

    const s = createSession(makeState(), reg);
    enqueue(s, [{
      kind: 'damage',
      source: id<PlayerId>('p2'),
      target: id<PlayerId>('p1'),
      amount: 1,
      damageKind: 'normal',
    }]);
    const pending = drain(s);
    // mand fires immediately, opt suspends
    expect(fired).toEqual(['mand']);
    expect(pending).not.toBeNull();
  });
});

describe('phase advance & turn rotation', () => {
  it('phase-change & draw effects update state and emit events', () => {
    const reg = new TriggerRegistry();
    const s = createSession(makeState(), reg);
    enqueue(s, [
      { kind: 'phase-change', to: 'draw' },
      { kind: 'draw-cards', player: id<PlayerId>('p1'), count: 2, reason: 'phase' },
    ]);
    drain(s);
    expect(s.state.phase).toBe('draw');
    expect(s.state.players[0]!.hand).toHaveLength(2);
    const types = s.state.eventLog.map((e) => e.type);
    expect(types).toContain('phase-change');
    expect(types).toContain('draw-cards');
  });

  it('turn-advance moves currentPlayerSeat to next living player and bumps turnNumber', () => {
    const reg = new TriggerRegistry();
    const s = createSession(makeState(), reg);
    expect(s.state.currentPlayerSeat).toBe(0);
    expect(s.state.turnNumber).toBe(1);
    enqueue(s, [{ kind: 'turn-advance' }]);
    drain(s);
    expect(s.state.currentPlayerSeat).toBe(1);
    expect(s.state.turnNumber).toBe(2);
    const types = s.state.eventLog.map((e) => e.type);
    expect(types).toEqual(['turn-end', 'turn-start']);
  });

  it('skips dead players when advancing turn', () => {
    const reg = new TriggerRegistry();
    const base = makeState();
    const dead = base.players.map((p, i) =>
      i === 1 ? { ...p, alive: false } : p,
    );
    const s = createSession({ ...base, players: dead }, reg);
    enqueue(s, [{ kind: 'turn-advance' }]);
    drain(s);
    // only p1 alive → next seat wraps back to 0
    expect(s.state.currentPlayerSeat).toBe(0);
  });
});

describe('mutations: equipment slot replacement', () => {
  it('discards previous equipment when a new one is equipped in the same slot', () => {
    const reg = new TriggerRegistry();
    // Build state with 2 weapons; player has both in hand.
    const c1 = id<CardId>('w1');
    const c2 = id<CardId>('w2');
    const cardsMap = new Map<CardId, Card>([
      [c1, {
        id: c1, suit: 'spade', rank: '5', name: '诸葛连弩',
        category: 'equipment', subtype: 'zhu-ge-lian-nu', slot: 'weapon', range: 1,
      }],
      [c2, {
        id: c2, suit: 'club', rank: '5', name: '雌雄双股剑',
        category: 'equipment', subtype: 'ci-xiong-shuang-gu-jian', slot: 'weapon', range: 2,
      }],
    ]);
    const base = makeState({ cards: cardsMap, drawPile: [] });
    const withHand: GameState = {
      ...base,
      players: base.players.map((p, i) =>
        i === 0 ? { ...p, hand: [c1, c2] } : p,
      ),
    };
    const s = createSession(withHand, reg);

    enqueue(s, [
      { kind: 'equip-card', player: id<PlayerId>('p1'), card: c1 },
      { kind: 'equip-card', player: id<PlayerId>('p1'), card: c2 },
    ]);
    drain(s);

    const p1 = s.state.players[0]!;
    expect(p1.equipment.weapon).toBe(c2);
    expect(p1.hand).toHaveLength(0);
    // c1 should be in discard pile
    expect(s.state.discardPile).toContain(c1);
  });
});
