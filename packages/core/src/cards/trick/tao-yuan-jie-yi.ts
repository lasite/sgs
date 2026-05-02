/**
 * 桃园结义 — every living player heals 1 (subject to maxHp cap).
 */

import type { CardBehaviour } from '../registry.js';
import { livingAll, moveToDiscard } from '../helpers.js';
import type { Effect } from '../../engine/effects.js';

export const taoYuanJieYiBehaviour: CardBehaviour = {
  name: '桃园结义',
  cancellable: true,
  targeting: (state, _user) => ({
    minTargets: 0,
    maxTargets: 0,
    candidates: livingAll(state),
  }),
  validateTargets: (_state, _user, _c, targets) => targets.length === 0,
  onUse: ({ state, user, card }) => {
    const out: Effect[] = [];
    out.push(...moveToDiscard(user, [card.id], 'use-tao-yuan'));
    // turn-order starting from user
    const seat = state.players.find((p) => p.id === user)!.seat;
    const ordered = state.players.slice()
      .sort((a, b) => ((a.seat - seat + state.players.length) % state.players.length)
                    - ((b.seat - seat + state.players.length) % state.players.length));
    for (const p of ordered) {
      if (!p.alive) continue;
      out.push({
        kind: 'heal',
        source: user,
        target: p.id,
        amount: 1,
        reason: '桃园结义',
      });
    }
    return out;
  },
};
