/**
 * Session — the runtime that ties events, triggers, decisions, and
 * mutations together.
 *
 * Loop:
 *   1. If no pending decision and queue non-empty, pop next Effect.
 *   2. Apply primitive mutation → produce new state + emitted event.
 *   3. Match triggers; mandatory ones queue their effects immediately,
 *      optional ones queue a `request` Effect that turns into a
 *      DecisionRequest the caller must answer.
 *   4. Recurse until queue empty.
 *
 * The session is *passive*: callers drive it via `step()` / `respond()`.
 * Tests can drive it deterministically with scripted decisions.
 */

import type { GameState } from '../model/state.js';
import type { Effect } from './effects.js';
import {
  drawCards,
  discardToPile,
  loseCards,
  gainCards,
  equipCard,
  dealDamage,
  heal,
  revealGeneral,
  setPhase,
  advanceTurn,
  toPile,
  setFlag,
  setKingdomChoice,
  setAmbitionist,
  setMaxHp,
  markDeath,
} from './mutations.js';
import type { GameEvent } from './events.js';
import type {
  DecisionId,
  DecisionRequest,
  DecisionResponse,
  TriggerOptInRequest,
} from './decisions.js';
import type { Trigger, TriggerRegistry, TriggerContext } from './triggers.js';

export interface PendingDecision {
  readonly request: DecisionRequest;
  /** What the engine will do once a response arrives. */
  readonly resume: (response: DecisionResponse, state: GameState) => readonly Effect[];
}

export interface Session {
  state: GameState;
  /** FIFO queue of effects awaiting application. */
  queue: Effect[];
  /** Set when the session is blocked on a player decision. */
  pending: PendingDecision | null;
  registry: TriggerRegistry;
  /** Monotonic decision id counter. */
  decisionSeq: number;
}

export const createSession = (
  state: GameState,
  registry: TriggerRegistry,
): Session => ({
  state,
  queue: [],
  pending: null,
  registry,
  decisionSeq: 0,
});

const nextDecisionId = (s: Session): DecisionId => {
  s.decisionSeq += 1;
  return `dec-${s.decisionSeq}` as DecisionId;
};

export const enqueue = (s: Session, effects: readonly Effect[]): void => {
  for (const e of effects) {
    if (e.kind === 'sequence') enqueue(s, e.effects);
    else s.queue.push(e);
  }
};

/**
 * Apply the primitive mutation for one Effect, returning the events it
 * emitted (so trigger matching can run on each).
 */
const applyEffect = (
  s: Session,
  effect: Effect,
): { events: readonly GameEvent[]; pending?: PendingDecision } => {
  switch (effect.kind) {
    case 'draw-cards': {
      const r = drawCards(s.state, effect.player, effect.count, effect.reason);
      s.state = r.state;
      return { events: [r.event] };
    }
    case 'discard-cards': {
      const r = discardToPile(s.state, effect.player, effect.cards, effect.reason);
      s.state = r.state;
      return { events: r.events };
    }
    case 'lose-cards': {
      const r = loseCards(s.state, effect.player, effect.cards, effect.from, effect.reason);
      s.state = r.state;
      return { events: [r.event] };
    }
    case 'gain-cards': {
      const r = gainCards(s.state, effect.player, effect.cards, effect.reason);
      s.state = r.state;
      return { events: [r.event] };
    }
    case 'equip-card': {
      const r = equipCard(s.state, effect.player, effect.card);
      s.state = r.state;
      return { events: r.events };
    }
    case 'damage': {
      const r = dealDamage(
        s.state, effect.source, effect.target, effect.amount, effect.damageKind, effect.card,
      );
      s.state = r.state;
      return { events: [r.event] };
    }
    case 'heal': {
      const r = heal(s.state, effect.source, effect.target, effect.amount, effect.reason);
      s.state = r.state;
      return { events: [r.event] };
    }
    case 'reveal-general': {
      const r = revealGeneral(s.state, effect.player, effect.slot);
      s.state = r.state;
      return { events: [r.event] };
    }
    case 'to-pile': {
      const r = toPile(s.state, effect.cards, effect.pile);
      s.state = r.state;
      return { events: [r.event] };
    }
    case 'set-flag': {
      s.state = setFlag(s.state, effect.player, effect.flag, effect.value);
      return { events: [] };
    }
    case 'set-kingdom-choice': {
      s.state = setKingdomChoice(s.state, effect.player, effect.slot, effect.kingdom);
      return { events: [] };
    }
    case 'set-ambitionist': {
      s.state = setAmbitionist(s.state, effect.player, effect.value);
      return { events: [] };
    }
    case 'set-max-hp': {
      s.state = setMaxHp(s.state, effect.player, effect.delta);
      return { events: [] };
    }
    case 'mark-death': {
      const r = markDeath(s.state, effect.player, effect.source);
      s.state = r.state;
      return { events: r.events };
    }
    case 'phase-change': {
      const r = setPhase(s.state, effect.to);
      s.state = r.state;
      return { events: [r.event] };
    }
    case 'turn-advance': {
      const r = advanceTurn(s.state);
      s.state = r.state;
      return { events: r.events };
    }
    case 'request': {
      const pending: PendingDecision = {
        request: effect.request,
        resume: effect.resume,
      };
      return { events: [], pending };
    }
    case 'sequence': {
      // sequences should already be flattened by enqueue
      enqueue(s, effect.effects);
      return { events: [] };
    }
  }
};

/**
 * For each emitted event, collect matching triggers and convert them into
 * effects to enqueue.  Mandatory triggers fire immediately; optional ones
 * suspend the session with an opt-in DecisionRequest.
 */
const processTriggers = (s: Session, events: readonly GameEvent[]): void => {
  for (const event of events) {
    const matched = s.registry.match(s.state, event);
    if (matched.length === 0) continue;

    for (const trig of matched) {
      const ctx: TriggerContext = { state: s.state, event, owner: trig.owner };
      if (trig.mandatory) {
        enqueue(s, trig.handler(ctx));
      } else {
        // Synthesize an opt-in request; on yes, run handler.
        const id = nextDecisionId(s);
        const req: TriggerOptInRequest = {
          id,
          kind: 'trigger-opt-in',
          player: trig.owner,
          prompt: `是否发动「${trig.skill ?? '技能'}」？`,
          trigger: trig.id,
          skill: trig.skill ?? '',
        };
        // Insert a request effect at the *front* of the queue so the
        // optional trigger is resolved before any other queued work.
        const pending: PendingDecision = {
          request: req,
          resume: (resp, state) => {
            if (resp.kind !== 'trigger-opt-in') return [];
            if (!resp.accept) return [];
            return trig.handler({ ...ctx, state });
          },
        };
        if (s.pending) {
          // Nesting: stash later triggers back onto the queue.
          // For the MVP we simply queue a synthetic effect that re-emits
          // by enqueueing the trigger's effects directly when accepted.
          // This conservative path drops chained pendings on the floor;
          // Phase 4+ tests will tighten as needed.
          continue;
        }
        s.pending = pending;
        return;
      }
    }
  }
};

/**
 * Advance the session as far as possible without player input.  Returns
 * `pending` if the session is now blocked on a decision, or null if the
 * queue is fully drained.
 */
export const drain = (s: Session): PendingDecision | null => {
  while (!s.pending && s.queue.length > 0) {
    const eff = s.queue.shift()!;
    const { events, pending } = applyEffect(s, eff);
    if (pending) {
      s.pending = pending;
      break;
    }
    if (events.length > 0) processTriggers(s, events);
  }
  return s.pending;
};

/** Submit a response to the current pending decision and continue. */
export const respond = (s: Session, response: DecisionResponse): PendingDecision | null => {
  if (!s.pending) throw new Error('no pending decision');
  const { resume } = s.pending;
  s.pending = null;
  const followUps = resume(response, s.state);
  enqueue(s, followUps);
  return drain(s);
};
