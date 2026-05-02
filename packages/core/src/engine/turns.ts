/**
 * Turn orchestration for the standard 国战 flow.
 *
 * The engine itself is decision-driven (Effects + triggers); these
 * helpers package up "what one full turn looks like" so callers — the
 * web store, integration tests, replay tools — can run a game without
 * each one reinventing the phase pipeline.
 *
 *   buildPlayerPhasesUpToPlay(player):
 *     start → judge → draw (+2) → play
 *     Used at the *human's* turn so the UI takes over once we hit play.
 *
 *   buildAiFullTurn(player):
 *     start → judge → draw (+2) → play (skipped) → discard → end → advance
 *     The MVP AI doesn't actively play cards on its turn; it just draws,
 *     discards if over hand limit (= max-hp), and ends.  Active AI play
 *     would land here later.
 *
 *   buildHumanEndTurnAndAdvance(player):
 *     discard → end → advance
 *     Tail of a human turn after they click 结束回合.
 *
 * Phase ordering note: `turn-advance` already resets state.phase to
 * 'start' and emits turn-start, but it does NOT emit phase-change to
 * 'start' — so we explicitly emit phase-change events here for any
 * trigger listening on phase-change.
 */

import type { Effect } from './effects.js';
import type { PlayerId } from '../model/player.js';
import type { GameState } from '../model/state.js';

export const buildPlayerPhasesUpToPlay = (player: PlayerId): Effect[] => [
  { kind: 'phase-change', to: 'start' },
  { kind: 'phase-change', to: 'judge' },
  { kind: 'phase-change', to: 'draw' },
  { kind: 'draw-cards', player, count: 2, reason: 'phase' },
  { kind: 'phase-change', to: 'play' },
];

/**
 * Auto-discard handled lazily via a trigger on `phase-change → discard`.
 * Build-time helpers can't know the hand size at the moment the discard
 * phase runs (draws haven't happened yet when we enqueue effects), so
 * we register the trigger separately via `registerHandLimitTrigger`.
 *
 * 国战 hand limit at end of turn = current HP (not maxHp).  Drops the
 * oldest cards in hand for determinism; future versions can ask the
 * player which to drop.
 */

import type { Trigger, TriggerId, TriggerRegistry } from './triggers.js';

export const registerHandLimitTrigger = (registry: TriggerRegistry): void => {
  const trig: Trigger = {
    id: 'engine-hand-limit-discard' as TriggerId,
    on: 'phase-change',
    owner: '' as PlayerId,
    mandatory: true,
    priority: 500,
    handler: (ctx) => {
      const ev = ctx.event;
      if (ev.type !== 'phase-change') return [];
      if (ev.to !== 'discard') return [];
      const player = ctx.state.players.find((p) => p.id === ev.player);
      if (!player) return [];
      const limit = Math.max(0, player.hp);
      const overflow = player.hand.length - limit;
      if (overflow <= 0) return [];
      const toDrop = player.hand.slice(0, overflow);
      return [{
        kind: 'discard-cards',
        player: player.id,
        cards: toDrop,
        reason: 'phase',
      }];
    },
  };
  registry.register(trig);
};

export const buildHumanEndTurnAndAdvance = (
  _state: GameState,
  _player: PlayerId,
): Effect[] => [
  { kind: 'phase-change', to: 'discard' },
  // discard-to-limit fires via the registered trigger
  { kind: 'phase-change', to: 'end' },
  { kind: 'turn-advance' },
];

export const buildAiFullTurn = (
  _state: GameState,
  player: PlayerId,
): Effect[] => [
  ...buildPlayerPhasesUpToPlay(player),
  // No active play phase for MVP AI.
  { kind: 'phase-change', to: 'discard' },
  { kind: 'phase-change', to: 'end' },
  { kind: 'turn-advance' },
];
