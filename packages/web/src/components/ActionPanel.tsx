import { useState } from 'react';
import type { GameState, Player, PendingDecision, CardId, PlayerId } from '@sgs/core';
import { useGame } from '../store/game.js';

interface Props {
  state: GameState;
  pending: PendingDecision | null;
  human: Player;
}

export function ActionPanel({ state, pending, human }: Props): JSX.Element {
  const reveal = useGame((s) => s.reveal);
  const playHand = useGame((s) => s.playHand);
  const endTurn = useGame((s) => s.endTurn);
  const respond = useGame((s) => s.respond);

  const [selectedCard, setSelectedCard] = useState<CardId | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<PlayerId[]>([]);

  const hand = human.hand;
  const enemies = state.players.filter((p) => p.id !== human.id && p.alive);

  if (pending) {
    return <PendingPrompt pending={pending} state={state} respond={respond} human={human} />;
  }

  const canRevealMain = !human.main.revealed;
  const canRevealSub = !human.sub.revealed;

  const onPlay = () => {
    if (!selectedCard) return;
    playHand(selectedCard, selectedTargets);
    setSelectedCard(null);
    setSelectedTargets([]);
  };

  return (
    <div className="rounded-lg bg-slate-900/80 border border-slate-700 p-4 space-y-3">
      <div className="text-sm text-slate-300">
        阶段: <span className="text-amber-300">{state.phase}</span> ·
        回合: <span className="text-amber-300">{state.turnNumber}</span>
      </div>

      <div className="flex gap-2">
        {canRevealMain && (
          <button
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded"
            onClick={() => reveal('main')}
          >
            亮主将
          </button>
        )}
        {canRevealSub && (
          <button
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm rounded"
            onClick={() => reveal('sub')}
          >
            亮副将
          </button>
        )}
        <button
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded"
          onClick={endTurn}
        >
          结束回合
        </button>
      </div>

      <div>
        <div className="text-xs text-slate-400 mb-1">选择手牌</div>
        <div className="flex flex-wrap gap-1">
          {hand.map((cid) => {
            const c = state.cards.get(cid);
            if (!c) return null;
            const sel = selectedCard === cid;
            return (
              <button
                key={cid}
                className={`w-12 h-16 rounded text-xs flex flex-col items-center justify-center text-slate-900 ${
                  sel ? 'bg-amber-300 ring-2 ring-amber-500' : 'bg-amber-100 hover:bg-amber-200'
                }`}
                onClick={() => setSelectedCard(sel ? null : cid)}
              >
                <span className="font-bold">{c.name}</span>
                <span className="text-[9px] opacity-70">{c.suit}{c.rank}</span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedCard && (
        <div>
          <div className="text-xs text-slate-400 mb-1">选择目标 (可空)</div>
          <div className="flex gap-2">
            {enemies.map((p) => {
              const sel = selectedTargets.includes(p.id);
              return (
                <button
                  key={p.id}
                  className={`px-2 py-1 text-xs rounded ${
                    sel ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-200'
                  }`}
                  onClick={() => {
                    setSelectedTargets((prev) =>
                      sel ? prev.filter((x) => x !== p.id) : [...prev, p.id],
                    );
                  }}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
          <button
            className="mt-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded"
            onClick={onPlay}
          >
            出牌
          </button>
        </div>
      )}
    </div>
  );
}

function PendingPrompt({
  pending, state, respond, human,
}: {
  pending: PendingDecision;
  state: GameState;
  respond: (r: any) => void;
  human: Player;
}): JSX.Element {
  const req = pending.request;
  return (
    <div className="rounded-lg bg-amber-950/40 border border-amber-500/40 p-4 space-y-3">
      <div className="text-sm font-bold text-amber-200">{req.prompt}</div>

      {req.kind === 'trigger-opt-in' && (
        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded"
            onClick={() => respond({ id: req.id, kind: 'trigger-opt-in', accept: true })}
          >
            发动
          </button>
          <button
            className="px-3 py-1.5 bg-slate-700 text-white text-sm rounded"
            onClick={() => respond({ id: req.id, kind: 'trigger-opt-in', accept: false })}
          >
            取消
          </button>
        </div>
      )}

      {req.kind === 'respond-card' && (
        <div className="space-y-2">
          <div className="text-xs text-slate-300">可用：{req.accepts.join(' / ')}</div>
          <div className="flex flex-wrap gap-1">
            {human.hand.map((cid) => {
              const c = state.cards.get(cid);
              if (!c) return null;
              const ok = req.accepts.includes(c.name);
              return (
                <button
                  key={cid}
                  disabled={!ok}
                  className={`w-12 h-16 rounded text-xs ${ok ? 'bg-emerald-200 hover:bg-emerald-300' : 'bg-slate-700 opacity-50'} text-slate-900`}
                  onClick={() => respond({ id: req.id, kind: 'respond-card', card: cid })}
                >
                  <div className="font-bold">{c.name}</div>
                  <div className="text-[9px] opacity-70">{c.suit}{c.rank}</div>
                </button>
              );
            })}
          </div>
          <button
            className="px-3 py-1.5 bg-slate-700 text-white text-sm rounded"
            onClick={() => respond({ id: req.id, kind: 'respond-card', card: null })}
          >
            放弃
          </button>
        </div>
      )}

      {req.kind === 'choose-kingdom' && (
        <div className="flex gap-2">
          {req.options.map((k: string) => (
            <button
              key={k}
              className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded uppercase"
              onClick={() => respond({ id: req.id, kind: 'choose-kingdom', kingdom: k })}
            >
              {k}
            </button>
          ))}
        </div>
      )}

      {req.kind === 'choose-cards' && (
        <ChooseCardsControls
          req={req}
          state={state}
          onSubmit={(cards) => respond({ id: req.id, kind: 'choose-cards', cards })}
        />
      )}

      {req.kind === 'choose-targets' && (
        <div className="flex gap-2">
          {req.candidates.map((tid: string) => (
            <button
              key={tid}
              className="px-3 py-1.5 bg-red-600 text-white text-sm rounded"
              onClick={() => respond({ id: req.id, kind: 'choose-targets', targets: [tid] })}
            >
              {state.players.find((p) => p.id === tid)?.name ?? tid}
            </button>
          ))}
        </div>
      )}

      {req.kind === 'reveal-general' && (
        <div className="flex gap-2">
          {req.slots.map((s: 'main' | 'sub') => (
            <button
              key={s}
              className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded"
              onClick={() => respond({ id: req.id, kind: 'reveal-general', slot: s })}
            >
              亮{s === 'main' ? '主' : '副'}将
            </button>
          ))}
          <button
            className="px-3 py-1.5 bg-slate-700 text-white text-sm rounded"
            onClick={() => respond({ id: req.id, kind: 'reveal-general', slot: null })}
          >
            不亮
          </button>
        </div>
      )}

      {req.kind === 'yes-no' && (
        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded"
            onClick={() => respond({ id: req.id, kind: 'yes-no', value: true })}
          >
            是
          </button>
          <button
            className="px-3 py-1.5 bg-slate-700 text-white text-sm rounded"
            onClick={() => respond({ id: req.id, kind: 'yes-no', value: false })}
          >
            否
          </button>
        </div>
      )}
    </div>
  );
}

function ChooseCardsControls({
  req, state, onSubmit,
}: {
  req: any; state: GameState;
  onSubmit: (cards: any[]) => void;
}): JSX.Element {
  const [picked, setPicked] = useState<string[]>([]);
  const pool = req.pool ?? [];
  const min = req.min ?? 0;
  const max = req.max ?? pool.length;

  return (
    <div className="space-y-2">
      <div className="text-xs text-slate-300">选 {min}-{max} 张</div>
      <div className="flex flex-wrap gap-1">
        {pool.map((cid: string) => {
          const c = state.cards.get(cid as any);
          if (!c) return <div key={cid} className="w-12 h-16 bg-slate-700 rounded">?</div>;
          const sel = picked.includes(cid);
          return (
            <button
              key={cid}
              className={`w-12 h-16 rounded text-xs ${sel ? 'bg-amber-300 ring-2 ring-amber-500' : 'bg-amber-100 hover:bg-amber-200'} text-slate-900`}
              onClick={() => {
                setPicked((prev) => sel ? prev.filter((x) => x !== cid) : [...prev, cid]);
              }}
            >
              <div className="font-bold">{c.name}</div>
              <div className="text-[9px] opacity-70">{c.suit}{c.rank}</div>
            </button>
          );
        })}
      </div>
      <button
        disabled={picked.length < min || picked.length > max}
        className="px-3 py-1.5 bg-emerald-600 disabled:bg-slate-700 text-white text-sm rounded"
        onClick={() => { onSubmit(picked); setPicked([]); }}
      >
        提交
      </button>
    </div>
  );
}
