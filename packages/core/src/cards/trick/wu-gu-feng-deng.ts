/**
 * 五谷丰登 — canonically: flip N cards face-up (N = living players), each
 * player in turn order picks one for their hand, leftovers go to
 * discard.
 *
 * Phase 3 MVP simplification: each living player simply draws 1 card in
 * turn order.  The canonical face-up-pool path lands in Phase 4 once the
 * engine grows a public-reveal area.
 */

import type { CardBehaviour } from '../registry.js';
import type { Effect } from '../../engine/effects.js';
import { livingAll, moveToDiscard } from '../helpers.js';

export const wuGuFengDengBehaviour: CardBehaviour = {
  name: '五谷丰登',
  cancellable: true,
  targeting: (state) => ({
    minTargets: 0,
    maxTargets: 0,
    candidates: livingAll(state),
  }),
  validateTargets: (_state, _user, _c, targets) => targets.length === 0,
  onUse: ({ state, user, card }) => {
    const out: Effect[] = [];
    out.push(...moveToDiscard(user, [card.id], 'use-wu-gu'));

    const userSeat = state.players.find((p) => p.id === user)!.seat;
    const order = state.players
      .filter((p) => p.alive)
      .slice()
      .sort(
        (a, b) =>
          ((a.seat - userSeat + state.players.length) % state.players.length) -
          ((b.seat - userSeat + state.players.length) % state.players.length),
      )
      .map((p) => p.id);

    for (const pid of order) {
      out.push({ kind: 'draw-cards', player: pid, count: 1, reason: 'card' });
    }
    return out;
  },
};
