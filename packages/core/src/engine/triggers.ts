/**
 * Trigger registry.  Triggers are subscribers to specific event types;
 * the engine matches them against an emitted event, sorts by mandatory >
 * priority > seat, and invokes their handlers.
 *
 * A trigger handler is *pure*: it receives the current state and the
 * triggering event and returns a list of follow-up `Effect`s (see
 * effects.ts) for the engine to enqueue.  This keeps trigger logic free
 * of any I/O or async wiring.
 */

import type { GameState } from '../model/state.js';
import type { PlayerId } from '../model/player.js';
import type { GameEvent } from './events.js';
import type { Effect } from './effects.js';

export type TriggerId = string & { readonly __brand: 'TriggerId' };

export interface TriggerContext<E extends GameEvent = GameEvent> {
  readonly state: GameState;
  readonly event: E;
  /** The owner of this trigger (player whose general/skill it belongs to). */
  readonly owner: PlayerId;
}

export interface Trigger<E extends GameEvent = GameEvent> {
  readonly id: TriggerId;
  /** Event type filter; '*' means any event. */
  readonly on: E['type'] | '*';
  readonly owner: PlayerId;
  /** Mandatory triggers fire automatically; non-mandatory prompt the owner. */
  readonly mandatory: boolean;
  /** Higher priority resolves first.  Equal priorities use seat order. */
  readonly priority: number;
  /** Optional gating predicate; if false, the trigger is skipped. */
  readonly condition?: (ctx: TriggerContext<E>) => boolean;
  /** Effects to enqueue when the trigger fires. */
  readonly handler: (ctx: TriggerContext<E>) => readonly Effect[];
  /** Skill that produced this trigger — for UI labelling and 暗将 gating. */
  readonly skill?: string;
}

export class TriggerRegistry {
  private readonly byEvent = new Map<string, Trigger[]>();

  register(t: Trigger): void {
    const list = this.byEvent.get(t.on) ?? [];
    list.push(t);
    this.byEvent.set(t.on, list);
  }

  unregister(id: TriggerId): void {
    for (const [k, list] of this.byEvent) {
      const next = list.filter((t) => t.id !== id);
      if (next.length === 0) this.byEvent.delete(k);
      else this.byEvent.set(k, next);
    }
  }

  /**
   * Returns matching triggers in resolution order:
   *   1. mandatory before optional
   *   2. higher priority first
   *   3. owner's seat, starting from the current player's seat
   */
  match(state: GameState, event: GameEvent): readonly Trigger[] {
    const exact = this.byEvent.get(event.type) ?? [];
    const wild = this.byEvent.get('*') ?? [];
    const candidates = [...exact, ...wild];

    const seatOf = (id: PlayerId): number =>
      state.players.find((p) => p.id === id)?.seat ?? 999;

    const cur = state.currentPlayerSeat;
    const playerCount = state.players.length || 1;
    const seatDistance = (s: number): number =>
      (s - cur + playerCount) % playerCount;

    return candidates
      .filter((t) => {
        if (!t.condition) return true;
        return t.condition({ state, event, owner: t.owner } as TriggerContext);
      })
      .sort((a, b) => {
        if (a.mandatory !== b.mandatory) return a.mandatory ? -1 : 1;
        if (a.priority !== b.priority) return b.priority - a.priority;
        return seatDistance(seatOf(a.owner)) - seatDistance(seatOf(b.owner));
      });
  }
}
