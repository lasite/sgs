import type { GameState, Player } from '@sgs/core';
import { playerKingdom } from '@sgs/core';
import { GeneralSlot } from './GeneralSlot.js';

interface Props {
  state: GameState;
  player: Player;
  isCurrent: boolean;
  isSelf: boolean;
}

export function PlayerSeat({ state, player, isCurrent, isSelf }: Props): JSX.Element {
  const k = playerKingdom(player);
  return (
    <div
      className={`rounded-lg p-3 border ${
        isCurrent ? 'border-amber-300 shadow-lg shadow-amber-500/20' : 'border-slate-700'
      } ${player.alive ? 'bg-slate-800/80' : 'bg-slate-900/40 opacity-50'}`}
    >
      <div className="flex justify-between items-baseline mb-2">
        <div className="font-bold">
          {player.name} {isSelf && <span className="text-[10px] text-amber-300">(你)</span>}
        </div>
        <div className="text-xs text-slate-300">
          {player.hp}/{player.maxHp} HP · {k ?? (player.isAmbitionist ? '野心家' : '?')}
        </div>
      </div>
      <div className="flex gap-2 justify-center">
        <GeneralSlot slot={player.main} label="主" />
        <GeneralSlot slot={player.sub} label="副" />
      </div>
      <div className="mt-2 text-xs text-slate-300 flex justify-between">
        <span>手牌 {player.hand.length}</span>
        <span>装备 {Object.keys(player.equipment).length}</span>
        {player.judgeArea.length > 0 && <span>判定 {player.judgeArea.length}</span>}
      </div>
      {isSelf && player.hand.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 max-w-[18rem]">
          {player.hand.map((cid) => {
            const c = state.cards.get(cid);
            if (!c) return null;
            return (
              <div
                key={cid}
                className="w-12 h-16 rounded bg-amber-100 text-slate-900 text-xs flex flex-col items-center justify-center px-1 text-center"
                title={`${c.name} ${c.suit}-${c.rank}`}
              >
                <div className="font-bold text-[11px]">{c.name}</div>
                <div className="text-[9px] opacity-70">{c.suit}{c.rank}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
