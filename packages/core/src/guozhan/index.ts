export * from './kingdom.js';
export * from './reveal.js';
export * from './victory.js';
export * from './setup.js';
export * from './first-turn.js';

import type { TriggerRegistry } from '../engine/triggers.js';
import { registerGuozhanTriggers } from './reveal.js';
import { registerVictoryTrigger } from './victory.js';
import { registerFirstTurnTrigger } from './first-turn.js';
import { registerHandLimitTrigger } from '../engine/turns.js';

/** Convenience: wire all Guozhan-level engine triggers in one shot. */
export const installGuozhanRules = (registry: TriggerRegistry): void => {
  registerGuozhanTriggers(registry);
  registerVictoryTrigger(registry);
  registerFirstTurnTrigger(registry);
  registerHandLimitTrigger(registry);
};
