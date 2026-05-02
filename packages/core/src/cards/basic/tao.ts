/**
 * 桃 — heal 1 HP.  Out-of-turn, only legal usage is on a dying player
 * (target = self or others); during one's own turn the user heals
 * themselves if not at full HP.  Phase 3 MVP supports the in-turn
 * self-heal path; the dying-rescue path is folded into the dying
 * trigger in Phase 4.
 */

import type { CardBehaviour } from '../registry.js';
import { moveToDiscard } from '../helpers.js';
import type { Effect } from '../../engine/effects.js';

export const taoBehaviour: CardBehaviour = {
  name: '桃',
  cancellable: false,
  targeting: (_state, user) => ({
    minTargets: 1,
    maxTargets: 1,
    candidates: [user.id],
  }),
  validateTargets: (state, user, _card, targets) => {
    if (targets.length !== 1) return false;
    if (targets[0] !== user.id) return false;
    const p = state.players.find((x) => x.id === user.id);
    if (!p) return false;
    return p.hp < p.maxHp;
  },
  onUse: ({ user, card, targets }) => {
    const target = targets[0]!;
    const out: Effect[] = [];
    out.push(...moveToDiscard(user, [card.id], 'use-tao'));
    out.push({ kind: 'heal', source: user, target, amount: 1, reason: '桃' });
    return out;
  },
};
