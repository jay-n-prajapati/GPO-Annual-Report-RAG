# Progress: RAG ingestion

Update after each working session. Newest first. Phase details are in `plan.md`.

## Phase tracker
| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Foundation: Docker, deps, env, PDF, extraction dump, cleaning rules drafted | DONE |
| 1 | Walking skeleton: schema + migration, naive ingest, `npm run ask` end to end, baseline | DONE (commit dcd5ee0) |
| 2 | Quality ingestion: clean + sentence-aware chunker + idempotent re-runs | DONE (commit 5209768) |
| 3 | Eval harness: golden set, `npm run eval`, debug logging, tuning | DONE 2026-10-15: golden set approved, full eval 8/8 retrieval, 8/8 correct, 2/2 refusal, no tuning needed (D-62). Earlier note: BUILT (commit a66a394). Golden set DRAFT awaiting user review; retrieval-only eval run (8/8 hit); full eval with chat NOT run (daily chat quota exhausted, D-48); tuning NOT started |
| 4 | API route + chat UI with sources | BUILT (commit e3e2907); live generation verified in the browser on 2026-10-15 (4 chat requests): streaming, citation chips, chip-click highlight, refusal stamp, light/dark all OK. One UI fix (markdown rendering, D-61) uncommitted |
| 5 | Hardening: compose e2e, audit, README | PARTIAL (commit 259f28b): audit, Docker e2e and README done (D-58, D-59); revisit-with-eval items (D-36 financial pages, similarity cutoff, hybrid search, tuning) pending the eval |

## 2026-10-15 (live browser test, plan step 2)
- Chat quota HAD reset. Used exactly 4 chat requests (1 curl probe + 3 via the UI). Dev server + headless Chrome (CDP) driven by a scratchpad script; all processes stopped by PID afterwards.
- Answers (top-5, same index of 265 chunks), compared with the Phase 1/2 baselines:
  1. Libraries (curl): "In FY 2018, GPO staff visited 166 depository libraries (page 5, page 21)." Same as baseline.
  2. FDsys: govinfo; moved out of beta Dec 2017; FDsys scheduled to be completely retired and replaced by govinfo in Dec 2018 (pages 8, 10, 22, 39). Top similarity 0.679 (unchanged weak spot). Same substance as baseline.
  3. Procurement: "more than $375 million (valued at approximately $375.7 million)" (pages 5, 17). Top similarity 0.805. Same as Phase 2.
  4. Out of scope (g09, "Congressional Record pages in FY 2019"): refusal "Not in the document." with the stamped verdict UI; retrieved FY 2018 chunk scored 0.772, so the prompt (not a score cutoff) did the refusing.
- UI: sources event arrives at ~0.6 s (before generation), answer text then streams as several NDJSON chunks (q2: 4 increments in ~0.4 s) but the first answer token took 7-22 s (q2 hit two 503 retries, 1.2 s + 2.2 s; q3 7 s; oos 16 s), so generation latency is the dominant wait. Citation chips match the sources panel pages; chip click highlights the right excerpt (checked chunk ids 267 -> page 8 and 260 -> page 5 in the DB); refusal stamp, light and dark all render correctly; no console errors/exceptions in any run.
- BUG found + fixed (D-61): answers contained raw markdown (`* **New system:** govinfo`) shown as literal asterisks. `src/components/answer.tsx` now renders `* ` bullets and `**bold**`. Verified with a mocked stream (no quota); needs its own commit.
- Side effects to know: `next dev` regenerated an untracked `AGENTS.md` at the repo root again (D-57 note); it is not committed. Other uncommitted changes in the tree (golden.json, eval.mts, eval-review.md, decisions.md D-60) are from the golden-set review, not this task.
- Not done (by design): `npm run eval`, tuning.
- Next: full `npm run eval` (needs ~10 chat requests; 16 of 20 daily requests remain only if nothing else used them today).

## 2026-10-15 (first full eval)
- Golden set approved with g03/g06 tightened (D-60). Live browser test passed with real Gemini (4 chat requests, D-61 markdown rendering fix in the UI, uncommitted).
- Full eval: retrieval hit 8/8, correct 8/8, refusal 2/2, 1 faithfulness warning (benign unit conversion on g06). Saved to `data/extracted/eval-latest.json` (git-ignored).
- Tuning/cutoff/hybrid/financial-pages/min-chunk decisions closed with data: nothing added (D-62).
- Use Case 1 meets its pass/fail bar on the golden set and the 3 acceptance questions.
- Remaining optional: commit pending changes; larger stress set; theme toggle; AGENTS.md decision.

## 2026-10-14 (Phase 3 build)
- Built: `src/lib/rag/answer.ts` (shared retrieve/answer), thin `scripts/ask.mts`, `evals/golden.json` (10 items, DRAFT), `specs/rag-ingestion/eval-review.md` (evidence per item), `scripts/eval.mts` + `npm run eval`, retry fail-fast + request timeout in `embed.ts`. Decisions D-45..D-49.
- Run results (retrieval-only, top-5, 265 chunks, no tuning): retrieval hit 8/8 in-scope. Top similarity: g01 0.828, g02 0.679 (weakest), g03 0.805, g04 0.816, g05 0.835, g06 0.797, g07 0.829, g08 0.796; out-of-scope g09 0.772 (near-miss, retrieves the FY 2018 figure on p14), g10 0.524.
- NOT run: full eval with chat (correctness, refusal, faithfulness). Free-tier chat quota for `gemini-3.8-flash` is 20 requests/day and was exhausted; two earlier eval attempts hung because the retry slept on the server's ~19h wait (fixed, D-48). No full eval result exists yet.
- Pending: user review of the golden set; chat quota decision (wait ~19h, enable billing, or switch model); then one full eval run; only then tuning (D-49).
- `npm audit`: reviewed in Phase 5 (D-58).

## 2026-10-14 (Phase 1 build)
- Built: `src/lib/env.ts`, Drizzle schema + `drizzle.config.ts` + migration `drizzle/0000_*.sql`, `src/lib/rag/{config,chunk,embed}.ts`, `scripts/ingest.mts`, `scripts/ask.mts`; npm scripts `db:generate`, `db:migrate`, `ingest`, `ask`.
- Verified (no API): db container healthy, migration applied; `vector` 0.8.7, `chunks`/`documents` tables, HNSW cosine index and FK cascade exist; chunker, L2 normalizer, and DB insert + cosine search + cascade delete checked with throwaway fake-vector tests (removed); `npx tsc --noEmit` and `npm run lint` clean; real PDF -> 249 chunks (~13 embed requests).
- NOT verified: any Gemini call (embedContent, generateContent), `npm run ingest` and `npm run ask` end to end, retry/backoff path. `.env.local` still holds the placeholder key.
- Confirmed from docs: model IDs and embed call shape (D-37, D-38). Impl notes in D-39.
- Environment note: Docker Desktop context (`desktop-linux`) was not running; used `DOCKER_HOST=unix:///var/run/docker.sock` for this session only. The `task-1_pgdata` volume was created fresh.
- Next: set real key, run `npm run ingest` then ask the 3 acceptance questions and record the baseline.

## 2026-10-14 (Phase 2)
- Built: `src/lib/rag/clean.ts`, sentence-aware `chunk.ts`, idempotent `scripts/ingest.mts` (D-41..D-44). No new dependencies, no migration.
- Checks (throwaway script, deleted): 15 unit checks pass (glued header, edge vs table numbers, hyphen join, dashes/quotes, abbreviations/decimals in sentence splitting, overlap, long sentences, no digit token created/altered on all 79 pages, known facts present).
- Live ingest: 82 pages -> 79 kept (dropped 2 empty, 29 empty, 33 TOC) -> 265 chunks (chars min 67, avg 716, max 899). Second run skipped as designed.
- Re-run of the 3 acceptance questions (top-5, same model) vs Phase 1 baseline: all still CORRECT.
  1. Libraries: 166, pages 5, 21. Top similarity 0.830 -> 0.828 (same).
  2. FDsys: govinfo; beta Dec 2017; FDsys retired Dec 2018. Cited pages 10, 22, 39 -> 8, 10, 22, 39. Top similarity 0.666 -> 0.679 (still the weakest).
  3. Procurement: ">$375 million" (page 5) and now also "$375.7 million" (page 17, verified against the raw text). Top similarity 0.808 -> 0.805.
- Surprises: first implementation left `|` separators and mid-page page numbers in chunks (fixed, D-41); heading-only chunks dropped (D-42); a sentence crossing a page break is cut at the boundary (9 pages start with a lowercase chunk).
- `npm audit`: reviewed in Phase 5 (D-58). Next: user reviews sample chunks, commit Phase 2, then Phase 3 (eval harness).

## 2026-10-15 (Phase 4 build)
- Built: `streamAnswer`, `POST /api/ask` (NDJSON, D-51), chat page (`src/app/page.tsx`, `src/components/{ask-panel,answer,sources}.tsx`, `src/lib/{ask-client,ask-protocol,refusal}.ts`), new theme in `globals.css`, fonts in `layout.tsx` (D-54..D-57).
- Verified: tsc, lint, `npm run build` (standalone) clean; client bundle contains no drizzle/postgres/genai/API-key strings. curl against dev server: invalid/empty/too-long/wrong-type bodies -> 400 JSON; valid question -> `sources` event then clean `quota` error event (real quota exhaustion). Retry budget fixed after the first attempt took 2.2 min (D-53), now ~5 s.
- Visually verified with headless Chrome over CDP (desktop light/dark, mobile, searching, quota error with sources open/closed, cite-click highlight, refusal stamp light/dark). The streaming-answer and refusal screens used a MOCKED stream injected in the page; they exercise the UI only, not the model.
- NOT verified: real streamed generation from Gemini, Docker image build of the app service, keyboard/screen-reader behavior beyond markup review.
- Side effect: `next dev` generated an untracked `AGENTS.md` at the repo root (Next 16.4 agent rules; disable with `agentRules: false` in next.config). Left in place for the user to decide.
- Next: after the chat quota resets, run the full eval once and the 3 questions in the browser; then Phase 5.

## 2026-10-14 (Phase 1 live run)
- Ingest: 82 pages -> 249 chunks stored (naive 900-char chunks, no cleaning). Needed retry fix for the free-tier 429 (D-40).
- BASELINE, top-5, no cleaning, `gemini-3.8-flash`, answers checked against `data/extracted/raw-pages.txt`:
  1. Libraries visited: "166 depository libraries" (pages 5, 21). CORRECT (top similarity 0.830).
  2. FDsys replacement: govinfo; moved out of beta Dec 2017; FDsys scheduled to be retired/replaced Dec 2018 (pages 10, 22, 39). CORRECT, faithful to the text, which says "scheduled" (top similarity 0.666, the weakest retrieval of the three).
  3. Procurement: "more than $375 million" (page 5). CORRECT (top similarity 0.808). The text also gives $375.7 million elsewhere (pages ~25).
- Observation: the Q2 answer cites pages (10, 22, 39) while the top similarity is only 0.666; watch it in Phase 2/3.
- `npm audit`: reviewed in Phase 5 (D-58).
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
