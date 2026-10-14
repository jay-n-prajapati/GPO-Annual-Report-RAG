# Spec: RAG ingestion (Use Case 1, GPO 2018 Annual Report)

## Goal
Question answering over one plain-text PDF. A correct answer is the exact fact from the surrounding
paragraph with nothing added that is not in the document. If it is absent, say so.

## Acceptance questions
1. How many depository libraries did GPO staff visit in FY 2018?
2. What new digital system replaced FDsys, and when was it fully deployed?
3. How much did GPO procure in printing and information products in FY 2018 on behalf of federal agencies?
Plus an out-of-scope question that must answer "not in the document".

## Pipeline requirements
1. Extract: `unpdf`, per page, keep page numbers.
2. Clean: dump text to a file, inspect, add only observed rules (headers/footers, hyphenation, whitespace).
3. Chunk: recursive paragraph-aware, ~800-1000 chars, ~15% overlap, page kept.
4. Embed: Gemini, 768 dims, document vs query task types; embed "title + page" header + chunk.
5. Store: Postgres + pgvector via Drizzle. `documents(name, hash, config)` and `chunks(document_id, page, index, content, embedding vector(768))`, HNSW index.
6. Re-run: replace a document's chunks in one transaction; skip if hash + config unchanged.

## Non-goals (this spec)
Tables/scans (Use Cases 2-3), reranking, LLM-generated chunk context, UI.

See `specs/decisions.md` for rationale.
