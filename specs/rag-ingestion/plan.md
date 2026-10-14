# Plan: RAG ingestion + Q&A (Use Case 1)

Vertical slices: each phase runs through every layer (extract -> store -> retrieve -> answer) and ends
with something demonstrable and measurable, instead of finishing one layer before starting the next.
Quality work (cleaning, tuning) comes after a working skeleton so every change is compared to a baseline.
Status lives in `progress.md`. Decision IDs refer to `specs/decisions.md`.

## Phase 0 - Foundation (DONE)
Docker (pgvector db + app), packages, `.env.local`, PDF in `data/`, `npm run dump:pdf`, cleaning rules drafted.
Exit: raw text extracted; decisions D-01..D-36 recorded.

## Phase 1 - Walking skeleton (thin end-to-end, CLI only) - BUILT, awaiting live run with API key
Goal: ask one question from the terminal and get a cited answer from the stored PDF, however crude.
- `src/lib/env.ts` (zod-validated env).
- `src/lib/db/schema.ts` (`documents`, `chunks` with `vector(768)`), `drizzle.config.ts`, first migration, HNSW index; `npm run db:migrate`.
- Confirm exact Gemini Flash model ID and embedding call shape in the docs (open items from D-21, D-20).
- Minimal ingest: raw page text -> fixed-size chunks (no cleaning yet) -> batched embed (D-29) -> insert.
- `npm run ask "<question>"`: embed query (`RETRIEVAL_QUERY`), top-5 vector search (D-23), strict grounding prompt (D-25), print answer + pages + scores.
Exit: the 3 acceptance questions run end to end; their answers recorded as the BASELINE (pass/fail by eye).
Why first: surfaces integration risks early (model IDs, pgvector, dimensions, rate limits) and gives a baseline.

## Phase 2 - Quality ingestion
Goal: better chunks, safe re-runs.
- [x] `clean` module: rules 1-8 from `cleaning-rules.md` (D-33) + safety check on known facts (`src/lib/rag/clean.ts`).
- [x] Sentence-aware chunker with overlap, PDF page kept per chunk (D-34, D-35); header text "title + page" embedded (D-19).
- [x] Transactional replace per document, hash + config skip, `--force` (D-18, D-43).
- [x] Spot-check column reading order (D-44).
- [ ] Review sample chunks together with the user.
Exit: re-ingest is idempotent; the 3 questions re-run and compared to the Phase 1 baseline.

## Phase 3 - Evaluation harness
Goal: replace "by eye" with repeatable numbers.
- [x] Draft 8-10 golden questions with expected values and PDF pages from the document, incl. 2 out-of-scope (D-28). [ ] User review (`eval-review.md`).
- [x] `npm run eval` built (string-match facts, exact refusal, retrieval hit reported separately, `--retrieval-only`). [x] Retrieval-only run: 8/8. [ ] Full eval with chat (blocked by daily chat quota, D-48).
- [x] `RAG_DEBUG=1` logging of query, chunk IDs, pages, scores (D-31).
- [ ] Tune chunk size, overlap, top-k using the harness (not before golden set approved + full eval run, D-49). Decide hybrid search / similarity cutoff only if data shows a need (D-23, D-24).
Exit: documented eval scores; acceptance questions pass; refusal cases pass.

## Phase 4 - API + UI
Goal: usable chat page.
- [x] `streamAnswer` in `src/lib/rag/answer.ts` (same prompt/config as `answerQuestion`).
- [x] `POST /api/ask` route handler: zod-validated body, NDJSON stream (sources, text, done/error), clean error mapping (D-51..D-53).
- [x] One page: question input, streamed answer, collapsible sources panel (chunks, pages, scores), refusal + quota states (D-54..D-57). Applied `frontend-design` and `vercel-react-best-practices`.
- [x] `npm run build` (standalone) passes; no server deps in the client bundle.
- [ ] LIVE streamed generation in the browser (blocked by the daily chat quota, D-50).
Exit: acceptance questions answered in the browser with visible sources.

## Phase 5 - Hardening
- Full compose run (db + app) within resource limits; `npm audit` review; README (setup, ingest, eval).
- Revisit D-36 (financial pages) and any deferred decisions with eval data.
Exit: fresh clone -> documented commands -> working app.

## Cross-cutting rules
- After each phase: update `progress.md`, append decisions to `decisions.md` (flag overrides).
- Don't tune anything before Phase 3 has a harness to measure it.
