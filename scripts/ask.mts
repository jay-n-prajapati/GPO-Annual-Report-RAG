import { cosineDistance, desc, sql } from "drizzle-orm";
import { client, db } from "../src/lib/db";
import { chunks } from "../src/lib/db/schema";
import { env } from "../src/lib/env";
import { CHAT_MODEL, TOP_K } from "../src/lib/rag/config";
import { ai, embedTexts, withRetry } from "../src/lib/rag/embed";

const question = process.argv.slice(2).join(" ").trim();
if (!question) {
  console.error('Usage: npm run ask "<question>"');
  process.exit(1);
}

const [queryVector] = await embedTexts([question], "RETRIEVAL_QUERY");
const similarity = sql<number>`1 - (${cosineDistance(chunks.embedding, queryVector)})`;
const hits = await db
  .select({ page: chunks.page, content: chunks.content, score: similarity })
  .from(chunks)
  .orderBy(desc(similarity))
  .limit(TOP_K);

const SYSTEM_PROMPT = `You answer questions about one document using ONLY the excerpts provided.
- Use no outside knowledge and add nothing that is not in the excerpts.
- Cite the PDF page number(s) you used, like (page 12).
- If the excerpts do not contain the answer, reply exactly: Not in the document.`;

const excerpts = hits.map((h) => `[page ${h.page}]\n${h.content}`).join("\n\n");
const res = await withRetry(() =>
  ai.models.generateContent({
    model: CHAT_MODEL,
    contents: `Excerpts:\n${excerpts}\n\nQuestion: ${question}`,
    config: { systemInstruction: SYSTEM_PROMPT, temperature: 0 },
  }),
);

console.log(`\n${res.text}\n`);
console.log("Sources:");
for (const h of hits) console.log(`  page ${h.page}  similarity ${h.score.toFixed(3)}`);
if (env.RAG_DEBUG === "1") {
  for (const h of hits) console.log(`\n--- page ${h.page} (${h.score.toFixed(3)}) ---\n${h.content}`);
}
await client.end();
