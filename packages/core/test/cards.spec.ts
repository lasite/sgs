import { describe, it, expect } from 'vitest';
import {
  TriggerRegistry,
  createSession,
  drain,
  enqueue,
  respond,
  buildDefaultCardRegistry,
  buildStandardDeck,
  playCard,
} from '../src/index.js';
import type {
  Card,
  CardId,
  GameState,
  Player,
  PlayerId,
  GeneralId,
} from '../src/model/index.js';

const id = <T extends string>(s: string): T => s as unknown as T;

const baseState = (
  cardOverrides: Map<CardId, Card>,
  hand1: CardId[],
  hand2: CardId[] = [],
): GameState => ({
  tick: 0,
  players: [
    {
      id: id<PlayerId>('p1'),
      seat: 0,
      name: 'P1',
      main: { general: id<GeneralId>('a'), revealed: false },
      sub: { general: id<GeneralId>('b'), revealed: false },
      hp: 4,
      maxHp: 4,
      hand: hand1,
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
      main: { general: id<GeneralId>('c'), revealed: false },
      sub: { general: id<GeneralId>('d'), revealed: false },
      hp: 4,
      maxHp: 4,
      hand: hand2,
      equipment: {},
      judgeArea: [],
      isAmbitionist: false,
      alive: true,
      flags: {},
    },
  ],
  cards: cardOverrides,
  drawPile: [],
  discardPile: [],
  currentPlayerSeat: 0,
  phase: 'play',
  turnNumber: 1,
  eventLog: [],
  rng: { seed: 1, cursor: 0 },
  victory: { ended: false },
});

const mkSha = (idStr: string): Card => ({
  id: id<CardId>(idStr),
  suit: 'spade',
  rank: '7',
  name: '杀',
  category: 'basic',
  subtype: 'sha',
  element: 'normal',
});
const mkShan = (idStr: string): Card => ({
  id: id<CardId>(idStr),
  suit: 'heart',
  rank: '5',
  name: '闪',
  category: 'basic',
  subtype: 'shan',
});
const mkTao = (idStr: string): Card => ({
  id: id<CardId>(idStr),
  suit: 'heart',
  rank: '8',
  name: '桃',
  category: 'basic',
  subtype: 'tao',
});

describe('杀', () => {
  it('damages target who declines 闪', () => {
    const reg = new TriggerRegistry();
    const sha = mkSha('sha-1');
    const cards = new Map([[sha.id, sha]]);
    const state = baseState(cards, [sha.id]);
    const cardReg = buildDefaultCardRegistry();

    const session = createSession(state, reg);
    enqueue(session, playCard(state, id<PlayerId>('p1'), sha.id, [id<PlayerId>('p2')], cardReg));

    let pending = drain(session);
    expect(pending).not.toBeNull();
    expect(pending!.request.kind).toBe('respond-card');
    if (pending!.request.kind !== 'respond-card') throw new Error('kind');
    expect(pending!.request.player).toBe('p2');
    expect(pending!.request.accepts).toContain('闪');

    pending = respond(session, {
      id: pending!.request.id, kind: 'respond-card', card: null,
    });
    expect(pending).toBeNull();
    const p2 = session.state.players[1]!;
    expect(p2.hp).toBe(3);
    expect(session.state.discardPile).toContain(sha.id);
  });

  it('absorbs 闪 with no damage and discards both cards', () => {
    const reg = new TriggerRegistry();
    const sha = mkSha('sha-2');
    const shan = mkShan('shan-1');
    const cards = new Map([[sha.id, sha], [shan.id, shan]]);
    const state = baseState(cards, [sha.id], [shan.id]);

    const session = createSession(state, reg);
    enqueue(session, playCard(state, id<PlayerId>('p1'), sha.id, [id<PlayerId>('p2')], buildDefaultCardRegistry()));
    let pending = drain(session)!;
    pending = respond(session, {
      id: pending.request.id, kind: 'respond-card', card: shan.id,
    })!;
    expect(pending).toBeNull();
    const p2 = session.state.players[1]!;
    expect(p2.hp).toBe(4);
    expect(p2.hand).toHaveLength(0);
    expect(session.state.discardPile).toEqual(expect.arrayContaining([sha.id, shan.id]));
  });

  it('refuses self-target', () => {
    const sha = mkSha('sha-3');
    const cards = new Map([[sha.id, sha]]);
    const state = baseState(cards, [sha.id]);
    expect(() =>
      playCard(state, id<PlayerId>('p1'), sha.id, [id<PlayerId>('p1')], buildDefaultCardRegistry()),
    ).toThrow();
  });
});

describe('桃', () => {
  it('heals self when wounded', () => {
    const reg = new TriggerRegistry();
    const tao = mkTao('tao-1');
    const cards = new Map([[tao.id, tao]]);
    const state: GameState = {
      ...baseState(cards, [tao.id]),
      players: [
        // wound p1 from 4 -> 2
        { ...baseState(cards, [tao.id]).players[0]!, hp: 2 },
        baseState(cards, []).players[1]!,
      ],
    };
    const session = createSession(state, reg);
    enqueue(session, playCard(state, id<PlayerId>('p1'), tao.id, [id<PlayerId>('p1')], buildDefaultCardRegistry()));
    drain(session);
    expect(session.state.players[0]!.hp).toBe(3);
  });

  it('refuses use at full HP', () => {
    const tao = mkTao('tao-2');
    const cards = new Map([[tao.id, tao]]);
    const state = baseState(cards, [tao.id]);
    expect(() =>
      playCard(state, id<PlayerId>('p1'), tao.id, [id<PlayerId>('p1')], buildDefaultCardRegistry()),
    ).toThrow();
  });
});

describe('无中生有', () => {
  it('draws 2 cards', () => {
    const reg = new TriggerRegistry();
    const wzsy: Card = {
      id: id<CardId>('wz-1'),
      suit: 'heart',
      rank: 'K',
      name: '无中生有',
      category: 'trick',
      subtype: 'wu-zhong-sheng-you',
      delayed: false,
    };
    const c1 = mkSha('c1');
    const c2 = mkSha('c2');
    const cards = new Map([[wzsy.id, wzsy], [c1.id, c1], [c2.id, c2]]);
    const state: GameState = {
      ...baseState(cards, [wzsy.id]),
      drawPile: [c2.id, c1.id], // top of pile = end of array; will draw c1 then c2
    };
    const session = createSession(state, reg);
    enqueue(session, playCard(state, id<PlayerId>('p1'), wzsy.id, [], buildDefaultCardRegistry()));
    drain(session);
    const p1 = session.state.players[0]!;
    expect(p1.hand).toEqual([c1.id, c2.id]);
    expect(session.state.discardPile).toContain(wzsy.id);
  });
});

describe('决斗', () => {
  it("attacker wins when target can't produce 杀", () => {
    const reg = new TriggerRegistry();
    const jd: Card = {
      id: id<CardId>('jd-1'),
      suit: 'spade',
      rank: 'A',
      name: '决斗',
      category: 'trick',
      subtype: 'jue-dou',
      delayed: false,
    };
    const cards = new Map([[jd.id, jd]]);
    const state = baseState(cards, [jd.id]);
    const session = createSession(state, reg);
    enqueue(session, playCard(state, id<PlayerId>('p1'), jd.id, [id<PlayerId>('p2')], buildDefaultCardRegistry()));
    let pending = drain(session)!;
    // p2 prompted first
    expect(pending.request.player).toBe('p2');
    pending = respond(session, { id: pending.request.id, kind: 'respond-card', card: null })!;
    expect(pending).toBeNull();
    expect(session.state.players[1]!.hp).toBe(3);
  });

  it('damages attacker if target plays 杀 and attacker fails to', () => {
    const reg = new TriggerRegistry();
    const jd: Card = {
      id: id<CardId>('jd-2'),
      suit: 'spade',
      rank: '2',
      name: '决斗',
      category: 'trick',
      subtype: 'jue-dou',
      delayed: false,
    };
    const sha = mkSha('sha-d');
    const cards = new Map([[jd.id, jd], [sha.id, sha]]);
    const state = baseState(cards, [jd.id], [sha.id]);
    const session = createSession(state, reg);
    enqueue(session, playCard(state, id<PlayerId>('p1'), jd.id, [id<PlayerId>('p2')], buildDefaultCardRegistry()));
    let pending = drain(session)!;
    // p2 plays 杀
    pending = respond(session, { id: pending.request.id, kind: 'respond-card', card: sha.id })!;
    // now p1 must respond with 杀
    expect(pending!.request.player).toBe('p1');
    pending = respond(session, { id: pending!.request.id, kind: 'respond-card', card: null })!;
    expect(pending).toBeNull();
    expect(session.state.players[0]!.hp).toBe(3);
    expect(session.state.players[1]!.hp).toBe(4);
  });
});

describe('AOE: 万箭齐发', () => {
  it('damages each non-source player who fails to play 闪', () => {
    const reg = new TriggerRegistry();
    const wj: Card = {
      id: id<CardId>('wj-1'),
      suit: 'heart',
      rank: '10',
      name: '万箭齐发',
      category: 'trick',
      subtype: 'wan-jian-qi-fa',
      delayed: false,
    };
    const cards = new Map([[wj.id, wj]]);
    const state = baseState(cards, [wj.id]);
    const session = createSession(state, reg);
    enqueue(session, playCard(state, id<PlayerId>('p1'), wj.id, [], buildDefaultCardRegistry()));
    let pending = drain(session)!;
    // first prompt is for p2 (only other living player)
    expect(pending.request.player).toBe('p2');
    pending = respond(session, { id: pending.request.id, kind: 'respond-card', card: null })!;
    expect(pending).toBeNull();
    expect(session.state.players[1]!.hp).toBe(3);
  });
});

describe('过河拆桥', () => {
  it("discards a chosen card from target's hand", () => {
    const reg = new TriggerRegistry();
    const guo: Card = {
      id: id<CardId>('g-1'),
      suit: 'spade',
      rank: '4',
      name: '过河拆桥',
      category: 'trick',
      subtype: 'guo-he-chai-qiao',
      delayed: false,
    };
    const victim = mkSha('v-1');
    const cards = new Map([[guo.id, guo], [victim.id, victim]]);
    const state = baseState(cards, [guo.id], [victim.id]);
    const session = createSession(state, reg);
    enqueue(session, playCard(state, id<PlayerId>('p1'), guo.id, [id<PlayerId>('p2')], buildDefaultCardRegistry()));
    let pending = drain(session)!;
    expect(pending.request.kind).toBe('choose-cards');
    pending = respond(session, {
      id: pending.request.id, kind: 'choose-cards', cards: [victim.id],
    })!;
    expect(pending).toBeNull();
    expect(session.state.players[1]!.hand).toHaveLength(0);
    expect(session.state.discardPile).toEqual(expect.arrayContaining([guo.id, victim.id]));
  });
});

describe('deck builder', () => {
  it('produces a sane standard deck', () => {
    const deck = buildStandardDeck();
    expect(deck.length).toBeGreaterThan(140);
    expect(deck.length).toBeLessThan(180);
    const names = new Set(deck.map((c) => c.name));
    for (const expected of ['杀', '闪', '桃', '决斗', '无懈可击', '诸葛连弩', '+1马', '闪电']) {
      expect(names.has(expected)).toBe(true);
    }
    const shaCount = deck.filter((c) => c.name === '杀').length;
    expect(shaCount).toBeGreaterThan(40);
    // every card has a unique id
    const ids = new Set(deck.map((c) => c.id));
    expect(ids.size).toBe(deck.length);
  });

  it('every deck card name is registered in the default registry', () => {
    const deck = buildStandardDeck();
    const reg = buildDefaultCardRegistry();
    const missing = deck.map((c) => c.name).filter((n) => !reg.has(n));
    expect(missing).toEqual([]);
  });
});
