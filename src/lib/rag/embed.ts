import { GoogleGenAI } from "@google/genai";
import { env } from "../env";
import { EMBED_BATCH_SIZE, EMBEDDING_MODEL } from "./config";
import { EMBEDDING_DIMENSIONS } from "../db/schema";

export const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

// gemini-embedding-001 only returns unit-length vectors at 3072 dims, so we normalize ourselves (D-20).
export function l2Normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

const MAX_ATTEMPTS = 8;

// 429 responses say how long to wait ("retryDelay":"27s"); honor it instead of guessing.
function serverRetryDelayMs(err: unknown): number {
  const m = /"retryDelay":\s*"(\d+(?:\.\d+)?)s"/.exec(String((err as Error)?.message ?? ""));
  return m ? Math.ceil(Number(m[1]) * 1000) + 1000 : 0;
}

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = (err as { status?: number }).status;
      const retryable = status === 429 || (status !== undefined && status >= 500);
      if (!retryable || attempt >= MAX_ATTEMPTS) throw err;
      const delay = Math.max(1000 * 2 ** (attempt - 1), serverRetryDelayMs(err)) + Math.random() * 250;
      console.warn(`Gemini ${status}, retry ${attempt}/${MAX_ATTEMPTS - 1} in ${Math.round(delay)}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

export async function embedTexts(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY",
): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    const res = await withRetry(() =>
      ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: batch,
        config: { taskType, outputDimensionality: EMBEDDING_DIMENSIONS },
      }),
    );
    const vectors = res.embeddings?.map((e) => e.values ?? []) ?? [];
    if (vectors.length !== batch.length || vectors.some((v) => v.length !== EMBEDDING_DIMENSIONS)) {
      throw new Error(`Unexpected embedding response for batch starting at ${i}`);
    }
    out.push(...vectors.map(l2Normalize));
  }
  return out;
}
