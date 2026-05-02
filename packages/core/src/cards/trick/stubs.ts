/**
 * Phase 3 stub behaviours — cards that need Phase 4 infrastructure
 * (delayed-trick judge area, weapon-coupled tricks).  They register so
 * the default deck doesn't have orphan names; on use they simply move
 * to the discard pile and emit no further effects.  Phase 4 swaps in
 * the real implementations.
 */

import type { CardBehaviour } from '../registry.js';
import type { PlayerId } from '../../model/player.js';
import { livingExcept, livingAll, moveToDiscard } from '../helpers.js';

const stubTrick = (
  name: string,
  needsTarget: boolean,
): CardBehaviour => ({
  name,
  cancellable: true,
  targeting: (state, user) => ({
    minTargets: needsTarget ? 1 : 0,
    maxTargets: needsTarget ? 1 : 0,
    candidates: needsTarget ? livingExcept(state, user.id) : livingAll(state),
  }),
  validateTargets: (_state, _user, _c, targets) =>
    needsTarget ? targets.length === 1 : targets.length === 0,
  onUse: ({ user, card }) => moveToDiscard(user, [card.id], `stub-${name}`),
});

export const jieDaoShaRenStub = stubTrick('借刀杀人', true);
export const leBuSiShuStub = stubTrick('乐不思蜀', true);
export const bingLiangCunDuanStub = stubTrick('兵粮寸断', true);
export const shanDianStub = stubTrick('闪电', false);
