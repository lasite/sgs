/**
 * 过河拆桥 — choose a player with cards in hand/equipment/judge and
 * discard one of their cards (chosen by the user).
 */

import type { CardBehaviour } from '../registry.js';
import type { CardId } from '../../model/card.js';
import type { PlayerId } from '../../model/player.js';
import type { Effect } from '../../engine/effects.js';
import { livingExcept, moveToDiscard, newDecisionId } from '../helpers.js';

export const guoHeChaiQiaoBehaviour: CardBehaviour = {
  name: '过河拆桥',
  cancellable: true,
  targeting: (state, user) => ({
    minTargets: 1,
    maxTargets: 1,
    candidates: livingExcept(state, user.id).filter((id) => {
      const p = state.players.find((x) => x.id === id)!;
      return (
        p.hand.length > 0 ||
        p.judgeArea.length > 0 ||
        Object.keys(p.equipment).length > 0
      );
    }),
  }),
  validateTargets: (_state, user, _c, targets) =>
    targets.length === 1 && targets[0] !== user.id,
  onUse: ({ state, user, card, targets }) => {
    const target = targets[0]!;
    const tp = state.players.find((p) => p.id === target)!;

    const handPool = tp.hand.slice();
    const equipPool = (Object.values(tp.equipment).filter(Boolean) as CardId[]);
    const judgePool = tp.judgeArea.slice();
    const pool: CardId[] = [...handPool, ...equipPool, ...judgePool];

    const out: Effect[] = [];
    out.push(...moveToDiscard(user, [card.id], 'use-guo-he'));
    if (pool.length === 0) return out;

    out.push({
      kind: 'request',
      request: {
        id: newDecisionId(),
        kind: 'choose-cards',
        player: user,
        prompt: `选择 ${tp.name} 的一张牌弃置`,
        from: 'pool',
        target: target as PlayerId,
        pool,
        min: 1,
        max: 1,
      },
      resume: (resp) => {
        if (resp.kind !== 'choose-cards') return [];
        const chosen = resp.cards[0];
        if (!chosen) return [];
        let from: 'hand' | 'equipment' | 'judge' = 'hand';
        if (handPool.includes(chosen)) from = 'hand';
        else if (equipPool.includes(chosen)) from = 'equipment';
        else if (judgePool.includes(chosen)) from = 'judge';
        return [
          { kind: 'lose-cards', player: target as PlayerId, cards: [chosen],
            from, reason: 'guo-he-chai-qiao' },
          { kind: 'to-pile', cards: [chosen], pile: 'discard' },
        ];
      },
    });
    return out;
  },
};
