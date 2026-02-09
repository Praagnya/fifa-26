import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const LS_KEY = "fifa26_favorites";

function readLocal(): string[] {
  try {
    const val = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    return Array.isArray(val) ? val : [];
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
  
  // Track which user ID we have loaded data for.
  // null means not loaded for current user (or no user logged in yet processed).
  // "guest" could strictly mean loaded from local storage for non-authed.
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);

  // Derived loaded state:
  // If not logged in, we consider it loaded (from local).
  // If logged in, we are loaded only if our tracker matches the current user ID.
  const loaded = !user || loadedUserId === user.id;

  const fetchFavorites = useCallback(async () => {
    if (!user) {
      // not logged in — use whatever is in localStorage
      setFavorites(readLocal());
      setLoadedUserId(null); // Reset or use a special sentinel if needed, but !user covers the 'loaded' calc
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
      // BUT: If switching users, we might not want to use local storage from prev user?
      // For now, keeping existing logic but beware leaking data between users on same device
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
    setLoadedUserId(user.id);
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

  const syncFavorites = async (teams: string[]) => {
    const previous = [...favorites];
    setFavorites(teams);
    writeLocal(teams);

    if (!user) return;

    // determine diff
    const added = teams.filter((t) => !previous.includes(t));
    const removed = previous.filter((t) => !teams.includes(t));

    if (added.length > 0) {
      const rows = added.map((team_name) => ({
        user_id: user.id,
        team_name,
      }));
      const { error } = await supabase.from("user_favorites").upsert(rows, {
        onConflict: "user_id,team_name",
      });
      if (error) console.warn("Could not save favorites to Supabase:", error.message);
    }

    if (removed.length > 0) {
      const { error } = await supabase
        .from("user_favorites")
        .delete()
        .eq("user_id", user.id)
        .in("team_name", removed);
      if (error) console.warn("Could not remove favorites from Supabase:", error.message);
    }
  };

  return { favorites, loaded, addFavorites, removeFavorite, syncFavorites, refetch: fetchFavorites };
}
