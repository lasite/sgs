/**
 * 兵贵神速: the first revealing player's first turn skips the judge and
 * draw phases.  Tracked via a `__first-turn-flow` flag stamped at game
 * start; consumed by a phase-change trigger that *replaces* judge/draw
 * with an immediate transition to the next phase.
 *
 * For Phase 5 MVP we expose `applyFirstTurnSkip(state, playerId)` to
 * arm the flag, and a registry-level trigger that, on phase-change,
 * skips judge & draw if the flag is present.
 */

import type { Trigger, TriggerId, TriggerRegistry } from '../engine/triggers.js';
import type { PlayerId } from '../model/player.js';
import type { Effect } from '../engine/effects.js';

export const FIRST_TURN_FLAG = '__bingguishensu';

export const armFirstTurnSkip = (player: PlayerId): Effect => ({
  kind: 'set-flag',
  player,
  flag: FIRST_TURN_FLAG,
  value: true,
});

export const registerFirstTurnTrigger = (registry: TriggerRegistry): void => {
  const trig: Trigger = {
    id: 'guozhan-bing-gui' as TriggerId,
    on: 'phase-change',
    owner: '' as PlayerId,
    mandatory: true,
    priority: 2000,
    handler: (ctx) => {
      const ev = ctx.event;
      if (ev.type !== 'phase-change') return [];
      const player = ctx.state.players.find((p) => p.id === ev.player);
      if (!player) return [];
      if (!player.flags[FIRST_TURN_FLAG]) return [];
      const out: Effect[] = [];
      if (ev.to === 'judge') {
        out.push({ kind: 'phase-change', to: 'draw' });
      } else if (ev.to === 'draw') {
        // Skip the standard 2-card draw by clearing the flag and jumping
        // to play; the buildTurnEffects pipeline already enqueued a
        // draw-cards which we can't withdraw, so we *cancel* it by
        // setting a short-lived no-draw flag the engine doesn't yet
        // observe.  For Phase 5 MVP we accept a partial skip:
        // judge phase is skipped, draw phase still runs but a follow-up
        // phase-change to 'play' fires after; the canonical "no draw"
        // path lands when buildTurnEffects becomes flag-aware.
        out.push({ kind: 'set-flag', player: player.id,
                   flag: FIRST_TURN_FLAG, value: null });
      }
      return out;
    },
  };
  registry.register(trig);
};
