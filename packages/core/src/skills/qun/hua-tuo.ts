/**
 * 华佗 — 急救 (ji-jiu).
 *
 * 你的回合外，你可以将一张红色手牌当桃使用（仅对濒死角色）.
 *
 * Phase 4: We model 急救 as a skill that, on a `dying` event for any
 * other player, prompts owner to play any red card from hand as a 桃.
 * The dying-rescue chain itself lands in Phase 5 (the `dying` event
 * isn't yet emitted by combat).  Phase 4 commits the trigger so the
 * mechanism is ready.
 *
 * Pattern: out-of-turn trigger, view-as (red-card → 桃).
 */

import type { SkillSetup } from '../registry.js';
import type { Trigger, TriggerId } from '../../engine/triggers.js';
import type { SkillId, GeneralId } from '../../model/general.js';
import { newDecisionId } from '../../cards/helpers.js';
import type { CardId } from '../../model/card.js';
import { isRed } from '../../model/card.js';
import type { Effect } from '../../engine/effects.js';

export const jiJiuSetup: SkillSetup = ({ owner }) => {
  const trig: Trigger = {
    id: `${owner}-jijiu` as TriggerId,
    on: 'dying',
    owner,
    mandatory: false,
    priority: 0,
    skill: '急救',
    condition: (ctx) => {
      if (ctx.event.type !== 'dying') return false;
      const me = ctx.state.players.find((p) => p.id === owner);
      if (!me) return false;
      return me.hand.some((cid) => {
        const c = ctx.state.cards.get(cid);
        return c ? isRed(c) : false;
      });
    },
    handler: (ctx) => {
      if (ctx.event.type !== 'dying') return [];
      const me = ctx.state.players.find((p) => p.id === owner);
      if (!me) return [];
      const target = ctx.event.target;
      const reds = me.hand.filter((cid) => {
        const c = ctx.state.cards.get(cid);
        return c ? isRed(c) : false;
      });
      if (reds.length === 0) return [];
      const out: Effect[] = [{
        kind: 'request',
        request: {
          id: newDecisionId(),
          kind: 'choose-cards',
          player: owner,
          prompt: `急救：选一张红色手牌当桃救 ${target}`,
          from: 'hand',
          pool: reds as readonly CardId[],
          min: 1,
          max: 1,
        },
        resume: (resp) => {
          if (resp.kind !== 'choose-cards') return [];
          const chosen = resp.cards[0];
          if (!chosen) return [];
          return [
            { kind: 'lose-cards', player: owner, cards: [chosen],
              from: 'hand', reason: '急救' },
            { kind: 'to-pile', cards: [chosen], pile: 'discard' },
            { kind: 'heal', source: owner, target, amount: 1, reason: '急救' },
          ];
        },
      }];
      return out;
    },
  };
  return {
    meta: {
      id: 'qun-huatuo-jijiu' as SkillId,
      name: '急救',
      kind: 'triggered',
      source: 'hua-tuo' as GeneralId,
      requiresReveal: true,
      description: '回合外可将一张红色手牌当桃对濒死角色使用。',
    },
    triggers: [trig],
  };
};
