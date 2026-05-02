/**
 * 夏侯惇 — 刚烈 (gang-lie).
 *
 * 当你受到伤害后，你可以进行一次判定：若结果不为红桃，则伤害来源选择：弃两张
 *  手牌或受到一点伤害。
 *
 * Phase 4 simplification: skip the judgement step and apply the
 * "deal 1 damage back" branch as a mandatory retaliation.  Phase 5
 * adds the proper judgement orchestration via a new judge primitive.
 *
 * Pattern: mandatory retaliation triggered by damage (lock-style).
 */

import type { SkillSetup } from '../registry.js';
import type { Trigger, TriggerId } from '../../engine/triggers.js';
import type { SkillId, GeneralId } from '../../model/general.js';

export const gangLieSetup: SkillSetup = ({ owner }) => {
  const trig: Trigger = {
    id: `${owner}-ganglie` as TriggerId,
    on: 'damage',
    owner,
    mandatory: false,
    priority: 0,
    skill: '刚烈',
    condition: (ctx) => {
      if (ctx.event.type !== 'damage') return false;
      return (
        ctx.event.target === owner &&
        ctx.event.source !== null &&
        ctx.event.source !== owner
      );
    },
    handler: (ctx) => {
      if (ctx.event.type !== 'damage' || ctx.event.source === null) return [];
      return [{
        kind: 'damage',
        source: owner,
        target: ctx.event.source,
        amount: 1,
        damageKind: 'normal',
      }];
    },
  };
  return {
    meta: {
      id: 'wei-xiahoudun-ganglie' as SkillId,
      name: '刚烈',
      kind: 'triggered',
      source: 'xiahou-dun' as GeneralId,
      requiresReveal: true,
      description: '当你受到伤害后，你可进行判定（简化版：直接对伤害来源造成1点伤害）。',
    },
    triggers: [trig],
  };
};
