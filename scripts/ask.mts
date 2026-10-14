import { client } from "../src/lib/db";
import { env } from "../src/lib/env";
import { answerQuestion } from "../src/lib/rag/answer";

const question = process.argv.slice(2).join(" ").trim();
if (!question) {
  console.error('Usage: npm run ask "<question>"');
  process.exit(1);
}

const { answer, hits } = await answerQuestion(question);

console.log(`\n${answer}\n`);
console.log("Sources:");
for (const h of hits) console.log(`  page ${h.page}  similarity ${h.score.toFixed(3)}`);
if (env.RAG_DEBUG === "1") {
  for (const h of hits) console.log(`\n--- page ${h.page} (${h.score.toFixed(3)}) ---\n${h.content}`);
}
await client.end();
