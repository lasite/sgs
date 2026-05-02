/**
 * 南蛮入侵 / 万箭齐发 — AOE tricks.
 *
 *   南蛮: every other living player must respond with 杀 or take 1 damage.
 *   万箭: every other living player must respond with 闪 or take 1 damage.
 */

import type { CardBehaviour } from '../registry.js';
import type { PlayerId } from '../../model/player.js';
import type { Effect } from '../../engine/effects.js';
import { livingExcept, moveToDiscard, newDecisionId } from '../helpers.js';

const aoeBehaviour = (
  name: '南蛮入侵' | '万箭齐发',
  responseCard: '杀' | '闪',
): CardBehaviour => ({
  name,
  cancellable: true,
  targeting: (state, user) => ({
    minTargets: 0,
    maxTargets: 0,
    candidates: livingExcept(state, user.id),
  }),
  validateTargets: (_state, _user, _c, targets) => targets.length === 0,
  onUse: ({ state, user, card }) => {
    const out: Effect[] = [];
    out.push(...moveToDiscard(user, [card.id], `use-${name}`));
    for (const tid of livingExcept(state, user)) {
      out.push({
        kind: 'request',
        request: {
          id: newDecisionId(),
          kind: 'respond-card',
          player: tid as PlayerId,
          prompt: `${name}：是否打出${responseCard}？`,
          accepts: [responseCard],
          context: name,
        },
        resume: (resp) => {
          if (resp.kind !== 'respond-card') return [];
          if (resp.card) {
            return [
              { kind: 'lose-cards', player: tid as PlayerId, cards: [resp.card],
                from: 'hand', reason: `${name}-respond` },
              { kind: 'to-pile', cards: [resp.card], pile: 'discard' },
            ];
          }
          return [{
            kind: 'damage',
            source: user,
            target: tid as PlayerId,
            amount: 1,
            damageKind: 'normal',
            card: card.id,
          }];
        },
      });
    }
    return out;
  },
});

export const nanManRuQinBehaviour = aoeBehaviour('南蛮入侵', '杀');
export const wanJianQiFaBehaviour = aoeBehaviour('万箭齐发', '闪');
