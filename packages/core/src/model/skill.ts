/**
 * Skill metadata — runtime behaviour (triggers, handlers) is wired up in
 * Phase 2's engine; this file just defines the descriptor shape every
 * general's skill plugs into.
 */

import type { GeneralId, SkillId } from './general.js';

/**
 * Skill activation kind:
 *  - `triggered`: fires on a matching event; player may decline unless `mandatory`.
 *  - `active`:    player chooses to use during a phase (出牌阶段限定 etc.).
 *  - `lock`:      锁定技, automatic, cannot be declined.
 *  - `awaken`:    觉醒技, fires once when its precondition is first met.
 *  - `passive`:   global modifier (range, max-hp, hand-limit) — no action needed.
 */
export type SkillKind = 'triggered' | 'active' | 'lock' | 'awaken' | 'passive';

export interface SkillMeta {
  readonly id: SkillId;
  readonly name: string;        // 中文名, e.g. '奸雄'
  readonly kind: SkillKind;
  readonly source: GeneralId;
  /** If true, ignored while general is 暗置 (Guozhan hidden-side rule). */
  readonly requiresReveal: boolean;
  /** Brief in-game description for tooltip. */
  readonly description: string;
}
