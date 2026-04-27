# Product Specification Document
## FIFA 2026 World Cup Travel & Match Planning Assistant

**Version:** 1.0
**Date:** March 21, 2026
**Status:** Live / Production

---

## 1. Product Overview

### 1.1 Purpose

The FIFA 2026 World Cup Assistant is an AI-powered travel and match planning web application that helps football fans plan their trip to the 2026 FIFA World Cup. Users can explore match schedules, search for flights and hotels to match venues, and get personalized travel recommendations — all through a conversational interface.

### 1.2 Problem Statement

Attending the World Cup requires coordinating across many systems: official match schedules, flight search engines, hotel booking platforms, and team statistics. Fans currently have to visit multiple websites, manually cross-reference match dates with travel options, and manage everything themselves. This creates friction and a high barrier to planning.

### 1.3 Solution

A single-page web application with an AI chat assistant that understands natural language queries. Users can ask questions like "Find me flights to Los Angeles for the Brazil vs Argentina match" and the system handles intent recognition, data retrieval, and summarization end-to-end.

---

## 2. Target Users

| User Type | Description |
|---|---|
| International Fans | Travelers flying from abroad to attend World Cup matches |
| Domestic US/Canada/Mexico Fans | Fans attending matches within the host countries |
| Casual Visitors | Users browsing match schedules without committing to travel |
| Football Analysts | Users interested in team head-to-head stats and match history |

---

## 3. Features

### 3.1 Match Browser

**Purpose:** Browse and explore all FIFA 2026 match schedules.

**Behavior:**
- Display all matches with team names, venue city, kickoff time, and match stage (Group, Round of 16, Quarterfinal, etc.)
- Filter matches by team name
- Click a match to open a **Match Details Modal** showing full match info
- Show match timezone in the user's local timezone (configurable via a timezone selector)
- Favorite specific matches for quick access via a Favorites sidebar

**UI Components:**
- `Matches.tsx` — main match listing page
- `MatchDetailsModal.tsx` — popup with full match detail
- `FavoritesSidebar.tsx` — persistent panel for saved matches
- `TimeZoneSelector.tsx` — dropdown to change display timezone
- `TeamPicker.tsx` — team filter component

---

### 3.2 AI Chat Assistant

**Purpose:** Natural language interface for travel and match queries.

**Behavior:**
- Accepts free-text questions from the user
- Maintains conversation context across multiple turns within a session
- Classifies user intent and routes to the appropriate specialist agent
- Returns structured responses (text summary + structured flight/hotel data)
- Limits users to **15 queries per 12-hour window** (rate limiting)
- Shows remaining query count after each response
- Supports session continuity: remembers departure city, preferred airline, currency, and match context across turns

**Supported Intents:**
| Intent | Example Query |
|---|---|
| `flight_search` | "Find flights from NYC to Dallas for the USA match" |
| `flight_refine` | "Show me only United Airlines flights" / "Sort by price" |
| `hotel_search` | "Find hotels near the stadium in Miami" |
| `match_info` | "When does England play?" |
| `general` | "Which teams are in Group A?" |

**UI Components:**
- `ChatSidebar.tsx` — collapsible chat panel
- `FlightSearchPanel.tsx` — structured flight results with filtering controls
- `HotelSearchForm.tsx` — hotel preference form rendered in-chat when user asks for hotels

---

### 3.3 Flight Search

**Purpose:** Search real-time flights to World Cup match venues via the Amadeus Travel API.

**Behavior:**
- Triggered by a `flight_search` intent from the chat
- Requires: departure city, destination match city, and match date
- Returns up to 10 results by default (configurable)
- Results include: airline, flight number, departure/arrival times, stops, duration, and price
- Supports multi-currency pricing (USD, EUR, GBP, JPY, INR, CAD, AUD, MXN)
- Supports filtering by: airline name/IATA code, nonstop preference, price range
- Supports sorting by: price (asc/desc), duration, stops, departure time
- If no departure city is provided, the assistant asks the user before searching

**UI:** `FlightSearchPanel.tsx` — renders a sortable, filterable card list of flight results returned from the API.

---

### 3.4 Hotel Search

**Purpose:** Find hotels near World Cup venues for match nights.

**Behavior:**
- Triggered by a `hotel_search` intent from the chat
- Requires: city, check-in date, check-out date
- Smart defaults: check-in = day before match, check-out = day after match
- If no preference is specified by the user, a **Hotel Search Form** is shown in the chat UI before the API call is made
- Hotel preference options: `cheapest`, `nearest` (to venue), `best-rated`
- Supports optional `max_distance_miles` filter
- Supports multi-currency pricing
- Returns results categorized by the selected preference

**UI:** `HotelSearchForm.tsx` — inline form rendered within chat to capture hotel preferences before the API call.

---

### 3.5 Head-to-Head Statistics

**Purpose:** Show historical match records between any two international teams.

**Behavior:**
- Accessible via the API endpoint `GET /api/v1/h2h/{team1}/{team2}`
- Returns a nested JSON object with:
  - `summary` — object containing `total_matches`, `team1_wins`, `team2_wins`, `draws`
  - `history` — array of historical match records (with `year`, `home_team`, `away_team`, `home_score`, `away_score`, `home_penalties`, `away_penalties`, `result`, `stadium`, `city`, `attendance`)
  - `team1_recent` — array of last 5 matches for team 1
  - `team2_recent` — array of last 5 matches for team 2

---

### 3.6 Authentication

**Purpose:** Identify users for rate limiting and session management.

**Behavior:**
- Login/signup via Supabase Auth (email/password or OAuth)
- User identity is used to enforce the 15-query-per-12-hour rate limit
- Authenticated state persisted across browser sessions
- Admin users (configured via `ADMIN_EMAILS` env var) bypass rate limits

**UI Component:** `AuthModal.tsx` — modal for login/signup flow.

---

### 3.7 Multi-Currency Support

**Purpose:** Allow users from different countries to see prices in their preferred currency.

**Supported Currencies:** USD, EUR, GBP, JPY, INR, CAD, AUD, MXN

**Behavior:**
- Currency preference can be set via chat ("show prices in EUR") or via a UI control
- Currency preference is persisted for the duration of the session
- Applied to both flight and hotel search results

---

## 4. Agent Architecture

The chat backend runs a **4-agent LangGraph pipeline**:

```
User Message
     │
     ▼
Orchestrator Agent
  ├── Classifies intent (flight_search, hotel_search, match_info, general, flight_refine)
  ├── Extracts entities (team, city, departure_city, date, airline, currency, etc.)
  └── Queries match database if team/city/stage entities are present
     │
     ├── flight_search ──► Scout Agent ──► Amadeus Flights API ──► LLM summary
     ├── hotel_search  ──► Concierge Agent ──► Amadeus Hotels API ──► LLM summary
     └── match_info / general / flight_refine
     │
     ▼
Liaison Agent
  └── Formats final user-facing response (uses LLM to produce natural language)
```

### Agent Descriptions

| Agent | Role |
|---|---|
| **Orchestrator** | Intent classification and entity extraction. Routes to the appropriate specialist. |
| **Scout** | Flight search specialist. Calls Amadeus flight search API and summarizes results. |
| **Concierge** | Hotel search specialist. Calls Amadeus hotel search API and summarizes results. |
| **Liaison** | Final formatting agent. Produces the user-visible natural language response. |

### LLM
- **Model:** OpenAI `gpt-4o-mini`
- **Temperature:** 0.3 (deterministic, factual responses)

---

## 5. Data Sources

| Data | Source |
|---|---|
| Match schedule (teams, venues, kickoff times) | SQLite local database (seeded from official FIFA data) |
| Historical H2H match records | SQLite local database |
| Live flight prices | Amadeus Travel API |
| Live hotel availability & prices | Amadeus Travel API |
| General web search (fallback) | Tavily Search API |
| Visa information | Placeholder endpoint (future feature) |

---

## 6. API Endpoints

| Method | Endpoint | Auth Required | Description |
|---|---|---|---|
| `GET` | `/health` | No | Health check |
| `GET` | `/api/v1/matches` | No | List all matches |
| `GET` | `/api/v1/matches/{match_id}` | No | Get a single match |
| `GET` | `/api/v1/h2h/{team1}/{team2}` | No | Head-to-head history |
| `GET` | `/api/v1/chat/limit` | Yes | Check remaining query quota |
| `POST` | `/api/v1/chat` | Yes | Send a chat message |
| `POST` | `/api/v1/visa` | No | Visa info (stub) |

### Match Response Schema (`GET /api/v1/matches` and `GET /api/v1/matches/{match_id}`)

Each match object has the following fields:

```json
{
  "match_id": 1,
  "kickoff_utc": "2026-06-11T18:00:00Z",
  "home_team": "Mexico",
  "away_team": "Japan",
  "group_name": "A",
  "stage": "Group Stage",
  "stadium": "Estadio Azteca",
  "city": "Mexico City",
  "host_country": "Mexico",
  "metadata": null
}
```

- `GET /api/v1/matches` returns an **array** of match objects.
- `GET /api/v1/matches/{match_id}` returns a **single** match object.

> **Note:** The kickoff time field is named `kickoff_utc` (ISO 8601 UTC timestamp), not `kickoff`.

### Head-to-Head Response Schema (`GET /api/v1/h2h/{team1}/{team2}`)

```json
{
  "summary": {
    "total_matches": 42,
    "team1_wins": 18,
    "team2_wins": 15,
    "draws": 9
  },
  "history": [
    {
      "year": 2022,
      "match_date": "2022-12-09",
      "stage": "World Cup Quarter-final",
      "home_team": "Argentina",
      "away_team": "Netherlands",
      "home_score": 2,
      "away_score": 2,
      "home_penalties": 4,
      "away_penalties": 3,
      "result": "Argentina win",
      "stadium": "Lusail Stadium",
      "city": "Lusail",
      "attendance": 88966
    }
  ],
  "team1_recent": [ /* last 5 matches for team1 */ ],
  "team2_recent": [ /* last 5 matches for team2 */ ]
}
```

> **Note:** Stats are nested under `summary`, not at the top level. Historical matches are under `history`, and recent form is split into `team1_recent` and `team2_recent`.

### Chat Request Schema (`POST /api/v1/chat`)

```json
{
  "message": "Find me flights from London to New York for the England game",
  "session_id": "abc123",
  "airline": "BA",
  "date": "2026-07-10",
  "timezone": "America/New_York",
  "currency": "GBP"
}
```

### Chat Response Schema

```json
{
  "reply": "Here are the best flights I found...",
  "flights": [...],
  "hotels": [...],
  "match": {...},
  "show_hotel_form": false,
  "sort": "price",
  "currency": "GBP",
  "refinement": {...},
  "queries_remaining": 12
}
```

---

## 7. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Backend | FastAPI, Python 3.12, Uvicorn |
| Agent Framework | LangGraph (multi-agent orchestration) |
| LLM | OpenAI GPT-4o-mini |
| Database | Supabase (PostgreSQL) + SQLite (local cache) |
| Travel APIs | Amadeus (flights & hotels) |
| Web Search | Tavily |
| Authentication | Supabase Auth |

---

## 8. Non-Functional Requirements

### 8.1 Rate Limiting
- 15 queries per user per 12-hour rolling window
- Enforced server-side using Supabase Auth identity
- Rate limit status returned with every chat response (`queries_remaining`)

### 8.2 Session Management
- In-memory session store on the backend, keyed by `session_id`
- Persists: conversation history (last 10 messages), match context, departure city, airline preference, currency, check-in/out dates
- No cross-session persistence (session state is lost on server restart)

### 8.3 Security
- All chat endpoints require a valid Supabase JWT
- Admin emails configured via environment variable (not hardcoded)
- API keys stored in `.env` (not committed to version control)

### 8.4 Performance
- LLM calls use `gpt-4o-mini` for low latency
- Match data served from local SQLite cache (no external API call)
- Flight/hotel results fetched on-demand (live API call per request)

---

## 9. Project Structure

```
fifa-26/
├── backend/
│   └── app/
│       ├── main.py                # FastAPI entry point
│       ├── api/
│       │   ├── routes.py          # All API endpoints
│       │   └── auth.py            # Auth & rate limiting
│       ├── agents/
│       │   ├── graph.py           # LangGraph workflow definition
│       │   ├── nodes.py           # Orchestrator, Scout, Concierge, Liaison agents
│       │   ├── state.py           # Shared AgentState schema
│       │   ├── tools/
│       │   │   ├── flight_search.py
│       │   │   ├── hotel_search.py
│       │   │   ├── match_search.py
│       │   │   └── visa_checker.py
│       │   └── prompts/
│       │       └── system.py      # LLM system prompts per agent
│       └── db/
│           ├── client.py          # Supabase client
│           ├── repository.py      # Data access layer (matches, H2H, recent form)
│           └── schemas.py         # Pydantic models
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── pages/
│       │   └── Matches.tsx
│       ├── components/
│       │   ├── AuthModal.tsx
│       │   ├── ChatSidebar.tsx
│       │   ├── FavoritesSidebar.tsx
│       │   ├── FlightSearchPanel.tsx
│       │   ├── HotelSearchForm.tsx
│       │   ├── LeftSidebar.tsx
│       │   ├── MainLayout.tsx
│       │   ├── MatchDetailsModal.tsx
│       │   ├── TeamPicker.tsx
│       │   └── TimeZoneSelector.tsx
│       ├── context/               # React context providers
│       ├── hooks/                 # Custom React hooks
│       ├── lib/                   # Supabase client, utilities
│       └── types/                 # TypeScript type definitions
├── pyproject.toml
├── uv.lock
└── README.md
```

---

## 10. Environment Configuration

### Backend (`.env` in project root)

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key for LLM calls |
| `GEMINI_API_KEY` | Google Gemini API key (reserved) |
| `TAVILY_API_KEY` | Tavily web search API key |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (server-side) |
| `AMADEUS_API_KEY` | Amadeus Travel API key |
| `AMADEUS_API_SECRET` | Amadeus Travel API secret |
| `ADMIN_EMAILS` | Comma-separated list of admin email addresses |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (client-side) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key (client-side) |

---

## 11. Getting Started

### Prerequisites
- Python 3.12+
- Node.js 18+
- [uv](https://docs.astral.sh/uv/) Python package manager

### Backend

```bash
uv sync
uvicorn backend.app.main:app --reload
# Runs on http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

---

## 12. Known Limitations & Future Work

| Area | Current State | Future Improvement |
|---|---|---|
| Visa Information | Stub endpoint only | Integrate real visa requirement data by nationality |
| Session Persistence | In-memory only (lost on restart) | Persist sessions in Supabase |
| H2H in Chat | Only available via direct API | Expose H2H data through the chat assistant |
| Hotel Search Form | Shown in chat when preference is missing | Pre-populate form from user history |
| Multi-leg Trips | Not supported | Allow searching connecting flights across multiple match cities |
| Push Notifications | Not supported | Notify users of lineup changes or kickoff reminders |
| Mobile App | Web only | React Native or PWA for mobile |
