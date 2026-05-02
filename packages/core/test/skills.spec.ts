import { describe, it, expect } from 'vitest';
import {
  TriggerRegistry,
  createSession,
  drain,
  enqueue,
  respond,
  buildDefaultSkillRegistry,
  ALL_GENERALS,
  buildDefaultCardRegistry,
  playCard,
} from '../src/index.js';
import type {
  Card,
  CardId,
  GameState,
  GeneralId,
  Player,
  PlayerId,
  SkillId,
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
      main: { general: id<GeneralId>('cao-cao'), revealed: true },
      sub: { general: id<GeneralId>('sima-yi'), revealed: true },
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
      main: { general: id<GeneralId>('sun-quan'), revealed: true },
      sub: { general: id<GeneralId>('liu-bei'), revealed: true },
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

describe('skill registry', () => {
  it('every general references a defined kingdom and HP > 0', () => {
    for (const g of ALL_GENERALS) {
      expect(g.hp).toBeGreaterThan(0);
      for (const k of g.kingdoms) {
        expect(['wei', 'shu', 'wu', 'qun']).toContain(k);
      }
    }
  });

  it('companion lists are coherent (referenced ids exist)', () => {
    const ids = new Set(ALL_GENERALS.map((g) => g.id));
    for (const g of ALL_GENERALS) {
      for (const c of g.companion ?? []) {
        expect(ids.has(c)).toBe(true);
      }
    }
  });

  it('default skill registry installs known skills only', () => {
    const r = buildDefaultSkillRegistry();
    expect(r.has(id<SkillId>('wei-caocao-jianxiong'))).toBe(true);
    expect(r.has(id<SkillId>('wei-simayi-fankui'))).toBe(true);
    expect(r.has(id<SkillId>('shu-zhangfei-paoxiao'))).toBe(true);
    expect(r.has(id<SkillId>('wu-sunquan-zhiheng'))).toBe(true);
    expect(r.has(id<SkillId>('qun-huatuo-jijiu'))).toBe(true);
  });
});

describe('奸雄 (cao-cao)', () => {
  it('opt-in to gain the damage-source card', () => {
    const reg = new TriggerRegistry();
    const skills = buildDefaultSkillRegistry();
    const sha = mkSha('sha-x');
    skills.install(
      [id<SkillId>('wei-caocao-jianxiong')],
      { owner: id<PlayerId>('p1'), registry: reg },
    );
    const cards = new Map([[sha.id, sha]]);
    const state = baseState(cards, [], [sha.id]);
    const session = createSession(state, reg);

    // p2 plays 杀 on p1
    enqueue(session, playCard(state, id<PlayerId>('p2'), sha.id, [id<PlayerId>('p1')], buildDefaultCardRegistry()));
    let pending = drain(session)!;
    // p1 declines 闪
    pending = respond(session, { id: pending.request.id, kind: 'respond-card', card: null })!;
    // damage event fires; 奸雄 prompts p1
    expect(pending).not.toBeNull();
    expect(pending!.request.kind).toBe('trigger-opt-in');
    pending = respond(session, { id: pending!.request.id, kind: 'trigger-opt-in', accept: true })!;
    expect(pending).toBeNull();
    const p1 = session.state.players[0]!;
    expect(p1.hand).toContain(sha.id);
  });
});

describe('刚烈 (xiahou-dun)', () => {
  it('reflects 1 damage back to source on opt-in', () => {
    const reg = new TriggerRegistry();
    const skills = buildDefaultSkillRegistry();
    skills.install(
      [id<SkillId>('wei-xiahoudun-ganglie')],
      { owner: id<PlayerId>('p1'), registry: reg },
    );
    const sha = mkSha('sha-y');
    const cards = new Map([[sha.id, sha]]);
    const state = baseState(cards, [], [sha.id]);
    const session = createSession(state, reg);

    enqueue(session, playCard(state, id<PlayerId>('p2'), sha.id, [id<PlayerId>('p1')], buildDefaultCardRegistry()));
    let pending = drain(session)!;
    // p1 declines 闪
    pending = respond(session, { id: pending.request.id, kind: 'respond-card', card: null })!;
    // 刚烈 opt-in
    expect(pending!.request.kind).toBe('trigger-opt-in');
    pending = respond(session, { id: pending!.request.id, kind: 'trigger-opt-in', accept: true })!;
    expect(pending).toBeNull();
    expect(session.state.players[0]!.hp).toBe(3); // p1 took the original 杀
    expect(session.state.players[1]!.hp).toBe(3); // p2 took the 刚烈 retaliation
  });
});

describe('反馈 (sima-yi)', () => {
  it('takes a card from the damage source on opt-in', () => {
    const reg = new TriggerRegistry();
    const skills = buildDefaultSkillRegistry();
    skills.install(
      [id<SkillId>('wei-simayi-fankui')],
      { owner: id<PlayerId>('p1'), registry: reg },
    );
    const sha = mkSha('sha-z');
    const stash = mkSha('stash-1');
    const cards = new Map([[sha.id, sha], [stash.id, stash]]);
    const state = baseState(cards, [], [sha.id, stash.id]);
    const session = createSession(state, reg);

    enqueue(session, playCard(state, id<PlayerId>('p2'), sha.id, [id<PlayerId>('p1')], buildDefaultCardRegistry()));
    let pending = drain(session)!;
    // p1 declines 闪
    pending = respond(session, { id: pending.request.id, kind: 'respond-card', card: null })!;
    // 反馈 opt-in
    expect(pending!.request.kind).toBe('trigger-opt-in');
    pending = respond(session, { id: pending!.request.id, kind: 'trigger-opt-in', accept: true })!;
    // choose card
    expect(pending!.request.kind).toBe('choose-cards');
    pending = respond(session, { id: pending!.request.id, kind: 'choose-cards', cards: [stash.id] })!;
    expect(pending).toBeNull();
    expect(session.state.players[0]!.hand).toContain(stash.id);
    expect(session.state.players[1]!.hand).not.toContain(stash.id);
  });
});

describe('咆哮 (zhang-fei)', () => {
  it('sets the no-limit flag on owner turn-start', () => {
    const reg = new TriggerRegistry();
    const skills = buildDefaultSkillRegistry();
    skills.install(
      [id<SkillId>('shu-zhangfei-paoxiao')],
      { owner: id<PlayerId>('p1'), registry: reg },
    );
    const state = baseState(new Map(), []);
    const session = createSession(state, reg);
    enqueue(session, [{ kind: 'turn-advance' }]);
    drain(session);
    // turn-advance moves to p2; p1 turn-start did not fire here.  Cycle once more.
    enqueue(session, [{ kind: 'turn-advance' }]);
    drain(session);
    const p1 = session.state.players[0]!;
    expect(p1.flags['paoxiao-no-limit']).toBe(true);
  });
});

describe('制衡 (sun-quan)', () => {
  it('asks owner to discard cards then draws same count on phase=play', () => {
    const reg = new TriggerRegistry();
    const skills = buildDefaultSkillRegistry();
    skills.install(
      [id<SkillId>('wu-sunquan-zhiheng')],
      { owner: id<PlayerId>('p1'), registry: reg },
    );
    const c1 = mkSha('zh-1');
    const c2 = mkSha('zh-2');
    const c3 = mkSha('zh-3');
    const e1 = mkSha('extra-1');
    const e2 = mkSha('extra-2');
    const cards = new Map<CardId, Card>([
      [c1.id, c1], [c2.id, c2], [c3.id, c3], [e1.id, e1], [e2.id, e2],
    ]);
    const state: GameState = {
      ...baseState(cards, [c1.id, c2.id]),
      // top of pile = end of array; first draw will be e2
      drawPile: [c3.id, e1.id, e2.id],
    };
    const session = createSession(state, reg);
    enqueue(session, [{ kind: 'phase-change', to: 'play' }]);
    let pending = drain(session)!;
    expect(pending.request.kind).toBe('trigger-opt-in');
    pending = respond(session, { id: pending.request.id, kind: 'trigger-opt-in', accept: true })!;
    expect(pending.request.kind).toBe('choose-cards');
    pending = respond(session, { id: pending.request.id, kind: 'choose-cards', cards: [c1.id] })!;
    expect(pending).toBeNull();
    const p1 = session.state.players[0]!;
    // discarded c1, drew 1 from top (= e2)
    expect(p1.hand).not.toContain(c1.id);
    expect(p1.hand).toContain(e2.id);
    expect(session.state.discardPile).toContain(c1.id);
  });
});
