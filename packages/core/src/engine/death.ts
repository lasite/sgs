/**
 * Death-check trigger.
 *
 * After every damage resolution, if the target's HP has dropped to 0 or
 * below and they are still marked alive, emit a `mark-death` effect to
 * flip them out of play.
 *
 * 国战 ruleset proper: damage → 濒死状态 → 桃/酒 救援 chain → 死亡 if no
 * save.  For MVP we collapse 濒死 into immediate death since no save
 * handlers are wired into the standard play flow.  When 桃-rescue lands
 * we'll insert the dying-event step before mark-death.
 */

import type { Trigger, TriggerId, TriggerRegistry } from './triggers.js';
import type { PlayerId } from '../model/player.js';

export const registerDeathCheckTrigger = (registry: TriggerRegistry): void => {
  const trig: Trigger = {
    id: 'engine-death-check' as TriggerId,
    on: 'damage',
    owner: '' as PlayerId,
    mandatory: true,
    priority: -1000, // run after every other damage handler
    handler: (ctx) => {
      const ev = ctx.event;
      if (ev.type !== 'damage') return [];
      const target = ctx.state.players.find((p) => p.id === ev.target);
      if (!target) return [];
      if (!target.alive) return [];
      if (target.hp > 0) return [];
      return [{
        kind: 'mark-death',
        player: target.id,
        source: ev.source,
      }];
    },
  };
  registry.register(trig);
};
