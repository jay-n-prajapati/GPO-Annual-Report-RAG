# GPO 2018 Annual Report Q&A (RAG, Use Case 1)

Question answering over one plain-text PDF, the U.S. Government Publishing Office 2018 Annual Report.
A correct answer is the exact fact from the document with nothing added; if the document does not contain
the answer, the system replies exactly `Not in the document.`

## How it works

```
PDF -> unpdf (per page) -> clean -> sentence-aware chunks (~900 chars, ~15% overlap)
    -> Gemini embeddings (gemini-embedding-001, 768 dims) -> Postgres + pgvector (HNSW, cosine)

question -> embed -> top-5 chunks -> strict grounded prompt -> Gemini chat (gemini-3.8-flash)
         -> streamed answer citing PDF pages + the retrieved sources
```

Next.js 16 serves the chat page and a streaming `POST /api/ask` route. Ingestion, the CLI and the eval run on
the host and talk to the Dockerized database.

## Prerequisites

- Node.js 22, npm
- Docker (Compose v2)
- A Gemini API key
- The PDF saved as `data/gpo-2018-annual-report.pdf` (git-ignored)

## Setup

1. Create `.env.local` (git-ignored; compose reads it via `--env-file`):

   ```
   GEMINI_API_KEY=your-gemini-api-key
   POSTGRES_USER=task1
   POSTGRES_PASSWORD=change-me
   POSTGRES_DB=task1_rag
   DATABASE_URL=postgres://task1:change-me@localhost:5432/task1_rag
   ```

   Keep the password in `DATABASE_URL` in sync with `POSTGRES_PASSWORD`.

2. Start the database and install dependencies:

   ```bash
   docker compose --env-file .env.local up -d db
   npm install
   npm run db:migrate
   ```

3. Ingest the PDF (a few minutes on the free tier, see quotas below):

   ```bash
   npm run ingest            # skips if the PDF and settings are unchanged
   npm run ingest -- --force # re-ingest anyway
   ```

## Usage

| Command | What it does |
|---|---|
| `npm run dev` | Chat UI at http://localhost:3000 |
| `npm run ask "<question>"` | Ask from the terminal; prints the answer, cited pages and similarity scores |
| `npm run eval` | Run the golden question set (`--ids a,b`, `--json`, `--retrieval-only`) |
| `npm run dump:pdf` | Dump raw per-page PDF text to `data/extracted/raw-pages.txt` |
| `npm run db:generate` / `npm run db:migrate` | Create / apply Drizzle migrations |

Set `RAG_DEBUG=1` to log the query, retrieved chunk ids, pages, scores and answer.

## Full stack in Docker

```bash
docker compose --env-file .env.local up -d --build
```

This builds the standalone Next.js image and runs `db` (pgvector/pgvector:pg17, 384 MB limit) and `app`
(256 MB limit, read-only filesystem). The app listens on http://localhost:3000. Ingest still runs on the host
against `localhost:5432`.

## Free-tier quotas

- Embeddings: 100 requests per minute (each text in a batch seems to count), so a full ingest takes a few
  minutes with retries.
- Chat (`gemini-3.8-flash`): about 20 requests per day. When it is exhausted the UI shows a quota message and
  `npm run eval` cannot complete the answer checks (`--retrieval-only` still works).

## Layout

```
src/app/            Next.js page and /api/ask route
src/components/     chat UI (ask-panel, answer, sources)
src/lib/rag/        clean, chunk, embed, answer (retrieve + generate), config
src/lib/db/         Drizzle schema and client
scripts/            ingest, ask, eval, dump-pdf
evals/golden.json   golden questions (draft, pending review)
drizzle/            SQL migrations
db/init.sql         enables the pgvector extension
specs/              decisions and plans (see below)
```

## Project docs

- `specs/decisions.md`: append-only decision log
- `specs/rag-ingestion/spec.md`, `plan.md`, `progress.md`: requirements, phased plan and status
- `specs/rag-ingestion/cleaning-rules.md`: PDF text cleaning rules
- `specs/rag-ingestion/eval-review.md`: evidence for each golden question

## Status

Ingestion, retrieval, the CLI and the chat UI are built. The full eval run and any tuning are pending the golden
set review and the daily chat quota reset. See `specs/rag-ingestion/progress.md`.
