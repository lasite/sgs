import type { GeneralSlot as Slot } from '@sgs/core';
import { ALL_GENERALS } from '@sgs/core';

const generalById = (gid: string) =>
  ALL_GENERALS.find((g) => (g.id as unknown as string) === gid);

const KINGDOM_BG: Record<string, string> = {
  wei: 'bg-wei',
  shu: 'bg-shu',
  wu: 'bg-wu',
  qun: 'bg-qun',
};

interface Props {
  slot: Slot;
  label: '主' | '副';
}

export function GeneralSlot({ slot, label }: Props): JSX.Element {
  const general = generalById(slot.general as unknown as string);
  if (!general) {
    return (
      <div className="w-20 h-28 rounded-md bg-slate-700 flex items-center justify-center text-xs">
        ?
      </div>
    );
  }

  if (!slot.revealed) {
    return (
      <div className="w-20 h-28 rounded-md bg-slate-600 border-2 border-dashed border-slate-400 flex flex-col items-center justify-center text-xs text-slate-300">
        <div className="text-[10px] opacity-70">{label}将</div>
        <div className="mt-1">暗置</div>
      </div>
    );
  }

  const k = slot.kingdomChoice ?? general.kingdoms[0];
  return (
    <div
      className={`w-20 h-28 rounded-md ${KINGDOM_BG[k] ?? 'bg-slate-500'} border-2 border-amber-300 flex flex-col items-center justify-between p-1`}
    >
      <div className="text-[10px] text-white/90 font-bold">{label}将</div>
      <div className="text-base font-extrabold text-white drop-shadow">{general.name}</div>
      <div className="flex gap-1 items-center text-[10px] text-white/80">
        <span>{k.toUpperCase()}</span>
        <span>·</span>
        <span>{general.hp}HP</span>
      </div>
    </div>
  );
}
