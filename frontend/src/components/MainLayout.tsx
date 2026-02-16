import { useCallback, useEffect, useState } from "react";
import { Outlet, useOutletContext } from "react-router-dom";
import type { Match } from "../types/match";
import { useAuth } from "../context/AuthContext";
import { useFavorites } from "../hooks/useFavorites";
import { supabase } from "../lib/supabase";
import LeftSidebar from "./LeftSidebar";
import ChatSidebar from "./ChatSidebar";
import TeamPicker from "./TeamPicker";
import AuthModal from "./AuthModal";

interface FlightSegment {
  from: string;
  from_name?: string;
  from_tz?: string;
  to: string;
  to_name?: string;
  to_tz?: string;
  depart: string;
  arrive: string;
  carrier: string;
  flight_number: string;
  aircraft?: string;
}

interface Flight {
  price: string;
  airline: string;
  departure: string;
  arrival: string;
  duration: string;
  stops: number;
  aircraft?: string;
  segments: FlightSegment[];
}

interface Hotel {
  hotel_name: string;
  hotel_id: string;
  price_per_night: string;
  total_price: string;
  check_in: string;
  check_out: string;
  nights: number;
  distance: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

interface MatchInfo {
  home_team: string;
  away_team: string;
  kickoff_utc: string;
  stadium: string;
  city: string;
  stage: string;
}

export interface Refinement {
  sort?: string;
  filter_airline?: string;
  filter_stops?: string;
  max_results?: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  flights?: Flight[];
  hotels?: Hotel[];
  match?: MatchInfo;
  sort?: string;
  refinement?: Refinement;
}

export interface LayoutContext {
  matches: Match[];
  loading: boolean;
  openPicker: () => void;
  selectedMatch: Match | null;
  setSelectedMatch: (m: Match | null) => void;
  onSelectMatchForFlight: (m: Match) => void;
  selectedFlightMatch: Match | null;
  focusedMatchId: string | null;
  setFocusedMatchId: (id: string | null) => void;
  openAuthModal: () => void;
}

const QUERY_LIMIT = 15;

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function MainLayout() {
  const { user } = useAuth();
  const { favorites, loaded: favsLoaded, syncFavorites, removeFavorite } =
    useFavorites();

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"favorites" | "flights">("favorites");
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false);
  const [chatSidebarWidth, setChatSidebarWidth] = useState(384); // Default to w-96 (384px)
  const [showPicker, setShowPicker] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedFlightMatch, setSelectedFlightMatch] = useState<Match | null>(null);
  const [focusedMatchId, setFocusedMatchId] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [queriesRemaining, setQueriesRemaining] = useState(QUERY_LIMIT);

  // Fetch remaining queries from backend
  const refreshQueryCount = useCallback(async () => {
    if (!user) { setQueriesRemaining(QUERY_LIMIT); return; }
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch("/api/v1/chat/limit", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setQueriesRemaining(data.remaining);
      }
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => {
    refreshQueryCount();
    const interval = setInterval(refreshQueryCount, 60_000);
    return () => clearInterval(interval);
  }, [refreshQueryCount]);

  // Auto-clear focus after a short delay so we can re-focus same match if clicked again
  useEffect(() => {
    if (focusedMatchId) {
      const t = setTimeout(() => setFocusedMatchId(null), 2000);
      return () => clearTimeout(t);
    }
  }, [focusedMatchId]);

  const handleFocusMatch = (id: string | null) => {
    setFocusedMatchId(id);
    // If sidebar is open on mobile/small screens, you might want to close it:
    // setSidebarOpen(false); 
  };

  // Chat State
  const [sessionId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hey! I'm your FIFA 2026 assistant. Ask me about matches, teams, stadiums, or anything about the World Cup.",
      timestamp: new Date(),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [currency, setCurrency] = useState("USD");

  const handleChatToggle = () => {
    setChatSidebarOpen((o) => !o);
  };

  const sendMessage = async (text: string, airline?: string, date?: string, currencyOverride?: string) => {
     if (!text) return;
     if (!user) return;

     // Ensure chat sidebar is open when sending a message
     if (!chatSidebarOpen) setChatSidebarOpen(true);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: "Session expired. Please sign in again.", timestamp: new Date() }]);
        setIsTyping(false);
        return;
      }

      let messagePayload = text;
      if (selectedFlightMatch) {
          const m = selectedFlightMatch;
          const matchContext = `\n\n[Context: User selected match: ${m.home_team} vs ${m.away_team} at ${m.city}]`;
          if (!text.includes("User selected match")) {
              messagePayload += matchContext;
          }
      }

      const effectiveCurrency = currencyOverride || currency;
      const payload: Record<string, string> = {
        message: messagePayload,
        session_id: sessionId,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        currency: effectiveCurrency,
      };
      if (airline) payload.airline = airline;
      if (date) payload.date = date;
      const res = await fetch("/api/v1/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      // Handle rate limit response
      if (res.status === 429) {
        const err = await res.json();
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: err.detail, timestamp: new Date() }]);
        setQueriesRemaining(0);
        return;
      }

      const data = await res.json();

      // Update remaining count from backend
      if (data.queries_remaining !== undefined) {
        setQueriesRemaining(data.queries_remaining);
      }

      const botMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply ?? data.message ?? "Something went wrong.",
        timestamp: new Date(),
        flights: data.flights,
        hotels: data.hotels,
        match: data.match,
        sort: data.sort,
        refinement: data.refinement,
      };
      if (data.currency) {
        setCurrency(data.currency);
      }
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Couldn't reach the server. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

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

  const handleSelectMatchForFlight = (m: Match) => {
    setSelectedFlightMatch(m);
    setSidebarTab("flights");
    setSidebarOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* sidebar — show when user has favorites (now LeftSidebar) */}
      <LeftSidebar 
        open={sidebarOpen} 
        onToggle={() => setSidebarOpen((o) => !o)}
        activeTab={sidebarTab}
        onTabChange={setSidebarTab}
        favorites={favorites}
        matches={matches}
        onRemoveFavorite={removeFavorite}
        onSelectMatch={setSelectedMatch}
        onFocusMatch={handleFocusMatch}
        onFlightSearch={(text, airline, date) => sendMessage(text, airline, date, currency)}
        searchDisabled={isTyping}
        selectedMatch={selectedFlightMatch}
      />

      {/* chat sidebar — gated behind auth */}
      <ChatSidebar
        open={chatSidebarOpen}
        onToggle={handleChatToggle}
        matches={matches}
        width={chatSidebarWidth}
        onWidthChange={setChatSidebarWidth}
        messages={messages}
        onSendMessage={sendMessage}
        isTyping={isTyping}
        currency={currency}
        onCurrencyChange={setCurrency}
        isAuthenticated={!!user}
        onAuthRequired={() => setShowAuthModal(true)}
        queriesRemaining={queriesRemaining}
      />

      {/* auth modal */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}

      {/* team picker overlay */}
      {showPicker && <TeamPicker onDone={handlePickerDone} onCancel={() => setShowPicker(false)} initialSelected={favorites} />}

      {/* main content area — shifts when sidebars are open */}
      <div
        className="transition-all duration-300"
        style={{ 
          marginLeft: sidebarOpen ? 320 : 0, // Left sidebar is 320px (w-80)
          marginRight: chatSidebarOpen ? chatSidebarWidth : 0
        }}
      >
        <Outlet context={{
            matches,
            loading,
            openPicker,
            selectedMatch,
            setSelectedMatch,
            onSelectMatchForFlight: handleSelectMatchForFlight,
            selectedFlightMatch,
            focusedMatchId,
            setFocusedMatchId: handleFocusMatch,
            openAuthModal: () => setShowAuthModal(true),
        } satisfies LayoutContext} />
      </div>
    </div>
  );
}

export function useLayoutContext() {
  return useOutletContext<LayoutContext>();
}
