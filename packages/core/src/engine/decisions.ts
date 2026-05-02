/**
 * Player decisions.
 *
 * The engine never blocks on I/O; instead, when it needs a choice from a
 * player, it suspends with a `DecisionRequest`.  A `DecisionProvider`
 * (the AI in MVP, the UI later) returns the matching `DecisionResponse`
 * and the engine resumes.
 *
 * This split keeps the engine itself pure & synchronous and makes
 * scripted tests trivial — drive the engine with a list of canned
 * decisions.
 */

import type { CardId } from '../model/card.js';
import type { PlayerId } from '../model/player.js';
import type { TriggerId } from './triggers.js';

export type DecisionId = string & { readonly __brand: 'DecisionId' };

/** Discriminator for the kind of input expected. */
export type DecisionRequest =
  | TriggerOptInRequest
  | ChooseTriggerOrderRequest
  | RespondCardRequest
  | ChooseTargetsRequest
  | ChooseCardsRequest
  | RevealGeneralRequest
  | ChooseKingdomRequest
  | YesNoRequest;

export interface RequestBase {
  readonly id: DecisionId;
  readonly player: PlayerId;
  readonly prompt: string;
}

/** Ask a player whether to fire an optional triggered skill. */
export interface TriggerOptInRequest extends RequestBase {
  readonly kind: 'trigger-opt-in';
  readonly trigger: TriggerId;
  readonly skill: string;
}

/** When several triggers share priority, owner picks the order. */
export interface ChooseTriggerOrderRequest extends RequestBase {
  readonly kind: 'trigger-order';
  readonly triggers: readonly TriggerId[];
}

/** Card response (e.g. play 闪 against a 杀, 无懈 against a trick). */
export interface RespondCardRequest extends RequestBase {
  readonly kind: 'respond-card';
  /** Allowed card names (e.g. ['闪']). */
  readonly accepts: readonly string[];
  /** What this response is replying to (free-form context). */
  readonly context?: string;
}

export interface ChooseTargetsRequest extends RequestBase {
  readonly kind: 'choose-targets';
  readonly card: CardId;
  readonly minTargets: number;
  readonly maxTargets: number;
  readonly candidates: readonly PlayerId[];
}

export interface ChooseCardsRequest extends RequestBase {
  readonly kind: 'choose-cards';
  readonly from: 'hand' | 'equipment' | 'judge' | 'pool';
  readonly target?: PlayerId;
  readonly pool?: readonly CardId[];
  readonly min: number;
  readonly max: number;
}

export interface RevealGeneralRequest extends RequestBase {
  readonly kind: 'reveal-general';
  readonly slots: readonly ('main' | 'sub')[];
}

export interface ChooseKingdomRequest extends RequestBase {
  readonly kind: 'choose-kingdom';
  readonly options: readonly ('wei' | 'shu' | 'wu' | 'qun')[];
}

export interface YesNoRequest extends RequestBase {
  readonly kind: 'yes-no';
}

/** Responses are paired with requests by `id`. */
export type DecisionResponse =
  | TriggerOptInResponse
  | ChooseTriggerOrderResponse
  | RespondCardResponse
  | ChooseTargetsResponse
  | ChooseCardsResponse
  | RevealGeneralResponse
  | ChooseKingdomResponse
  | YesNoResponse;

export interface ResponseBase {
  readonly id: DecisionId;
}

export interface TriggerOptInResponse extends ResponseBase {
  readonly kind: 'trigger-opt-in';
  readonly accept: boolean;
}
export interface ChooseTriggerOrderResponse extends ResponseBase {
  readonly kind: 'trigger-order';
  readonly order: readonly TriggerId[];
}
export interface RespondCardResponse extends ResponseBase {
  readonly kind: 'respond-card';
  readonly card: CardId | null; // null = decline
}
export interface ChooseTargetsResponse extends ResponseBase {
  readonly kind: 'choose-targets';
  readonly targets: readonly PlayerId[];
}
export interface ChooseCardsResponse extends ResponseBase {
  readonly kind: 'choose-cards';
  readonly cards: readonly CardId[];
}
export interface RevealGeneralResponse extends ResponseBase {
  readonly kind: 'reveal-general';
  readonly slot: 'main' | 'sub' | null; // null = skip
}
export interface ChooseKingdomResponse extends ResponseBase {
  readonly kind: 'choose-kingdom';
  readonly kingdom: 'wei' | 'shu' | 'wu' | 'qun';
}
export interface YesNoResponse extends ResponseBase {
  readonly kind: 'yes-no';
  readonly value: boolean;
}

/** A decision provider supplies responses for a player's requests. */
export interface DecisionProvider {
  decide(request: DecisionRequest): DecisionResponse;
}
