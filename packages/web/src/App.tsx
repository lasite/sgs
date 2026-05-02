import { useGame } from './store/game.js';
import { PlayerSeat } from './components/PlayerSeat.js';
import { ActionPanel } from './components/ActionPanel.js';
import { EventLog } from './components/EventLog.js';

export function App(): JSX.Element {
  const state = useGame((s) => s.state);
  const pending = useGame((s) => s.pending);
  const humanId = useGame((s) => s.humanId);
  const log = useGame((s) => s.log);
  const start = useGame((s) => s.start);

  if (!state || !humanId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h1 className="text-3xl font-bold">三国杀·国战</h1>
        <p className="text-slate-400 text-sm">3 人对局：你 + 2 AI</p>
        <button
          onClick={start}
          className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded"
        >
          开始对局
        </button>
      </div>
    );
  }

  const human = state.players.find((p) => p.id === humanId)!;
  const others = state.players.filter((p) => p.id !== humanId);

  if (state.victory.ended) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <h1 className="text-3xl font-bold text-amber-300">对局结束</h1>
        <p className="text-slate-200">
          胜者: {state.victory.winners?.map((id) =>
            state.players.find((p) => p.id === id)?.name).join(', ')}
        </p>
        <p className="text-slate-400 text-sm">{state.victory.reason}</p>
        <button
          onClick={start}
          className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded"
        >
          再来一局
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-6xl mx-auto space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">三国杀·国战</h1>
        <div className="text-xs text-slate-400">
          回合 {state.turnNumber} · 阶段 {state.phase} · 牌堆 {state.drawPile.length}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3">
        {others.map((p) => (
          <PlayerSeat
            key={p.id}
            state={state}
            player={p}
            isCurrent={state.players[state.currentPlayerSeat]?.id === p.id}
            isSelf={false}
          />
        ))}
      </section>

      <section>
        <PlayerSeat
          state={state}
          player={human}
          isCurrent={state.players[state.currentPlayerSeat]?.id === human.id}
          isSelf
        />
      </section>

      <section className="grid md:grid-cols-2 gap-3">
        <ActionPanel state={state} pending={pending} human={human} />
        <EventLog log={log} />
      </section>
    </div>
  );
}
