/**
 * Player runtime state.  Immutable: all mutations produce a new object.
 *
 * Guozhan specifics:
 *  - Each player has TWO generals (`main` and `sub`), independently revealed.
 *  - HP/maxHp track the current bowl; companion bonuses on reveal mutate them.
 *  - `kingdomDeclared` records the *chosen* kingdom for double-faction
 *    generals (阴阳鱼) — only meaningful once that general is revealed.
 *  - `isAmbitionist` flips true the moment the player reveals two generals
 *    of incompatible kingdoms (野心家).
 */

import type { CardId, EquipmentSlot } from './card.js';
import type { GeneralId, Kingdom } from './general.js';

export type PlayerId = string & { readonly __brand: 'PlayerId' };

export interface GeneralSlot {
  readonly general: GeneralId;
  readonly revealed: boolean;
  /** For 双势力 generals, which kingdom the player selected on reveal. */
  readonly kingdomChoice?: Kingdom;
}

/** A card sitting in someone's equipment row, indexed by slot. */
export type EquipmentArea = Readonly<Partial<Record<EquipmentSlot, CardId>>>;

export interface Player {
  readonly id: PlayerId;
  readonly seat: number;
  readonly name: string;
  readonly main: GeneralSlot;
  readonly sub: GeneralSlot;
  readonly hp: number;
  readonly maxHp: number;
  /** Hand cards, in draw order (oldest first). */
  readonly hand: readonly CardId[];
  readonly equipment: EquipmentArea;
  /** 判定区 — delayed tricks awaiting this player's judge phase. */
  readonly judgeArea: readonly CardId[];
  readonly isAmbitionist: boolean;
  readonly alive: boolean;
  /** Tags for transient effects (e.g. 'skip-judge-once', 'shasha-used-3'). */
  readonly flags: Readonly<Record<string, number | boolean | string>>;
}

export const bothRevealed = (p: Player): boolean =>
  p.main.revealed && p.sub.revealed;

export const anyRevealed = (p: Player): boolean =>
  p.main.revealed || p.sub.revealed;

export const handSize = (p: Player): number => p.hand.length;
