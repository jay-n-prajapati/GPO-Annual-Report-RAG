import { mkdir, readFile, writeFile } from "node:fs/promises";
import { client } from "../src/lib/db";
import { answerQuestion, REFUSAL, retrieve } from "../src/lib/rag/answer";

type Item = {
  id: string;
  type: "fact" | "multi-fact" | "trap" | "numeric" | "out-of-scope";
  question: string;
  expectedAnswerContains: string[];
  expectedAnswerContainsAny?: string[]; // at least one must appear
  expectedAnswerNotContains?: string[]; // none may appear
  expectedPages: number[];
};

const args = process.argv.slice(2);
const idsFlag = args.findIndex((a) => a === "--ids" || a.startsWith("--ids="));
const idsValue = idsFlag === -1 ? null : args[idsFlag].includes("=") ? args[idsFlag].split("=")[1] : args[idsFlag + 1];
const wantIds = idsValue ? new Set(idsValue.split(",").filter(Boolean)) : null;
const saveJson = args.includes("--json");
// Embeddings only, no chat call: checks retrieval without spending the (small) free-tier chat quota.
const retrievalOnly = args.includes("--retrieval-only");
const DELAY_MS = 1500; // gentle pacing for the free tier; withRetry handles the rest

// Case, whitespace and thousands separators don't matter ("802,834" == "802834").
const norm = (s: string) =>
  s.toLowerCase().replace(/(?<=\d),(?=\d)/g, "").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();

// Numbers in the answer (page citations excluded) that appear in none of the retrieved chunks.
function unsupportedNumbers(answer: string, chunkTexts: string[]): string[] {
  const body = norm(answer.replace(/\(pages?[^)]*\)/gi, " "));
  const context = norm(chunkTexts.join(" "));
  const nums = body.match(/\d[\d.]*\d|\d/g) ?? [];
  return [...new Set(nums)].filter((n) => !context.includes(n));
}

const golden = JSON.parse(await readFile("evals/golden.json", "utf8")) as { status: string; items: Item[] };
const items = wantIds ? golden.items.filter((i) => wantIds.has(i.id)) : golden.items;
if (items.length === 0) {
  console.error("No golden items matched --ids");
  process.exit(1);
}
console.log(`Golden set: ${golden.status}\nRunning ${items.length} question(s)\n`);

type Result = {
  id: string;
  type: Item["type"];
  retrievalHit: boolean | null;
  correct: boolean | null;
  unsupported: string[];
  answer: string;
  pages: number[];
  topScore: number;
};
const results: Result[] = [];

for (const [i, item] of items.entries()) {
  if (i > 0) await new Promise((r) => setTimeout(r, DELAY_MS));
  const { answer, hits } = retrievalOnly
    ? { answer: "", hits: await retrieve(item.question) }
    : await answerQuestion(item.question);
  const pages = hits.map((h) => h.page);
  const oos = item.type === "out-of-scope";
  results.push({
    id: item.id,
    type: item.type,
    retrievalHit: oos ? null : item.expectedPages.some((p) => pages.includes(p)),
    correct: retrievalOnly
      ? null
      : oos
        ? answer.trim() === REFUSAL
        : isCorrect(item, answer),
    unsupported: unsupportedNumbers(answer, hits.map((h) => h.content)),
    answer,
    pages,
    topScore: hits[0]?.score ?? 0,
  });
}

function isCorrect(item: Item, answer: string): boolean {
  const a = norm(answer);
  const has = (s: string) => a.includes(norm(s));
  return (
    item.expectedAnswerContains.every(has) &&
    (!item.expectedAnswerContainsAny || item.expectedAnswerContainsAny.some(has)) &&
    !(item.expectedAnswerNotContains ?? []).some(has)
  );
}

const mark = (v: boolean | null) => (v === null ? "  -" : v ? " ok" : "FAIL");
if (retrievalOnly) console.log("(retrieval-only: no chat call, correctness and refusal not evaluated)\n");
console.log("id".padEnd(26), "type".padEnd(13), "retr", "corr", "top-sim", "retrieved-pages".padEnd(18), "unsupported-numbers");
for (const r of results) {
  console.log(
    r.id.padEnd(26),
    r.type.padEnd(13),
    mark(r.retrievalHit).padStart(4),
    mark(r.correct).padStart(4),
    r.topScore.toFixed(3).padStart(7),
    r.pages.join(",").padEnd(18),
    r.unsupported.length ? r.unsupported.join(", ") : "",
  );
}

const rate = (n: number, d: number) => (d === 0 ? "n/a" : `${n}/${d}`);
const inScope = results.filter((r) => r.type !== "out-of-scope");
const oosRes = results.filter((r) => r.type === "out-of-scope");
console.log("\nSummary");
console.log(`  retrieval hit : ${rate(inScope.filter((r) => r.retrievalHit).length, inScope.length)}`);
if (!retrievalOnly) {
  console.log(`  correct       : ${rate(inScope.filter((r) => r.correct).length, inScope.length)}`);
  console.log(`  refusal pass  : ${rate(oosRes.filter((r) => r.correct).length, oosRes.length)}`);
  console.log(`  faithfulness flags (warnings): ${results.filter((r) => r.unsupported.length).length}`);
}

const failures = retrievalOnly
  ? results.filter((r) => r.retrievalHit === false)
  : results.filter((r) => !r.correct);
for (const f of failures) console.log(`\nFAIL ${f.id}\n  retrieved pages: ${f.pages.join(", ")}${f.answer ? `\n  answer: ${f.answer}` : ""}`);

if (saveJson) {
  await mkdir("data/extracted", { recursive: true });
  await writeFile("data/extracted/eval-latest.json", JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2));
  console.log("\nSaved data/extracted/eval-latest.json");
}

await client.end();
process.exit(failures.length ? 1 : 0);
