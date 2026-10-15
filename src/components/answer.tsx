import { REFUSAL_TEXT, isRefusal } from "@/lib/refusal";

// "(page 5)", "(pages 10, 22, 39)", "(page 5, page 21)", "(p. 7)": the model cites PDF pages this way.
const CITATION = /\(((?:pages?|pp?\.)\s*\d+(?:\s*(?:,|;|and|&|–|-)\s*(?:pages?\s*)?\d+)*)\)/gi;
const DIGITS = /\d+/g;

type Part = { text: string } | { pages: number[] };

function parse(text: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const m of text.matchAll(CITATION)) {
    const start = m.index ?? 0;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ pages: [...m[1].matchAll(DIGITS)].map((d) => Number(d[0])) });
    last = start + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

// The model sometimes answers with light markdown ("* " bullets, **bold**) despite the plain-text prompt;
// render just those two instead of showing raw asterisks.
const BOLD = /\*\*([^*]+)\*\*/g;

function Inline({ text }: { text: string }) {
  const pieces = text.replace(/^\*\s+/gm, "\u2022 ").split(BOLD);
  return pieces.map((piece, i) => (i % 2 ? <strong key={i}>{piece}</strong> : piece));
}

const CHIP =
  "mx-0.5 inline-block -rotate-1 border px-1.5 py-px align-[0.15em] font-mono text-[0.68em] font-semibold uppercase tracking-[0.12em]";

type Props = {
  text: string;
  streaming: boolean;
  sourcePages: ReadonlySet<number>;
  onCite: (page: number) => void;
};

export function Answer({ text, streaming, sourcePages, onCite }: Props) {
  return (
    <p className={`whitespace-pre-wrap text-[1.3rem] leading-[1.6] md:text-[1.45rem] ${streaming ? "caret" : ""}`}>
      {parse(text.trimStart()).map((part, i) =>
        "text" in part ? (
          <span key={i}>
            <Inline text={part.text} />
          </span>
        ) : (
          <span key={i} className="whitespace-nowrap">
            {part.pages.map((page) =>
              sourcePages.has(page) ? (
                <button
                  key={page}
                  type="button"
                  onClick={() => onCite(page)}
                  aria-label={`Show the retrieved excerpt from PDF page ${page}`}
                  className={`${CHIP} cursor-pointer border-stamp text-stamp transition-colors hover:bg-stamp hover:text-background focus-visible:bg-stamp focus-visible:text-background focus-visible:outline-none`}
                >
                  p. {page}
                </button>
              ) : (
                <span
                  key={page}
                  title="This page was not among the retrieved excerpts"
                  className={`${CHIP} border-dashed border-muted-foreground text-muted-foreground`}
                >
                  p. {page}
                  <span className="sr-only"> (not among the retrieved excerpts)</span>
                </span>
              ),
            )}
          </span>
        ),
      )}
    </p>
  );
}

// "Not in the document." is a designed outcome, not an error: the system refusing to invent an answer.
export function RefusalStamp({ text }: { text: string }) {
  if (!isRefusal(text)) return null;
  return (
    <div className="py-4">
      <div
        role="img"
        aria-label={REFUSAL_TEXT}
        className="stamp-in inline-block border-[3px] border-double border-stamp px-6 py-4 text-stamp"
      >
        <p className="font-mono text-xl font-semibold uppercase tracking-[0.22em] md:text-3xl">Not in the document</p>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.2em]">Nothing was invented · see sources</p>
      </div>
      <p className="mt-5 max-w-prose text-lg leading-relaxed text-muted-foreground">
        The report does not answer this. Rather than guess, the system says so. Check the excerpts below to see what it
        did find.
      </p>
    </div>
  );
}
