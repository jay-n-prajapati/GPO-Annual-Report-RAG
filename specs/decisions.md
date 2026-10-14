# Decision Log

Append-only. Newest entries go at the bottom. Mark any time the user chose something other than the
recommended option as **OVERRIDE**, and when a decision replaces an earlier one, say which.

Format: `D-NN | date | area | decision | why | status`

| ID | Date | Area | Decision | Why / notes | Status |
|----|------|------|----------|-------------|--------|
| D-01 | 2026-10-12 | Infra | Docker Compose with `db` (Postgres) + `app` (Next.js standalone), resource-limited (db 384m, app 256m), read-only app FS, localhost-bound DB port | Simple, optimized, resource friendly | Active |
| D-02 | 2026-10-12 | LLM | Hosted APIs, no local model server | No GPU/RAM cost, only API keys | Active (provider refined by D-13) |
| D-03 | 2026-10-12 | Vector store | pgvector in the existing Postgres (`pgvector/pgvector:pg17`, `db/init.sql` runs `CREATE EXTENSION vector`) | One DB for chunks, metadata, vectors | Active |
| D-04 | 2026-10-12 | Ingestion | In-app Node/TS script (`npm run ingest`), no Python sidecar | Plain-text doc, no extra container | Active |
| D-05 | 2026-10-12 | Eval | Golden Q&A script (`npm run eval`): 3 given questions + extras + an out-of-scope "not in the document" case, string-match checks | Repeatable pass/fail for the "no invented facts" bar | Active |
| D-06 | 2026-10-12 | Dev workflow | `docker compose up db` + `npm run dev` on host; compose `app` service is for prod-like runs | Hot reload, fast scripts | Active |
| D-07 | 2026-10-12 | DB layer | **OVERRIDE** - Drizzle ORM (recommended was raw `postgres.js`) | User wants typed queries/migrations and is learning | Active |
| D-08 | 2026-10-12 | DB driver | `postgres` (postgres.js) under Drizzle | Light, pure JS | Active |
| D-09 | 2026-10-12 | Migrations | `drizzle-kit generate` + `migrate`; schema in `src/lib/db/schema.ts`; `db/init.sql` keeps only `CREATE EXTENSION vector` | Reviewable, repeatable history | Active |
| D-10 | 2026-10-12 | LLM SDK | **OVERRIDE** - Gemini instead of Claude (question offered Anthropic SDK vs Vercel AI SDK; user answered "gemini") | User preference | Active |
| D-11 | 2026-10-12 | LLM SDK | `@google/genai` (not Vercel AI SDK); one `GEMINI_API_KEY` covers chat + embeddings | Fewest deps; AI SDK does not reduce key count (keys are per provider) | Active |
| D-12 | 2026-10-12 | Packages | Installed `drizzle-orm`, `postgres`, `@google/genai`, `zod`, dev `drizzle-kit`. `unpdf` deferred at the time (see D-14); `tsx` not selected, add when scripts are written | User chose zod only from the extras | Active |
| D-13 | 2026-10-12 | Env | `.env.local` with placeholders: `GEMINI_API_KEY`, `POSTGRES_*`, `DATABASE_URL` (localhost). Compose reads `.env`, so use `docker compose --env-file .env.local` | Compose `app` now requires `GEMINI_API_KEY` (replaced `ANTHROPIC_API_KEY` / `EMBEDDING_API_KEY`) | Active |
| D-14 | 2026-10-12 | Extraction | `unpdf`, page by page (overrides the earlier "defer PDF parsing" stance, now decided) | Pure JS, page numbers for citations | Active, not yet installed |
| D-15 | 2026-10-12 | Cleaning | Inspect extracted text first, then add only the minimal rules observed | Learning-oriented, every rule justified | Active |
| D-16 | 2026-10-12 | Chunking | Recursive, paragraph-aware, ~800-1000 chars, ~15% overlap, page number kept per chunk | Standard baseline, tunable | Active |
| D-17 | 2026-10-12 | Embeddings | Gemini embeddings at 768 dims via `outputDimensionality`; `RETRIEVAL_DOCUMENT` for chunks, `RETRIEVAL_QUERY` for questions | HNSW limit 2000 dims; small and cheap | Active (model name to verify in docs) |
| D-18 | 2026-10-12 | Re-runs | `documents` + `chunks` tables; re-ingest replaces a document's chunks in one transaction; skip if file hash + config unchanged | No duplicates, saves embedding calls | Active |
| D-19 | 2026-10-12 | Embedded text | Embed "document title + page" header + chunk text; store clean chunk text and metadata separately | Cheap context for retrieval, clean citations | Active |
| D-20 | 2026-10-14 | Embed model | `gemini-embedding-001` at 768 dims; normalize vectors ourselves (docs do not confirm 768-dim output is normalized) | Stable, text-focused, documented dimension option; `gemini-embedding-2` (multimodal) revisit for Use Cases 2-3 | Active (confirms D-17) |
| D-21 | 2026-10-14 | Chat model | Gemini Flash tier; exact model ID to be confirmed from the models page before coding (docs names conflicted) | Cheap/fast, enough for extraction from supplied context | Active |
| D-22 | 2026-10-14 | Tooling | `tsx` as dev dependency for `ingest`, `eval` scripts | Handles `@/` aliases and ESM | Active, not yet installed |
| D-23 | 2026-10-14 | Retrieval | Vector search, top-k = 5 as a config value; add Postgres full-text (hybrid) only if eval shows exact-token failures | Baseline first, measure, then fix | Active |
| D-24 | 2026-10-14 | Refusal | Prompt-only first; log similarity scores; add a similarity cutoff later from real eval data | Avoid guessing a threshold | Active |
| D-25 | 2026-10-14 | Prompt | Strict grounding: context only, cite pages, exact "Not in the document" refusal, temperature ~0; plain text output | Targets the pass/fail bar | Active |
| D-26 | 2026-10-14 | Chat | Single-turn Q&A; multi-turn with question rewriting is a later spec | Matches acceptance questions, simpler | Active |
| D-27 | 2026-10-14 | UI | One page: input, streamed answer, collapsible sources panel (chunks, pages, scores) using shadcn | Sources let us verify grounding | Active |
| D-28 | 2026-10-14 | Eval set | Claude drafts 8-10 questions from the PDF with expected values + pages (incl. 2 out-of-scope); user reviews against the PDF | A wrong expected answer would ruin the eval | Active |
| D-29 | 2026-10-14 | Embed calls | Batched requests (~20-50 chunks), retry with exponential backoff on 429/5xx, fail whole ingest on final failure (DB write is one transaction) | Rate-limit safe, old data survives failure | Active |
| D-30 | 2026-10-14 | Execution | Migrations and ingest run on the host only against the Dockerized DB; prod image carries no dev tooling | Small image | Active |
| D-31 | 2026-10-14 | Logging | Retrieval debug logging (query, chunk IDs, pages, scores, answer) behind `RAG_DEBUG=1`, dev only | No doc text in prod logs | Active |
| D-32 | 2026-10-14 | Scope | Use Case 1 only. Use Cases 2 (long structured report) and 3 (visual document) are separate builds, not part of this system. No `profile`/`kind` columns or multi-document scoping now | Different problems; keep UC1 simple. We recommended one shared system with per-document profiles, user chose to keep them separate | Active |
| D-33 | 2026-10-14 | Cleaning | Adopt cleaning rules 1-8 in `specs/rag-ingestion/cleaning-rules.md` (fixed header/footer list, edge-of-page numbers, dot leaders + TOC page excluded, line re-flow, keep EOL hyphens, char normalization, never touch digits) plus a post-clean safety check on known facts | Each rule backed by observed noise in the extracted text | Active, not yet implemented |
| D-34 | 2026-10-14 | Chunking | Chunker is sentence-aware, not paragraph-aware (extraction has no paragraph breaks); pack sentences to ~800-1000 chars with ~15% overlap | Refines D-16 | Active (refines D-16) |
| D-35 | 2026-10-14 | Citations | Cite the PDF page index (not the printed page number) | Matches the page counter in any PDF viewer | Active |
| D-36 | 2026-10-14 | Financial pages | Keep financial-statement pages in the index for now; revisit if the eval shows they hurt retrieval | Not needed for acceptance questions; measure before excluding | Active |

## Open questions
- Exact Gemini Flash model ID (confirm on the models page).
- `npm audit` warnings after install were not reviewed.
- Chunk size/overlap and top-k values to be tuned against the eval set once it exists.
- Column reading order (cleaning-rules open question C): spot-check a few pages after rule 5 is implemented.
- Hybrid search and similarity cutoff are deferred until eval data exists.
