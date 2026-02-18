import { useState, useRef, useEffect, useMemo } from "react";
import type { Match } from "../types/match";
import { AIRLINE_NAMES } from "../data/airlines";
import HotelSearchForm from "./HotelSearchForm"; // NEW



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

interface Refinement {
  sort?: string;
  filter_airline?: string;
  filter_stops?: string;
  max_results?: number;
}

interface HotelResponse {
  cheapest: Hotel[];
  nearest: Hotel[];
  best_rated: Hotel[];
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  flights?: Flight[];
  hotels?: Hotel[] | HotelResponse;
  match?: MatchInfo;
  sort?: string;
  refinement?: Refinement;
  showHotelForm?: boolean; // NEW
  checkIn?: string;
  checkOut?: string;
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

function formatCardDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
}

function formatCardTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).replace(" ", "");
}

function segmentDuration(depart: string, arrive: string): string {
  const ms = new Date(arrive).getTime() - new Date(depart).getTime();
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function connectionDuration(prevArrive: string, nextDepart: string): string {
  const ms = new Date(nextDepart).getTime() - new Date(prevArrive).getTime();
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function FlightCard({ flight }: { flight: Flight }) {
  const [expanded, setExpanded] = useState(false);
  const airlineName = AIRLINE_NAMES[flight.airline] || flight.airline;
  const firstSeg = flight.segments[0];
  const lastSeg = flight.segments[flight.segments.length - 1];

  const stopsLabel = flight.stops === 0
    ? "Nonstop"
    : flight.stops === 1
      ? `Connects in ${flight.segments[0]?.to}`
      : `${flight.stops} stops`;

  const flightNumbers = flight.segments.map((s) => s.flight_number).join(", ");

  return (
    <div className="bg-[#1a1a24] border border-white/10 rounded-xl overflow-hidden hover:border-indigo-500/30 transition-colors">
      {/* ── Collapsed Summary (always visible) ── */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-3.5 py-3 cursor-pointer"
      >
        {/* Connection / Nonstop badge */}
        <div className="flex items-center justify-between mb-2">
          <span className={`text-[10px] font-semibold ${flight.stops === 0 ? "text-green-400/80" : "text-amber-400/80"}`}>
            {stopsLabel}
          </span>
          <svg
            className={`w-3.5 h-3.5 text-white/30 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Route: origin → destination with times */}
        <div className="flex items-center gap-3 mb-2.5">
          <div className="flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-bold text-white">{formatCardTime(flight.departure)}</span>
              {firstSeg?.from_tz && <span className="text-[9px] text-indigo-400/60 font-mono">{firstSeg.from_tz}</span>}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] font-semibold text-white/70">{firstSeg?.from}</span>
              <span className="text-[9px] text-white/25 truncate">{firstSeg?.from_name || firstSeg?.from}</span>
            </div>
          </div>
          <div className="flex flex-col items-center shrink-0">
            <span className="text-[9px] text-white/25 font-mono">{formatDuration(flight.duration)}</span>
            <svg className="w-4 h-4 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </div>
          <div className="flex-1 text-right">
            <div className="flex items-baseline justify-end gap-1.5">
              <span className="text-xs font-bold text-white">{formatCardTime(flight.arrival)}</span>
              {lastSeg?.to_tz && <span className="text-[9px] text-indigo-400/60 font-mono">{lastSeg.to_tz}</span>}
            </div>
            <div className="flex items-center justify-end gap-1.5 mt-0.5">
              <span className="text-[9px] text-white/25 truncate">{lastSeg?.to_name || lastSeg?.to}</span>
              <span className="text-[11px] font-semibold text-white/70">{lastSeg?.to}</span>
            </div>
          </div>
        </div>

        {/* Price + duration + airline row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center">
              <span className="text-[8px] font-bold text-white/60">{flight.airline}</span>
            </div>
            <span className="text-[10px] text-white/40">{airlineName}</span>
          </div>
          <span className="text-base font-bold text-green-400 font-['Oswald']">
            {flight.price.split(" ")[0]}
          </span>
        </div>

        {/* Flight numbers */}
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          {flight.segments.map((seg, i) => (
            <span key={i} className="text-[9px] text-white/25 font-mono bg-white/5 px-1.5 py-0.5 rounded">
              {AIRLINE_NAMES[seg.carrier] || seg.carrier} · {seg.aircraft || "—"} · {seg.flight_number}
            </span>
          ))}
        </div>
      </button>

      {/* ── Expanded Details ── */}
      {expanded && (
        <div className="border-t border-white/5 px-3.5 py-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Flight Details</p>
            <p className="text-[10px] text-white/30">
              {formatCardDate(flight.departure)} · Total {formatDuration(flight.duration)}
            </p>
          </div>

          {flight.segments.map((seg, i) => (
            <div key={i}>
              {/* Connection banner between segments */}
              {i > 0 && (
                <div className="flex items-center gap-2 my-2 py-1.5 px-2.5 bg-amber-500/5 border border-amber-500/10 rounded-lg">
                  <svg className="w-3 h-3 text-amber-400/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-[10px] text-amber-300/80 font-semibold">
                      Connection in {seg.from_name || seg.from} ({seg.from})
                    </p>
                    <p className="text-[9px] text-white/30">
                      {connectionDuration(flight.segments[i - 1].arrive, seg.depart)} layover
                    </p>
                  </div>
                </div>
              )}

              {/* Segment timeline */}
              <div className="relative pl-5 pb-1">
                {/* Vertical line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/10" />

                {/* Departure */}
                <div className="relative flex items-start gap-3 pb-3">
                  <div className="absolute left-[-13px] top-1 w-2 h-2 rounded-full bg-indigo-500 z-10" />
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-bold text-white">{formatCardTime(seg.depart)}</span>
                      <span className="text-[10px] text-white/30">{formatCardDate(seg.depart)}</span>
                    </div>
                    <p className="text-[10px] text-white/50 mt-0.5">{seg.from_name || seg.from} <span className="text-white/30 font-mono">({seg.from})</span></p>
                  </div>
                </div>

                {/* Duration + carrier info */}
                <div className="relative flex items-center gap-2 pb-3 pl-0">
                  <div className="absolute left-[-14px] top-0 bottom-0 flex items-center">
                    <div className="w-[3px] h-[3px] rounded-full bg-white/20" />
                  </div>
                  <div className="text-[9px] text-white/25 flex items-center gap-1.5 bg-white/[0.02] rounded px-2 py-1">
                    <span>{segmentDuration(seg.depart, seg.arrive)}</span>
                    <span className="text-white/10">·</span>
                    <span>{AIRLINE_NAMES[seg.carrier] || seg.carrier}</span>
                    <span className="text-white/10">·</span>
                    <span className="font-mono">{seg.aircraft || "—"}</span>
                    <span className="text-white/10">·</span>
                    <span className="font-mono">{seg.flight_number}</span>
                  </div>
                </div>

                {/* Arrival */}
                <div className="relative flex items-start gap-3">
                  <div className="absolute left-[-13px] top-1 w-2 h-2 rounded-full bg-indigo-500 z-10" />
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-bold text-white">{formatCardTime(seg.arrive)}</span>
                      <span className="text-[10px] text-white/30">{formatCardDate(seg.arrive)}</span>
                    </div>
                    <p className="text-[10px] text-white/50 mt-0.5">{seg.to_name || seg.to} <span className="text-white/30 font-mono">({seg.to})</span></p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
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

type SortKey = "price" | "price_desc" | "duration" | "stops" | "departure";

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
      case "price_desc":
        return parsePrice(b.price) - parsePrice(a.price);
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
  { key: "price_desc", label: "Most expensive" },
  { key: "duration", label: "Fastest" },
  { key: "stops", label: "Fewest stops" },
  { key: "departure", label: "Earliest" },
];

function FlightResults({
  flights,
  match,
  sortHint,
  initialAirlineFilter,
  initialStopsFilter,
  maxResults,
}: {
  flights: Flight[];
  match?: MatchInfo;
  sortHint?: SortKey;
  initialAirlineFilter?: string;
  initialStopsFilter?: string;
  maxResults?: number;
}) {
  const [activeAirlines, setActiveAirlines] = useState<Set<string>>(
    initialAirlineFilter ? new Set([initialAirlineFilter]) : new Set()
  );
  const [activeStops, setActiveStops] = useState<Set<string>>(
    initialStopsFilter ? new Set([initialStopsFilter]) : new Set()
  );
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

  const sorted = useMemo(() => {
    const s = sortFlights(filtered, sortBy);
    return maxResults ? s.slice(0, maxResults) : s;
  }, [filtered, sortBy, maxResults]);

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
            {sorted.length} of {flights.length} flights
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

/* ── Hotel Card ────────────────────────────────────────────────── */

function formatHotelDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
}

function HotelCard({ hotel }: { hotel: Hotel }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[#1a1a24] border border-white/10 rounded-xl overflow-hidden hover:border-indigo-500/30 transition-colors">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-3.5 py-3 cursor-pointer"
      >
        {/* Hotel name + expand icon */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-white truncate pr-2">{hotel.hotel_name}</span>
          <svg
            className={`w-3.5 h-3.5 text-white/30 transition-transform shrink-0 ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Price row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold text-green-400 font-['Oswald']">
              {hotel.price_per_night.split(" ")[0]}
            </span>
            <span className="text-[10px] text-white/30">/night</span>
          </div>
          <span className="text-[11px] text-white/50">
            {hotel.total_price.split(" ")[0]} total
          </span>
        </div>

        {/* Dates + nights */}
        <div className="flex items-center gap-3 mb-1.5">
          <div className="flex items-center gap-1.5 text-[10px] text-white/40">
            <span>{formatHotelDate(hotel.check_in)}</span>
            <svg className="w-3 h-3 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <span>{formatHotelDate(hotel.check_out)}</span>
          </div>
          <span className="text-[10px] text-indigo-400/60 font-semibold">
            {hotel.nights} {hotel.nights === 1 ? "night" : "nights"}
          </span>
        </div>

        {/* Distance badge */}
        {hotel.distance && (
          <div className="flex items-center gap-1 mt-1">
            <svg className="w-3 h-3 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-[10px] text-white/30">{hotel.distance}</span>
          </div>
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-white/5 px-3.5 py-3">
          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">Details</p>
          {hotel.address && (
            <div className="flex items-start gap-2 mb-2">
              <svg className="w-3 h-3 text-white/20 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="text-[10px] text-white/40">{hotel.address}</span>
            </div>
          )}
          <div className="flex items-center gap-4 text-[10px] text-white/30">
            <span>Check-in: {formatHotelDate(hotel.check_in)}</span>
            <span>Check-out: {formatHotelDate(hotel.check_out)}</span>
          </div>
          <div className="mt-2 text-[10px] text-white/20 font-mono">
            ID: {hotel.hotel_id}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Hotel Results ─────────────────────────────────────────────── */

type HotelSortKey = "price" | "distance";

function parseHotelPrice(price: string): number {
  const num = price.replace(/[^0-9.]/g, "");
  return parseFloat(num) || 0;
}

function parseDistance(dist: string): number {
  const num = dist.replace(/[^0-9.]/g, "");
  return parseFloat(num) || Infinity;
}

const HOTEL_SORT_OPTIONS: { key: HotelSortKey; label: string }[] = [
  { key: "price", label: "Cheapest" },
  { key: "distance", label: "Nearest" },
];

function HotelCategorySection({ title, hotels }: { title: string; hotels: Hotel[] }) {
  if (!hotels || hotels.length === 0) return null;
  return (
    <div className="mb-4 last:mb-0">
      <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2 border-b border-indigo-500/20 pb-1">
        {title}
      </h4>
      <div className="space-y-2">
        {hotels.map((h, i) => (
          <HotelCard key={i} hotel={h} />
        ))}
      </div>
    </div>
  );
}

function HotelResults({
  hotels,
  match,
}: {
  hotels: Hotel[] | HotelResponse;
  match?: MatchInfo;
}) {
  const [sortBy, setSortBy] = useState<HotelSortKey>("price");

  // Check if grouped
  const isGrouped = !Array.isArray(hotels) && "cheapest" in hotels;

  const sortedList = useMemo(() => {
    if (isGrouped) return [];
    return [...(hotels as Hotel[])].sort((a, b) => {
      if (sortBy === "price") return parseHotelPrice(a.total_price) - parseHotelPrice(b.total_price);
      return parseDistance(a.distance) - parseDistance(b.distance);
    });
  }, [hotels, sortBy, isGrouped]);

  return (
    <>
      {match && <MatchBanner match={match} />}

      {isGrouped ? (
        // Render Categorized View
        <div className="mt-2">
           <HotelCategorySection title="Cheapest Options" hotels={(hotels as HotelResponse).cheapest} />
           <HotelCategorySection title="Nearest to Stadium" hotels={(hotels as HotelResponse).nearest} />
           <HotelCategorySection title="Best Rated" hotels={(hotels as HotelResponse).best_rated} />
           {((hotels as HotelResponse).best_rated?.length === 0) && (
             <div className="mb-4">
                <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1 border-b border-indigo-500/20 pb-1">
                  Best Rated
                </h4>
                <p className="text-[10px] text-white/30 italic">Ratings not available yet.</p>
             </div>
           )}
        </div>
      ) : (
        // Render Standard List View
        <>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <span className="text-xs font-semibold text-white/60">
                {sortedList.length} hotels
              </span>
            </div>

            <div className="flex items-center gap-1">
              <svg className="w-3 h-3 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as HotelSortKey)}
                className="bg-transparent text-[10px] text-white/50 outline-none cursor-pointer appearance-none pr-1 [&>option]:bg-[#1a1a24]"
              >
                {HOTEL_SORT_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            {sortedList.map((h, i) => (
              <HotelCard key={i} hotel={h} />
            ))}
            {sortedList.length === 0 && (
              <p className="text-[11px] text-white/30 text-center py-2">No hotels found</p>
            )}
          </div>
        </>
      )}
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
  isAuthenticated: boolean;
  onAuthRequired: () => void;
  queriesRemaining: number;
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
  isAuthenticated,
  onAuthRequired,
  queriesRemaining,
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

  // Derive sort hint from the latest message that has a sort preference (including refinements)
  const sortHint = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      const s = msg.refinement?.sort || msg.sort;
      if (s && ["price", "price_desc", "duration", "stops", "departure"].includes(s)) {
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
        {!isAuthenticated && !open ? (
          <svg
            className="w-4 h-4 text-white/50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        ) : (
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
        )}
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

        {/* sign-in gate */}
        {!isAuthenticated && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <p className="text-sm font-bold text-white/70 font-['Oswald'] uppercase tracking-wide mb-1">
              Sign in to use the assistant
            </p>
            <p className="text-xs text-white/30 mb-5 max-w-[220px]">
              Create an account or sign in to chat with the FIFA 2026 Assistant.
            </p>
            <button
              onClick={onAuthRequired}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-bold text-white font-['Oswald'] uppercase tracking-wider transition-colors cursor-pointer"
            >
              Sign In
            </button>
          </div>
        )}

        {/* messages */}
        {isAuthenticated && <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, msgIdx) => {
            // For refinement messages (no flights), find the last message with flights
            const isRefinement = msg.role === "assistant" && msg.refinement && !msg.flights;
            let refinementFlights: Flight[] | undefined;
            let refinementMatch: MatchInfo | undefined;
            if (isRefinement) {
              for (let j = msgIdx - 1; j >= 0; j--) {
                if (messages[j].flights && messages[j].flights!.length > 0) {
                  refinementFlights = messages[j].flights;
                  refinementMatch = messages[j].match;
                  break;
                }
              }
            }

            return (
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
                {msg.role === "assistant" && msg.hotels ? (
                  <HotelResults hotels={msg.hotels} match={msg.match} />
                ) : msg.role === "assistant" && msg.flights && msg.flights.length > 0 ? (
                  <FlightResults flights={msg.flights} match={msg.match} sortHint={sortHint} />
                ) : isRefinement && refinementFlights ? (
                  <>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap font-['Inter'] mb-2">
                      {msg.content}
                    </div>
                    <FlightResults
                      flights={refinementFlights}
                      match={refinementMatch}
                      sortHint={(msg.refinement?.sort as SortKey) || sortHint}
                      initialAirlineFilter={msg.refinement?.filter_airline}
                      initialStopsFilter={msg.refinement?.filter_stops}
                      maxResults={msg.refinement?.max_results}
                    />
                  </>
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
                
                {/* Render Interactive Form if signal present */}
                {msg.showHotelForm && (
                    <HotelSearchForm
                        onSearch={(query) => onSendMessage(query)}
                        defaultCheckIn={msg.checkIn}
                        defaultCheckOut={msg.checkOut}
                        city={msg.match?.city}
                        matchDate={msg.match?.kickoff_utc}
                    />
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
            );
          })}

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
        </div>}

        {/* input area */}
        {isAuthenticated && <div className="p-4 border-t border-white/5 shrink-0">
          {/* queries remaining — hide for admins (unlimited = -1) */}
          {queriesRemaining >= 0 && (
            <div className="flex items-center justify-between mb-2 px-1">
              <span className={`text-[10px] font-mono ${queriesRemaining <= 3 ? "text-red-400/70" : "text-white/20"}`}>
                {queriesRemaining}/15 queries left
              </span>
              {queriesRemaining <= 3 && queriesRemaining > 0 && (
                <span className="text-[10px] text-amber-400/60">Running low</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            {/* Text input */}
            <div className={`flex-1 flex items-center gap-2 bg-white/5 border rounded-xl px-4 py-2 transition-colors ${queriesRemaining === 0 ? "border-red-500/20 opacity-50" : "border-white/10 focus-within:border-indigo-500/50"}`}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={queriesRemaining === 0 ? "Query limit reached" : `Ask in ${currency}...`}
                disabled={queriesRemaining === 0}
                className="flex-1 bg-transparent text-sm text-white placeholder-white/20 outline-none font-['Inter'] disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSendMessage}
                disabled={!input.trim() || queriesRemaining === 0}
                className="shrink-0 w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-default flex items-center justify-center transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </div>
        </div>}
      </aside>
    </>
  );
}
