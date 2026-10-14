# Progress: RAG ingestion

Update after each working session. Newest first. Phase details are in `plan.md`.

## Phase tracker
| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Foundation: Docker, deps, env, PDF, extraction dump, cleaning rules drafted | DONE |
| 1 | Walking skeleton: schema + migration, naive ingest, `npm run ask` end to end, baseline | BUILT, awaiting live run: needs a real `GEMINI_API_KEY` in `.env.local`, then `npm run ingest` and `npm run ask` (no Gemini call has been made) |
| 2 | Quality ingestion: clean + sentence-aware chunker + idempotent re-runs | NOT STARTED |
| 3 | Eval harness: golden set, `npm run eval`, debug logging, tuning | NOT STARTED |
| 4 | API route + chat UI with sources | NOT STARTED |
| 5 | Hardening: compose e2e, audit, README | NOT STARTED |

## 2026-10-14 (Phase 1 build)
- Built: `src/lib/env.ts`, Drizzle schema + `drizzle.config.ts` + migration `drizzle/0000_*.sql`, `src/lib/rag/{config,chunk,embed}.ts`, `scripts/ingest.mts`, `scripts/ask.mts`; npm scripts `db:generate`, `db:migrate`, `ingest`, `ask`.
- Verified (no API): db container healthy, migration applied; `vector` 0.8.7, `chunks`/`documents` tables, HNSW cosine index and FK cascade exist; chunker, L2 normalizer, and DB insert + cosine search + cascade delete checked with throwaway fake-vector tests (removed); `npx tsc --noEmit` and `npm run lint` clean; real PDF -> 249 chunks (~13 embed requests).
- NOT verified: any Gemini call (embedContent, generateContent), `npm run ingest` and `npm run ask` end to end, retry/backoff path. `.env.local` still holds the placeholder key.
- Confirmed from docs: model IDs and embed call shape (D-37, D-38). Impl notes in D-39.
- Environment note: Docker Desktop context (`desktop-linux`) was not running; used `DOCKER_HOST=unix:///var/run/docker.sock` for this session only. The `task-1_pgdata` volume was created fresh.
- Next: set real key, run `npm run ingest` then ask the 3 acceptance questions and record the baseline.

## 2026-10-14 (Phase 1 live run)
- Ingest: 82 pages -> 249 chunks stored (naive 900-char chunks, no cleaning). Needed retry fix for the free-tier 429 (D-40).
- BASELINE, top-5, no cleaning, `gemini-3.8-flash`, answers checked against `data/extracted/raw-pages.txt`:
  1. Libraries visited: "166 depository libraries" (pages 5, 21). CORRECT (top similarity 0.830).
  2. FDsys replacement: govinfo; moved out of beta Dec 2017; FDsys scheduled to be retired/replaced Dec 2018 (pages 10, 22, 39). CORRECT, faithful to the text, which says "scheduled" (top similarity 0.666, the weakest retrieval of the three).
  3. Procurement: "more than $375 million" (page 5). CORRECT (top similarity 0.808). The text also gives $375.7 million elsewhere (pages ~25).
- Observation: the Q2 answer cites pages (10, 22, 39) while the top similarity is only 0.666; watch it in Phase 2/3.
- Open: `npm audit` still not reviewed.
- Next: Phase 2 quality ingestion. Commit Phase 1 first (uncommitted in working tree).

## 2026-10-14
- Done: requirement/dev decisions D-20..D-31 recorded (models, retrieval, grounding, UI, eval, execution, logging). All recommended options; no overrides.
- Not started: application code. `unpdf` and `tsx` not installed yet.
- Done: installed `unpdf` + `tsx`; `npm run dump:pdf` extracts 82 pages / ~171k chars. Facts for the 3 acceptance questions are present in the text (166 depository libraries visited, govinfo replaced FDsys, 802,834 copies).
- Observed noise: letter-spaced running header/footer lines ('2 0 1 8 A N N U A L R E P O R T | U . S . ...', ~32), sometimes glued to the next sentence with no newline; page 2 is empty; harmless 'TT: undefined function: 32' font warning.
- Done: cleaning rules approved (D-33..D-36).
- Planned work in vertical phases 1-5 (see tracker above); plan.md rewritten.
- Next: Phase 1 walking skeleton.

## 2026-10-12
- Done: Docker (pgvector db + app), packages installed (drizzle-orm, postgres, @google/genai, zod, drizzle-kit), `.env.local` placeholders, ingestion design decided.
- Not started: any application code, PDF not yet in repo, `unpdf` not installed.
- PDF moved to `data/gpo-2018-annual-report.pdf`; `data` added to `.dockerignore`.
- Next: plan step 2 (install `unpdf`) and the dump-and-inspect script.
