/**
 * Game event union — every state-changing primitive emits one of these,
 * triggers subscribe by `type`, and the eventLog records them in order.
 *
 * Convention: payload fields use IDs, not full objects.  Engine helpers
 * resolve IDs against the GameState as needed.
 */

import type { CardId } from '../model/card.js';
import type { PlayerId } from '../model/player.js';
import type { TurnPhase, GameEventBase } from '../model/state.js';

export type DamageKind = 'normal' | 'fire' | 'thunder';

export type GameEvent =
  | TurnStartEvent
  | TurnEndEvent
  | PhaseChangeEvent
  | DrawCardsEvent
  | LoseCardsEvent
  | GainCardsEvent
  | EquipCardEvent
  | UnequipCardEvent
  | UseCardEvent
  | TargetCardEvent
  | EffectCardEvent
  | ResponseCardEvent
  | JudgeStartEvent
  | JudgeResolveEvent
  | DamageEvent
  | HealEvent
  | DyingEvent
  | DeathEvent
  | RevealGeneralEvent
  | DiscardCardEvent
  | EnterPileEvent;

interface Base extends GameEventBase {}

export interface TurnStartEvent extends Base {
  readonly type: 'turn-start';
  readonly player: PlayerId;
  readonly turnNumber: number;
}
export interface TurnEndEvent extends Base {
  readonly type: 'turn-end';
  readonly player: PlayerId;
  readonly turnNumber: number;
}
export interface PhaseChangeEvent extends Base {
  readonly type: 'phase-change';
  readonly player: PlayerId;
  readonly from: TurnPhase | null;
  readonly to: TurnPhase;
}
export interface DrawCardsEvent extends Base {
  readonly type: 'draw-cards';
  readonly player: PlayerId;
  readonly cards: readonly CardId[];
  readonly reason: 'phase' | 'skill' | 'card' | 'death-bonus';
}
export interface LoseCardsEvent extends Base {
  readonly type: 'lose-cards';
  readonly player: PlayerId;
  readonly cards: readonly CardId[];
  /** Where the cards came from on the player. */
  readonly from: 'hand' | 'equipment' | 'judge';
  readonly reason: string;
}
export interface GainCardsEvent extends Base {
  readonly type: 'gain-cards';
  readonly player: PlayerId;
  readonly cards: readonly CardId[];
  readonly reason: string;
}
export interface EquipCardEvent extends Base {
  readonly type: 'equip-card';
  readonly player: PlayerId;
  readonly card: CardId;
  /** If a previous card was kicked out by this equip, it's listed here. */
  readonly replaced?: CardId;
}
export interface UnequipCardEvent extends Base {
  readonly type: 'unequip-card';
  readonly player: PlayerId;
  readonly card: CardId;
}
export interface UseCardEvent extends Base {
  readonly type: 'use-card';
  readonly user: PlayerId;
  readonly card: CardId;
  readonly targets: readonly PlayerId[];
}
export interface TargetCardEvent extends Base {
  readonly type: 'target-card';
  readonly user: PlayerId;
  readonly target: PlayerId;
  readonly card: CardId;
}
export interface EffectCardEvent extends Base {
  readonly type: 'effect-card';
  readonly user: PlayerId;
  readonly target: PlayerId;
  readonly card: CardId;
}
export interface ResponseCardEvent extends Base {
  readonly type: 'response-card';
  readonly responder: PlayerId;
  readonly card: CardId;
  /** What this response is replying to (e.g. another card / request id). */
  readonly toCard?: CardId;
  readonly toRequestId?: string;
}
export interface JudgeStartEvent extends Base {
  readonly type: 'judge-start';
  readonly player: PlayerId;
  readonly card: CardId;
}
export interface JudgeResolveEvent extends Base {
  readonly type: 'judge-resolve';
  readonly player: PlayerId;
  readonly judgeCard: CardId;
  /** Card that triggered the judgement (e.g. 闪电, 乐不思蜀, 鬼才's source). */
  readonly source?: CardId;
}
export interface DamageEvent extends Base {
  readonly type: 'damage';
  readonly source: PlayerId | null; // null for environmental (闪电)
  readonly target: PlayerId;
  readonly amount: number;
  readonly kind: DamageKind;
  readonly card?: CardId;
}
export interface HealEvent extends Base {
  readonly type: 'heal';
  readonly source: PlayerId | null;
  readonly target: PlayerId;
  readonly amount: number;
  readonly reason: string;
}
export interface DyingEvent extends Base {
  readonly type: 'dying';
  readonly target: PlayerId;
  readonly source: PlayerId | null;
}
export interface DeathEvent extends Base {
  readonly type: 'death';
  readonly target: PlayerId;
  readonly source: PlayerId | null;
}
export interface RevealGeneralEvent extends Base {
  readonly type: 'reveal-general';
  readonly player: PlayerId;
  readonly slot: 'main' | 'sub';
}
export interface DiscardCardEvent extends Base {
  readonly type: 'discard-card';
  readonly player: PlayerId;
  readonly cards: readonly CardId[];
  readonly reason: 'phase' | 'skill' | 'card';
}
export interface EnterPileEvent extends Base {
  readonly type: 'enter-pile';
  readonly cards: readonly CardId[];
  readonly pile: 'discard' | 'draw';
}

export type EventOf<T extends GameEvent['type']> = Extract<GameEvent, { type: T }>;
