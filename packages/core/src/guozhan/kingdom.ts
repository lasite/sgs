/**
 * Kingdom resolution.
 *
 * In Guozhan a player's "current kingdom" is a function of which of
 * their two generals are revealed plus, for double-faction generals,
 * the kingdom they declared on reveal.
 *
 *   - both暗置: kingdom unknown (returns null).
 *   - one revealed (single-faction): that kingdom.
 *   - one revealed (double-faction): the declared kingdom.
 *   - both revealed: must agree (else ambitionist; returns null).
 */

import type { GameState } from '../model/state.js';
import type { Player } from '../model/player.js';
import type { Kingdom, General } from '../model/general.js';
import { ALL_GENERALS } from '../data/generals.js';

const generalById = (id: string): General => {
  const g = ALL_GENERALS.find((x) => x.id === id);
  if (!g) throw new Error(`unknown general ${id}`);
  return g;
};

export const slotKingdom = (
  general: General,
  declared: Kingdom | undefined,
): Kingdom => {
  if (general.kingdoms.length === 1) return general.kingdoms[0];
  if (declared && general.kingdoms.includes(declared)) return declared;
  return general.kingdoms[0];
};

export const playerKingdom = (player: Player): Kingdom | null => {
  if (player.isAmbitionist) return null;
  const main = player.main;
  const sub = player.sub;

  if (!main.revealed && !sub.revealed) return null;

  if (main.revealed && sub.revealed) {
    const km = slotKingdom(generalById(main.general), main.kingdomChoice);
    const ks = slotKingdom(generalById(sub.general), sub.kingdomChoice);
    return km === ks ? km : null;
  }

  const visible = main.revealed ? main : sub;
  return slotKingdom(generalById(visible.general), visible.kingdomChoice);
};

/** Two players are allies if they share a non-null kingdom. */
export const sameKingdom = (a: Player, b: Player): boolean => {
  const ka = playerKingdom(a);
  const kb = playerKingdom(b);
  return ka !== null && ka === kb;
};

/**
 * Compute kingdom counts among living, revealed players.  Used by
 * reveal-time death-bonus draws and 野心家 detection.
 */
export const kingdomCounts = (
  state: GameState,
): Record<Kingdom, number> => {
  const counts: Record<Kingdom, number> = { wei: 0, shu: 0, wu: 0, qun: 0 };
  for (const p of state.players) {
    if (!p.alive) continue;
    const k = playerKingdom(p);
    if (k) counts[k] += 1;
  }
  return counts;
};
