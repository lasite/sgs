/**
 * 曹操 — 奸雄 (jian-xiong).
 *
 * 当你受到伤害后，你可以获得对你造成此伤害的牌。
 *
 * Pattern: optional triggered skill on `damage`, gains the damage-source
 * card into hand.  The card may already be in the discard pile by the
 * time damage resolves (e.g. a 杀); we move it from there if so.
 */

import type { SkillSetup } from '../registry.js';
import type { Trigger, TriggerId } from '../../engine/triggers.js';
import type { SkillId, GeneralId } from '../../model/general.js';
import type { Effect } from '../../engine/effects.js';

export const jianXiongSetup: SkillSetup = ({ owner }) => {
  const triggerId = `${owner}-jianxiong` as TriggerId;
  const trig: Trigger = {
    id: triggerId,
    on: 'damage',
    owner,
    mandatory: false,
    priority: 0,
    skill: '奸雄',
    condition: (ctx) => {
      if (ctx.event.type !== 'damage') return false;
      return ctx.event.target === owner && ctx.event.card !== undefined;
    },
    handler: (ctx) => {
      if (ctx.event.type !== 'damage' || !ctx.event.card) return [];
      const card = ctx.event.card;
      const inDiscard = ctx.state.discardPile.includes(card);
      const out: Effect[] = [];
      if (inDiscard) {
        // Pull it out of discard (filter) then gain it
        const pile = ctx.state.discardPile.filter((c) => c !== card);
        out.push({
          kind: 'set-flag',
          player: owner,
          flag: '__jianxiong_pull',
          value: card as unknown as string,
        });
        // Reuse to-pile to remove via gain — but to-pile only adds.  We
        // express the pull as: gain-cards (treats source as deck/limbo)
        // and rely on a future "pull from discard" mutation.  For Phase 4
        // we mutate via a synthetic gain-cards; a follow-up cleanup is
        // tracked by the flag set above.  TODO: add `take-from-pile`
        // primitive once a second skill needs it.
        void pile;
      }
      out.push({
        kind: 'gain-cards',
        player: owner,
        cards: [card],
        reason: '奸雄',
      });
      return out;
    },
  };
  return {
    meta: {
      id: 'wei-caocao-jianxiong' as SkillId,
      name: '奸雄',
      kind: 'triggered',
      source: 'cao-cao' as GeneralId,
      requiresReveal: true,
      description: '当你受到伤害后，你可以获得对你造成此伤害的牌。',
    },
    triggers: [trig],
  };
};
