import { cosineDistance, desc, sql } from "drizzle-orm";
import { db } from "../db";
import { chunks } from "../db/schema";
import { env } from "../env";
import { CHAT_MODEL, TOP_K } from "./config";
import { ai, embedTexts, withRetry, type RetryOptions } from "./embed";

export type Hit = { id: number; page: number; content: string; score: number };
export type Answer = { answer: string; hits: Hit[] };

export const REFUSAL = "Not in the document.";

const SYSTEM_PROMPT = `You answer questions about one document using ONLY the excerpts provided.
- Use no outside knowledge and add nothing that is not in the excerpts.
- Cite the PDF page number(s) you used, like (page 12).
- If the excerpts do not contain the answer, reply exactly: ${REFUSAL}`;

export async function retrieve(question: string, topK = TOP_K, retry?: RetryOptions): Promise<Hit[]> {
  const [queryVector] = await embedTexts([question], "RETRIEVAL_QUERY", retry);
  const similarity = sql<number>`1 - (${cosineDistance(chunks.embedding, queryVector)})`;
  return db
    .select({ id: chunks.id, page: chunks.page, content: chunks.content, score: similarity })
    .from(chunks)
    .orderBy(desc(similarity))
    .limit(topK);
}

// Same model, prompt and temperature for the one-shot and streaming paths.
function generationRequest(question: string, hits: Hit[]) {
  const excerpts = hits.map((h) => `[page ${h.page}]\n${h.content}`).join("\n\n");
  return {
    model: CHAT_MODEL,
    contents: `Excerpts:\n${excerpts}\n\nQuestion: ${question}`,
    config: { systemInstruction: SYSTEM_PROMPT, temperature: 0 },
  };
}

function debugLog(question: string, hits: Hit[], answer: string) {
  if (env.RAG_DEBUG !== "1") return;
  console.debug(
    JSON.stringify({
      query: question,
      hits: hits.map((h) => ({ id: h.id, page: h.page, score: Number(h.score.toFixed(3)) })),
      answer,
    }),
  );
}

export async function answerQuestion(question: string): Promise<Answer> {
  const hits = await retrieve(question);
  const res = await withRetry(() => ai.models.generateContent(generationRequest(question, hits)));
  const answer = (res.text ?? "").trim();
  debugLog(question, hits, answer);
  return { answer, hits };
}

export type AnswerStream = { hits: Hit[]; text: AsyncGenerator<string, void> };

// Interactive requests: ~3 quick attempts, and give up fast if Google asks for a long wait.
const WEB_RETRY: RetryOptions = { maxAttempts: 3, maxServerWaitMs: 15_000 };

// Retrieval runs first so callers can show sources (or fail cleanly) before any generation starts.
// The model request is only sent once `text` is iterated; withRetry covers opening the stream.
export async function streamAnswer(question: string): Promise<AnswerStream> {
  const hits = await retrieve(question, TOP_K, WEB_RETRY);
  return { hits, text: streamText(question, hits) };
}

async function* streamText(question: string, hits: Hit[]): AsyncGenerator<string, void> {
  const stream = await withRetry(() => ai.models.generateContentStream(generationRequest(question, hits)), WEB_RETRY);
  let full = "";
  for await (const chunk of stream) {
    const text = chunk.text;
    if (!text) continue;
    full += text;
    yield text;
  }
  debugLog(question, hits, full.trim());
}
