import { useEffect, useMemo, useState } from "react";
import { getFlagUrl } from "../data/flags";
import { toDateKey, formatDayLabel, formatTime, formatMonth } from "../lib/dateUtils";
import { useLayoutContext } from "../components/MainLayout";
import { useAuth } from "../context/AuthContext";
import type { Match } from "../types/match";
import MatchDetailsModal from "../components/MatchDetailsModal";


function displayName(team: string): string {
  return getFlagUrl(team) ? team : "TBD";
}

/* ── component ───────────────────────────────────────────── */

function Matches() {
  const { matches, loading, openPicker } = useLayoutContext();
  const { user, signInWithGoogle, signOut } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const dates = useMemo(() => {
    const set = new Set(matches.map((m) => toDateKey(m.kickoff_utc)));
    return [...set].sort();
  }, [matches]);

  useEffect(() => {
    if (dates.length && !selectedDate) setSelectedDate(dates[0]);
  }, [dates, selectedDate]);

  // auto-scroll when selected date changes
  useEffect(() => {
    if (selectedDate) {
      const el = document.getElementById(`date-${selectedDate}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [selectedDate]);

  const dayMatches = matches
    .filter((m) => toDateKey(m.kickoff_utc) === selectedDate)
    .sort(
      (a, b) =>
        new Date(a.kickoff_utc).getTime() - new Date(b.kickoff_utc).getTime()
    );

  const currentIdx = dates.indexOf(selectedDate);
  const goPrev = () =>
    currentIdx > 0 && setSelectedDate(dates[currentIdx - 1]);
  const goNext = () =>
    currentIdx < dates.length - 1 && setSelectedDate(dates[currentIdx + 1]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 rounded-full border-2 border-white/40 border-t-transparent animate-spin" />
          <p className="text-sm text-white/40 font-['Inter']">
            Loading matches...
          </p>
        </div>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-[#0a0a0f] font-['Inter']">
      {/* ── header ───────────────────────────────────────── */}
      <header className="bg-[#111118] border-b border-white/5 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4">
          <div className="py-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.25em] text-white/30 uppercase font-['Oswald']">
                FIFA World Cup
              </p>
              <h1 className="text-2xl font-extrabold text-white uppercase tracking-wide font-['Oswald']">
                2026 Schedule
              </h1>

            </div>

            {/* header actions */}
            <div className="flex items-center gap-3">
              
              {/* pick teams button — always visible */}
              <button
                onClick={openPicker}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 transition-all cursor-pointer"
              >
                <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                <span className="text-xs font-semibold text-indigo-300 font-['Oswald'] uppercase tracking-wider">
                  My Teams
                </span>
              </button>

              {/* auth button */}
              {user ? (
                <>
                  {user.user_metadata?.avatar_url && (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt=""
                      className="w-8 h-8 rounded-full border border-white/10"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <button
                    onClick={signOut}
                    className="text-xs text-white/40 hover:text-white/70 font-['Oswald'] uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  onClick={signInWithGoogle}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span className="text-xs font-semibold text-white/70 font-['Oswald'] uppercase tracking-wider">
                    Sign In
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* date picker */}
          <div className="relative group px-4 -mx-4">
            {/* left arrow */}
            <button
              onClick={goPrev}
              disabled={currentIdx <= 0}
              className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-[#111118]/80 backdrop-blur-sm border border-white/10 shadow-lg text-white/60 hover:text-white hover:bg-[#111118] disabled:opacity-0 transition-all cursor-pointer ${
                currentIdx <= 0 ? "pointer-events-none" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* scroll container */}
            <div className="flex items-center gap-1 pb-3 overflow-x-auto scrollbar-none px-4">
              {dates.map((d) => {
                const dt = new Date(d + "T12:00:00");
                const dayNum = dt.toLocaleDateString('en-US', { day: 'numeric' });
                const dayName = dt.toLocaleDateString("en-US", { weekday: "short" });
                const isActive = d === selectedDate;
                
                // add refs or IDs to help with scrolling later if needed
                return (
                  <button
                    key={d}
                    id={`date-${d}`}
                    onClick={() => setSelectedDate(d)}
                    className={`shrink-0 flex flex-col items-center px-4 py-2 rounded-xl text-xs transition-all cursor-pointer border ${
                      isActive
                        ? "bg-white text-[#0a0a0f] border-white shadow-lg scale-105"
                        : "text-white/40 border-transparent hover:bg-white/5 hover:text-white/60"
                    }`}
                  >
                    <span className="text-[10px] uppercase font-semibold font-['Oswald'] tracking-wider leading-none mb-1">
                      {dayName}
                    </span>
                    <span className={`text-lg font-bold leading-none ${isActive ? "text-[#0a0a0f]" : ""}`}>
                      {dayNum}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* right arrow */}
            <button
              onClick={goNext}
              disabled={currentIdx >= dates.length - 1}
              className={`absolute right-4 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-[#111118]/80 backdrop-blur-sm border border-white/10 shadow-lg text-white/60 hover:text-white hover:bg-[#111118] disabled:opacity-0 transition-all cursor-pointer ${
                currentIdx >= dates.length - 1 ? "pointer-events-none" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ── day label ────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 pt-8 pb-4">
        <p className="text-xs font-bold tracking-[0.2em] text-white/25 uppercase font-['Oswald']">
          {selectedDate && formatDayLabel(selectedDate)}
        </p>
        <p className="text-[11px] text-white/20 mt-1">
          {dayMatches.length} match{dayMatches.length !== 1 && "es"}
        </p>
      </div>

      {/* ── match cards ──────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 pb-16 space-y-5">
        {dayMatches.map((match) => (
          <div
            key={match.match_id}
            onClick={() => setSelectedMatch(match)}
            className="bg-[#13131a] rounded-2xl border border-white/5 overflow-hidden hover:border-white/10 transition-all cursor-pointer group hover:bg-[#1a1a24]"
          >
            {/* top accent bar */}
            <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

            <div className="p-6 sm:p-8">
              {/* stage + match info row */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/80 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg font-['Oswald']">
                    {match.stage}
                  </span>
                  {match.group_name && (
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg font-['Oswald']">
                      Group {match.group_name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                     <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-['Oswald']">
                        View History &rarr;
                     </span>
                     <span className="text-[11px] text-white/20 font-mono">
                        Match #{match.match_id}
                     </span>
                </div>
              </div>

              {/* teams row */}
              <div className="flex items-center justify-center gap-4 sm:gap-8 mb-8">
                {/* home */}
                <div className="flex-1 flex flex-col items-center gap-3">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                    {getFlagUrl(match.home_team) ? (
                      <img
                        src={getFlagUrl(match.home_team)!}
                        alt={match.home_team}
                        className="w-10 sm:w-12 object-contain"
                      />
                    ) : (
                      <span className="text-lg sm:text-xl font-extrabold text-white/50 font-['Oswald'] tracking-wider">
                        TBD
                      </span>
                    )}
                  </div>
                  <p className="text-sm sm:text-base font-bold text-white text-center font-['Oswald'] uppercase tracking-wide">
                    {displayName(match.home_team)}
                  </p>
                </div>

                {/* vs / time */}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-lg font-extrabold text-white/15 font-['Oswald'] uppercase">
                    vs
                  </span>
                   <span className="text-sm font-bold text-white/70 font-mono">
                     {formatTime(match.kickoff_utc)}
                   </span>
                </div>

                {/* away */}
                <div className="flex-1 flex flex-col items-center gap-3">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                    {getFlagUrl(match.away_team) ? (
                      <img
                        src={getFlagUrl(match.away_team)!}
                        alt={match.away_team}
                        className="w-10 sm:w-12 object-contain"
                      />
                    ) : (
                      <span className="text-lg sm:text-xl font-extrabold text-white/50 font-['Oswald'] tracking-wider">
                        TBD
                      </span>
                    )}
                  </div>
                  <p className="text-sm sm:text-base font-bold text-white text-center font-['Oswald'] uppercase tracking-wide">
                    {displayName(match.away_team)}
                  </p>
                </div>
              </div>

              {/* divider */}
              <div className="h-px bg-white/5 mb-5" />

              {/* details grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] font-semibold text-white/20 uppercase tracking-wider mb-1 font-['Oswald']">
                    Stadium
                  </p>
                  <p className="text-xs text-white/60 leading-relaxed">
                    {match.stadium}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-white/20 uppercase tracking-wider mb-1 font-['Oswald']">
                    City
                  </p>
                  <p className="text-xs text-white/60">{match.city}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-white/20 uppercase tracking-wider mb-1 font-['Oswald']">
                    Country
                  </p>
                  <p className="text-xs text-white/60">{match.host_country}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-white/20 uppercase tracking-wider mb-1 font-['Oswald']">
                    Kickoff
                  </p>
                  <p className="text-xs text-white/60">
                    {formatMonth(toDateKey(match.kickoff_utc))}{" "}
                    {new Date(match.kickoff_utc).toLocaleDateString('en-US', { 
                      day: 'numeric'
                    })},{" "}
                    {formatTime(match.kickoff_utc)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {dayMatches.length === 0 && (
          <div className="bg-[#13131a] rounded-2xl border border-white/5 p-16 text-center">
            <p className="text-sm text-white/20 font-['Oswald'] uppercase tracking-wider">
              No matches on this day
            </p>
          </div>
        )}
      </div>

       {/* Match Details Modal */}
      {selectedMatch && (
        <MatchDetailsModal 
            match={selectedMatch} 
            onClose={() => setSelectedMatch(null)} 
        />
      )}
    </div>
  );
}

export default Matches;
