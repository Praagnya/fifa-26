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
}

export default function FavoritesSidebar({
  open,
  onToggle,
  favorites,
  matches,
  onRemoveFavorite,
  onSelectMatch,
}: Props) {
  const favoriteMatches = (team: string) =>
    matches
      .filter((m) => m.home_team === team || m.away_team === team)
      .sort(
        (a, b) =>
          new Date(a.kickoff_utc).getTime() - new Date(b.kickoff_utc).getTime()
      )
      .slice(0, 5);

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
              <div key={team} className="rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden">
                {/* team header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden shrink-0">
                    {flag ? (
                      <img src={flag} alt={team} className="w-5 object-contain" />
                    ) : (
                      <span className="text-[10px] font-bold text-white/30">?</span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-white font-['Oswald'] uppercase tracking-wide flex-1">
                    {displayName(team)}
                  </span>
                  <button
                    onClick={() => onRemoveFavorite(team)}
                    className="text-white/20 hover:text-red-400 transition-colors cursor-pointer"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* upcoming matches */}
                <div className="divide-y divide-white/5">
                  {upcoming.length === 0 && (
                    <p className="text-[11px] text-white/20 px-4 py-3">No matches found</p>
                  )}
                  {upcoming.map((m) => {
                    const dateKey = toDateKey(m.kickoff_utc);
                    return (
                      <div 
                        key={m.match_id} 
                        className="px-4 py-2.5 hover:bg-white/5 transition-colors cursor-pointer"
                        onClick={() => onSelectMatch(m)}
                      >
                        <p className="text-[10px] text-white/25 font-mono mb-1">
                          {formatMonth(dateKey)} {new Date(m.kickoff_utc).toLocaleDateString('en-US', { 
                            day: 'numeric'
                          })} &middot;{" "}
                          {formatTime(m.kickoff_utc)}
                        </p>
                        <p className="text-xs text-white/60 font-medium">
                          {displayName(m.home_team)} vs {displayName(m.away_team)}
                        </p>
                        <p className="text-[10px] text-white/20 mt-0.5">
                          {m.stadium}
                        </p>
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
