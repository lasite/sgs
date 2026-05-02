/**
 * Turn-phase orchestration.
 *
 * `runTurn(player)` enqueues the standard 国战 phase sequence:
 *   start → judge → draw → play → discard → end
 *
 * Each phase is just a `phase-change` Effect followed by the phase's
 * default work (e.g. drawing 2 cards in `draw`).  Skills and Guozhan
 * specifics (e.g. 兵贵神速 skips judge+draw on first reveal turn) hook in
 * via triggers on `phase-change`.
 */

import type { Effect } from './effects.js';
import type { Player } from '../model/player.js';
import { TURN_PHASES } from '../model/state.js';

export const buildTurnEffects = (player: Player): readonly Effect[] => {
  const out: Effect[] = [];
  for (const phase of TURN_PHASES) {
    out.push({ kind: 'phase-change', to: phase });
    if (phase === 'draw') {
      out.push({ kind: 'draw-cards', player: player.id, count: 2, reason: 'phase' });
    }
    // Other phases (judge/play/discard) require player decisions; those
    // are produced by triggers + card-play orchestrators, not here.
  }
  out.push({ kind: 'turn-advance' });
  return out;
};
