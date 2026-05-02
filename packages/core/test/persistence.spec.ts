import { describe, it, expect } from 'vitest';
import {
  serialize,
  deserialize,
  buildStandardDeck,
  createGuozhanState,
} from '../src/index.js';
import type { GeneralId, PlayerId } from '../src/model/index.js';

const id = <T extends string>(s: string): T => s as unknown as T;

describe('snapshot round-trip', () => {
  it('serializes and restores state including cards map', () => {
    const original = createGuozhanState(
      [
        { id: id<PlayerId>('p1'), name: 'P1',
          main: id<GeneralId>('cao-cao'), sub: id<GeneralId>('zhang-liao') },
        { id: id<PlayerId>('p2'), name: 'P2',
          main: id<GeneralId>('liu-bei'), sub: id<GeneralId>('guan-yu') },
      ],
      buildStandardDeck(),
      42,
      4,
    );
    const json = serialize(original);
    const restored = deserialize(json);
    expect(restored.players).toHaveLength(2);
    expect(restored.players[0]!.hand).toHaveLength(4);
    expect(restored.cards.size).toBeGreaterThan(140);
    expect(restored.rng).toEqual(original.rng);
    expect(restored.turnNumber).toBe(original.turnNumber);
  });
});
