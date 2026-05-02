/**
 * Heuristic AI — a `DecisionProvider` that answers every prompt with a
 * reasonable default.  The strategy is deliberately simple and
 * deterministic so tests can pin behaviour and humans can reason about
 * AI moves:
 *
 *  - trigger-opt-in:   accept (most triggers are beneficial; we leave
 *                      "harmful" triggers like 自爆 to be flagged by the
 *                      skill setter via prompt convention).
 *  - respond-card:     respond with the first matching card in hand
 *                      (闪 to 杀, 杀 to 决斗).  If none, decline.
 *  - choose-targets:   pick the first non-allied candidate; if all are
 *                      allies (or kingdom-unknown) pick the lowest-HP
 *                      candidate.
 *  - choose-cards:     pick the first card (or N cards) from the pool.
 *  - reveal-general:   reveal main slot first.
 *  - choose-kingdom:   pick the kingdom most-represented among visible
 *                      players, else the first option.
 *  - yes-no:           default yes.
 *
 * The provider is stateless apart from a reference to the current
 * GameState (passed in per-request) so multiple AI seats can share an
 * instance.
 */

import type {
  DecisionProvider,
  DecisionRequest,
  DecisionResponse,
} from '../engine/decisions.js';
import type { GameState } from '../model/state.js';
import type { Player } from '../model/player.js';
import { sameKingdom, kingdomCounts } from '../guozhan/kingdom.js';

export interface HeuristicAiOpts {
  readonly stateRef: () => GameState;
}

const findCardByName = (
  state: GameState,
  player: Player,
  names: readonly string[],
): string | null => {
  for (const cid of player.hand) {
    const c = state.cards.get(cid);
    if (c && names.includes(c.name)) return cid;
  }
  return null;
};

export class HeuristicAi implements DecisionProvider {
  constructor(private readonly opts: HeuristicAiOpts) {}

  decide(request: DecisionRequest): DecisionResponse {
    const state = this.opts.stateRef();
    const me = state.players.find((p) => p.id === request.player);
    if (!me) throw new Error(`AI: unknown player ${request.player}`);

    switch (request.kind) {
      case 'trigger-opt-in':
        return { id: request.id, kind: 'trigger-opt-in', accept: true };

      case 'trigger-order':
        return { id: request.id, kind: 'trigger-order', order: request.triggers };

      case 'respond-card': {
        const cid = findCardByName(state, me, request.accepts);
        return { id: request.id, kind: 'respond-card', card: cid as never ?? null };
      }

      case 'choose-targets': {
        // Prefer enemies first, then weakest by HP.
        const candidates = request.candidates
          .map((id) => state.players.find((p) => p.id === id))
          .filter((p): p is Player => Boolean(p));
        const enemies = candidates.filter((p) => !sameKingdom(me, p));
        const pool = enemies.length > 0 ? enemies : candidates;
        const sorted = pool.slice().sort((a, b) => a.hp - b.hp);
        const picked = sorted.slice(0, request.minTargets || 1);
        return {
          id: request.id,
          kind: 'choose-targets',
          targets: picked.map((p) => p.id),
        };
      }

      case 'choose-cards': {
        const pool = request.pool ?? me.hand;
        const need = Math.max(request.min, 1);
        const slice = pool.slice(0, Math.min(pool.length, need));
        return { id: request.id, kind: 'choose-cards', cards: slice };
      }

      case 'reveal-general': {
        const slot = request.slots.includes('main') ? 'main'
                   : request.slots[0] ?? null;
        return { id: request.id, kind: 'reveal-general', slot };
      }

      case 'choose-kingdom': {
        const counts = kingdomCounts(state);
        const ranked = request.options
          .slice()
          .sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0));
        return {
          id: request.id,
          kind: 'choose-kingdom',
          kingdom: ranked[0] ?? request.options[0]!,
        };
      }

      case 'yes-no':
        return { id: request.id, kind: 'yes-no', value: true };
    }
  }
}
