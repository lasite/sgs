import { describe, it, expect } from 'vitest';
import {
  colorOf,
  isRed,
  isBlack,
  RANK_VALUE,
  type Card,
  type CardId,
  isDoubleFaction,
  generalKingdomFor,
  type General,
  type GeneralId,
  type SkillId,
  bothRevealed,
  anyRevealed,
  type Player,
  type PlayerId,
} from '../src/model/index.js';

const id = <T extends string>(s: string): T => s as unknown as T;

describe('card primitives', () => {
  it('colors map by suit', () => {
    expect(colorOf('heart')).toBe('red');
    expect(colorOf('diamond')).toBe('red');
    expect(colorOf('spade')).toBe('black');
    expect(colorOf('club')).toBe('black');
  });

  it('isRed/isBlack flip on suit', () => {
    const sha: Card = {
      id: id<CardId>('c1'),
      suit: 'heart',
      rank: '7',
      name: '杀',
      category: 'basic',
      subtype: 'sha',
      element: 'normal',
    };
    expect(isRed(sha)).toBe(true);
    expect(isBlack(sha)).toBe(false);
  });

  it('rank values are 1..13', () => {
    expect(RANK_VALUE.A).toBe(1);
    expect(RANK_VALUE['10']).toBe(10);
    expect(RANK_VALUE.K).toBe(13);
  });
});

describe('general / kingdom', () => {
  const caoCao: General = {
    id: id<GeneralId>('cao-cao'),
    name: '曹操',
    kingdoms: ['wei'],
    hp: 4,
    gender: 'male',
    skills: [id<SkillId>('jian-xiong'), id<SkillId>('hu-jia')],
  };

  const erQiao: General = {
    id: id<GeneralId>('er-qiao'),
    name: '二乔',
    kingdoms: ['wu', 'qun'],
    hp: 3,
    gender: 'female',
    skills: [],
  };

  it('detects double-faction generals', () => {
    expect(isDoubleFaction(caoCao)).toBe(false);
    expect(isDoubleFaction(erQiao)).toBe(true);
  });

  it('resolves kingdom for single- and double-faction generals', () => {
    expect(generalKingdomFor(caoCao)).toBe('wei');
    // double-faction without a choice falls back to first
    expect(generalKingdomFor(erQiao)).toBe('wu');
    // double-faction with a valid choice uses it
    expect(generalKingdomFor(erQiao, 'qun')).toBe('qun');
    // double-faction with an invalid choice still falls back
    expect(generalKingdomFor(erQiao, 'wei')).toBe('wu');
  });
});

describe('player reveal helpers', () => {
  const mk = (mainRev: boolean, subRev: boolean): Player => ({
    id: id<PlayerId>('p1'),
    seat: 0,
    name: 'P1',
    main: { general: id<GeneralId>('g-main'), revealed: mainRev },
    sub: { general: id<GeneralId>('g-sub'), revealed: subRev },
    hp: 4,
    maxHp: 4,
    hand: [],
    equipment: {},
    judgeArea: [],
    isAmbitionist: false,
    alive: true,
    flags: {},
  });

  it('anyRevealed', () => {
    expect(anyRevealed(mk(false, false))).toBe(false);
    expect(anyRevealed(mk(true, false))).toBe(true);
    expect(anyRevealed(mk(false, true))).toBe(true);
  });

  it('bothRevealed', () => {
    expect(bothRevealed(mk(false, false))).toBe(false);
    expect(bothRevealed(mk(true, false))).toBe(false);
    expect(bothRevealed(mk(true, true))).toBe(true);
  });
});
