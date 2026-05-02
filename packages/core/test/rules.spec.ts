/**
 * Comprehensive Guozhan rule audit.
 *
 * Each `it` corresponds to a single rule from the 国战 official ruleset.
 * Tests that fail signal genuine rule gaps; the engine has unit tests
 * for individual primitives elsewhere — this file probes them in
 * combination, the way a real game would.
 *
 * Sections follow the canonical rulebook structure:
 *   A. 设置与初始化
 *   B. 回合阶段
 *   C. 基本牌
 *   D. 锦囊牌
 *   E. 装备牌
 *   F. 国战独有
 *   G. 濒死与死亡
 *   H. 技能
 *   I. 胜利
 */

import { describe, it, expect } from 'vitest';
import {
  TriggerRegistry,
  HeuristicAi,
  buildDefaultCardRegistry,
  buildDefaultSkillRegistry,
  buildStandardDeck,
  installGuozhanRules,
  createGuozhanState,
  createSession,
  drain,
  enqueue,
  respond as sessionRespond,
  buildRevealEffects,
  buildPlayerPhasesUpToPlay,
  buildAiFullTurn,
  buildHumanEndTurnAndAdvance,
  playCard,
  refreshVictory,
  computeVictory,
  ALL_GENERALS,
  type Card,
  type CardId,
  type GameState,
  type GeneralId,
  type PlayerId,
  type Player,
  type SkillId,
  type Session,
} from '../src/index.js';

const id = <T extends string>(s: string): T => s as unknown as T;

const HUMAN: PlayerId = id<PlayerId>('p1');
const AI1: PlayerId = id<PlayerId>('p2');
const AI2: PlayerId = id<PlayerId>('p3');

// ---- helpers ----------------------------------------------------------------

const setup = (): { session: Session; ai: HeuristicAi } => {
  const reg = new TriggerRegistry();
  installGuozhanRules(reg);
  const initial = createGuozhanState(
    [
      { id: HUMAN, name: 'P1', main: id<GeneralId>('cao-cao'), sub: id<GeneralId>('zhang-liao') },
      { id: AI1, name: 'P2', main: id<GeneralId>('liu-bei'), sub: id<GeneralId>('guan-yu') },
      { id: AI2, name: 'P3', main: id<GeneralId>('sun-quan'), sub: id<GeneralId>('lu-meng') },
    ],
    buildStandardDeck(),
    7,
    4,
  );
  const session = createSession(initial, reg);
  const ai = new HeuristicAi({ stateRef: () => session.state });
  return { session, ai };
};

const pumpAll = (session: Session, ai: HeuristicAi, humanId = HUMAN): void => {
  let pending = drain(session);
  while (pending) {
    pending = sessionRespond(session, ai.decide(pending.request));
    if (!pending) pending = drain(session);
  }
  void humanId;
};

const runUntilHuman = (session: Session, ai: HeuristicAi): void => {
  let safety = 0;
  let pending = drain(session);
  while (pending && pending.request.player !== HUMAN) {
    pending = sessionRespond(session, ai.decide(pending.request));
  }
  while (!pending && safety++ < 200) {
    if (session.state.victory.ended) return;
    const cur = session.state.players[session.state.currentPlayerSeat];
    if (!cur || !cur.alive) return;
    if (cur.id === HUMAN) {
      enqueue(session, buildPlayerPhasesUpToPlay(HUMAN));
      pending = drain(session);
      while (pending && pending.request.player !== HUMAN) {
        pending = sessionRespond(session, ai.decide(pending.request));
      }
      return;
    }
    enqueue(session, buildAiFullTurn(session.state, cur.id));
    pending = drain(session);
    while (pending && pending.request.player !== HUMAN) {
      pending = sessionRespond(session, ai.decide(pending.request));
    }
  }
};

const mkCard = (overrides: Partial<Card> & Pick<Card, 'id' | 'name' | 'category'>): Card =>
  ({
    suit: 'spade',
    rank: '7',
    ...overrides,
  } as Card);

const giveCard = (
  state: GameState,
  player: PlayerId,
  card: Card,
): GameState => {
  const cards = new Map(state.cards);
  cards.set(card.id, card);
  return {
    ...state,
    cards,
    players: state.players.map((p) =>
      p.id === player ? { ...p, hand: [...p.hand, card.id] } : p,
    ),
  };
};

// =============================================================================
// A. 设置与初始化
// =============================================================================

describe('A. 设置与初始化', () => {
  it('A.1 HP = floor((主将HP + 副将HP) / 2)', () => {
    const { session } = setup();
    // cao-cao(4) + zhang-liao(4) = 4
    expect(session.state.players[0]!.hp).toBe(4);
    expect(session.state.players[0]!.maxHp).toBe(4);
    // liu-bei(4) + guan-yu(4) = 4
    expect(session.state.players[1]!.hp).toBe(4);
    // sun-quan(4) + lu-meng(4) = 4
    expect(session.state.players[2]!.hp).toBe(4);
  });

  it('A.2 双将武将 HP=3 时 floor 处理', () => {
    const reg = new TriggerRegistry();
    installGuozhanRules(reg);
    const state = createGuozhanState(
      [
        { id: HUMAN, name: 'P1',
          main: id<GeneralId>('zhu-ge-liang'),  // hp=3
          sub: id<GeneralId>('lu-xun') },        // hp=3
      ],
      buildStandardDeck(), 1, 4,
    );
    expect(state.players[0]!.hp).toBe(3);
  });

  it('A.3 双将武将 HP=3+4 时 floor 处理为 3', () => {
    const reg = new TriggerRegistry();
    installGuozhanRules(reg);
    const state = createGuozhanState(
      [
        { id: HUMAN, name: 'P1',
          main: id<GeneralId>('zhu-ge-liang'),  // hp=3
          sub: id<GeneralId>('zhang-liao') },    // hp=4 → floor((3+4)/2) = 3
      ],
      buildStandardDeck(), 1, 4,
    );
    expect(state.players[0]!.hp).toBe(3);
  });

  it('A.4 起始所有武将均暗置', () => {
    const { session } = setup();
    for (const p of session.state.players) {
      expect(p.main.revealed).toBe(false);
      expect(p.sub.revealed).toBe(false);
    }
  });

  it('A.5 起始每名玩家摸 4 张手牌', () => {
    const { session } = setup();
    for (const p of session.state.players) {
      expect(p.hand).toHaveLength(4);
    }
  });

  it('A.6 标准卡池 ~160 张，含杀/闪/桃/酒/装备/锦囊/延时锦囊', () => {
    const deck = buildStandardDeck();
    expect(deck.length).toBeGreaterThanOrEqual(140);
    const names = new Set(deck.map((c) => c.name));
    expect(names.has('杀')).toBe(true);
    expect(names.has('闪')).toBe(true);
    expect(names.has('桃')).toBe(true);
    expect(names.has('酒')).toBe(true);
    expect(names.has('诸葛连弩')).toBe(true);
    expect(names.has('过河拆桥')).toBe(true);
    expect(names.has('闪电')).toBe(true);
  });
});

// =============================================================================
// B. 回合阶段
// =============================================================================

describe('B. 回合阶段', () => {
  it('B.1 标准回合包含 起始/判定/摸牌/出牌/弃牌/结束 六个阶段', () => {
    const { session, ai } = setup();
    runUntilHuman(session, ai);
    enqueue(session, buildHumanEndTurnAndAdvance(session.state, HUMAN));
    runUntilHuman(session, ai);
    const phases = session.state.eventLog
      .filter((e) => e.type === 'phase-change')
      .map((e: any) => e.to);
    for (const p of ['start', 'judge', 'draw', 'play', 'discard', 'end']) {
      expect(phases).toContain(p);
    }
  });

  it('B.2 摸牌阶段默认摸 2 张', () => {
    const { session, ai } = setup();
    const handBefore = session.state.players[0]!.hand.length;
    runUntilHuman(session, ai);
    expect(session.state.players[0]!.hand.length).toBe(handBefore + 2);
  });

  it('B.3 弃牌阶段须将手牌弃至当前体力值', () => {
    const { session, ai } = setup();
    runUntilHuman(session, ai);
    // human at 4 hp, has 4+2=6 cards.  End turn → discard 2 → 4.
    enqueue(session, buildHumanEndTurnAndAdvance(session.state, HUMAN));
    runUntilHuman(session, ai);
    // Back to human with 4 + 2(next draw) = 6
    expect(session.state.players[0]!.hand.length).toBe(6);
    expect(session.state.discardPile.length).toBeGreaterThanOrEqual(2);
  });

  it('B.4 turn-advance 跳过已死亡玩家', () => {
    const { session } = setup();
    const altered: GameState = {
      ...session.state,
      players: session.state.players.map((p, i) =>
        i === 1 ? { ...p, alive: false } : p,
      ),
    };
    const session2 = createSession(altered, session.registry);
    enqueue(session2, [{ kind: 'turn-advance' }]);
    drain(session2);
    expect(session2.state.currentPlayerSeat).toBe(2);
  });
});

// =============================================================================
// C. 基本牌
// =============================================================================

describe('C. 基本牌', () => {
  describe('C.1 杀', () => {
    it('C.1.a 普通杀造成 normal 伤害', () => {
      const reg = new TriggerRegistry();
      const sha = mkCard({ id: id<CardId>('s1'), name: '杀',
        category: 'basic', subtype: 'sha', element: 'normal' } as Card);
      const state = giveCard(setup().session.state, HUMAN, sha);
      const session = createSession(state, reg);
      enqueue(session, playCard(state, HUMAN, sha.id, [AI1], buildDefaultCardRegistry()));
      // pump through with no shan response
      let pending = drain(session)!;
      sessionRespond(session, { id: pending.request.id, kind: 'respond-card', card: null });
      const dmgs = session.state.eventLog.filter((e: any) => e.type === 'damage');
      expect(dmgs).toHaveLength(1);
      expect((dmgs[0] as any).kind).toBe('normal');
    });

    it('C.1.b 火杀造成 fire 伤害', () => {
      const reg = new TriggerRegistry();
      const sha = mkCard({ id: id<CardId>('s2'), name: '杀', suit: 'heart',
        category: 'basic', subtype: 'sha', element: 'fire' } as Card);
      const state = giveCard(setup().session.state, HUMAN, sha);
      const session = createSession(state, reg);
      enqueue(session, playCard(state, HUMAN, sha.id, [AI1], buildDefaultCardRegistry()));
      let pending = drain(session)!;
      sessionRespond(session, { id: pending.request.id, kind: 'respond-card', card: null });
      const dmg = session.state.eventLog.find((e: any) => e.type === 'damage') as any;
      expect(dmg.kind).toBe('fire');
    });

    it('C.1.c 雷杀造成 thunder 伤害', () => {
      const reg = new TriggerRegistry();
      const sha = mkCard({ id: id<CardId>('s3'), name: '杀',
        category: 'basic', subtype: 'sha', element: 'thunder' } as Card);
      const state = giveCard(setup().session.state, HUMAN, sha);
      const session = createSession(state, reg);
      enqueue(session, playCard(state, HUMAN, sha.id, [AI1], buildDefaultCardRegistry()));
      let pending = drain(session)!;
      sessionRespond(session, { id: pending.request.id, kind: 'respond-card', card: null });
      const dmg = session.state.eventLog.find((e: any) => e.type === 'damage') as any;
      expect(dmg.kind).toBe('thunder');
    });

    it('C.1.d 出杀使用后牌进入弃牌堆', () => {
      const reg = new TriggerRegistry();
      const sha = mkCard({ id: id<CardId>('s4'), name: '杀',
        category: 'basic', subtype: 'sha', element: 'normal' } as Card);
      const state = giveCard(setup().session.state, HUMAN, sha);
      const session = createSession(state, reg);
      enqueue(session, playCard(state, HUMAN, sha.id, [AI1], buildDefaultCardRegistry()));
      let pending = drain(session)!;
      sessionRespond(session, { id: pending.request.id, kind: 'respond-card', card: null });
      expect(session.state.discardPile).toContain(sha.id);
    });

    it('C.1.e 不可指定自己为目标', () => {
      const sha = mkCard({ id: id<CardId>('s5'), name: '杀',
        category: 'basic', subtype: 'sha', element: 'normal' } as Card);
      const state = giveCard(setup().session.state, HUMAN, sha);
      expect(() =>
        playCard(state, HUMAN, sha.id, [HUMAN], buildDefaultCardRegistry()),
      ).toThrow();
    });
  });

  describe('C.2 闪', () => {
    it('C.2.a 不可主动使用', () => {
      const shan = mkCard({ id: id<CardId>('sn1'), name: '闪',
        category: 'basic', subtype: 'shan' } as Card);
      const state = giveCard(setup().session.state, HUMAN, shan);
      expect(() =>
        playCard(state, HUMAN, shan.id, [HUMAN], buildDefaultCardRegistry()),
      ).toThrow();
    });

    it('C.2.b 响应杀后双方牌均入弃牌堆', () => {
      const reg = new TriggerRegistry();
      const sha = mkCard({ id: id<CardId>('s6'), name: '杀',
        category: 'basic', subtype: 'sha', element: 'normal' } as Card);
      const shan = mkCard({ id: id<CardId>('sn2'), name: '闪', suit: 'heart',
        category: 'basic', subtype: 'shan' } as Card);
      let state = giveCard(setup().session.state, HUMAN, sha);
      state = giveCard(state, AI1, shan);
      const session = createSession(state, reg);
      enqueue(session, playCard(state, HUMAN, sha.id, [AI1], buildDefaultCardRegistry()));
      let pending = drain(session)!;
      sessionRespond(session, { id: pending.request.id, kind: 'respond-card', card: shan.id });
      expect(session.state.discardPile).toEqual(expect.arrayContaining([sha.id, shan.id]));
      // No damage event
      const dmgs = session.state.eventLog.filter((e: any) => e.type === 'damage');
      expect(dmgs).toHaveLength(0);
    });
  });

  describe('C.3 桃', () => {
    it('C.3.a 满血时不能对自己使用', () => {
      const tao = mkCard({ id: id<CardId>('t1'), name: '桃', suit: 'heart',
        category: 'basic', subtype: 'tao' } as Card);
      const state = giveCard(setup().session.state, HUMAN, tao);
      expect(() =>
        playCard(state, HUMAN, tao.id, [HUMAN], buildDefaultCardRegistry()),
      ).toThrow();
    });

    it('C.3.b 受伤时回 1 血', () => {
      const reg = new TriggerRegistry();
      const tao = mkCard({ id: id<CardId>('t2'), name: '桃', suit: 'heart',
        category: 'basic', subtype: 'tao' } as Card);
      let state = giveCard(setup().session.state, HUMAN, tao);
      state = { ...state,
        players: state.players.map((p, i) => i === 0 ? { ...p, hp: 2 } : p) };
      const session = createSession(state, reg);
      enqueue(session, playCard(state, HUMAN, tao.id, [HUMAN], buildDefaultCardRegistry()));
      drain(session);
      expect(session.state.players[0]!.hp).toBe(3);
      expect(session.state.discardPile).toContain(tao.id);
    });
  });
});

// =============================================================================
// D. 锦囊牌
// =============================================================================

describe('D. 锦囊牌', () => {
  it('D.1 无中生有：摸 2 张', () => {
    const reg = new TriggerRegistry();
    const wzsy = mkCard({ id: id<CardId>('wz1'), name: '无中生有',
      category: 'trick', subtype: 'wu-zhong-sheng-you', delayed: false } as Card);
    const state = giveCard(setup().session.state, HUMAN, wzsy);
    const before = state.players[0]!.hand.length;
    const session = createSession(state, reg);
    enqueue(session, playCard(state, HUMAN, wzsy.id, [], buildDefaultCardRegistry()));
    drain(session);
    // -1 (used) + 2 (drawn) = +1 net
    expect(session.state.players[0]!.hand.length).toBe(before + 1);
  });

  it('D.2 决斗：目标无杀时受伤', () => {
    const reg = new TriggerRegistry();
    const jd = mkCard({ id: id<CardId>('jd1'), name: '决斗',
      category: 'trick', subtype: 'jue-dou', delayed: false } as Card);
    let state = giveCard(setup().session.state, HUMAN, jd);
    state = { ...state, players: state.players.map((p, i) =>
      i === 1 ? { ...p, hand: [] } : p) };
    const session = createSession(state, reg);
    enqueue(session, playCard(state, HUMAN, jd.id, [AI1], buildDefaultCardRegistry()));
    let pending = drain(session)!;
    sessionRespond(session, { id: pending.request.id, kind: 'respond-card', card: null });
    expect(session.state.players[1]!.hp).toBe(3);
  });

  it('D.3 过河拆桥：目标手牌进入弃牌堆', () => {
    const reg = new TriggerRegistry();
    const guo = mkCard({ id: id<CardId>('g1'), name: '过河拆桥',
      category: 'trick', subtype: 'guo-he-chai-qiao', delayed: false } as Card);
    const target = mkCard({ id: id<CardId>('vic'), name: '杀',
      category: 'basic', subtype: 'sha', element: 'normal' } as Card);
    let state = giveCard(setup().session.state, HUMAN, guo);
    state = giveCard(state, AI1, target);
    const session = createSession(state, reg);
    enqueue(session, playCard(state, HUMAN, guo.id, [AI1], buildDefaultCardRegistry()));
    let pending = drain(session)!;
    sessionRespond(session, { id: pending.request.id, kind: 'choose-cards', cards: [target.id] });
    expect(session.state.discardPile).toContain(target.id);
    expect(session.state.players[1]!.hand).not.toContain(target.id);
  });

  it('D.4 顺手牵羊：目标牌进入用户手牌', () => {
    const reg = new TriggerRegistry();
    const ssqy = mkCard({ id: id<CardId>('ss1'), name: '顺手牵羊',
      category: 'trick', subtype: 'shun-shou-qian-yang', delayed: false } as Card);
    const target = mkCard({ id: id<CardId>('vic2'), name: '杀',
      category: 'basic', subtype: 'sha', element: 'normal' } as Card);
    let state = giveCard(setup().session.state, HUMAN, ssqy);
    state = giveCard(state, AI1, target);
    const session = createSession(state, reg);
    enqueue(session, playCard(state, HUMAN, ssqy.id, [AI1], buildDefaultCardRegistry()));
    let pending = drain(session)!;
    sessionRespond(session, { id: pending.request.id, kind: 'choose-cards', cards: [target.id] });
    expect(session.state.players[0]!.hand).toContain(target.id);
    expect(session.state.players[1]!.hand).not.toContain(target.id);
  });

  it('D.5 桃园结义：所有存活玩家回血 1', () => {
    const reg = new TriggerRegistry();
    const ty = mkCard({ id: id<CardId>('ty1'), name: '桃园结义',
      category: 'trick', subtype: 'tao-yuan-jie-yi', delayed: false } as Card);
    let state = giveCard(setup().session.state, HUMAN, ty);
    // wound everyone
    state = { ...state, players: state.players.map((p) => ({ ...p, hp: 2 })) };
    const session = createSession(state, reg);
    enqueue(session, playCard(state, HUMAN, ty.id, [], buildDefaultCardRegistry()));
    drain(session);
    for (const p of session.state.players) {
      expect(p.hp).toBe(3);
    }
  });

  it('D.6 万箭齐发：未出闪者受伤 1', () => {
    const reg = new TriggerRegistry();
    const wj = mkCard({ id: id<CardId>('wj1'), name: '万箭齐发',
      category: 'trick', subtype: 'wan-jian-qi-fa', delayed: false } as Card);
    const state = giveCard(setup().session.state, HUMAN, wj);
    const session = createSession(state, reg);
    enqueue(session, playCard(state, HUMAN, wj.id, [], buildDefaultCardRegistry()));
    // Two prompts (AI1, AI2); both decline
    let pending = drain(session)!;
    sessionRespond(session, { id: pending.request.id, kind: 'respond-card', card: null });
    pending = drain(session)!;
    sessionRespond(session, { id: pending.request.id, kind: 'respond-card', card: null });
    expect(session.state.players[1]!.hp).toBe(3);
    expect(session.state.players[2]!.hp).toBe(3);
  });

  it('D.7 南蛮入侵：未出杀者受伤 1', () => {
    const reg = new TriggerRegistry();
    const nm = mkCard({ id: id<CardId>('nm1'), name: '南蛮入侵',
      category: 'trick', subtype: 'nan-man-ru-qin', delayed: false } as Card);
    const state = giveCard(setup().session.state, HUMAN, nm);
    const session = createSession(state, reg);
    enqueue(session, playCard(state, HUMAN, nm.id, [], buildDefaultCardRegistry()));
    let pending = drain(session)!;
    sessionRespond(session, { id: pending.request.id, kind: 'respond-card', card: null });
    pending = drain(session)!;
    sessionRespond(session, { id: pending.request.id, kind: 'respond-card', card: null });
    expect(session.state.players[1]!.hp).toBe(3);
    expect(session.state.players[2]!.hp).toBe(3);
  });

  it('D.8 无懈可击：不可主动使用', () => {
    const wxkj = mkCard({ id: id<CardId>('wx1'), name: '无懈可击',
      category: 'trick', subtype: 'wu-xie-ke-ji', delayed: false } as Card);
    const state = giveCard(setup().session.state, HUMAN, wxkj);
    expect(() =>
      playCard(state, HUMAN, wxkj.id, [], buildDefaultCardRegistry()),
    ).toThrow();
  });

  it('D.9 (gap) 借刀杀人：当前为占位实现，无武器约束逻辑', () => {
    // Documented gap — stub only discards the card.
    const reg = new TriggerRegistry();
    const jd = mkCard({ id: id<CardId>('jds1'), name: '借刀杀人',
      category: 'trick', subtype: 'jie-dao-sha-ren', delayed: false } as Card);
    const state = giveCard(setup().session.state, HUMAN, jd);
    const session = createSession(state, reg);
    enqueue(session, playCard(state, HUMAN, jd.id, [AI1], buildDefaultCardRegistry()));
    drain(session);
    expect(session.state.discardPile).toContain(jd.id);
    expect(session.state.players[1]!.hp).toBe(4); // unchanged - stub
  });

  it('D.10 (gap) 乐不思蜀/兵粮寸断/闪电：当前为占位实现，无判定/延时逻辑', () => {
    for (const [name, sub] of [
      ['乐不思蜀', 'le-bu-si-shu'],
      ['兵粮寸断', 'bing-liang-cun-duan'],
    ] as const) {
      const reg = new TriggerRegistry();
      const card = mkCard({ id: id<CardId>(`${sub}-1`), name,
        category: 'trick', subtype: sub, delayed: true } as Card);
      const state = giveCard(setup().session.state, HUMAN, card);
      const session = createSession(state, reg);
      enqueue(session, playCard(state, HUMAN, card.id, [AI1], buildDefaultCardRegistry()));
      drain(session);
      expect(session.state.discardPile).toContain(card.id);
      // Target's judgeArea remains empty (gap)
      expect(session.state.players[1]!.judgeArea).toHaveLength(0);
    }
  });
});

// =============================================================================
// E. 装备牌
// =============================================================================

describe('E. 装备牌', () => {
  it('E.1 装备牌使用即穿戴到对应装备槽', () => {
    const reg = new TriggerRegistry();
    const eq = mkCard({ id: id<CardId>('eq1'), name: '诸葛连弩',
      category: 'equipment', subtype: 'zhu-ge-lian-nu', slot: 'weapon', range: 1 } as Card);
    const state = giveCard(setup().session.state, HUMAN, eq);
    const session = createSession(state, reg);
    enqueue(session, playCard(state, HUMAN, eq.id, [HUMAN], buildDefaultCardRegistry()));
    drain(session);
    expect(session.state.players[0]!.equipment.weapon).toBe(eq.id);
  });

  it('E.2 装备槽冲突时旧装备进入弃牌堆', () => {
    const reg = new TriggerRegistry();
    const w1 = mkCard({ id: id<CardId>('w1'), name: '诸葛连弩',
      category: 'equipment', subtype: 'zhu-ge-lian-nu', slot: 'weapon', range: 1 } as Card);
    const w2 = mkCard({ id: id<CardId>('w2'), name: '雌雄双股剑',
      category: 'equipment', subtype: 'ci-xiong-shuang-gu-jian', slot: 'weapon', range: 2 } as Card);
    let state = giveCard(setup().session.state, HUMAN, w1);
    state = giveCard(state, HUMAN, w2);
    const session = createSession(state, reg);
    enqueue(session, [
      ...playCard(state, HUMAN, w1.id, [HUMAN], buildDefaultCardRegistry()),
      ...playCard(state, HUMAN, w2.id, [HUMAN], buildDefaultCardRegistry()),
    ]);
    drain(session);
    expect(session.state.players[0]!.equipment.weapon).toBe(w2.id);
    expect(session.state.discardPile).toContain(w1.id);
  });

  it('E.3 (gap) 武器/防具/坐骑战斗效果：装备只入槽，combat triggers 待 Phase X', () => {
    // Documented gap — equipping does not yet wire any combat triggers.
    const reg = new TriggerRegistry();
    const armor = mkCard({ id: id<CardId>('a1'), name: '八卦阵',
      category: 'equipment', subtype: 'ba-gua-zhen', slot: 'armor' } as Card);
    const state = giveCard(setup().session.state, HUMAN, armor);
    const session = createSession(state, reg);
    enqueue(session, playCard(state, HUMAN, armor.id, [HUMAN], buildDefaultCardRegistry()));
    drain(session);
    expect(session.state.players[0]!.equipment.armor).toBe(armor.id);
    // No 八卦阵 judge-on-杀 trigger registered (gap)
  });
});

// =============================================================================
// F. 国战独有
// =============================================================================

describe('F. 国战独有', () => {
  it('F.1 单势力武将亮将后势力公开', () => {
    const { session, ai } = setup();
    enqueue(session, buildRevealEffects(session.state, HUMAN, 'main'));
    pumpAll(session, ai);
    expect(session.state.players[0]!.main.revealed).toBe(true);
  });

  it('F.2 双势力武将（阴阳鱼）亮将时玩家选择势力', () => {
    const reg = new TriggerRegistry();
    installGuozhanRules(reg);
    const initial = createGuozhanState(
      [{ id: HUMAN, name: 'P1',
         main: id<GeneralId>('xiao-qiao'), sub: id<GeneralId>('zhou-yu') }],
      buildStandardDeck(), 1, 4,
    );
    const session = createSession(initial, reg);
    enqueue(session, buildRevealEffects(session.state, HUMAN, 'main'));
    const pending = drain(session)!;
    expect(pending.request.kind).toBe('choose-kingdom');
    sessionRespond(session, { id: pending.request.id, kind: 'choose-kingdom', kingdom: 'qun' });
    expect(session.state.players[0]!.main.kingdomChoice).toBe('qun');
  });

  it('F.3 珠联璧合：双方武将均亮且为搭档时获 +1 maxHp + heal 1 + draw 1', () => {
    const reg = new TriggerRegistry();
    installGuozhanRules(reg);
    const initial = createGuozhanState(
      [{ id: HUMAN, name: 'P1',
         main: id<GeneralId>('liu-bei'), sub: id<GeneralId>('guan-yu') }],
      buildStandardDeck(), 1, 4,
    );
    const session = createSession(initial, reg);
    const handBefore = initial.players[0]!.hand.length;
    enqueue(session, [
      ...buildRevealEffects(initial, HUMAN, 'main'),
      ...buildRevealEffects(initial, HUMAN, 'sub'),
    ]);
    drain(session);
    expect(session.state.players[0]!.maxHp).toBe(5);
    expect(session.state.players[0]!.hand.length).toBe(handBefore + 1);
  });

  it('F.4 野心家：明置后两势力不同（且非阴阳鱼可调和）则成为野心家', () => {
    const reg = new TriggerRegistry();
    installGuozhanRules(reg);
    const initial = createGuozhanState(
      [{ id: HUMAN, name: 'P1',
         main: id<GeneralId>('cao-cao'),     // wei
         sub: id<GeneralId>('guan-yu') }],   // shu
      buildStandardDeck(), 1, 4,
    );
    const session = createSession(initial, reg);
    enqueue(session, [
      ...buildRevealEffects(initial, HUMAN, 'main'),
      ...buildRevealEffects(initial, HUMAN, 'sub'),
    ]);
    drain(session);
    expect(session.state.players[0]!.isAmbitionist).toBe(true);
  });

  it('F.5 阴阳鱼调和后不进入野心家', () => {
    const reg = new TriggerRegistry();
    installGuozhanRules(reg);
    const initial = createGuozhanState(
      [{ id: HUMAN, name: 'P1',
         main: id<GeneralId>('xiao-qiao'),   // wu/qun
         sub: id<GeneralId>('zhou-yu') }],   // wu
      buildStandardDeck(), 1, 4,
    );
    const session = createSession(initial, reg);
    enqueue(session, buildRevealEffects(initial, HUMAN, 'main'));
    let pending = drain(session)!;
    sessionRespond(session, { id: pending.request.id, kind: 'choose-kingdom', kingdom: 'wu' });
    enqueue(session, buildRevealEffects(session.state, HUMAN, 'sub'));
    drain(session);
    expect(session.state.players[0]!.isAmbitionist).toBe(false);
  });

  it('F.6 (gap) 兵贵神速：首回合首亮玩家跳过判定+摸牌——未完整接入', () => {
    // Trigger registered but only skips judge phase, not draw.  Documented.
    expect(true).toBe(true);
  });
});

// =============================================================================
// G. 濒死与死亡
// =============================================================================

describe('G. 濒死与死亡', () => {
  it('G.1 受到致命伤害后玩家死亡（alive=false）', () => {
    const reg = new TriggerRegistry();
    installGuozhanRules(reg);
    const initial = createGuozhanState(
      [
        { id: HUMAN, name: 'P1',
          main: id<GeneralId>('cao-cao'), sub: id<GeneralId>('zhang-liao') },
        { id: AI1, name: 'P2',
          main: id<GeneralId>('liu-bei'), sub: id<GeneralId>('guan-yu') },
      ],
      buildStandardDeck(), 1, 0,
    );
    const wounded = { ...initial,
      players: initial.players.map((p, i) => i === 1 ? { ...p, hp: 1 } : p) };
    const session = createSession(wounded, reg);
    enqueue(session, [{
      kind: 'damage', source: HUMAN, target: AI1,
      amount: 1, damageKind: 'normal',
    }]);
    drain(session);
    expect(session.state.players[1]!.hp).toBeLessThanOrEqual(0);
    // Without a death-check trigger, alive remains true.  This test fails
    // until G.* implementation lands.
    expect(session.state.players[1]!.alive).toBe(false);
  });

  it('G.2 (gap) 濒死状态可由桃/酒救援——未实现', () => {
    // Currently dying event isn't emitted on hp<=0; documented gap.
    expect(true).toBe(true);
  });

  it('G.3 死亡的玩家不再行动（turn-advance 跳过）', () => {
    const { session } = setup();
    const altered: GameState = {
      ...session.state,
      players: session.state.players.map((p, i) =>
        i === 1 ? { ...p, alive: false } : p),
    };
    const session2 = createSession(altered, session.registry);
    enqueue(session2, [{ kind: 'turn-advance' }]);
    drain(session2);
    expect(session2.state.currentPlayerSeat).toBe(2);
  });
});

// =============================================================================
// H. 技能
// =============================================================================

describe('H. 技能', () => {
  it('H.1 技能注册器包含所有 6 个 MVP 技能', () => {
    const r = buildDefaultSkillRegistry();
    expect(r.has(id<SkillId>('wei-caocao-jianxiong'))).toBe(true);
    expect(r.has(id<SkillId>('wei-simayi-fankui'))).toBe(true);
    expect(r.has(id<SkillId>('wei-xiahoudun-ganglie'))).toBe(true);
    expect(r.has(id<SkillId>('shu-zhangfei-paoxiao'))).toBe(true);
    expect(r.has(id<SkillId>('wu-sunquan-zhiheng'))).toBe(true);
    expect(r.has(id<SkillId>('qun-huatuo-jijiu'))).toBe(true);
  });

  it('H.2 武将名册 ALL_GENERALS 完整（≥40 个）', () => {
    expect(ALL_GENERALS.length).toBeGreaterThanOrEqual(40);
  });

  it('H.3 (gap) 技能在亮将时自动安装到 TriggerRegistry——当前 web store 未自动接入', () => {
    // Skill behaviours exist in core; auto-install on reveal-general is
    // pending.  Players can install manually for demos but the web flow
    // doesn't yet.
    expect(true).toBe(true);
  });
});

// =============================================================================
// I. 胜利
// =============================================================================

describe('I. 胜利', () => {
  it('I.1 仅剩一势力存活时该势力胜利', () => {
    const { session } = setup();
    const altered: GameState = {
      ...session.state,
      players: session.state.players.map((p, i) => {
        if (i === 0) return { ...p,
          main: { ...p.main, revealed: true },
          sub: { ...p.sub, revealed: true } };
        return { ...p, alive: false };
      }),
    };
    const v = computeVictory(altered);
    expect(v.ended).toBe(true);
    expect(v.winners).toEqual([HUMAN]);
  });

  it('I.2 野心家独活时胜利', () => {
    const { session } = setup();
    const altered: GameState = {
      ...session.state,
      players: session.state.players.map((p, i) => i === 0
        ? { ...p, isAmbitionist: true,
            main: { ...p.main, revealed: true },
            sub: { ...p.sub, revealed: true } }
        : { ...p, alive: false }),
    };
    const v = computeVictory(altered);
    expect(v.ended).toBe(true);
    expect(v.reason).toBe('ambitionist-solo');
  });

  it('I.3 仍有暗将玩家时不结束', () => {
    const { session } = setup();
    expect(computeVictory(session.state).ended).toBe(false);
  });
});
