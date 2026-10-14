import type { CleanPage } from "./clean";
import { MIN_CHUNK_CHARS } from "./config";

export type Chunk = { page: number; chunkIndex: number; content: string };

// Abbreviations that end in "." without ending a sentence.
const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "no", "nos", "vs", "inc", "co", "corp", "ltd",
  "gen", "sen", "rep", "gov", "hon", "lt", "col", "sgt", "capt", "dept", "fig", "vol", "approx",
  "ave", "blvd", "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
]);

// `atSentenceStart`: the word is the whole segment so far, so "1." is a list marker, not the end of a sentence.
function isAbbreviation(word: string, atSentenceStart: boolean): boolean {
  const w = word.replace(/^["'(\[]+/, "").replace(/\.$/, "");
  return (
    ABBREVIATIONS.has(w.toLowerCase()) ||
    /^[A-Za-z]$/.test(w) || // initials and "U." / "S." in "U. S. Government"
    /^([A-Za-z]\.)+[A-Za-z]$/.test(w) || // "U.S", "D.C", "e.g"
    (atSentenceStart && /^\d{1,2}$/.test(w)) // list markers like "1."
  );
}

const BOUNDARY = /([.!?]["')\]]*)(\s+)/g;

export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (const m of text.matchAll(BOUNDARY)) {
    const next = text[m.index + m[0].length];
    if (next === undefined || !/[A-Z0-9"'($\[]/.test(next)) continue;
    const segment = text.slice(start, m.index + 1);
    const word = /(\S+)$/.exec(segment)?.[1] ?? "";
    if (m[1][0] === "." && isAbbreviation(word, word === segment)) continue;
    out.push(text.slice(start, m.index + m[1].length));
    start = m.index + m[0].length;
  }
  if (start < text.length) out.push(text.slice(start));
  return out;
}

// Splits an over-long sentence at clause punctuation, then at spaces. Never inside a token (so never inside a number).
function splitLong(s: string, size: number): string[] {
  const out: string[] = [];
  let rest = s;
  while (rest.length > size) {
    const window = rest.slice(0, size + 1);
    let cut = Math.max(window.lastIndexOf(", "), window.lastIndexOf("; "), window.lastIndexOf(": ")) + 1;
    if (cut < size / 2) cut = window.lastIndexOf(" ");
    if (cut <= 0) cut = size;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

// Overlap = trailing whole sentences up to 2x the target (sentences are ~150-250 chars, so a strict 135 would
// almost never fit one). If even the last sentence is longer, carry its last words instead.
function overlapTail(sentences: string[], overlap: number): string[] {
  const tail: string[] = [];
  let total = 0;
  for (let i = sentences.length - 1; i >= 0; i--) {
    const add = sentences[i].length + (tail.length ? 1 : 0);
    if (total + add > overlap * 2) break;
    tail.unshift(sentences[i]);
    total += add;
  }
  if (tail.length) return tail;
  const words = sentences[sentences.length - 1].split(" ");
  let part = "";
  for (let i = words.length - 1; i >= 0 && part.length + words[i].length + 1 <= overlap; i--) {
    part = part ? `${words[i]} ${part}` : words[i];
  }
  return part ? [part] : [];
}

export function packSentences(sentences: string[], size: number, overlap: number): string[] {
  const chunks: string[] = [];
  let cur: string[] = [];
  let carried = 0;
  const len = (a: string[]) => a.join(" ").length;
  for (const s of sentences.flatMap((x) => splitLong(x, size))) {
    if (cur.length > carried && len(cur) + 1 + s.length > size) {
      chunks.push(cur.join(" "));
      cur = overlapTail(cur, overlap);
      if (cur.length && len(cur) + 1 + s.length > size) cur = [];
      carried = cur.length;
    }
    cur.push(s);
  }
  if (cur.length > carried) chunks.push(cur.join(" "));
  return chunks;
}

// Sentence-aware chunks per page, so every chunk keeps its PDF page number (D-34, D-35).
export function chunkPages(pages: CleanPage[], size: number, overlap: number): Chunk[] {
  const out: Chunk[] = [];
  for (const { page, text } of pages) {
    for (const content of packSentences(splitSentences(text), size, overlap)) {
      if (content.length < MIN_CHUNK_CHARS) continue;
      out.push({ page, chunkIndex: out.length, content });
    }
  }
  return out;
}
