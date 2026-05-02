/**
 * Card primitives & types.
 *
 * A `Card` is a *physical* card instance from the deck (each has a unique
 * `id`). The runtime effect logic lives in registries keyed by `name` —
 * see `cards/`.
 */

export type Suit = 'spade' | 'heart' | 'diamond' | 'club';
export type Color = 'red' | 'black';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export const SUIT_COLOR: Record<Suit, Color> = {
  spade: 'black',
  club: 'black',
  heart: 'red',
  diamond: 'red',
};

export type CardId = string & { readonly __brand: 'CardId' };

export type CardCategory = 'basic' | 'trick' | 'equipment';

export type BasicSubtype = 'sha' | 'shan' | 'tao' | 'jiu';
/** 杀 has elemental variants — fire / thunder / normal. */
export type ShaElement = 'normal' | 'fire' | 'thunder';

export type TrickSubtype =
  | 'guo-he-chai-qiao'   // 过河拆桥
  | 'shun-shou-qian-yang' // 顺手牵羊
  | 'wu-zhong-sheng-you'  // 无中生有
  | 'wu-gu-feng-deng'     // 五谷丰登
  | 'tao-yuan-jie-yi'     // 桃园结义
  | 'jue-dou'             // 决斗
  | 'jie-dao-sha-ren'     // 借刀杀人
  | 'nan-man-ru-qin'      // 南蛮入侵
  | 'wan-jian-qi-fa'      // 万箭齐发
  | 'le-bu-si-shu'        // 乐不思蜀  (delayed)
  | 'bing-liang-cun-duan' // 兵粮寸断  (delayed)
  | 'shan-dian'           // 闪电      (delayed)
  | 'wu-xie-ke-ji';       // 无懈可击  (response only)

export type EquipmentSlot = 'weapon' | 'armor' | 'horse-plus' | 'horse-minus' | 'treasure';
export type EquipmentSubtype =
  // weapons
  | 'zhu-ge-lian-nu' | 'ci-xiong-shuang-gu-jian' | 'zhang-ba-she-mao' | 'guan-shi-fu'
  | 'zhu-que-yu-shan' | 'fang-tian-hua-ji' | 'qi-lin-gong' | 'qing-gang-jian'
  | 'qing-long-yan-yue-dao' | 'gu-ding-dao'
  // armor
  | 'teng-jia' | 'ba-gua-zhen' | 'ren-wang-dun' | 'bai-yin-shi-zi'
  // horses
  | 'horse-plus-1' | 'horse-minus-1';

/** Common card fields — any physical card has these. */
interface CardBase {
  readonly id: CardId;
  readonly suit: Suit;
  readonly rank: Rank;
  readonly name: string; // human-readable Chinese name, e.g. '杀'
}

export interface BasicCard extends CardBase {
  readonly category: 'basic';
  readonly subtype: BasicSubtype;
  /** Only relevant for 杀. */
  readonly element?: ShaElement;
}

export interface TrickCard extends CardBase {
  readonly category: 'trick';
  readonly subtype: TrickSubtype;
  /** Whether the trick is *delayed* (judge-area cards: 乐, 兵, 闪电). */
  readonly delayed: boolean;
}

export interface EquipmentCard extends CardBase {
  readonly category: 'equipment';
  readonly subtype: EquipmentSubtype;
  readonly slot: EquipmentSlot;
  /** Range modifier for weapons / horses. */
  readonly range?: number;
}

export type Card = BasicCard | TrickCard | EquipmentCard;

export const colorOf = (suit: Suit): Color => SUIT_COLOR[suit];
export const isRed = (card: Card): boolean => colorOf(card.suit) === 'red';
export const isBlack = (card: Card): boolean => colorOf(card.suit) === 'black';

/**
 * Numeric rank — 2..10 are themselves; A=1, J=11, Q=12, K=13.
 * Used by 闪电 judgement (spade 2-9) and similar conditions.
 */
export const RANK_VALUE: Record<Rank, number> = {
  A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, J: 11, Q: 12, K: 13,
};
