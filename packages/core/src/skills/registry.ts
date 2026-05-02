/**
 * Skill registry.
 *
 * A `SkillSetup` function is called when a player gains a skill (i.e.
 * either at game start for already-revealed skills, or on `reveal-general`
 * when a hidden skill activates).  It returns a list of `Trigger`s plus
 * a teardown handle so the engine can deregister them when the skill is
 * removed (rare — only on awaken-replace and certain edge cases).
 */

import type { PlayerId } from '../model/player.js';
import type { SkillId } from '../model/general.js';
import type { TriggerRegistry, Trigger } from '../engine/triggers.js';
import type { SkillMeta } from '../model/skill.js';

export interface SkillSetupContext {
  readonly owner: PlayerId;
  readonly registry: TriggerRegistry;
}

export interface SkillBundle {
  readonly meta: SkillMeta;
  /** Triggers registered for this skill instance.  Engine deregisters
   *  these by id when the skill is removed. */
  readonly triggers: readonly Trigger[];
}

export type SkillSetup = (ctx: SkillSetupContext) => SkillBundle;

export class SkillRegistry {
  private readonly bySkill = new Map<SkillId, SkillSetup>();

  register(id: SkillId, setup: SkillSetup): void {
    if (this.bySkill.has(id)) throw new Error(`duplicate skill ${id}`);
    this.bySkill.set(id, setup);
  }

  get(id: SkillId): SkillSetup | undefined {
    return this.bySkill.get(id);
  }

  require(id: SkillId): SkillSetup {
    const s = this.bySkill.get(id);
    if (!s) throw new Error(`unknown skill ${id}`);
    return s;
  }

  has(id: SkillId): boolean {
    return this.bySkill.has(id);
  }

  /** Apply every skill the owner has at construction time. */
  install(skills: readonly SkillId[], ctx: SkillSetupContext): SkillBundle[] {
    const out: SkillBundle[] = [];
    for (const id of skills) {
      const setup = this.bySkill.get(id);
      if (!setup) continue;
      const bundle = setup(ctx);
      for (const t of bundle.triggers) ctx.registry.register(t);
      out.push(bundle);
    }
    return out;
  }
}
