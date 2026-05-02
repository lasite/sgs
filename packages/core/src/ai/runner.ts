/**
 * AI runner — pumps a session forward by feeding pending decisions to
 * a `DecisionProvider`.
 *
 * Useful for self-play tests, tutorial setup, and as the seat-runner
 * for any AI player in mixed human/AI tables.  Returns when the queue
 * empties *and* no further pending decision exists.
 */

import type { Session } from '../engine/session.js';
import { drain, respond } from '../engine/session.js';
import type { DecisionProvider } from '../engine/decisions.js';

export interface RunOpts {
  /** Safety cap on iterations to prevent infinite loops. */
  readonly maxSteps?: number;
}

export const runUntilStable = (
  session: Session,
  provider: DecisionProvider,
  opts: RunOpts = {},
): void => {
  const cap = opts.maxSteps ?? 10000;
  let steps = 0;
  let pending = drain(session);
  while (pending && steps++ < cap) {
    const response = provider.decide(pending.request);
    pending = respond(session, response);
  }
  if (steps >= cap) {
    throw new Error(`runUntilStable: hit step cap ${cap}`);
  }
};
