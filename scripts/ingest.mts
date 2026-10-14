import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { extractText, getDocumentProxy } from "unpdf";
import { client, db } from "../src/lib/db";
import { EMBEDDING_DIMENSIONS, chunks, documents } from "../src/lib/db/schema";
import { chunkPages } from "../src/lib/rag/chunk";
import { assertKnownFacts, cleanPages } from "../src/lib/rag/clean";
import {
  CHUNK_OVERLAP, CHUNK_SIZE, CHUNK_VERSION, CLEAN_VERSION, DOCUMENT_NAME, EMBEDDING_MODEL, PDF_PATH,
} from "../src/lib/rag/config";
import { embedTexts } from "../src/lib/rag/embed";

const force = process.argv.includes("--force");

const file = new Uint8Array(await readFile(PDF_PATH));
const contentHash = createHash("sha256").update(file).digest("hex");
const config = {
  chunkSize: CHUNK_SIZE, chunkOverlap: CHUNK_OVERLAP,
  embeddingModel: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS,
  cleanVersion: CLEAN_VERSION, chunkVersion: CHUNK_VERSION,
};
const stable = (o: object) => JSON.stringify(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

// Same PDF + same settings: nothing would change, so skip the (slow, quota-limited) embedding step (D-18).
const [existing] = await db.select().from(documents).where(eq(documents.name, DOCUMENT_NAME));
if (!force && existing && existing.contentHash === contentHash && stable(existing.config as object) === stable(config)) {
  console.log(`"${DOCUMENT_NAME}" is already ingested with the same PDF and settings; skipping (use --force to re-ingest).`);
  await client.end();
  process.exit(0);
}

const pdf = await getDocumentProxy(file);
const { text: rawPages } = await extractText(pdf, { mergePages: false });
const { pages, dropped } = cleanPages(rawPages);
assertKnownFacts(pages);
const pieces = chunkPages(pages, CHUNK_SIZE, CHUNK_OVERLAP);
const sizes = pieces.map((c) => c.content.length);
console.log(
  `${rawPages.length} pages -> ${pages.length} kept (dropped: ${dropped.map((d) => `${d.page} ${d.reason}`).join(", ") || "none"}) -> ${pieces.length} chunks ` +
    `(chars min ${Math.min(...sizes)}, avg ${Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length)}, max ${Math.max(...sizes)})`,
);

// Embed first (slow, can fail) so the DB transaction below is short and all-or-nothing.
const vectors = await embedTexts(
  pieces.map((c) => `${DOCUMENT_NAME}, page ${c.page}\n${c.content}`),
  "RETRIEVAL_DOCUMENT",
);

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
