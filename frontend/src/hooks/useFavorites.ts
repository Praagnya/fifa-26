import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const LS_KEY = "fifa26_favorites";

function readLocal(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeLocal(teams: string[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(teams));
}

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<string[]>(readLocal);
  const [loaded, setLoaded] = useState(false);

  const fetchFavorites = useCallback(async () => {
    if (!user) {
      // not logged in — use whatever is in localStorage
      setFavorites(readLocal());
      setLoaded(true);
      return;
    }
    const { data, error } = await supabase
      .from("user_favorites")
      .select("team_name")
      .eq("user_id", user.id);

    if (error) {
      console.warn("Could not fetch favorites from Supabase, using local:", error.message);
      setFavorites(readLocal());
    } else if (data && data.length > 0) {
      const teams = data.map((r) => r.team_name);
      setFavorites(teams);
      writeLocal(teams);
    } else {
      // Supabase returned empty — check localStorage for any saved picks
      const local = readLocal();
      if (local.length > 0) {
        setFavorites(local);
        // sync localStorage favorites up to Supabase
        const rows = local.map((team_name) => ({ user_id: user.id, team_name }));
        supabase.from("user_favorites").upsert(rows, { onConflict: "user_id,team_name" });
      } else {
        setFavorites([]);
      }
    }
    setLoaded(true);
  }, [user]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const addFavorites = async (teams: string[]) => {
    const next = [...new Set([...favorites, ...teams])];
    setFavorites(next);
    writeLocal(next);

    if (!user) return;
    const rows = teams.map((team_name) => ({
      user_id: user.id,
      team_name,
    }));
    const { error } = await supabase.from("user_favorites").upsert(rows, {
      onConflict: "user_id,team_name",
    });
    if (error) console.warn("Could not save favorites to Supabase:", error.message);
  };

  const removeFavorite = async (team: string) => {
    const next = favorites.filter((t) => t !== team);
    setFavorites(next);
    writeLocal(next);

    if (!user) return;
    const { error } = await supabase
      .from("user_favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("team_name", team);
    if (error) console.warn("Could not remove favorite from Supabase:", error.message);
  };

  return { favorites, loaded, addFavorites, removeFavorite, refetch: fetchFavorites };
}
