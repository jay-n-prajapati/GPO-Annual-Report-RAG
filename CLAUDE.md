# CLAUDE.md

RAG question-answering over the GPO 2018 Annual Report (Use Case 1). Next.js 16 + shadcn, Postgres/pgvector, Drizzle, Gemini (`@google/genai`).

## Workflow (follow this every session)
1. Read `specs/decisions.md` first. Do not re-litigate decided items.
2. Work from `specs/<feature>/spec.md` and `plan.md`; update `progress.md` after each session.
3. Append to `specs/decisions.md` whenever a decision is made, and flag any case where the user chose something other than the recommended option as **OVERRIDE**. Never rewrite old rows; supersede them with a new row.
4. Unresolved decisions: ask the user with options and a recommendation, one question at a time (the user is learning RAG, so explain tradeoffs).

## Dev
- DB: `docker compose --env-file .env.local up -d db`; app: `npm run dev` on the host.
- Env lives in `.env.local` (git-ignored). Compose reads `.env`, so pass `--env-file`.
- Schema changes go through Drizzle migrations, not edits to `db/init.sql` (that only enables the `vector` extension).

## Constraints
- Resource-friendly containers (db 384m, app 256m); keep dependencies minimal.
- Answers must come only from the document; say "not in the document" otherwise.
