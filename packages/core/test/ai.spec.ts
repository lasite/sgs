import { describe, it, expect } from 'vitest';
import {
  HeuristicAi,
  runUntilStable,
  TriggerRegistry,
  createSession,
  enqueue,
  installGuozhanRules,
  buildDefaultCardRegistry,
  buildStandardDeck,
  createGuozhanState,
  buildRevealEffects,
  playCard,
} from '../src/index.js';
import type {
  Card,
  CardId,
  GeneralId,
  PlayerId,
} from '../src/model/index.js';

const id = <T extends string>(s: string): T => s as unknown as T;

const mkSha = (s: string): Card => ({
  id: id<CardId>(s),
  suit: 'spade', rank: '7', name: '杀',
  category: 'basic', subtype: 'sha', element: 'normal',
});
const mkShan = (s: string): Card => ({
  id: id<CardId>(s),
  suit: 'heart', rank: '5', name: '闪',
  category: 'basic', subtype: 'shan',
});

describe('HeuristicAi.respond-card', () => {
  it('plays a 闪 from hand against a 杀 if available', () => {
    const reg = new TriggerRegistry();
    const sha = mkSha('s1');
    const shan = mkShan('s2');
    const state = createGuozhanState(
      [
        { id: id<PlayerId>('p1'), name: 'P1',
          main: id<GeneralId>('cao-cao'), sub: id<GeneralId>('zhang-liao') },
        { id: id<PlayerId>('p2'), name: 'P2',
          main: id<GeneralId>('liu-bei'), sub: id<GeneralId>('guan-yu') },
      ],
      buildStandardDeck(),
      1,
      0,
    );
    const customCards = new Map(state.cards);
    customCards.set(sha.id, sha);
    customCards.set(shan.id, shan);
    const seeded = {
      ...state,
      cards: customCards,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, hand: [sha.id] } : { ...p, hand: [shan.id] },
      ),
    };
    const session = createSession(seeded, reg);
    const ai = new HeuristicAi({ stateRef: () => session.state });

    enqueue(session, playCard(seeded, id<PlayerId>('p1'), sha.id, [id<PlayerId>('p2')], buildDefaultCardRegistry()));
    runUntilStable(session, ai);
    // p2 should have used 闪 to absorb damage
    expect(session.state.players[1]!.hp).toBe(4);
    expect(session.state.discardPile).toEqual(expect.arrayContaining([sha.id, shan.id]));
  });

  it('takes damage when no matching response is available', () => {
    const reg = new TriggerRegistry();
    const sha = mkSha('s3');
    const state = createGuozhanState(
      [
        { id: id<PlayerId>('p1'), name: 'P1',
          main: id<GeneralId>('cao-cao'), sub: id<GeneralId>('zhang-liao') },
        { id: id<PlayerId>('p2'), name: 'P2',
          main: id<GeneralId>('liu-bei'), sub: id<GeneralId>('guan-yu') },
      ],
      buildStandardDeck(),
      1,
      0,
    );
    const customCards = new Map(state.cards);
    customCards.set(sha.id, sha);
    const seeded = {
      ...state,
      cards: customCards,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, hand: [sha.id] } : { ...p, hand: [] },
      ),
    };
    const session = createSession(seeded, reg);
    const ai = new HeuristicAi({ stateRef: () => session.state });

    enqueue(session, playCard(seeded, id<PlayerId>('p1'), sha.id, [id<PlayerId>('p2')], buildDefaultCardRegistry()));
    runUntilStable(session, ai);
    expect(session.state.players[1]!.hp).toBe(3);
  });
});

describe('HeuristicAi.choose-kingdom (阴阳鱼)', () => {
  it('picks the kingdom most-represented among revealed living players', () => {
    const reg = new TriggerRegistry();
    installGuozhanRules(reg);
    const state = createGuozhanState(
      [
        { id: id<PlayerId>('p1'), name: 'P1',
          main: id<GeneralId>('cao-cao'), sub: id<GeneralId>('zhang-liao') },
        { id: id<PlayerId>('p2'), name: 'P2',
          main: id<GeneralId>('xiao-qiao'), sub: id<GeneralId>('zhou-yu') },
        // bonus: a wu-revealed player so 'wu' has count > 0
        { id: id<PlayerId>('p3'), name: 'P3',
          main: id<GeneralId>('sun-quan'), sub: id<GeneralId>('lu-meng') },
      ],
      buildStandardDeck(),
      1,
      0,
    );
    // pre-reveal p3's main so wu has count = 1
    const seeded = {
      ...state,
      players: state.players.map((p, i) =>
        i === 2 ? { ...p, main: { ...p.main, revealed: true } } : p,
      ),
    };
    const session = createSession(seeded, reg);
    const ai = new HeuristicAi({ stateRef: () => session.state });

    enqueue(session, buildRevealEffects(seeded, id<PlayerId>('p2'), 'main'));
    runUntilStable(session, ai);
    const p2 = session.state.players[1]!;
    expect(p2.main.revealed).toBe(true);
    expect(p2.main.kingdomChoice).toBe('wu');
  });
});

describe('runUntilStable', () => {
  it('drains everything when no decisions are pending', () => {
    const reg = new TriggerRegistry();
    const state = createGuozhanState(
      [
        { id: id<PlayerId>('p1'), name: 'P1',
          main: id<GeneralId>('cao-cao'), sub: id<GeneralId>('zhang-liao') },
        { id: id<PlayerId>('p2'), name: 'P2',
          main: id<GeneralId>('liu-bei'), sub: id<GeneralId>('guan-yu') },
      ],
      buildStandardDeck(),
      1,
      4,
    );
    const session = createSession(state, reg);
    const ai = new HeuristicAi({ stateRef: () => session.state });
    enqueue(session, [
      { kind: 'phase-change', to: 'draw' },
      { kind: 'draw-cards', player: id<PlayerId>('p1'), count: 2, reason: 'phase' },
    ]);
    runUntilStable(session, ai);
    expect(session.state.players[0]!.hand).toHaveLength(6);
  });
});
