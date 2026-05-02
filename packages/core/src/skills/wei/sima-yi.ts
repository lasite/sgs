/**
 * 司马懿 — 反馈 (fan-kui).
 *
 * 当你受到伤害后，你可以获得伤害来源的一张手牌或装备。
 *
 * Pattern: optional triggered, target *another* player's belongings.
 * Demonstrates a request-with-resume from inside a skill trigger.
 */

import type { SkillSetup } from '../registry.js';
import type { Trigger, TriggerId } from '../../engine/triggers.js';
import type { SkillId, GeneralId } from '../../model/general.js';
import type { Effect } from '../../engine/effects.js';
import { newDecisionId } from '../../cards/helpers.js';
import type { CardId } from '../../model/card.js';
import type { PlayerId } from '../../model/player.js';

export const fanKuiSetup: SkillSetup = ({ owner }) => {
  const trig: Trigger = {
    id: `${owner}-fankui` as TriggerId,
    on: 'damage',
    owner,
    mandatory: false,
    priority: 0,
    skill: '反馈',
    condition: (ctx) => {
      if (ctx.event.type !== 'damage') return false;
      return (
        ctx.event.target === owner &&
        ctx.event.source !== null &&
        ctx.event.source !== owner
      );
    },
    handler: (ctx) => {
      const ev = ctx.event;
      if (ev.type !== 'damage') return [];
      if (ev.source === null) return [];
      const sourceId = ev.source;
      const sourcePlayer = ctx.state.players.find((p) => p.id === sourceId);
      if (!sourcePlayer) return [];
      const handPool: readonly CardId[] = sourcePlayer.hand;
      const equipPool = (Object.values(sourcePlayer.equipment).filter(Boolean) as CardId[]);
      const pool = [...handPool, ...equipPool];
      if (pool.length === 0) return [];
      const out: Effect[] = [{
        kind: 'request',
        request: {
          id: newDecisionId(),
          kind: 'choose-cards',
          player: owner,
          prompt: `反馈：选 ${sourcePlayer.name} 的一张牌`,
          from: 'pool',
          target: sourceId as PlayerId,
          pool,
          min: 1,
          max: 1,
        },
        resume: (resp) => {
          if (resp.kind !== 'choose-cards') return [];
          const chosen = resp.cards[0];
          if (!chosen) return [];
          const from: 'hand' | 'equipment' =
            handPool.includes(chosen) ? 'hand' : 'equipment';
          return [
            { kind: 'lose-cards', player: sourceId as PlayerId, cards: [chosen],
              from, reason: '反馈' },
            { kind: 'gain-cards', player: owner, cards: [chosen], reason: '反馈' },
          ];
        },
      }];
      return out;
    },
  };
  return {
    meta: {
      id: 'wei-simayi-fankui' as SkillId,
      name: '反馈',
      kind: 'triggered',
      source: 'sima-yi' as GeneralId,
      requiresReveal: true,
      description: '当你受到伤害后，你可以获得伤害来源的一张手牌或装备。',
    },
    triggers: [trig],
  };
};
