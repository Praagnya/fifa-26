import { useEffect, useState } from "react";
import { Outlet, useOutletContext } from "react-router-dom";
import type { Match } from "../types/match";
import { useAuth } from "../context/AuthContext";
import { useFavorites } from "../hooks/useFavorites";
import FavoritesSidebar from "./FavoritesSidebar";
import ChatSidebar from "./ChatSidebar";
import TeamPicker from "./TeamPicker";

export interface LayoutContext {
  matches: Match[];
  loading: boolean;
  openPicker: () => void;
  selectedMatch: Match | null;
  setSelectedMatch: (m: Match | null) => void;
}

export default function MainLayout() {
  const { user } = useAuth();
  const { favorites, loaded: favsLoaded, syncFavorites, removeFavorite } =
    useFavorites();

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  const hasFavorites = favorites.length > 0;

  // fetch all matches once
  useEffect(() => {
    fetch("/api/v1/matches")
      .then((r) => r.json())
      .then((data: Match[]) => {
        setMatches(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch matches:", err);
        setLoading(false);
      });
  }, []);

  // show team picker on first login when user has no favorites
  useEffect(() => {
    if (user && favsLoaded && favorites.length === 0) {
      setShowPicker(true);
    }
  }, [user, favsLoaded, favorites.length]);

  const openPicker = () => setShowPicker(true);

  const handlePickerDone = async (teams: string[]) => {
    await syncFavorites(teams);
    setShowPicker(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* sidebar — show when user has favorites */}
      {hasFavorites && (
        <FavoritesSidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen((o) => !o)}
          favorites={favorites}
          matches={matches}
          onRemoveFavorite={removeFavorite}
          onSelectMatch={setSelectedMatch}
        />
      )}

      {/* chat sidebar — always available */}
      <ChatSidebar
        open={chatSidebarOpen}
        onToggle={() => setChatSidebarOpen((o) => !o)}
      />

      {/* team picker overlay */}
      {showPicker && <TeamPicker onDone={handlePickerDone} onCancel={() => setShowPicker(false)} initialSelected={favorites} />}

      {/* main content area — shifts when sidebars are open */}
      <div
        className="transition-all duration-300"
        style={{ 
          marginLeft: hasFavorites && sidebarOpen ? 320 : 0,
          marginRight: chatSidebarOpen ? 384 : 0
        }}
      >
        <Outlet context={{ matches, loading, openPicker, selectedMatch, setSelectedMatch } satisfies LayoutContext} />
      </div>
    </div>
  );
}

export function useLayoutContext() {
  return useOutletContext<LayoutContext>();
}
