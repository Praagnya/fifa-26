import { useState, useRef, useEffect, useMemo } from "react";
import type { Match } from "../types/match";

interface FlightSegment {
  from: string;
  to: string;
  depart: string;
  arrive: string;
  carrier: string;
  flight_number: string;
}

interface Flight {
  price: string;
  airline: string;
  departure: string;
  arrival: string;
  duration: string;
  stops: number;
  segments: FlightSegment[];
}

interface MatchInfo {
  home_team: string;
  away_team: string;
  kickoff_utc: string;
  stadium: string;
  city: string;
  stage: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  flights?: Flight[];
  match?: MatchInfo;
}

interface Props {
  open: boolean;
  onToggle: () => void;
  matches: Match[];
}

const AIRLINE_NAMES: Record<string, string> = {
  // US carriers
  UA: "United",
  AA: "American",
  DL: "Delta",
  WN: "Southwest",
  B6: "JetBlue",
  AS: "Alaska",
  NK: "Spirit",
  F9: "Frontier",
  HA: "Hawaiian",
  SY: "Sun Country",
  G4: "Allegiant",
  // Canadian
  AC: "Air Canada",
  WS: "WestJet",
  TS: "Air Transat",
  PD: "Porter",
  // Latin America
  AV: "Avianca",
  AM: "AeroMexico",
  CM: "Copa",
  LA: "LATAM",
  AR: "Aerolineas Arg.",
  G3: "GOL",
  AD: "Azul",
  // European
  BA: "British Airways",
  LH: "Lufthansa",
  AF: "Air France",
  KL: "KLM",
  IB: "Iberia",
  AZ: "ITA Airways",
  LX: "Swiss",
  OS: "Austrian",
  SK: "SAS",
  AY: "Finnair",
  TP: "TAP Portugal",
  EI: "Aer Lingus",
  VS: "Virgin Atlantic",
  TK: "Turkish",
  // Middle East / Asia / Oceania
  EK: "Emirates",
  QR: "Qatar",
  EY: "Etihad",
  SQ: "Singapore",
  CX: "Cathay Pacific",
  NH: "ANA",
  JL: "JAL",
  KE: "Korean Air",
  OZ: "Asiana",
  QF: "Qantas",
  NZ: "Air New Zealand",
  AI: "Air India",
};

function formatFlightTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatFlightDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDuration(dur: string) {
  return dur.replace(/(\d+)h/, "$1h ").replace(/(\d+)m/, "$1m").trim();
}

function formatMatchDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ── Flight Search Form ────────────────────────────────────────── */

function FlightSearchForm({
  matches,
  onSearch,
  disabled,
}: {
  matches: Match[];
  onSearch: (text: string) => void;
  disabled: boolean;
}) {
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [departureCity, setDepartureCity] = useState("");

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
    const text = `Find flights from ${departureCity.trim()} to the ${match.home_team} vs ${match.away_team} match in ${match.city}`;
    onSearch(text);
  };

  return (
    <div className="space-y-2.5">
      {/* Match dropdown */}
      <select
        value={selectedMatchId}
        onChange={(e) => setSelectedMatchId(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500/50 transition-colors appearance-none cursor-pointer [&>optgroup]:bg-[#1a1a24] [&>option]:bg-[#1a1a24]"
      >
        <option value="">Select a match...</option>
        {Object.entries(grouped).map(([stage, stageMatches]) => (
          <optgroup key={stage} label={stage}>
            {stageMatches.map((m) => (
              <option key={m.match_id} value={String(m.match_id)}>
                {m.home_team} vs {m.away_team} — {formatMatchDate(m.kickoff_utc)}, {m.city}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Departure city + search button */}
      <div className="flex items-center gap-2">
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
          placeholder="Your city (e.g. Chicago)"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-indigo-500/50 transition-colors"
        />
        <button
          onClick={handleSearch}
          disabled={disabled || !selectedMatchId || !departureCity.trim()}
          className="shrink-0 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-default text-xs font-semibold text-white transition-colors cursor-pointer"
        >
          Search
        </button>
      </div>
    </div>
  );
}

/* ── Filter Pills ──────────────────────────────────────────────── */

function FlightFilterPills({
  flights,
  activeAirlines,
  toggleAirline,
  activeStops,
  toggleStops,
}: {
  flights: Flight[];
  activeAirlines: Set<string>;
  toggleAirline: (code: string) => void;
  activeStops: Set<string>;
  toggleStops: (key: string) => void;
}) {
  const airlines = useMemo(() => {
    const codes = new Set<string>();
    for (const f of flights) codes.add(f.airline);
    return Array.from(codes).sort();
  }, [flights]);

  const stopOptions = ["0", "1", "2+"];
  const stopLabels: Record<string, string> = {
    "0": "Nonstop",
    "1": "1 stop",
    "2+": "2+ stops",
  };

  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {/* Airline pills */}
      {airlines.map((code) => {
        const active = activeAirlines.size === 0 || activeAirlines.has(code);
        return (
          <button
            key={code}
            onClick={() => toggleAirline(code)}
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors cursor-pointer ${
              active
                ? "bg-indigo-600/80 border-indigo-500/50 text-white"
                : "bg-white/5 border-white/10 text-white/40"
            }`}
          >
            {AIRLINE_NAMES[code] || code}
          </button>
        );
      })}

      {/* Divider */}
      {airlines.length > 0 && (
        <div className="w-px h-4 bg-white/10 self-center mx-0.5" />
      )}

      {/* Stops pills */}
      {stopOptions.map((key) => {
        const active = activeStops.size === 0 || activeStops.has(key);
        return (
          <button
            key={key}
            onClick={() => toggleStops(key)}
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors cursor-pointer ${
              active
                ? "bg-indigo-600/80 border-indigo-500/50 text-white"
                : "bg-white/5 border-white/10 text-white/40"
            }`}
          >
            {stopLabels[key]}
          </button>
        );
      })}
    </div>
  );
}

/* ── Flight Card ───────────────────────────────────────────────── */

function FlightCard({ flight }: { flight: Flight }) {
  const airlineName = AIRLINE_NAMES[flight.airline] || flight.airline;
  const depTime = formatFlightTime(flight.departure);
  const arrTime = formatFlightTime(flight.arrival);
  const depDate = formatFlightDate(flight.departure);
  const arrDate = formatFlightDate(flight.arrival);
  const crossDay = depDate !== arrDate;
  const stopsLabel =
    flight.stops === 0
      ? "Nonstop"
      : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`;
  const route = flight.segments
    ? `${flight.segments[0]?.from} → ${flight.segments[flight.segments.length - 1]?.to}`
    : "";

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 hover:border-indigo-500/30 transition-colors">
      {/* Top row: airline + price */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center">
            <span className="text-[9px] font-bold text-white/60">
              {flight.airline}
            </span>
          </div>
          <span className="text-xs text-white/50">{airlineName}</span>
        </div>
        <span className="text-sm font-bold text-green-400">{flight.price.split(" ")[0]}</span>
      </div>

      {/* Timeline row */}
      <div className="flex items-center gap-2">
        {/* Departure */}
        <div className="text-right min-w-[52px]">
          <p className="text-sm font-semibold text-white leading-none">{depTime}</p>
          <p className="text-[10px] text-white/30 mt-0.5">{flight.segments?.[0]?.from}</p>
        </div>

        {/* Line + stops */}
        <div className="flex-1 flex flex-col items-center gap-0.5">
          <p className="text-[10px] text-white/30">{formatDuration(flight.duration)}</p>
          <div className="w-full flex items-center gap-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-white/30 shrink-0" />
            <div className="flex-1 h-px bg-white/15 relative">
              {flight.stops > 0 &&
                Array.from({ length: flight.stops }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-amber-400/70"
                    style={{
                      left: `${((i + 1) / (flight.stops + 1)) * 100}%`,
                    }}
                  />
                ))}
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-white/30 shrink-0" />
          </div>
          <p className={`text-[10px] ${flight.stops === 0 ? "text-green-400/70" : "text-amber-400/70"}`}>
            {stopsLabel}
          </p>
        </div>

        {/* Arrival */}
        <div className="min-w-[52px]">
          <div className="flex items-baseline gap-0.5">
            <p className="text-sm font-semibold text-white leading-none">{arrTime}</p>
            {crossDay && <span className="text-[9px] text-red-400/70">+1</span>}
          </div>
          <p className="text-[10px] text-white/30 mt-0.5">{flight.segments?.[flight.segments.length - 1]?.to}</p>
        </div>
      </div>

      {/* Route label */}
      {route && (
        <p className="text-[10px] text-white/20 mt-2 text-center">{route}</p>
      )}
    </div>
  );
}

/* ── Match Banner ──────────────────────────────────────────────── */

function MatchBanner({ match }: { match: MatchInfo }) {
  const d = new Date(match.kickoff_utc);
  const dateStr = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl px-3 py-2.5 mb-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-white">
            {match.home_team} vs {match.away_team}
          </p>
          <p className="text-[10px] text-white/40 mt-0.5">
            {dateStr} · {timeStr}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-white/50">{match.stadium}</p>
          <p className="text-[10px] text-white/30">{match.city}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Filtered Flights Renderer ─────────────────────────────────── */

function FlightResults({ flights, match }: { flights: Flight[]; match?: MatchInfo }) {
  const [activeAirlines, setActiveAirlines] = useState<Set<string>>(new Set());
  const [activeStops, setActiveStops] = useState<Set<string>>(new Set());

  const toggleAirline = (code: string) => {
    setActiveAirlines((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleStops = (key: string) => {
    setActiveStops((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filtered = flights.filter((f) => {
    if (activeAirlines.size > 0 && !activeAirlines.has(f.airline)) return false;
    if (activeStops.size > 0) {
      const stopKey = f.stops >= 2 ? "2+" : String(f.stops);
      if (!activeStops.has(stopKey)) return false;
    }
    return true;
  });

  return (
    <>
      {match && <MatchBanner match={match} />}

      {/* Flights header */}
      <div className="flex items-center gap-1.5 mb-2">
        <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
        <span className="text-xs font-semibold text-white/60">
          {filtered.length} of {flights.length} flights
        </span>
      </div>

      {/* Filter pills */}
      <FlightFilterPills
        flights={flights}
        activeAirlines={activeAirlines}
        toggleAirline={toggleAirline}
        activeStops={activeStops}
        toggleStops={toggleStops}
      />

      {/* Flight cards */}
      <div className="space-y-2">
        {filtered.map((f, i) => (
          <FlightCard key={i} flight={f} />
        ))}
        {filtered.length === 0 && (
          <p className="text-[11px] text-white/30 text-center py-2">No flights match filters</p>
        )}
      </div>
    </>
  );
}

/* ── Main Component ────────────────────────────────────────────── */

export default function ChatSidebar({ open, onToggle, matches }: Props) {
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
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showFlightForm, setShowFlightForm] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const sendMessage = async (text?: string) => {
    const msg = text ?? input.trim();
    if (!msg) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: msg,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const res = await fetch("/api/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, session_id: sessionId }),
      });
      const data = await res.json();
      const botMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply ?? data.message ?? "Something went wrong.",
        timestamp: new Date(),
        flights: data.flights,
        match: data.match,
      };
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* toggle button */}
      <button
        onClick={onToggle}
        className="fixed top-4 right-0 z-40 w-8 h-12 bg-[#1a1a24] border border-white/10 border-r-0 rounded-l-lg flex items-center justify-center hover:bg-white/5 transition-all cursor-pointer"
        style={{ transform: open ? "translateX(-384px)" : "translateX(0)" }}
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
            d={open ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"}
          />
        </svg>
      </button>

      {/* chat panel */}
      <aside
        className={`fixed top-0 right-0 z-30 h-full w-96 bg-[#111118] border-l border-white/5 flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* header */}
        <div className="p-5 pt-6 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-white font-['Oswald'] uppercase tracking-wide">
                Assistant
              </p>
              <p className="text-[10px] text-white/30 font-semibold tracking-[0.2em] uppercase font-['Oswald']">
                FIFA 2026 Assistant
              </p>
            </div>
          </div>
        </div>

        {/* messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-md"
                    : "bg-white/5 border border-white/5 text-white/70 rounded-bl-md"
                }`}
              >
                {/* Text content */}
                {msg.role === "assistant" && msg.flights && msg.flights.length > 0 ? (
                  <FlightResults flights={msg.flights} match={msg.match} />
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </p>
                )}

                <p
                  className={`text-[10px] mt-1.5 ${
                    msg.role === "user" ? "text-white/40" : "text-white/20"
                  }`}
                >
                  {msg.timestamp.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white/5 border border-white/5 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-white/30 animate-bounce [animation-delay:0ms]" />
                  <div className="w-2 h-2 rounded-full bg-white/30 animate-bounce [animation-delay:150ms]" />
                  <div className="w-2 h-2 rounded-full bg-white/30 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* input area */}
        <div className="p-4 border-t border-white/5 shrink-0">
          {/* Flight search form (collapsible) */}
          {showFlightForm && (
            <div className="mb-3 p-3 bg-white/[0.02] border border-white/10 rounded-xl">
              <div className="flex items-center gap-1.5 mb-2.5">
                <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                <span className="text-[11px] font-semibold text-white/50">Flight Search</span>
              </div>
              <FlightSearchForm
                matches={matches}
                onSearch={(text) => {
                  setShowFlightForm(false);
                  sendMessage(text);
                }}
                disabled={isTyping}
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Airplane toggle button */}
            <button
              onClick={() => setShowFlightForm((v) => !v)}
              className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                showFlightForm
                  ? "bg-indigo-600 text-white"
                  : "bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60"
              }`}
              title="Flight search"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>

            {/* Text input */}
            <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus-within:border-indigo-500/50 transition-colors">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about the World Cup..."
                className="flex-1 bg-transparent text-sm text-white placeholder-white/20 outline-none font-['Inter']"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim()}
                className="shrink-0 w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-default flex items-center justify-center transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
