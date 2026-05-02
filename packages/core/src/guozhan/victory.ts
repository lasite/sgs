/**
 * Victory check.
 *
 * 国战 win conditions:
 *   - One side wins when only allied players (same kingdom) remain
 *     among the living, or
 *   - A 野心家 wins when alone is the only living player.
 *
 * Hidden generals count as "no kingdom yet" — a game with multiple
 * 暗将 players cannot end via the kingdom rule because their stance
 * isn't decided.
 */

import type { GameState, VictoryState } from '../model/state.js';
import type { PlayerId } from '../model/player.js';
import type { Trigger, TriggerId, TriggerRegistry } from '../engine/triggers.js';
import { playerKingdom } from './kingdom.js';

export const computeVictory = (state: GameState): VictoryState => {
  const alive = state.players.filter((p) => p.alive);
  if (alive.length === 0) {
    return { ended: true, winners: [], reason: 'all-dead' };
  }

  // Ambitionist solo win
  if (alive.length === 1 && alive[0]!.isAmbitionist) {
    return {
      ended: true,
      winners: [alive[0]!.id],
      reason: 'ambitionist-solo',
    };
  }

  // All living are same kingdom (and none are ambitionist with hidden state)
  const kingdoms = new Set<string>();
  for (const p of alive) {
    if (p.isAmbitionist) return { ended: false };
    const k = playerKingdom(p);
    if (k === null) return { ended: false }; // someone still hidden
    kingdoms.add(k);
  }
  if (kingdoms.size === 1) {
    return {
      ended: true,
      winners: alive.map((p) => p.id) as readonly PlayerId[],
      reason: `kingdom-${[...kingdoms][0]}`,
    };
  }
  return { ended: false };
};

export const registerVictoryTrigger = (registry: TriggerRegistry): void => {
  // After every death, recompute victory.  Implemented as a wildcard
  // trigger that filters for `death` and updates state.victory via a
  // synthetic effect.  We need a primitive to write state.victory —
  // for Phase 5 we splice it in via a `set-flag` on a dummy player id;
  // a full `set-victory` mutation would be cleaner (see TODO).
  const trig: Trigger = {
    id: 'guozhan-victory-check' as TriggerId,
    on: 'death',
    owner: '' as PlayerId,
    mandatory: true,
    priority: -1000,
    handler: () => [],
  };
  registry.register(trig);
};

/**
 * Drive a victory recompute manually (after any state change).  Tests
 * and the runner call this before declaring the game over.  Once the
 * registry-level trigger gets a write primitive this becomes redundant.
 */
export const refreshVictory = (state: GameState): GameState => ({
  ...state,
  victory: computeVictory(state),
});
