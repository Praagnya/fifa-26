
import { useEffect, useState } from "react";
import type { Match } from "../types/match";
import { getFlagUrl } from "../data/flags";

interface Props {
  match: Match;
  onClose: () => void;
}

interface H2HStats {
  summary: {
    total_matches: number;
    team1_wins: number;
    team2_wins: number;
    draws: number;
  };
  history: any[];
  team1_recent: any[];
  team2_recent: any[];
}

export default function MatchDetailsModal({ match, onClose }: Props) {
  const [stats, setStats] = useState<H2HStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchH2H = async () => {
      try {
        const res = await fetch(
          `http://localhost:8000/api/v1/h2h/${encodeURIComponent(match.home_team)}/${encodeURIComponent(match.away_team)}`
        );
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Failed to fetch H2H:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchH2H();
  }, [match]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#13131a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-all cursor-pointer z-10"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
             <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header / Match Context */}
        <div className="p-6 pb-2 border-b border-white/5 bg-[#1a1a24]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40 font-['Oswald'] mb-1">
                Head-to-Head History
            </p>
            <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-3">
                     <img src={getFlagUrl(match.home_team)!} className="w-8 h-8 object-contain" alt={match.home_team} />
                     <span className="text-xl font-bold font-['Oswald'] uppercase text-white">{match.home_team}</span>
                </div>
                <span className="text-white/20 font-['Oswald'] italic text-sm">vs</span>
                <div className="flex items-center gap-3">
                     <span className="text-xl font-bold font-['Oswald'] uppercase text-white">{match.away_team}</span>
                     <img src={getFlagUrl(match.away_team)!} className="w-8 h-8 object-contain" alt={match.away_team} />
                </div>
            </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"/>
                    <p className="text-xs text-white/40 font-['Inter']">Searching archives...</p>
                </div>
            ) : stats ? (
                <div className="space-y-8">
                    {/* H2H SECTION: Summary OR First Time Meeting Message */}
                    {stats.summary.total_matches > 0 ? (
                        <>
                            {/* Summary Stats */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 text-center">
                                    <span className="block text-2xl font-bold text-indigo-400 font-['Oswald']">{stats.summary.team1_wins}</span>
                                    <span className="text-[10px] uppercase tracking-wide text-white/40 font-bold">{match.home_team} Wins</span>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                                    <span className="block text-2xl font-bold text-white/60 font-['Oswald']">{stats.summary.draws}</span>
                                    <span className="text-[10px] uppercase tracking-wide text-white/30 font-bold">Draws</span>
                                </div>
                                <div className="bg-pink-500/10 border border-pink-500/20 rounded-xl p-3 text-center">
                                    <span className="block text-2xl font-bold text-pink-400 font-['Oswald']">{stats.summary.team2_wins}</span>
                                    <span className="text-[10px] uppercase tracking-wide text-white/40 font-bold">{match.away_team} Wins</span>
                                </div>
                            </div>

                            {/* Historic Matches List */}
                            <div>
                                <h4 className="text-xs font-bold text-white/30 uppercase tracking-[0.2em] font-['Oswald'] mb-4">Previous Meetings</h4>
                                <div className="space-y-3">
                                    {stats.history.map((h, i) => {
                                        const isHomeLeft = h.home_team === match.home_team;
                                        const leftTeam = isHomeLeft ? h.home_team : h.away_team;
                                        const rightTeam = isHomeLeft ? h.away_team : h.home_team;
                                        const leftScore = isHomeLeft ? h.home_score : h.away_score;
                                        const rightScore = isHomeLeft ? h.away_score : h.home_score;
                                        const leftPen = isHomeLeft ? h.home_penalties : h.away_penalties;
                                        const rightPen = isHomeLeft ? h.away_penalties : h.home_penalties;

                                        return (
                                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                                            <div className="flex flex-col flex-1 mr-4">
                                                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest font-['Oswald']">
                                                    {h.year} • {h.stage}
                                                </span>
                                                <span className="text-xs text-white/30">
                                                    {h.stadium}, {h.city}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <div className="flex items-center gap-2 justify-end">
                                                        <span className={`text-sm font-bold font-['Oswald'] uppercase ${leftScore > rightScore ? 'text-indigo-400' : 'text-white/60'}`}>
                                                            {leftTeam}
                                                        </span>
                                                        <span className="text-lg font-bold text-white font-mono">{leftScore}</span>
                                                    </div>
                                                    {leftPen !== null && (
                                                        <span className="text-[10px] text-white/30 block">({leftPen} pens)</span>
                                                    )}
                                                </div>
                                                <span className="text-white/20">-</span>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-lg font-bold text-white font-mono">{rightScore}</span>
                                                        <span className={`text-sm font-bold font-['Oswald'] uppercase ${rightScore > leftScore ? 'text-pink-400' : 'text-white/60'}`}>
                                                            {rightTeam}
                                                        </span>
                                                    </div>
                                                    {rightPen !== null && (
                                                        <span className="text-[10px] text-white/30 block">({rightPen} pens)</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="py-8 text-center bg-white/5 rounded-xl border border-white/5">
                            <p className="text-4xl mb-4">⚽️</p>
                            <h3 className="text-lg font-bold text-white font-['Oswald'] uppercase tracking-wide">First Time Meeting</h3>
                            <p className="text-sm text-white/40 mt-2 max-w-xs mx-auto">
                                No previous World Cup matches found between {match.home_team} and {match.away_team}.
                            </p>
                        </div>
                    )}

                    {/* Recent Form / Guide (ALWAYS SHOW if data exists) */}
                    {(stats.team1_recent?.length > 0 || stats.team2_recent?.length > 0) && (
                        <div className="pt-6 border-t border-white/5">
                            <h4 className="text-xs font-bold text-white/30 uppercase tracking-[0.2em] font-['Oswald'] mb-4 text-center">
                                Recent World Cup Form
                            </h4>
                            <div className="grid grid-cols-2 gap-8">
                                {/* Home Team Form */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3 justify-center">
                                        <img src={getFlagUrl(match.home_team)!} className="w-4 h-4 object-contain" alt="" />
                                        <span className="text-[10px] font-bold text-white/60 font-['Oswald'] uppercase">{match.home_team}</span>
                                    </div>
                                    <div className="space-y-2">
                                        {stats.team1_recent.map((m, i) => (
                                            <div key={i} className="bg-white/5 rounded p-2 flex items-center justify-between">
                                                 <span className="text-[10px] text-white/40">{m.year}</span>
                                                 <div className="flex items-center gap-2">
                                                     <span className={`text-[10px] font-bold ${m.home_team === match.home_team && m.home_score > m.away_score || m.away_team === match.home_team && m.away_score > m.home_score ? 'text-green-400' : m.home_score === m.away_score ? 'text-white/40' : 'text-red-400'}`}>
                                                         {m.home_team === match.home_team ? (m.home_score > m.away_score ? 'W' : m.home_score === m.away_score ? 'D' : 'L') : (m.away_score > m.home_score ? 'W' : m.away_score === m.home_score ? 'D' : 'L')}
                                                     </span>
                                                     <span className="text-[10px] text-white/60">vs {m.home_team === match.home_team ? m.away_team : m.home_team}</span>
                                                 </div>
                                                 <span className="text-[10px] font-mono font-bold text-white/60">
                                                     {m.home_score}-{m.away_score}
                                                 </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Away Team Form */}
                                <div>
                                    <div className="flex items-center gap-2 mb-3 justify-center">
                                        <img src={getFlagUrl(match.away_team)!} className="w-4 h-4 object-contain" alt="" />
                                        <span className="text-[10px] font-bold text-white/60 font-['Oswald'] uppercase">{match.away_team}</span>
                                    </div>
                                    <div className="space-y-2">
                                        {stats.team2_recent.map((m, i) => (
                                            <div key={i} className="bg-white/5 rounded p-2 flex items-center justify-between">
                                                 <span className="text-[10px] text-white/40">{m.year}</span>
                                                 <div className="flex items-center gap-2">
                                                     <span className={`text-[10px] font-bold ${m.home_team === match.away_team && m.home_score > m.away_score || m.away_team === match.away_team && m.away_score > m.home_score ? 'text-green-400' : m.home_score === m.away_score ? 'text-white/40' : 'text-red-400'}`}>
                                                         {m.home_team === match.away_team ? (m.home_score > m.away_score ? 'W' : m.home_score === m.away_score ? 'D' : 'L') : (m.away_score > m.home_score ? 'W' : m.away_score === m.home_score ? 'D' : 'L')}
                                                     </span>
                                                     <span className="text-[10px] text-white/60">vs {m.home_team === match.away_team ? m.away_team : m.home_team}</span>
                                                 </div>
                                                 <span className="text-[10px] font-mono font-bold text-white/60">
                                                     {m.home_score}-{m.away_score}
                                                 </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="py-12 text-center">
                    <p className="text-4xl mb-4">❓</p>
                    <p className="text-sm text-white/40">Unable to load match data.</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}
