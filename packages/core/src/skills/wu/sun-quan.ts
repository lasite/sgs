/**
 * 孙权 — 制衡 (zhi-heng).
 *
 * 出牌阶段限一次：你可以弃置任意张手牌，然后摸等量的牌。
 *
 * Pattern: active skill, used during own play phase, limit-once.
 *
 * Phase 4 implementation: triggers on `phase-change` to play, asks
 * owner whether/which to invoke.  Real "active phase action" is
 * surfaced via an opt-in trigger so the existing session loop drives
 * it without new infrastructure.
 */

import type { SkillSetup } from '../registry.js';
import type { Trigger, TriggerId } from '../../engine/triggers.js';
import type { SkillId, GeneralId } from '../../model/general.js';
import { newDecisionId } from '../../cards/helpers.js';
import type { Effect } from '../../engine/effects.js';

export const zhiHengSetup: SkillSetup = ({ owner }) => {
  const trig: Trigger = {
    id: `${owner}-zhiheng` as TriggerId,
    on: 'phase-change',
    owner,
    mandatory: false,
    priority: 50,
    skill: '制衡',
    condition: (ctx) => {
      if (ctx.event.type !== 'phase-change') return false;
      const target = ctx.state.players.find((p) => p.id === owner);
      if (!target) return false;
      return ctx.event.to === 'play' &&
             ctx.event.player === owner &&
             target.hand.length > 0;
    },
    handler: (ctx) => {
      const target = ctx.state.players.find((p) => p.id === owner);
      if (!target || target.hand.length === 0) return [];
      const pool = target.hand.slice();
      const out: Effect[] = [{
        kind: 'request',
        request: {
          id: newDecisionId(),
          kind: 'choose-cards',
          player: owner,
          prompt: '制衡：选择任意张手牌弃置，然后摸等量的牌',
          from: 'hand',
          pool,
          min: 1,
          max: pool.length,
        },
        resume: (resp) => {
          if (resp.kind !== 'choose-cards') return [];
          if (resp.cards.length === 0) return [];
          return [
            { kind: 'discard-cards', player: owner, cards: resp.cards, reason: 'skill' },
            { kind: 'draw-cards', player: owner, count: resp.cards.length, reason: 'skill' },
          ];
        },
      }];
      return out;
    },
  };
  return {
    meta: {
      id: 'wu-sunquan-zhiheng' as SkillId,
      name: '制衡',
      kind: 'active',
      source: 'sun-quan' as GeneralId,
      requiresReveal: true,
      description: '出牌阶段限一次：弃任意张手牌然后摸等量的牌。',
    },
    triggers: [trig],
  };
};
