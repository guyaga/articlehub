# ArticleHub

AI-powered news monitoring and intelligence platform. The system scans configurable news sources on a schedule, analyzes articles for relevance using Claude AI, and generates response content — all managed through a bilingual (Hebrew/English) dashboard.

## Architecture

```
articlehub/
├── web/              # Next.js 16 frontend (dashboard)
├── supabase/
│   ├── functions/    # 7 Supabase Edge Functions (Deno/TS)
│   ├── migrations/   # 7 SQL migration files
│   └── seed.sql      # Initial seed data (news sources)
└── worker/           # Legacy Python FastAPI worker (archived, replaced by edge functions)
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + shadcn/ui + next-intl (HE/EN) |
| Database | Supabase (PostgreSQL + pgvector + Auth + Realtime) |
| Backend | Supabase Edge Functions (Deno 2 + TypeScript) |
| Scraping | Firecrawl API + RSS parsing |
| AI | Claude API (relevance analysis + content generation) |
| Email | Resend (intelligence briefs) |
| Hosting | Vercel (frontend) + Supabase (backend + DB) |

### Data Flow

```
                    pg_cron (scheduled)
                         │
                         ▼
               ┌─── scan-trigger ───┐
               │                    │
               ▼                    ▼
         scan-scrape          scan-scrape    (parallel batches)
               │                    │
               ▼                    ▼
         scan-process         scan-process   (Claude AI analysis)
               │                    │
               └────────┬───────────┘
                        ▼
                   Supabase DB  ◄────  Next.js Dashboard
                        │
                        ▼
                send-brief (Resend email)
```

### Edge Functions

| Function | Purpose | Auth |
|----------|---------|------|
| `scan-trigger` | Kicks off a scan cycle | Internal (no JWT) |
| `scan-orchestrator` | Coordinates parallel scan batches | Internal |
| `scan-scrape` | Scrapes articles via Firecrawl + RSS | Internal |
| `scan-process` | AI relevance analysis via Claude | Internal |
| `generate-content` | AI content generation | JWT required |
| `article-drill-down` | Deep article analysis | JWT required |
| `send-brief` | Email intelligence briefs via Resend | JWT required |

## Prerequisites

- **Node.js 20+** (for the frontend)
- **Supabase CLI** — `npm install -g supabase`
- **Python 3.11+** (only if running the legacy worker)

### API Keys Needed

| Service | What for | Get it at |
|---------|----------|-----------|
| Supabase | Database + Auth + Edge Functions | [supabase.com](https://supabase.com) |
| Anthropic | Claude AI analysis + generation | [console.anthropic.com](https://console.anthropic.com) |
| Firecrawl | Web scraping | [firecrawl.dev](https://firecrawl.dev) |
| Resend | Email briefs | [resend.com](https://resend.com) |

## Local Setup

### 1. Clone the repo

```bash
git clone https://github.com/guyaga/articlehub.git
cd articlehub/reem-sentinel
```

### 2. Supabase (Database + Edge Functions)

```bash
# Link to your Supabase project (or start local)
supabase link --project-ref YOUR_PROJECT_REF

# Apply migrations
supabase db push

# Or for a fresh local setup:
supabase start
supabase db reset   # applies migrations + seed data
```

Set edge function secrets on your Supabase project:

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set FIRECRAWL_API_KEY=fc-...
supabase secrets set RESEND_API_KEY=re_...
```

Deploy edge functions:

```bash
supabase functions deploy scan-trigger
supabase functions deploy scan-orchestrator
supabase functions deploy scan-scrape
supabase functions deploy scan-process
supabase functions deploy generate-content
supabase functions deploy article-drill-down
supabase functions deploy send-brief
```

### 3. Frontend (web/)

```bash
cd web
npm install
```

Create `.env.local`:

```env
# Supabase connection
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Service role key (used by /api/data server route to bypass RLS)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Run the dev server:

```bash
npm run dev
```

Open http://localhost:3000 — redirects to `/he/dashboard` (Hebrew by default).

### 4. Legacy Worker (worker/) — Optional

The Python worker has been replaced by Supabase Edge Functions. It's kept for reference.

```bash
cd worker
cp .env.example .env
# Edit .env with your API keys
pip install -e .
python -m src.main
```

## Deployment

### Frontend (Vercel)

The frontend is deployed on Vercel. Required environment variables:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

> **Important:** `NEXT_PUBLIC_` variables are embedded at build time, not runtime. Set them before deploying.

### Edge Functions (Supabase)

Edge functions are deployed via `supabase functions deploy`. Secrets are set via `supabase secrets set`.

Scan schedules are configured via `pg_cron` in the database:
- **Morning scan:** 06:00 UTC (09:00 Israel time)
- **Afternoon scan:** 12:30 UTC (15:30 Israel time)

## Database Schema

18 tables including:

| Table | Purpose |
|-------|---------|
| `sources` | Configurable news outlets (Ynet, N12, Walla, etc.) |
| `articles` | Deduplicated by URL hash |
| `analyses` | AI relevance scoring + sentiment analysis |
| `generated_content` | AI content with approval workflow |
| `knowledge_base` + `knowledge_base_chunks` | RAG with pgvector embeddings |
| `briefs` | Email intelligence reports |
| `scan_cycles` + `scan_batches` | Scan orchestration tracking |
| `system_config` | Runtime configuration |

## i18n

Hebrew (default) and English. RTL mirroring via CSS logical properties.

Translation files:
- `web/src/messages/he.json` (Hebrew)
- `web/src/messages/en.json` (English)

Switch languages via the sidebar toggle.

## Scan Schedule

Default: **09:00** and **15:30** Israel time (configurable in `system_config` table).

Manual trigger via edge function:
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/scan-trigger \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

## Known Limitations

- **Supabase free tier:** 60s edge function timeout. The orchestrator fires scan-process batches in parallel; batches continue running even if the orchestrator times out.
- **Large payloads:** Article content is truncated to 1K lead text to avoid exceeding edge function body limits.
- **Deno crypto:** MD5 is not supported in `crypto.subtle` — SHA-256 truncated to 32 hex chars is used instead.
