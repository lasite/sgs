/**
 * Equipment "use" = equip the card to its slot.  The combat effect of
 * each weapon/armor/horse is implemented as a *passive trigger* in
 * Phase 4 (e.g. 麒麟弓 hooks `damage`, 八卦阵 hooks 杀-incoming, etc.).
 *
 * Phase 3 only handles the equip plumbing — every equipment card uses
 * the same generic behaviour below.
 */

import type { CardBehaviour } from '../registry.js';
import type { Effect } from '../../engine/effects.js';

const equipBehaviour = (name: string): CardBehaviour => ({
  name,
  cancellable: false,
  targeting: (_state, user) => ({
    minTargets: 1,
    maxTargets: 1,
    candidates: [user.id],
  }),
  validateTargets: (_state, user, _c, targets) =>
    targets.length === 1 && targets[0] === user.id,
  onUse: ({ user, card }): readonly Effect[] => [
    { kind: 'equip-card', player: user, card: card.id },
  ],
});

export const equipmentBehaviours: readonly CardBehaviour[] = [
  // weapons
  '诸葛连弩', '雌雄双股剑', '丈八蛇矛', '贯石斧', '朱雀羽扇',
  '方天画戟', '麒麟弓', '青釭剑', '青龙偃月刀', '古锭刀',
  // armor
  '藤甲', '八卦阵', '仁王盾', '白银狮子',
  // horses
  '+1马', '-1马',
].map(equipBehaviour);
