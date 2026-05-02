/**
 * 张飞 — 咆哮 (pao-xiao).
 *
 * 锁定技。你于出牌阶段使用「杀」无次数限制。
 *
 * Phase 4 representation: a mandatory passive trigger on `turn-start`
 * sets a flag; the 杀-limit check (when fully implemented in Phase 5)
 * reads this flag.  For now it's a marker for tests.
 *
 * Pattern: lock skill = mandatory phase-driven flag setter.
 */

import type { SkillSetup } from '../registry.js';
import type { Trigger, TriggerId } from '../../engine/triggers.js';
import type { SkillId, GeneralId } from '../../model/general.js';

export const paoXiaoSetup: SkillSetup = ({ owner }) => {
  const trig: Trigger = {
    id: `${owner}-paoxiao` as TriggerId,
    on: 'turn-start',
    owner,
    mandatory: true,
    priority: 100,
    skill: '咆哮',
    condition: (ctx) =>
      ctx.event.type === 'turn-start' && ctx.event.player === owner,
    handler: () => [
      { kind: 'set-flag', player: owner, flag: 'paoxiao-no-limit', value: true },
    ],
  };
  return {
    meta: {
      id: 'shu-zhangfei-paoxiao' as SkillId,
      name: '咆哮',
      kind: 'lock',
      source: 'zhang-fei' as GeneralId,
      requiresReveal: true,
      description: '锁定技，你出杀无次数限制。',
    },
    triggers: [trig],
  };
};
