import { useState } from "react";
import { ALL_TEAM_NAMES, getFlagUrl } from "../data/flags";

interface Props {
  onDone: (teams: string[]) => void;
}

export default function TeamPicker({ onDone }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (team: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(team)) next.delete(team);
      else next.add(team);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0f]/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#13131a] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        {/* header */}
        <div className="p-6 border-b border-white/5">
          <h2 className="text-xl font-extrabold text-white uppercase tracking-wide font-['Oswald']">
            Pick Your Teams
          </h2>
          <p className="text-xs text-white/40 mt-1">
            Select your favorite teams to follow their matches
          </p>
        </div>

        {/* grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-3 sm:grid-cols-4 gap-3">
          {ALL_TEAM_NAMES.map((team) => {
            const active = selected.has(team);
            const flag = getFlagUrl(team);
            return (
              <button
                key={team}
                onClick={() => toggle(team)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all cursor-pointer ${
                  active
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-white/5 bg-white/[0.02] hover:border-white/10"
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden">
                  {flag ? (
                    <img src={flag} alt={team} className="w-7 object-contain" />
                  ) : (
                    <span className="text-xs font-bold text-white/30">?</span>
                  )}
                </div>
                <span className="text-[11px] font-semibold text-white/70 text-center leading-tight font-['Oswald'] uppercase tracking-wider">
                  {team}
                </span>
              </button>
            );
          })}
        </div>

        {/* footer */}
        <div className="p-6 border-t border-white/5 flex items-center justify-between">
          <p className="text-xs text-white/30">
            {selected.size} team{selected.size !== 1 && "s"} selected
          </p>
          <button
            disabled={selected.size === 0}
            onClick={() => onDone([...selected])}
            className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold uppercase tracking-wider font-['Oswald'] hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-default transition-all cursor-pointer"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
