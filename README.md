# FIFA 2026 World Cup Assistant

An intelligent travel and match planning assistant for the 2026 FIFA World Cup. Ask questions in natural language to explore match schedules, search for flights and hotels, and plan your World Cup trip.

## Features

- **Match Browser** — Browse all FIFA 2026 match schedules with team filtering
- **AI Chat Assistant** — Conversational interface powered by a multi-agent LangGraph pipeline
- **Flight Search** — Search flights to match venues via Amadeus API, with filtering by airline, stops, price, and duration
- **Hotel Search** — Find hotels near venues, categorized by cheapest, nearest, and best-rated
- **Head-to-Head Stats** — Historical match data between any two teams
- **Authentication** — Supabase-based auth with rate limiting (15 queries per 12-hour window)
- **Multi-currency Support** — USD, EUR, GBP, JPY, INR, CAD, AUD, MXN

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Backend | FastAPI, Python 3.12, Uvicorn |
| Agent Framework | LangGraph (multi-agent orchestration) |
| LLMs | OpenAI GPT-4o-mini |
| Database | Supabase (PostgreSQL) + SQLite (local cache) |
| Travel APIs | Amadeus (flights & hotels) |
| Search | Tavily |
| Auth | Supabase Auth |

## Agent Architecture

The chat backend uses a 4-agent LangGraph pipeline:

```
User Message
     │
     ▼
Orchestrator  ──── classifies intent, extracts entities
     │
     ├── flight_search  ──►  Scout Agent  ──► Amadeus flights
     ├── hotel_search   ──►  Concierge Agent ──► Amadeus hotels
     └── match_info / general
     │
     ▼
Liaison Agent  ──── formats and returns response to user
```

## Project Structure

```
fifa-26/
├── backend/
│   └── app/
│       ├── main.py            # FastAPI entry point
│       ├── api/
│       │   ├── routes.py      # API endpoints
│       │   └── auth.py        # Auth & rate limiting
│       ├── agents/
│       │   ├── graph.py       # LangGraph workflow
│       │   ├── nodes.py       # Agent definitions
│       │   ├── state.py       # Shared agent state
│       │   ├── tools/         # Flight, hotel, match, visa tools
│       │   └── prompts/       # LLM system prompts
│       └── db/
│           ├── client.py      # Supabase client
│           ├── repository.py  # Data access layer
│           └── schemas.py     # Pydantic models
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── pages/
│       │   └── Matches.tsx
│       └── components/        # Chat, flights, hotels, auth UI
├── pyproject.toml
└── uv.lock
```

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- [uv](https://docs.astral.sh/uv/) (Python package manager)

### Environment Variables

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=
GEMINI_API_KEY=
TAVILY_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
AMADEUS_API_KEY=
AMADEUS_API_SECRET=
ADMIN_EMAILS=
```

Create `frontend/.env`:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

### Backend

```bash
# Install dependencies
uv sync

# Start the server (runs on http://localhost:8000)
uvicorn backend.app.main:app --reload
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (runs on http://localhost:5173)
npm run dev
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/api/v1/matches` | List all matches |
| `GET` | `/api/v1/matches/{match_id}` | Get match details |
| `GET` | `/api/v1/h2h/{team1}/{team2}` | Head-to-head stats |
| `GET` | `/api/v1/chat/limit` | Check rate limit status |
| `POST` | `/api/v1/chat` | Send a chat message |

## Frontend Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build
npm run lint      # Run ESLint
```
