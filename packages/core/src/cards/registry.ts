/**
 * Card behaviour registry.
 *
 * A `CardBehaviour` describes how a particular *named* card resolves at
 * runtime: what targets it accepts, what it does on use, and (for trick
 * cards) whether 无懈可击 can cancel it.
 *
 * Behaviours are looked up by `card.name` (the Chinese name) plus, when
 * relevant, `subtype`.  This keeps the static deck data decoupled from
 * runtime logic — a deck card is just suit/rank/name; behaviour is
 * registered separately.
 */

import type { Card, CardId } from '../model/card.js';
import type { Player, PlayerId } from '../model/player.js';
import type { GameState } from '../model/state.js';
import type { Effect } from '../engine/effects.js';

export interface UseCardContext {
  readonly state: GameState;
  readonly user: PlayerId;
  readonly card: Card;
  readonly targets: readonly PlayerId[];
}

export interface TargetingResult {
  readonly minTargets: number;
  readonly maxTargets: number;
  readonly candidates: readonly PlayerId[];
}

export interface CardBehaviour {
  /** The display name this behaviour matches (e.g. '杀', '过河拆桥'). */
  readonly name: string;
  /** True for tricks that can be cancelled by 无懈可击. */
  readonly cancellable: boolean;
  /**
   * Compute valid targets at the moment of play.  Cards with no target
   * (e.g. 无中生有) return min=0, max=0 with empty candidates.
   */
  readonly targeting: (state: GameState, user: Player, card: Card) => TargetingResult;
  /**
   * Validate a targeting choice — engine calls this before resolving
   * to reject invalid selections (e.g. self-target on 决斗).
   */
  readonly validateTargets?: (
    state: GameState,
    user: Player,
    card: Card,
    targets: readonly PlayerId[],
  ) => boolean;
  /**
   * Produce effects to enqueue when the card is used.  Implementations
   * are responsible for the full life-cycle: emit `use-card` work, route
   * cards to the discard, request responses, deal effects, etc.
   *
   * Convention: the user has *already* lost the played card from hand
   * before `onUse` is invoked (see `playCard` orchestrator).
   */
  readonly onUse: (ctx: UseCardContext) => readonly Effect[];
}

export class CardRegistry {
  private readonly byName = new Map<string, CardBehaviour>();

  register(b: CardBehaviour): void {
    if (this.byName.has(b.name)) {
      throw new Error(`duplicate card behaviour for ${b.name}`);
    }
    this.byName.set(b.name, b);
  }

  get(name: string): CardBehaviour | undefined {
    return this.byName.get(name);
  }

  require(name: string): CardBehaviour {
    const b = this.byName.get(name);
    if (!b) throw new Error(`unknown card behaviour: ${name}`);
    return b;
  }

  has(name: string): boolean {
    return this.byName.has(name);
  }
}

/**
 * Convenience: `playCard` wraps the steps every card share — moving the
 * card out of the user's hand to the discard pile and emitting a
 * `use-card` event — then defers to the behaviour's `onUse`.
 */
export const playCard = (
  state: GameState,
  user: PlayerId,
  cardId: CardId,
  targets: readonly PlayerId[],
  registry: CardRegistry,
): readonly Effect[] => {
  const card = state.cards.get(cardId);
  if (!card) throw new Error(`unknown card ${cardId}`);
  const behaviour = registry.require(card.name);

  const userP = state.players.find((p) => p.id === user);
  if (!userP) throw new Error(`unknown user ${user}`);

  if (behaviour.validateTargets &&
      !behaviour.validateTargets(state, userP, card, targets)) {
    throw new Error(`invalid targets for ${card.name}`);
  }

  // The "lose card from hand → discard pile" plumbing is handled per-card
  // because some cards (e.g. equipment) keep the card on the table.
  return behaviour.onUse({ state, user, card, targets });
};
