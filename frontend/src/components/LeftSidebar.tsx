import type { Match } from "../types/match";
import FavoritesSidebar from "./FavoritesSidebar";
import FlightSearchPanel from "./FlightSearchPanel";

interface Props {
  open: boolean;
  onToggle: () => void;
  activeTab: "favorites" | "flights";
  onTabChange: (tab: "favorites" | "flights") => void;
  favorites: string[];
  matches: Match[];
  onRemoveFavorite: (team: string) => void;
  onSelectMatch: (match: Match) => void;
  onFocusMatch: (id: string) => void;
  onFlightSearch: (text: string, airline?: string, date?: string) => void;
  searchDisabled?: boolean;
  selectedMatch?: Match | null;
}

export default function LeftSidebar({
  open,
  onToggle,
  activeTab,
  onTabChange,
  favorites,
  matches,
  onRemoveFavorite,
  onFocusMatch,
  onFlightSearch,
  searchDisabled,
  selectedMatch,
}: Props) {


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
        className={`fixed top-0 left-0 z-30 h-full w-80 bg-[#111118] border-r border-white/5 flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Tabs Header */}
        <div className="flex items-center border-b border-white/5 relative bg-[#0a0a0f]">
          <button
            onClick={() => onTabChange("favorites")}
            className={`flex-1 py-4 text-[11px] font-bold uppercase tracking-[0.1em] font-['Oswald'] transition-all relative overflow-hidden group ${
              activeTab === "favorites"
                ? "text-white"
                : "text-white/40 hover:text-white hover:bg-white/[0.03]"
            }`}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
                <svg className={`w-3.5 h-3.5 ${activeTab === "favorites" ? "text-indigo-400" : "text-white/30 group-hover:text-white/60"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                My Teams
            </span>
            {activeTab === "favorites" && (
                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
            )}
          </button>
          
          <button
            onClick={() => onTabChange("flights")}
            className={`flex-1 py-4 text-[11px] font-bold uppercase tracking-[0.1em] font-['Oswald'] transition-all relative overflow-hidden group ${
              activeTab === "flights"
                ? "text-white"
                : "text-white/40 hover:text-white hover:bg-white/[0.03]"
            }`}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
                <svg className={`w-3.5 h-3.5 ${activeTab === "flights" ? "text-indigo-400" : "text-white/30 group-hover:text-white/60"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Flights
            </span>
            {activeTab === "flights" && (
                <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
            )}
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "favorites" ? (
            <FavoritesSidebar
              open={true} // Always open within this container
              onToggle={() => {}} // No-op, managed by parent
              favorites={favorites}
              matches={matches}
              onRemoveFavorite={onRemoveFavorite}
              onSelectMatch={(m) => onFocusMatch(String(m.match_id))}
              embedded={true} // Prop to hint it's embedded (optional, need to update FavoritesSidebar if we want to remove its wrapper logic)
            />
          ) : (
            <FlightSearchPanel
              matches={matches}
              onSearch={onFlightSearch}
              disabled={searchDisabled}
              initialMatchId={selectedMatch ? String(selectedMatch.match_id) : undefined}
            />
          )}
        </div>
      </aside>
    </>
  );
}
