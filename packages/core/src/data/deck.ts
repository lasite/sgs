/**
 * Standard 国战 card deck (≈160 cards).
 *
 * Counts roughly follow the 2013 国战标准版 list.  Suit/rank pairings are
 * representative — exact official pairings are documented in the
 * official rulebook; for engine purposes we just need *plausible*
 * suit/rank distributions that satisfy the colour/element constraints
 * the rules reference (e.g. 闪电 only triggers on spades 2-9).  Phase 8
 * polish swaps these out for the canonical pairing table.
 */

import type {
  Card,
  CardId,
  Rank,
  Suit,
  BasicCard,
  TrickCard,
  EquipmentCard,
  EquipmentSubtype,
} from '../model/card.js';

const id = (n: number): CardId => `card-${n}` as CardId;

interface Counter {
  readonly suit: Suit;
  readonly rank: Rank;
}

const RANKS: readonly Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS: readonly Suit[] = ['spade', 'heart', 'diamond', 'club'];

/** Build a deterministic suit/rank rotation across the deck. */
function* spread(start = 0): Generator<Counter> {
  let i = start;
  for (;;) {
    const suit = SUITS[i % SUITS.length]!;
    const rank = RANKS[Math.floor(i / SUITS.length) % RANKS.length]!;
    yield { suit, rank };
    i += 1;
  }
}

let _seq = 0;
const nextId = (): CardId => id(_seq++);

const mkBasic = (
  name: string,
  subtype: BasicCard['subtype'],
  count: number,
  element?: BasicCard['element'],
  start = 0,
): Card[] => {
  const out: Card[] = [];
  const gen = spread(start);
  for (let i = 0; i < count; i++) {
    const { suit, rank } = gen.next().value;
    const c: BasicCard = {
      id: nextId(),
      suit,
      rank,
      name,
      category: 'basic',
      subtype,
      ...(element ? { element } : {}),
    };
    out.push(c);
  }
  return out;
};

const mkTrick = (
  name: string,
  subtype: TrickCard['subtype'],
  count: number,
  delayed: boolean,
  start = 0,
): Card[] => {
  const out: Card[] = [];
  const gen = spread(start);
  for (let i = 0; i < count; i++) {
    const { suit, rank } = gen.next().value;
    const c: TrickCard = {
      id: nextId(),
      suit,
      rank,
      name,
      category: 'trick',
      subtype,
      delayed,
    };
    out.push(c);
  }
  return out;
};

const mkEquipment = (
  name: string,
  subtype: EquipmentSubtype,
  slot: EquipmentCard['slot'],
  range: number | undefined,
  count = 1,
  start = 0,
): Card[] => {
  const out: Card[] = [];
  const gen = spread(start);
  for (let i = 0; i < count; i++) {
    const { suit, rank } = gen.next().value;
    const c: EquipmentCard = {
      id: nextId(),
      suit,
      rank,
      name,
      category: 'equipment',
      subtype,
      slot,
      ...(range !== undefined ? { range } : {}),
    };
    out.push(c);
  }
  return out;
};

/**
 * Build the canonical 国战 deck.  Counts approximate the standard pack:
 *  - 杀: 30 普 + 8 火 + 8 雷 = 46
 *  - 闪: 24
 *  - 桃: 12
 *  - 酒: 5
 *  - 锦囊: ≈40 (mixed)
 *  - 装备: ≈20
 */
export const buildStandardDeck = (): Card[] => {
  _seq = 0;
  const cards: Card[] = [];

  // Basics
  cards.push(...mkBasic('杀', 'sha', 30, 'normal', 0));
  cards.push(...mkBasic('杀', 'sha', 8, 'fire', 30));
  cards.push(...mkBasic('杀', 'sha', 8, 'thunder', 38));
  cards.push(...mkBasic('闪', 'shan', 24, undefined, 1));
  cards.push(...mkBasic('桃', 'tao', 12, undefined, 13));
  cards.push(...mkBasic('酒', 'jiu', 5, undefined, 4));

  // Tricks (non-delayed)
  cards.push(...mkTrick('过河拆桥', 'guo-he-chai-qiao', 6, false, 2));
  cards.push(...mkTrick('顺手牵羊', 'shun-shou-qian-yang', 5, false, 7));
  cards.push(...mkTrick('无中生有', 'wu-zhong-sheng-you', 4, false, 11));
  cards.push(...mkTrick('五谷丰登', 'wu-gu-feng-deng', 2, false, 5));
  cards.push(...mkTrick('桃园结义', 'tao-yuan-jie-yi', 1, false, 9));
  cards.push(...mkTrick('决斗', 'jue-dou', 4, false, 0));
  cards.push(...mkTrick('借刀杀人', 'jie-dao-sha-ren', 2, false, 6));
  cards.push(...mkTrick('南蛮入侵', 'nan-man-ru-qin', 3, false, 8));
  cards.push(...mkTrick('万箭齐发', 'wan-jian-qi-fa', 1, false, 10));
  cards.push(...mkTrick('无懈可击', 'wu-xie-ke-ji', 8, false, 12));

  // Tricks (delayed)
  cards.push(...mkTrick('乐不思蜀', 'le-bu-si-shu', 3, true, 0));
  cards.push(...mkTrick('兵粮寸断', 'bing-liang-cun-duan', 2, true, 5));
  cards.push(...mkTrick('闪电', 'shan-dian', 2, true, 0)); // (suits seeded; engine checks rank)

  // Equipment
  cards.push(...mkEquipment('诸葛连弩', 'zhu-ge-lian-nu', 'weapon', 1, 1, 0));
  cards.push(...mkEquipment('雌雄双股剑', 'ci-xiong-shuang-gu-jian', 'weapon', 2, 1, 1));
  cards.push(...mkEquipment('丈八蛇矛', 'zhang-ba-she-mao', 'weapon', 3, 1, 2));
  cards.push(...mkEquipment('贯石斧', 'guan-shi-fu', 'weapon', 3, 1, 3));
  cards.push(...mkEquipment('朱雀羽扇', 'zhu-que-yu-shan', 'weapon', 4, 1, 4));
  cards.push(...mkEquipment('方天画戟', 'fang-tian-hua-ji', 'weapon', 4, 1, 5));
  cards.push(...mkEquipment('麒麟弓', 'qi-lin-gong', 'weapon', 5, 1, 6));
  cards.push(...mkEquipment('青釭剑', 'qing-gang-jian', 'weapon', 2, 1, 7));
  cards.push(...mkEquipment('青龙偃月刀', 'qing-long-yan-yue-dao', 'weapon', 3, 1, 8));
  cards.push(...mkEquipment('古锭刀', 'gu-ding-dao', 'weapon', 2, 1, 9));
  cards.push(...mkEquipment('藤甲', 'teng-jia', 'armor', undefined, 2, 10));
  cards.push(...mkEquipment('八卦阵', 'ba-gua-zhen', 'armor', undefined, 1, 12));
  cards.push(...mkEquipment('仁王盾', 'ren-wang-dun', 'armor', undefined, 1, 13));
  cards.push(...mkEquipment('白银狮子', 'bai-yin-shi-zi', 'armor', undefined, 1, 14));
  cards.push(...mkEquipment('+1马', 'horse-plus-1', 'horse-plus', 1, 4, 15));
  cards.push(...mkEquipment('-1马', 'horse-minus-1', 'horse-minus', 1, 4, 19));

  return cards;
};
