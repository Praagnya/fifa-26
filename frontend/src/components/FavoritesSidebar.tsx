import type { Match } from "../types/match";
import { getFlagUrl, displayName } from "../data/flags";
import { toDateKey, formatTime, formatMonth } from "../lib/dateUtils";


interface Props {
  open: boolean;
  onToggle: () => void;
  favorites: string[];
  matches: Match[];
  onRemoveFavorite: (team: string) => void;
  onSelectMatch: (match: Match) => void;
  embedded?: boolean;
}

export default function FavoritesSidebar({
  open,
  onToggle,
  favorites,
  matches,
  onRemoveFavorite,
  onSelectMatch,
  embedded = false,
}: Props) {
  const favoriteMatches = (team: string) =>
    matches
      .filter((m) => m.home_team === team || m.away_team === team)
      .sort(
        (a, b) =>
          new Date(a.kickoff_utc).getTime() - new Date(b.kickoff_utc).getTime()
      )
      .slice(0, 5);

  if (embedded) {
    return (
      <div className="h-full">
         {favorites.length === 0 && (
          <div className="px-5 py-8 text-center">
            <p className="text-xs text-white/20">No favorite teams yet</p>
          </div>
        )}

        <div className="px-3 pb-8 space-y-4 pt-4">
          {favorites.map((team) => {
            const flag = getFlagUrl(team);
            const upcoming = favoriteMatches(team);
            return (
              <div key={team} className="rounded-xl bg-[#15151e] border border-white/5 overflow-hidden group/team shadow-lg hover:border-indigo-500/30 transition-colors duration-300">
                {/* team header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] border-b border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-[#2a2a35] flex items-center justify-center overflow-hidden shrink-0 border border-white/10 shadow-inner">
                    {flag ? (
                      <img src={flag} alt={team} className="w-5 object-contain" />
                    ) : (
                      <span className="text-[10px] font-bold text-white/30">?</span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-white font-['Oswald'] uppercase tracking-wide flex-1 drop-shadow-sm">
                    {displayName(team)}
                  </span>
                  <button
                    onClick={() => onRemoveFavorite(team)}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-white/5 text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer opacity-0 group-hover/team:opacity-100"
                    title="Remove"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* upcoming matches */}
                <div className="divide-y divide-white/5">
                  {upcoming.length === 0 && (
                    <p className="text-[11px] text-white/20 px-4 py-3 italic">No upcoming matches</p>
                  )}
                  {upcoming.map((m) => {
                    const dateKey = toDateKey(m.kickoff_utc);
                    return (
                      <div 
                        key={m.match_id} 
                        className="px-4 py-3 hover:bg-gradient-to-r hover:from-indigo-500/10 hover:to-transparent transition-all cursor-pointer group/match relative border-l-2 border-transparent hover:border-indigo-400"
                        onClick={() => onSelectMatch(m)}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-indigo-400 font-mono bg-indigo-500/10 px-1.5 py-0.5 rounded">
                                    {formatMonth(dateKey)} {new Date(m.kickoff_utc).toLocaleDateString('en-US', { day: 'numeric' })}
                                </span>
                                <span className="text-[10px] text-white/40 font-mono">
                                    {formatTime(m.kickoff_utc)}
                                </span>
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <span className={`text-xs font-medium ${m.home_team === team ? "text-white font-bold" : "text-white/60"}`}>
                                    {displayName(m.home_team)}
                                </span>
                                <span className="text-[10px] text-white/20 font-mono">VS</span>
                                <span className={`text-xs font-medium ${m.away_team === team ? "text-white font-bold" : "text-white/60"}`}>
                                    {displayName(m.away_team)}
                                </span>
                            </div>
                        </div>
                        
                        <div className="mt-2 flex items-center gap-1.5 opacity-60 group-hover/match:opacity-100 transition-opacity">
                            <svg className="w-3 h-3 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="text-[10px] text-white/40 truncate max-w-[180px]">
                                {m.stadium}
                            </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* toggle button — always visible */}
      <button
        onClick={onToggle}
        className="fixed top-4 left-0 z-40 w-8 h-12 bg-[#1a1a24] border border-white/10 border-l-0 rounded-r-lg flex items-center justify-center hover:bg-white/5 transition-all cursor-pointer"
        style={{ transform: open ? "translateX(320px)" : "translateX(0)" }}
      >
        <svg
          className="w-4 h-4 text-white/50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d={open ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"}
          />
        </svg>
      </button>

      {/* sidebar panel */}
      <aside
        className={`fixed top-0 left-0 z-30 h-full w-80 bg-[#111118] border-r border-white/5 overflow-y-auto transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-5 pt-6">
          <p className="text-[10px] font-semibold tracking-[0.25em] text-white/30 uppercase font-['Oswald']">
            My Teams
          </p>
        </div>

        {favorites.length === 0 && (
          <div className="px-5 py-8 text-center">
            <p className="text-xs text-white/20">No favorite teams yet</p>
          </div>
        )}

        <div className="px-3 pb-8 space-y-4">
          {favorites.map((team) => {
            const flag = getFlagUrl(team);
            const upcoming = favoriteMatches(team);
            return (
              <div key={team} className="rounded-xl bg-[#15151e] border border-white/5 overflow-hidden group/team shadow-lg hover:border-indigo-500/30 transition-colors duration-300">
                {/* team header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] border-b border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-[#2a2a35] flex items-center justify-center overflow-hidden shrink-0 border border-white/10 shadow-inner">
                    {flag ? (
                      <img src={flag} alt={team} className="w-5 object-contain" />
                    ) : (
                      <span className="text-[10px] font-bold text-white/30">?</span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-white font-['Oswald'] uppercase tracking-wide flex-1 drop-shadow-sm">
                    {displayName(team)}
                  </span>
                  <button
                    onClick={() => onRemoveFavorite(team)}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-white/5 text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer opacity-0 group-hover/team:opacity-100"
                    title="Remove"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* upcoming matches */}
                <div className="divide-y divide-white/5">
                  {upcoming.length === 0 && (
                    <p className="text-[11px] text-white/20 px-4 py-3 italic">No upcoming matches</p>
                  )}
                  {upcoming.map((m) => {
                    const dateKey = toDateKey(m.kickoff_utc);
                    return (
                      <div 
                        key={m.match_id} 
                        className="px-4 py-3 hover:bg-gradient-to-r hover:from-indigo-500/10 hover:to-transparent transition-all cursor-pointer group/match relative border-l-2 border-transparent hover:border-indigo-400"
                        onClick={() => onSelectMatch(m)}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-indigo-400 font-mono bg-indigo-500/10 px-1.5 py-0.5 rounded">
                                    {formatMonth(dateKey)} {new Date(m.kickoff_utc).toLocaleDateString('en-US', { day: 'numeric' })}
                                </span>
                                <span className="text-[10px] text-white/40 font-mono">
                                    {formatTime(m.kickoff_utc)}
                                </span>
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                                <span className={`text-xs font-medium ${m.home_team === team ? "text-white font-bold" : "text-white/60"}`}>
                                    {displayName(m.home_team)}
                                </span>
                                <span className="text-[10px] text-white/20 font-mono">VS</span>
                                <span className={`text-xs font-medium ${m.away_team === team ? "text-white font-bold" : "text-white/60"}`}>
                                    {displayName(m.away_team)}
                                </span>
                            </div>
                        </div>
                        
                        <div className="mt-2 flex items-center gap-1.5 opacity-60 group-hover/match:opacity-100 transition-opacity">
                            <svg className="w-3 h-3 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="text-[10px] text-white/40 truncate max-w-[180px]">
                                {m.stadium}
                            </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}
