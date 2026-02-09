import { useEffect, useState } from "react";
import { Outlet, useOutletContext } from "react-router-dom";
import type { Match } from "../types/match";
import { useAuth } from "../context/AuthContext";
import { useFavorites } from "../hooks/useFavorites";
import FavoritesSidebar from "./FavoritesSidebar";
import TeamPicker from "./TeamPicker";

export interface LayoutContext {
  matches: Match[];
  loading: boolean;
  openPicker: () => void;
}

export default function MainLayout() {
  const { user } = useAuth();
  const { favorites, loaded: favsLoaded, addFavorites, removeFavorite } =
    useFavorites();

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

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
    await addFavorites(teams);
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
        />
      )}

      {/* team picker overlay */}
      {showPicker && <TeamPicker onDone={handlePickerDone} />}

      {/* main content area — shifts right when sidebar is open */}
      <div
        className="transition-all duration-300"
        style={{ marginLeft: hasFavorites && sidebarOpen ? 320 : 0 }}
      >
        <Outlet context={{ matches, loading, openPicker } satisfies LayoutContext} />
      </div>
    </div>
  );
}

export function useLayoutContext() {
  return useOutletContext<LayoutContext>();
}
