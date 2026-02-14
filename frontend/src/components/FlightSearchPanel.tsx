import { useState, useMemo } from "react";
import type { Match } from "../types/match";
import { AIRLINE_NAMES } from "../data/airlines";

interface Props {
  matches: Match[];
  onSearch: (text: string, airline?: string, date?: string) => void;
  disabled?: boolean;
  initialMatchId?: string;
}

function formatMatchDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function FlightSearchPanel({ matches, onSearch, disabled, initialMatchId }: Props) {
  const [selectedMatchId, setSelectedMatchId] = useState(initialMatchId || "");
  const [departureCity, setDepartureCity] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [preferredAirline, setPreferredAirline] = useState("");

  // Update selected match when initialMatchId prop changes
  useMemo(() => {
    if (initialMatchId) {
        setSelectedMatchId(initialMatchId);
    }
  }, [initialMatchId]);

  const grouped = useMemo(() => {
    const groups: Record<string, Match[]> = {};
    for (const m of matches) {
      const key = m.stage;
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    }
    return groups;
  }, [matches]);

  const handleSearch = () => {
    const match = matches.find((m) => String(m.match_id) === selectedMatchId);
    if (!match || !departureCity.trim()) return;

    // Validate that travel date is not after match date
    // (Visual warning is shown in UI, but we allow search to proceed if user insists)
    
    let text = `Find flights from ${departureCity.trim()} to the ${match.home_team} vs ${match.away_team} match in ${match.city}`;
    if (departureDate) {
      text += ` on ${departureDate}`;
    }
    if (preferredAirline) {
      const name = AIRLINE_NAMES[preferredAirline] || preferredAirline;
      text += `, preferably on ${name}`;
    }
    onSearch(text, preferredAirline || undefined, departureDate || undefined);
  };

  return (
    <div className="space-y-6 p-5">
      <div className="space-y-2">
        <h3 className="text-xl font-bold text-white font-['Oswald'] uppercase tracking-wider drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]">
          Plan Your Trip
        </h3>
        <p className="text-sm text-white/50 font-medium">
          Find flights to upcoming matches
        </p>
      </div>

      <div className="space-y-5">
        {/* Match dropdown */}
        <div className="space-y-2 group">
          <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider font-['Oswald'] flex items-center gap-1.5">
             <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
             </svg>
             Select Match
          </label>
          <div className="relative">
            <select
                value={selectedMatchId}
                onChange={(e) => setSelectedMatchId(e.target.value)}
                className="w-full bg-[#1a1a24] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all appearance-none cursor-pointer font-medium shadow-inner"
            >
                <option value="">Choose a match...</option>
                {Object.entries(grouped).map(([stage, stageMatches]) => (
                <optgroup key={stage} label={stage}>
                    {stageMatches.map((m) => (
                    <option key={m.match_id} value={String(m.match_id)}>
                        {m.home_team} vs {m.away_team} — {formatMatchDate(m.kickoff_utc)}
                    </option>
                    ))}
                </optgroup>
                ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/30">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </div>
          </div>
        </div>

        {/* Departure Date */}
        <div className="space-y-2 group">
          <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider font-['Oswald'] flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Travel Date
          </label>
          <div className="relative">
            <input
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                className="w-full bg-[#1a1a24] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-40 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 cursor-pointer font-medium shadow-inner"
                placeholder="Optional"
            />
          </div>
          {(() => {
             if (!departureDate || !selectedMatchId) return null;
             const m = matches.find(m => String(m.match_id) === selectedMatchId);
             if (!m) return null;
             
             const matchDate = new Date(m.kickoff_utc).toISOString().split('T')[0];
             if (departureDate >= matchDate) {
                 return (
                     <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 flex items-start gap-2">
                        <svg className="w-3.5 h-3.5 shrink-0 text-amber-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <p className="text-xs text-amber-200 font-medium leading-relaxed">
                            Heads up: This date is {departureDate === matchDate ? "the same day as" : "after"} the match. You might arrive too late!
                        </p>
                     </div>
                 );
             }
             return null;
          })()}
        </div>

        {/* Departure City */}
        <div className="space-y-2 group">
          <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider font-['Oswald'] flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Departure City
          </label>
          <input
            type="text"
            value={departureCity}
            onChange={(e) => setDepartureCity(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
            placeholder="e.g. New York"
            className="w-full bg-[#1a1a24] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium shadow-inner"
          />
        </div>

        {/* Airline Preference */}
        <div className="space-y-2 group">
          <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider font-['Oswald'] flex items-center gap-1.5">
             <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
             </svg>
             Preferred Airline
          </label>
          <div className="relative">
            <select
                value={preferredAirline}
                onChange={(e) => setPreferredAirline(e.target.value)}
                className="w-full bg-[#1a1a24] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all appearance-none cursor-pointer font-medium shadow-inner"
            >
                <option value="">Any airline</option>
                {Object.entries(AIRLINE_NAMES).map(([code, name]) => (
                <option key={code} value={code}>
                    {name} ({code})
                </option>
                ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/30">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </div>
          </div>
        </div>

        {/* Search Button */}
        <button
          onClick={handleSearch}
          disabled={disabled || !selectedMatchId || !departureCity.trim()}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:from-gray-800 disabled:to-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold uppercase tracking-[0.1em] text-white transition-all cursor-pointer shadow-lg shadow-indigo-500/20 mt-4 flex items-center justify-center gap-2 group hover:shadow-indigo-500/40 relative overflow-hidden"
        >
          <span className="relative z-10 flex items-center gap-2">
            Search Flights
            <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </span>
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
        </button>
      </div>
    </div>
  );
}
