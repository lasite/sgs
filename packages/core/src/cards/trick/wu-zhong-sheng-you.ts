/**
 * 无中生有 — user draws 2 cards.  No targeting.
 */

import type { CardBehaviour } from '../registry.js';
import { moveToDiscard } from '../helpers.js';
import type { Effect } from '../../engine/effects.js';

export const wuZhongShengYouBehaviour: CardBehaviour = {
  name: '无中生有',
  cancellable: true,
  targeting: () => ({ minTargets: 0, maxTargets: 0, candidates: [] }),
  validateTargets: (_state, _user, _c, targets) => targets.length === 0,
  onUse: ({ user, card }) => {
    const out: Effect[] = [];
    out.push(...moveToDiscard(user, [card.id], 'use-wu-zhong'));
    out.push({ kind: 'draw-cards', player: user, count: 2, reason: 'card' });
    return out;
  },
};
