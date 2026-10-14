export const DOCUMENT_NAME = "GPO 2018 Annual Report";
export const PDF_PATH = "data/gpo-2018-annual-report.pdf";

export const CHUNK_SIZE = 900;
export const CHUNK_OVERLAP = 135; // ~15%
export const MIN_CHUNK_CHARS = 60; // drops heading-only chunks ("2018 Annual Report") that match generic queries

export const EMBEDDING_MODEL = "gemini-embedding-001";
export const CHAT_MODEL = "gemini-3.8-flash";
export const EMBED_BATCH_SIZE = 20;

export const TOP_K = 5;

// Bump when the cleaning or chunking logic changes, so ingest re-embeds instead of skipping (D-18).
export const CLEAN_VERSION = 1;
export const CHUNK_VERSION = 1;

// Facts we know exist in the PDF. If cleaning loses any of them, the ingest fails (D-33).
export const KNOWN_FACTS = ["802,834", "166 depository libraries", "govinfo", "$375 million"];
