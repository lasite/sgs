/**
 * 无懈可击 — response-only card; cannot be actively played.  When a
 * cancellable trick is being resolved against a target, the engine
 * surfaces a `respond-card` request that accepts 无懈可击; the same
 * applies recursively (无懈无懈).  The card-to-card cancel logic lives
 * in Phase 4's trick orchestrator.
 */

import type { CardBehaviour } from '../registry.js';

export const wuXieKeJiBehaviour: CardBehaviour = {
  name: '无懈可击',
  cancellable: false,
  targeting: () => ({ minTargets: 0, maxTargets: 0, candidates: [] }),
  validateTargets: () => false,
  onUse: () => {
    throw new Error('无懈可击 cannot be used as an active card');
  },
};
