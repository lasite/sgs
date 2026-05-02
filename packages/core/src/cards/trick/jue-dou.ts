/**
 * 决斗 — target a player.  Target must play a 杀, then user must play a 杀,
 * alternating; the first to fail to produce a 杀 takes 1 damage from the
 * other side.
 *
 * Implementation: a recursive request loop.  The "current responder"
 * alternates between target and user; whoever fails takes damage from
 * the opposite side.
 */

import type { CardBehaviour } from '../registry.js';
import type { PlayerId } from '../../model/player.js';
import type { Effect } from '../../engine/effects.js';
import { moveToDiscard, newDecisionId, livingExcept } from '../helpers.js';

const promptFor = (responder: PlayerId, dueler: PlayerId): Effect => ({
  kind: 'request',
  request: {
    id: newDecisionId(),
    kind: 'respond-card',
    player: responder,
    prompt: `决斗中：你需要打出一张杀（与 ${dueler} 对峙）`,
    accepts: ['杀'],
    context: 'in-jue-dou',
  },
  resume: (resp) => {
    if (resp.kind !== 'respond-card') return [];
    if (resp.card) {
      // responded with 杀 — discard it, swap responder
      return [
        { kind: 'lose-cards', player: responder, cards: [resp.card],
          from: 'hand', reason: 'jue-dou-respond' },
        { kind: 'to-pile', cards: [resp.card], pile: 'discard' },
        promptFor(dueler, responder),
      ];
    }
    // Failed: take damage from the dueler
    return [{
      kind: 'damage',
      source: dueler,
      target: responder,
      amount: 1,
      damageKind: 'normal',
    }];
  },
});

export const jueDouBehaviour: CardBehaviour = {
  name: '决斗',
  cancellable: true,
  targeting: (state, user) => ({
    minTargets: 1,
    maxTargets: 1,
    candidates: livingExcept(state, user.id),
  }),
  validateTargets: (_state, user, _c, targets) =>
    targets.length === 1 && targets[0] !== user.id,
  onUse: ({ user, card, targets }) => {
    const target = targets[0]!;
    return [
      ...moveToDiscard(user, [card.id], 'use-jue-dou'),
      // Target responds first (用户出决斗，目标先出杀)
      promptFor(target as PlayerId, user),
    ];
  },
};
