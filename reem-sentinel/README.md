# Reem-AI Sentinel

Automated news monitoring and AI content generation system for an Israeli public figure.

## Architecture

```
reem-sentinel/
├── web/          # Next.js frontend (dashboard)
├── worker/       # Python worker (scraping + AI analysis)
├── supabase/     # Database migrations & seed data
└── README.md
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router) + Tailwind CSS + shadcn/ui + next-intl (HE/EN) |
| Database | Supabase (PostgreSQL + pgvector + Auth + Realtime) |
| Worker | Python + FastAPI + APScheduler (deployed on Railway) |
| Scraping | Firecrawl API + RSS (feedparser) |
| AI | Claude API (analysis + generation) |
| Email | Resend |

### Data Flow

```
News Sources → Python Worker (scrape + AI) → Supabase DB ← Next.js Dashboard
                                                ↓
                                          Email Briefs (Resend)
```

## Setup

### Prerequisites

- Node.js 20+
- Python 3.11+
- Supabase CLI (`npm install -g supabase`)

### 1. Supabase (Database)

```bash
# Start local Supabase
supabase start

# Apply migrations and seed data
supabase db reset
```

### 2. Frontend (web/)

```bash
cd web
cp .env.local.example .env.local
# Edit .env.local with your Supabase URL and anon key
npm install
npm run dev
```

Open http://localhost:3000 — redirects to `/he/dashboard`.

### 3. Worker (worker/)

```bash
cd worker
cp .env.example .env
# Edit .env with your API keys
pip install -e .
python -m src.main
```

Worker runs on http://localhost:8000. Health check at `GET /health`.

## Database Schema

18 tables including:
- **sources** — 11 Israeli news outlets (Ynet, N12, Walla, etc.)
- **articles** — deduplicated by URL hash
- **analyses** — AI relevance scoring + sentiment analysis
- **generated_content** — AI content with approval workflow
- **knowledge_base** + **knowledge_base_chunks** — RAG with pgvector
- **briefs** — email intelligence reports

## i18n

Hebrew (default) and English. RTL mirroring via CSS logical properties.
Switch languages via the sidebar toggle.

## Scan Schedule

Default: **08:00** and **14:30** Israel time (configurable in `system_config`).
Manual trigger: `POST /api/scan/trigger` on the worker.
