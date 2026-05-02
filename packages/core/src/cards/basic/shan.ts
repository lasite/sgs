/**
 * 闪 — response-only card; cannot be used as an active play.  Targeting
 * exists purely so the registry can refuse direct use.
 */

import type { CardBehaviour } from '../registry.js';

export const shanBehaviour: CardBehaviour = {
  name: '闪',
  cancellable: false,
  targeting: () => ({ minTargets: 0, maxTargets: 0, candidates: [] }),
  validateTargets: () => false,  // never directly playable
  onUse: () => {
    throw new Error('闪 cannot be used as an active card');
  },
};
