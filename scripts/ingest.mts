import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extractText, getDocumentProxy } from "unpdf";
import { client, db } from "../src/lib/db";
import { chunks, documents } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { chunkPages } from "../src/lib/rag/chunk";
import {
  CHUNK_OVERLAP, CHUNK_SIZE, DOCUMENT_NAME, EMBEDDING_MODEL, PDF_PATH,
} from "../src/lib/rag/config";
import { EMBEDDING_DIMENSIONS } from "../src/lib/db/schema";
import { embedTexts } from "../src/lib/rag/embed";

const file = new Uint8Array(await readFile(PDF_PATH));
const contentHash = createHash("sha256").update(file).digest("hex");
const pdf = await getDocumentProxy(file);
const { text: pages } = await extractText(pdf, { mergePages: false });

const pieces = chunkPages(pages, CHUNK_SIZE, CHUNK_OVERLAP);
console.log(`${pages.length} pages -> ${pieces.length} chunks`);

// Embed first (slow, can fail) so the DB transaction below is short and all-or-nothing.
const vectors = await embedTexts(
  pieces.map((c) => `${DOCUMENT_NAME}, page ${c.page}\n${c.content}`),
  "RETRIEVAL_DOCUMENT",
);

const config = {
  chunkSize: CHUNK_SIZE, chunkOverlap: CHUNK_OVERLAP,
  embeddingModel: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS,
};

await db.transaction(async (tx) => {
  const [doc] = await tx
    .insert(documents)
    .values({ name: DOCUMENT_NAME, contentHash, config })
    .onConflictDoUpdate({ target: documents.name, set: { contentHash, config } })
    .returning({ id: documents.id });
  await tx.delete(chunks).where(eq(chunks.documentId, doc.id));
  const rows = pieces.map((c, i) => ({ ...c, documentId: doc.id, embedding: vectors[i] }));
  for (let i = 0; i < rows.length; i += 200) await tx.insert(chunks).values(rows.slice(i, i + 200));
});

console.log(`Stored ${pieces.length} chunks for "${DOCUMENT_NAME}"`);
await client.end();
