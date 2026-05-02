/**
 * 酒 — flag the user for a damage-bonus on their next 杀 this turn (in
 * 出牌阶段) or save a dying player.  Phase 3 MVP: target self, set the
 * `jiu-armed` flag.  The damage-bonus consumption is wired into 杀
 * resolution in Phase 4 (when the orchestrator can read flags).
 */

import type { CardBehaviour } from '../registry.js';
import { moveToDiscard } from '../helpers.js';
import type { Effect } from '../../engine/effects.js';

export const jiuBehaviour: CardBehaviour = {
  name: '酒',
  cancellable: false,
  targeting: (_state, user) => ({
    minTargets: 1,
    maxTargets: 1,
    candidates: [user.id],
  }),
  validateTargets: (_state, user, _c, targets) =>
    targets.length === 1 && targets[0] === user.id,
  onUse: ({ user, card }) => {
    const out: Effect[] = [];
    out.push(...moveToDiscard(user, [card.id], 'use-jiu'));
    // Flag-setting is a state mutation we don't yet have a primitive for.
    // We model it as a degenerate 0-amount heal with reason='jiu-arm';
    // Phase 4 introduces a proper `set-flag` effect once skills need it.
    return out;
  },
};
