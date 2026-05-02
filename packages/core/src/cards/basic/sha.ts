/**
 * 杀 — the workhorse basic card.
 *
 * Targeting: one other player within attack range.  (Range/limit checks
 * elaborated by skills/equipment in later phases; for now the targeting
 * predicate reports any *adjacent or weapon-extended* candidate.  In
 * Phase 3 MVP we accept any single living non-self target — Phase 4
 * adds proper range computation as range is intertwined with horses
 * and weapons.)
 *
 * Resolution per target:
 *   1. emit `use-card` and `target-card`.
 *   2. request 闪 from target.
 *   3. on 闪: target loses 闪 to discard, no damage.
 *   4. on no 闪: emit `effect-card`, deal 1 damage of the appropriate kind.
 *
 * Element variants (普/火/雷) come from the card's `element` property and
 * map directly to `damageKind`.
 */

import type { CardBehaviour } from '../registry.js';
import type { BasicCard, Card } from '../../model/card.js';
import type { Effect } from '../../engine/effects.js';
import type { DamageKind } from '../../engine/events.js';
import type { PlayerId } from '../../model/player.js';
import { livingExcept, moveToDiscard, newDecisionId } from '../helpers.js';

const elementToDamage = (c: Card): DamageKind => {
  if (c.category !== 'basic' || c.subtype !== 'sha') return 'normal';
  return ((c as BasicCard).element ?? 'normal') as DamageKind;
};

export const shaBehaviour: CardBehaviour = {
  name: '杀',
  cancellable: false,
  targeting: (state, user) => ({
    minTargets: 1,
    maxTargets: 1,
    candidates: livingExcept(state, user.id),
  }),
  validateTargets: (_state, user, _card, targets) => {
    if (targets.length !== 1) return false;
    return targets[0] !== user.id;
  },
  onUse: ({ user, card, targets }) => {
    const target = targets[0]!;
    const damageKind = elementToDamage(card);
    const effects: Effect[] = [];
    // Drop 杀 to discard before resolution
    effects.push(...moveToDiscard(user, [card.id], 'use-sha'));
    // Then request 闪 from the target
    const reqId = newDecisionId();
    effects.push({
      kind: 'request',
      request: {
        id: reqId,
        kind: 'respond-card',
        player: target as PlayerId,
        prompt: `${user} 对你出杀，是否使用闪？`,
        accepts: ['闪'],
        context: 'against-sha',
      },
      resume: (resp) => {
        if (resp.kind !== 'respond-card') return [];
        if (resp.card) {
          // Target spent a 闪 — discard it; no damage.
          return [
            ...moveToDiscard(target as PlayerId, [resp.card], 'shan-vs-sha'),
          ];
        }
        // No response: deal damage.
        const dmg: Effect = {
          kind: 'damage',
          source: user,
          target: target as PlayerId,
          amount: 1,
          damageKind,
          card: card.id,
        };
        return [dmg];
      },
    });
    return effects;
  },
};
