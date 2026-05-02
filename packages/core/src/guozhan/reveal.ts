/**
 * 亮将 (reveal-general) orchestration.
 *
 * Reveal sequence:
 *  1. If the slot is already revealed, no-op.
 *  2. If the general is double-faction (阴阳鱼), prompt for kingdom choice
 *     (set-kingdom-choice → reveal-general).  Otherwise emit reveal directly.
 *  3. After every reveal, a registry-level mandatory bookkeeping trigger
 *     fires 珠联璧合 bonus and 野心家 promotion when both slots are now up.
 */

import type { Effect } from '../engine/effects.js';
import type { Player, PlayerId } from '../model/player.js';
import type { GameState } from '../model/state.js';
import type { General } from '../model/general.js';
import type { Trigger, TriggerId, TriggerRegistry } from '../engine/triggers.js';
import { ALL_GENERALS } from '../data/generals.js';
import { newDecisionId } from '../cards/helpers.js';
import { playerKingdom } from './kingdom.js';

const generalById = (id: string): General => {
  const g = ALL_GENERALS.find((x) => x.id === id);
  if (!g) throw new Error(`unknown general ${id}`);
  return g;
};

export const buildRevealEffects = (
  state: GameState,
  player: PlayerId,
  slot: 'main' | 'sub',
): readonly Effect[] => {
  const p = state.players.find((x) => x.id === player);
  if (!p) throw new Error(`unknown player ${player}`);
  const slotInfo = slot === 'main' ? p.main : p.sub;
  if (slotInfo.revealed) return [];
  const g = generalById(slotInfo.general);
  if (g.kingdoms.length === 1) {
    return [{ kind: 'reveal-general', player, slot }];
  }
  return [{
    kind: 'request',
    request: {
      id: newDecisionId(),
      kind: 'choose-kingdom',
      player,
      prompt: `亮将「${g.name}」：选择本将势力`,
      options: g.kingdoms,
    },
    resume: (resp) => {
      if (resp.kind !== 'choose-kingdom') return [];
      return [
        { kind: 'set-kingdom-choice', player, slot, kingdom: resp.kingdom },
        { kind: 'reveal-general', player, slot },
      ];
    },
  }];
};

const arePair = (a: General, b: General): boolean => {
  const set = new Set([...(a.companion ?? []), ...(b.companion ?? [])]);
  return set.has(a.id) || set.has(b.id);
};

const companionPairBonus = (player: Player): readonly Effect[] => {
  if (!player.main.revealed || !player.sub.revealed) return [];
  const main = generalById(player.main.general);
  const sub = generalById(player.sub.general);
  if (!arePair(main, sub)) return [];
  return [
    { kind: 'set-flag', player: player.id, flag: '__companion-bonus', value: true },
    { kind: 'set-max-hp', player: player.id, delta: 1 },
    { kind: 'heal', source: null, target: player.id, amount: 1, reason: '珠联璧合' },
    { kind: 'draw-cards', player: player.id, count: 1, reason: 'skill' },
  ];
};

const ambitionistPromotion = (player: Player): readonly Effect[] => {
  if (!player.main.revealed || !player.sub.revealed) return [];
  if (player.isAmbitionist) return [];
  const k = playerKingdom(player);
  if (k !== null) return [];
  return [{ kind: 'set-ambitionist', player: player.id, value: true }];
};

export const registerGuozhanTriggers = (registry: TriggerRegistry): void => {
  const bookkeeping: Trigger = {
    id: 'guozhan-reveal-bookkeeping' as TriggerId,
    on: 'reveal-general',
    owner: '' as PlayerId,
    mandatory: true,
    priority: 1000,
    handler: (ctx) => {
      const ev = ctx.event;
      if (ev.type !== 'reveal-general') return [];
      const player = ctx.state.players.find((p) => p.id === ev.player);
      if (!player) return [];
      if (!(player.main.revealed && player.sub.revealed)) return [];
      const out: Effect[] = [];
      out.push(...companionPairBonus(player));
      out.push(...ambitionistPromotion(player));
      return out;
    },
  };
  registry.register(bookkeeping);
};
