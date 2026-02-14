import { useState, useRef, useEffect, useMemo } from "react";
import type { Match } from "../types/match";
import { AIRLINE_NAMES } from "../data/airlines";

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
  width: number;
  onWidthChange: (w: number) => void;
}



function formatDuration(dur: string) {
  return dur.replace(/(\d+)h/, "$1h ").replace(/(\d+)m/, "$1m").trim();
}

/* ── Flight Search Form ────────────────────────────────────────── */

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
  
  // Helper to format date like "16-Feb-2026"
  const formatDateDetailed = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).replace(/ /g, "-");
  };

  // Helper for day of week "Monday"
  const getDayOfWeek = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-US", { weekday: "long" });
  };
  
  // Helper for time "01:25AM"
  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }).replace(" ", "");
  };

  const firstSeg = flight.segments[0];
  const lastSeg = flight.segments[flight.segments.length - 1];

  return (
    <div className="bg-[#1a1a24] border border-white/10 rounded-xl overflow-hidden hover:border-indigo-500/50 transition-colors group">
      {/* Header: Date & Aircraft & Duration */}
      <div className="bg-white/5 px-4 py-2 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-indigo-300 tracking-wider">
                {getDayOfWeek(flight.departure)}, {formatDateDetailed(flight.departure)}
            </span>
        </div>
        <div className="flex items-center gap-3">
             <span className="text-[10px] text-white/40 font-mono">
                {flight.aircraft ? `A${flight.aircraft}` : "Aircraft"}
             </span>
             <span className="text-[10px] text-white/40 font-mono flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatDuration(flight.duration)}
             </span>
        </div>
      </div>

      <div className="p-4 relative">
        {/* Timeline Line */}
        <div className="absolute left-[88px] top-5 bottom-5 w-px bg-white/10 border-l border-dashed border-white/20"></div>

        {/* Departure */}
        <div className="flex gap-4 relative">
            <div className="w-[60px] text-right shrink-0">
                <div className="text-sm font-bold text-white leading-none">{formatTime(flight.departure)}</div>
                <div className="text-[10px] font-bold text-indigo-400 mt-0.5">{firstSeg?.from_tz || "Local"}</div>
            </div>
            
            {/* Dot */}
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-[#1a1a24] relative z-10 mt-1 shrink-0"></div>
            
            <div className="flex-1 pb-6">
                <div className="text-xs font-bold text-white leading-none">{firstSeg?.from_name || firstSeg?.from}</div>
                <div className="text-[10px] text-white/40 mt-1 font-mono">{firstSeg?.from}</div>
            </div>
        </div>

        {/* Arrival */}
        <div className="flex gap-4 relative">
             <div className="w-[60px] text-right shrink-0">
                <div className="text-sm font-bold text-white leading-none">{formatTime(flight.arrival)}</div>
                <div className="text-[10px] font-bold text-indigo-400 mt-0.5">{lastSeg?.to_tz || "Local"}</div>
            </div>
            
            {/* Dot */}
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-[#1a1a24] relative z-10 mt-1 shrink-0"></div>
            
            <div className="flex-1">
                <div className="text-xs font-bold text-white leading-none">{lastSeg?.to_name || lastSeg?.to}</div>
                <div className="text-[10px] text-white/40 mt-1 font-mono">{lastSeg?.to}</div>
            </div>
        </div>
      </div>

      {/* Footer: Price & Airline */}
      <div className="bg-white/5 px-4 py-3 flex items-center justify-between border-t border-white/5">
        <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[9px] font-bold text-white/70">
                {flight.airline}
            </div>
            <span className="text-xs text-white/60 font-medium">{airlineName}</span>
        </div>
        <div className="text-lg font-bold text-green-400 font-['Oswald']">
            {flight.price.split(" ")[0]}
        </div>
      </div>
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

type SortKey = "price" | "duration" | "stops" | "departure";

function parsePrice(price: string): number {
  // price is like "$249.26 USD" or "€200.00 EUR" or "₹22590.00 INR"
  const num = price.replace(/[^0-9.]/g, "");
  return parseFloat(num) || 0;
}

function parseDuration(dur: string): number {
  // dur is like "8h54m" or "2h11m"
  const h = dur.match(/(\d+)h/);
  const m = dur.match(/(\d+)m/);
  return (h ? parseInt(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0);
}

function sortFlights(flights: Flight[], key: SortKey): Flight[] {
  return [...flights].sort((a, b) => {
    switch (key) {
      case "price":
        return parsePrice(a.price) - parsePrice(b.price);
      case "duration":
        return parseDuration(a.duration) - parseDuration(b.duration);
      case "stops":
        return a.stops - b.stops;
      case "departure":
        return new Date(a.departure).getTime() - new Date(b.departure).getTime();
    }
  });
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "price", label: "Cheapest" },
  { key: "duration", label: "Fastest" },
  { key: "stops", label: "Fewest stops" },
  { key: "departure", label: "Earliest" },
];

function FlightResults({ flights, match, sortHint }: { flights: Flight[]; match?: MatchInfo; sortHint?: SortKey }) {
  const [activeAirlines, setActiveAirlines] = useState<Set<string>>(new Set());
  const [activeStops, setActiveStops] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortKey>(sortHint || "price");

  // Update sort when external hint changes
  useEffect(() => {
    if (sortHint) setSortBy(sortHint);
  }, [sortHint]);

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

  const sorted = useMemo(() => sortFlights(filtered, sortBy), [filtered, sortBy]);

  return (
    <>
      {match && <MatchBanner match={match} />}

      {/* Flights header + sort */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          <span className="text-xs font-semibold text-white/60">
            {filtered.length} of {flights.length} flights
          </span>
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-1">
          <svg className="w-3 h-3 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="bg-transparent text-[10px] text-white/50 outline-none cursor-pointer appearance-none pr-1 [&>option]:bg-[#1a1a24]"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </div>
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
        {sorted.map((f, i) => (
          <FlightCard key={i} flight={f} />
        ))}
        {sorted.length === 0 && (
          <p className="text-[11px] text-white/30 text-center py-2">No flights match filters</p>
        )}
      </div>
    </>
  );
}

/* ── Main Component ────────────────────────────────────────────── */

interface Props {
  open: boolean;
  onToggle: () => void;
  matches: Match[];
  width: number;
  onWidthChange: (w: number) => void;
  // New props for lifted state
  messages: Message[];
  onSendMessage: (text: string, airline?: string, date?: string, currency?: string) => void;
  isTyping: boolean;
  currency: string;
  onCurrencyChange: (c: string) => void;
}

export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "INR"];

export default function ChatSidebar({
  open,
  onToggle,
  matches,
  width,
  onWidthChange,
  messages,
  onSendMessage,
  isTyping,
  currency,
  onCurrencyChange,
}: Props) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Resizing state
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  
  // Handle resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing) return;
        // Calculate new width: total window width - mouse X position
        const newWidth = window.innerWidth - e.clientX;
        // Constrain width (min: 300px, max: 800px or 80vw)
        const constrained = Math.max(300, Math.min(newWidth, Math.min(800, window.innerWidth - 100)));
        onWidthChange(constrained);
    };
    
    const handleMouseUp = () => {
        setIsResizing(false);
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto'; // Re-enable text selection
    };
    
    if (isResizing) {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none'; // Prevent text selection while dragging
    }
    
    return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, onWidthChange]);

  // Derive sort hint from the latest message that has a sort preference
  const sortHint = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const s = messages[i].sort;
      if (s && ["price", "duration", "stops", "departure"].includes(s)) {
        return s as SortKey;
      }
    }
    return "price" as SortKey;
  }, [messages]);

  const handleSendMessage = () => {
    if (!input.trim()) return;
    onSendMessage(input.trim(), undefined, undefined, currency);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* toggle button */}
      <button
        onClick={onToggle}
        className="fixed top-4 right-0 z-40 w-8 h-12 bg-[#1a1a24] border border-white/10 border-r-0 rounded-l-lg flex items-center justify-center hover:bg-white/5 transition-all cursor-pointer"
        style={{ transform: open ? `translateX(-${width}px)` : "translateX(0)" }}
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
        className={`fixed top-0 right-0 z-30 h-full bg-[#111118] border-l border-white/5 flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: width }}
      >
        {/* Resize Handle */}
        <div 
            className="absolute top-0 bottom-0 left-0 w-1 cursor-col-resize hover:bg-indigo-500/50 transition-colors z-50"
            onMouseDown={(e) => {
                e.preventDefault();
                setIsResizing(true);
            }}
        />

        {/* header */}
        <div className="p-5 pt-6 border-b border-white/5 shrink-0 flex items-center justify-between">
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
          
          {/* Currency Selector */}
          <select 
             value={currency}
             onChange={(e) => onCurrencyChange(e.target.value)}
             className="bg-white/5 border border-white/10 rounded-md text-[10px] text-white/70 px-2 py-1 outline-none focus:border-indigo-500/50 font-mono"
          >
              {SUPPORTED_CURRENCIES.map(c => (
                  <option key={c} value={c} className="bg-[#1a1a24] text-white">{c}</option>
              ))}
          </select>
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
                  <FlightResults flights={msg.flights} match={msg.match} sortHint={sortHint} />
                ) : (
                  <div className="text-sm leading-relaxed whitespace-pre-wrap font-['Inter']">
                    {msg.content.split(/(\*\*.*?\*\*)/g).map((part, i) => {
                      if (part.startsWith("**") && part.endsWith("**")) {
                        return (
                          <span key={i} className="font-bold text-indigo-300 font-['Oswald'] uppercase tracking-wide text-xs">
                            {part.slice(2, -2)}
                          </span>
                        );
                      }
                      return <span key={i}>{part}</span>;
                    })}
                  </div>
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
          <div className="flex items-center gap-2">
            {/* Text input */}
            <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2 focus-within:border-indigo-500/50 transition-colors">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Ask in ${currency}...`}
                className="flex-1 bg-transparent text-sm text-white placeholder-white/20 outline-none font-['Inter']"
              />
              <button
                onClick={handleSendMessage}
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
