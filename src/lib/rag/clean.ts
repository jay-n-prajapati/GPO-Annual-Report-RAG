// Cleaning rules from specs/rag-ingestion/cleaning-rules.md (D-33). Runs per page; the PDF page index is kept.
import { KNOWN_FACTS } from "./config";

// Running headers/footers, written without spaces. Matched whitespace-insensitively, which also catches the
// spaced-letter form ("U . S . G O V E R N M E N T ...") glued to the following sentence.
const HEADER_PHRASES = [
  "U.S.GOVERNMENTPUBLISHINGOFFICE",
  "2018ANNUALREPORT",
  "KEEPINGAMERICAINFORMED",
  "OFFICIAL|DIGITAL|SECURE",
  "U.S.GovernmentPublishingOffice|FinancialYearInReview-FY2018",
  "732NorthCapitolStreet,NW,Washington,DC20401|www.gpo.gov|www.fdsys.gov",
];

const escape = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const HEADER_REGEXES = HEADER_PHRASES.map((p) => new RegExp([...p].map(escape).join("\\s*"), "g"));

const LEADERS = /…+|\.{5,}/g;

export function isTocPage(raw: string): boolean {
  return raw.split("\n").filter((l) => /…{2,}|\.{5,}/.test(l)).length >= 5;
}

export function normalizeChars(s: string): string {
  return s
    .replace(LEADERS, " ")
    .normalize("NFKC")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—‐‑‒]/g, "-")
    .replace(/•/g, "- ");
}

const BARE_PAGE_NUMBER = /^\d{1,3}$/;
const HEADER_ANY = new RegExp(HEADER_REGEXES.map((r) => r.source).join("|"), "g");

// Removes headers line by line. On a line that held a header, a bare 1-3 digit leftover is that header's glued-on
// printed page number ("10" + header, header + "24"), including pages that hold two printed pages, and is dropped too.
export function stripHeaders(text: string): string {
  return text
    .split("\n")
    .flatMap((line) => {
      const parts = line.split(HEADER_ANY);
      if (parts.length === 1) return [line];
      return parts.map((p) => p.replace(/^[\s|]+|[\s|]+$/g, "")).filter((p) => p && !BARE_PAGE_NUMBER.test(p));
    })
    .join("\n");
}

function dropEdgePageNumbers(lines: string[]): string[] {
  const out = [...lines];
  if (out.length && BARE_PAGE_NUMBER.test(out[0])) out.shift();
  if (out.length && BARE_PAGE_NUMBER.test(out[out.length - 1])) out.pop();
  return out;
}

// Re-flow hard-wrapped lines into one text. A line ending in "letter-" / "digit-" (hyphen kept) or "/" (broken URL)
// is joined to the next without a space.
export function reflow(lines: string[]): string {
  let out = "";
  for (const line of lines) {
    if (!out) out = line;
    else out += /[A-Za-z0-9]-$|\/$/.test(out) ? line : ` ${line}`;
  }
  return out.replace(/\s+/g, " ").trim();
}

export function cleanPage(raw: string): string {
  const text = stripHeaders(normalizeChars(raw));
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return reflow(dropEdgePageNumbers(lines));
}

export type CleanPage = { page: number; text: string };
export type DroppedPage = { page: number; reason: "toc" | "empty" };

export function cleanPages(rawPages: string[]): { pages: CleanPage[]; dropped: DroppedPage[] } {
  const pages: CleanPage[] = [];
  const dropped: DroppedPage[] = [];
  rawPages.forEach((raw, i) => {
    const page = i + 1;
    if (isTocPage(raw)) return void dropped.push({ page, reason: "toc" });
    const text = cleanPage(raw);
    if (!text) return void dropped.push({ page, reason: "empty" });
    pages.push({ page, text });
  });
  return { pages, dropped };
}

// Fails loudly if a rule deleted content we know must be there.
export function assertKnownFacts(pages: CleanPage[]): void {
  const all = pages.map((p) => p.text).join("\n");
  const missing = KNOWN_FACTS.filter((f) => !all.includes(f));
  if (missing.length) throw new Error(`Cleaning lost known facts: ${missing.join(", ")}`);
}
