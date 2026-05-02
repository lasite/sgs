/**
 * General (武将) definitions — the *static* shape; runtime skill behaviour
 * is registered separately in `skills/`.
 *
 * Guozhan-specific:
 *  - `kingdoms`: usually one element; double-faction generals (e.g. 庞统蜀群,
 *    二乔吴群) carry two and resolve choice on reveal (阴阳鱼).
 *  - `companion`: declares which other generals trigger 珠联璧合 when both
 *    revealed.  Symmetric pairing — only one side needs to declare; the
 *    engine treats it as a set.
 *  - `hp`: the general's standalone HP cap.  In Guozhan, a player's max HP
 *    is `floor((mainHp + subHp) / 2)` plus any pair bonus on reveal.
 */

export type Kingdom = 'wei' | 'shu' | 'wu' | 'qun';
export const ALL_KINGDOMS: readonly Kingdom[] = ['wei', 'shu', 'wu', 'qun'] as const;

export type Gender = 'male' | 'female' | 'neuter';

export type GeneralId = string & { readonly __brand: 'GeneralId' };
export type SkillId = string & { readonly __brand: 'SkillId' };

export interface General {
  readonly id: GeneralId;
  /** Display name, e.g. '曹操'. */
  readonly name: string;
  /** Usually length 1; length 2 means double-faction (阴阳鱼). */
  readonly kingdoms: readonly [Kingdom] | readonly [Kingdom, Kingdom];
  /** Standalone HP cap (typically 3-5). */
  readonly hp: number;
  readonly gender: Gender;
  readonly skills: readonly SkillId[];
  /** Companion generals for 珠联璧合 (by GeneralId). */
  readonly companion?: readonly GeneralId[];
}

export const isDoubleFaction = (g: General): boolean => g.kingdoms.length === 2;

export const generalKingdomFor = (
  g: General,
  declared?: Kingdom,
): Kingdom => {
  if (g.kingdoms.length === 1) return g.kingdoms[0];
  if (declared && g.kingdoms.includes(declared)) return declared;
  // fall back to first; callers should usually pass `declared` for 双势力.
  return g.kingdoms[0];
};
