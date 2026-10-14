import { cosineDistance, desc, sql } from "drizzle-orm";
import { db } from "../db";
import { chunks } from "../db/schema";
import { env } from "../env";
import { CHAT_MODEL, TOP_K } from "./config";
import { ai, embedTexts, withRetry } from "./embed";

export type Hit = { id: number; page: number; content: string; score: number };
export type Answer = { answer: string; hits: Hit[] };

export const REFUSAL = "Not in the document.";

const SYSTEM_PROMPT = `You answer questions about one document using ONLY the excerpts provided.
- Use no outside knowledge and add nothing that is not in the excerpts.
- Cite the PDF page number(s) you used, like (page 12).
- If the excerpts do not contain the answer, reply exactly: ${REFUSAL}`;

export async function retrieve(question: string, topK = TOP_K): Promise<Hit[]> {
  const [queryVector] = await embedTexts([question], "RETRIEVAL_QUERY");
  const similarity = sql<number>`1 - (${cosineDistance(chunks.embedding, queryVector)})`;
  return db
    .select({ id: chunks.id, page: chunks.page, content: chunks.content, score: similarity })
    .from(chunks)
    .orderBy(desc(similarity))
    .limit(topK);
}

export async function answerQuestion(question: string): Promise<Answer> {
  const hits = await retrieve(question);
  const excerpts = hits.map((h) => `[page ${h.page}]\n${h.content}`).join("\n\n");
  const res = await withRetry(() =>
    ai.models.generateContent({
      model: CHAT_MODEL,
      contents: `Excerpts:\n${excerpts}\n\nQuestion: ${question}`,
      config: { systemInstruction: SYSTEM_PROMPT, temperature: 0 },
    }),
  );
  const answer = (res.text ?? "").trim();

  if (env.RAG_DEBUG === "1") {
    console.debug(
      JSON.stringify({
        query: question,
        hits: hits.map((h) => ({ id: h.id, page: h.page, score: Number(h.score.toFixed(3)) })),
        answer,
      }),
    );
  }
  return { answer, hits };
}
