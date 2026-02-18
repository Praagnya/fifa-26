import { useState } from "react";

interface Props {
  onSearch: (query: string) => void;
  defaultCheckIn?: string;
  defaultCheckOut?: string;
  city?: string;
  matchDate?: string; // ISO kickoff datetime
}

export default function HotelSearchForm({
  onSearch,
  defaultCheckIn = "",
  defaultCheckOut = "",
  city = "",
  matchDate,
}: Props) {
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const [preference, setPreference] = useState<"cheapest" | "nearest" | "best_rated">("cheapest");
  const [radius, setRadius] = useState(10); // Default 10 miles

  const matchDateOnly = matchDate ? matchDate.slice(0, 10) : null;
  const checkInAfterMatch = matchDateOnly && checkIn && checkIn > matchDateOnly;

  const handleSubmit = () => {
    // Construct natural language query for the agent
    let query = `Find ${preference} hotels`;
    if (city) query += ` in ${city}`;
    if (checkIn && checkOut) query += ` from ${checkIn} to ${checkOut}`;
    
    if (preference === "nearest") {
      query += `, within ${radius} miles of the stadium`;
    }
    
    onSearch(query);
  };

  return (
    <div className="bg-[#1a1a24] border border-white/10 rounded-xl p-4 mt-2 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center">
          <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
             <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <div>
           <p className="text-xs font-bold text-white uppercase tracking-wider font-['Oswald']">Find Your Stay</p>
           <p className="text-[10px] text-white/40">Select preferences to see best options</p>
        </div>
      </div>

      {/* Dates Row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-[10px] text-white/40 uppercase font-bold mb-1.5 ml-1">Check-in</label>
          <input
            type="date"
            value={checkIn}
            onChange={(e) => {
              const newCheckIn = e.target.value;
              setCheckIn(newCheckIn);
              // If check-out is now before check-in, clear it
              if (checkOut && newCheckIn > checkOut) setCheckOut("");
            }}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
        </div>
        <div>
          <label className="block text-[10px] text-white/40 uppercase font-bold mb-1.5 ml-1">Check-out</label>
          <input
            type="date"
            value={checkOut}
            min={checkIn || undefined}
            onChange={(e) => setCheckOut(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Preference Tabs */}
      <div className="mb-4">
         <label className="block text-[10px] text-white/40 uppercase font-bold mb-1.5 ml-1">Preference</label>
         <div className="grid grid-cols-3 gap-1 bg-white/5 p-1 rounded-lg">
            {(["cheapest", "nearest", "best_rated"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPreference(p)}
                className={`py-1.5 rounded-md text-[10px] font-semibold transition-all ${
                  preference === p 
                  ? "bg-indigo-600 text-white shadow-lg" 
                  : "text-white/40 hover:text-white/60"
                }`}
              >
                {p.replace("_", " ")}
              </button>
            ))}
         </div>
      </div>
      
      {/* Radius Slider (Only for Nearest) */}
      {preference === "nearest" && (
        <div className="mb-5 px-1">
           <div className="flex items-center justify-between mb-2">
             <label className="text-[10px] text-white/40 uppercase font-bold">Distance from Stadium</label>
             <span className="text-[10px] font-mono text-indigo-400">{radius} miles</span>
           </div>
           <input
             type="range"
             min="1"
             max="50"
             step="1"
             value={radius}
             onChange={(e) => setRadius(parseInt(e.target.value))}
             className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
           />
           <div className="flex justify-between text-[8px] text-white/20 mt-1 font-mono">
             <span>1 mi</span>
             <span>50 mi</span>
           </div>
        </div>
      )}

      {/* Warning: check-in after match */}
      {checkInAfterMatch && (
        <div className="flex items-start gap-2 mb-3 px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <svg className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-[10px] text-amber-300/90 leading-relaxed">
            Your check-in date is <span className="font-bold">after the match</span>. You may miss the game — consider checking in earlier.
          </p>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider py-3 rounded-lg transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
      >
        Search Hotels
      </button>
    </div>
  );
}
