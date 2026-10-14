# Progress: RAG ingestion

Update after each working session. Newest first. Phase details are in `plan.md`.

## Phase tracker
| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Foundation: Docker, deps, env, PDF, extraction dump, cleaning rules drafted | DONE |
| 1 | Walking skeleton: schema + migration, naive ingest, `npm run ask` end to end, baseline | NOT STARTED (next) |
| 2 | Quality ingestion: clean + sentence-aware chunker + idempotent re-runs | NOT STARTED |
| 3 | Eval harness: golden set, `npm run eval`, debug logging, tuning | NOT STARTED |
| 4 | API route + chat UI with sources | NOT STARTED |
| 5 | Hardening: compose e2e, audit, README | NOT STARTED |

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
