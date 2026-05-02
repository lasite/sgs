interface Props {
  log: readonly string[];
}

export function EventLog({ log }: Props): JSX.Element {
  return (
    <div className="rounded-lg bg-slate-900/80 border border-slate-700 p-3 max-h-48 overflow-auto text-xs">
      <div className="text-slate-400 mb-1">事件日志</div>
      {log.length === 0 && <div className="text-slate-500 italic">空</div>}
      <ul className="space-y-0.5 text-slate-200">
        {log.map((line, i) => (
          <li key={i}>· {line}</li>
        ))}
      </ul>
    </div>
  );
}
