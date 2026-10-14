"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { streamAsk } from "@/lib/ask-client";
import { MAX_QUESTION_LENGTH, type AskErrorCode, type AskSource } from "@/lib/ask-protocol";
import { isRefusal } from "@/lib/refusal";
import { Answer, RefusalStamp } from "./answer";
import { Sources } from "./sources";

const EXAMPLES = [
  "How many depository libraries did GPO staff visit in FY 2018?",
  "What new digital system replaced FDsys, and when was it fully deployed?",
  "How much did GPO procure in printing and information products in FY 2018 on behalf of federal agencies?",
];

type Phase = "idle" | "searching" | "streaming" | "done" | "error";
type AskError = { code: AskErrorCode; message: string };

const LABEL = "font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground";

export function AskPanel() {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<AskSource[]>([]);
  const [error, setError] = useState<AskError | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [cite, setCite] = useState<{ id: number; n: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const ask = useCallback((raw: string) => {
    const q = raw.trim();
    if (!q) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setAsked(q);
    setPhase("searching");
    setAnswer("");
    setSources([]);
    setError(null);
    setSourcesOpen(false);
    setCite(null);

    let sawEvent = false;
    void streamAsk(q, controller.signal, (event) => {
      if (controller.signal.aborted) return;
      sawEvent = true;
      switch (event.type) {
        case "sources":
          setSources(event.sources);
          setPhase("streaming");
          break;
        case "text":
          setAnswer((prev) => prev + event.text);
          break;
        case "done":
          setPhase("done");
          break;
        case "error":
          setError({ code: event.code, message: event.message });
          setPhase("error");
          break;
      }
    }).then(() => {
      // The stream ended without a terminal event (e.g. the server died): don't leave the UI spinning.
      if (controller.signal.aborted) return;
      if (!sawEvent) {
        setError({ code: "unavailable", message: "The server closed the connection without answering. Try again." });
        setPhase("error");
      } else {
        setPhase((p) => (p === "streaming" ? "done" : p));
      }
    });
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setPhase((p) => (p === "searching" ? "idle" : "done"));
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    ask(question);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      ask(question);
    }
  };

  const sourcePages = useMemo(() => new Set(sources.map((s) => s.page)), [sources]);

  const onCite = useCallback(
    (page: number) => {
      const target = sources.find((s) => s.page === page);
      if (!target) return;
      setSourcesOpen(true);
      setCite((c) => ({ id: target.id, n: (c?.n ?? 0) + 1 }));
    },
    [sources],
  );

  // Open the panel first, then scroll to the cited excerpt once it is laid out.
  useEffect(() => {
    if (!cite) return;
    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(`source-${cite.id}`);
      if (!el) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      el.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [cite]);

  const toggleSources = useCallback(() => setSourcesOpen((o) => !o), []);

  const busy = phase === "searching" || phase === "streaming";
  const refused = phase === "done" && isRefusal(answer);
  const remaining = MAX_QUESTION_LENGTH - question.length;

  return (
    <div>
      <form onSubmit={onSubmit} className="rise" style={{ "--d": 2 } as React.CSSProperties}>
        <label htmlFor="ask-input" className={LABEL}>
          Your question
        </label>
        <textarea
          id="ask-input"
          name="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={MAX_QUESTION_LENGTH}
          rows={2}
          placeholder="e.g. How many copies of titles did GPO distribute?"
          aria-describedby="ask-hint"
          className="field-sizing-content mt-3 block min-h-[4.5rem] w-full resize-none border-0 border-b-2 border-foreground bg-transparent px-0 pb-3 font-heading text-2xl leading-snug outline-none placeholder:italic placeholder:text-muted-foreground/60 focus-visible:border-stamp md:text-3xl"
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <p id="ask-hint" className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Enter to ask · Shift+Enter for a new line
            {remaining <= 100 ? <span className="text-stamp"> · {remaining} left</span> : null}
          </p>
          <div className="flex items-center gap-3">
            {busy ? (
              <button
                type="button"
                onClick={stop}
                className="border border-foreground px-5 py-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] outline-none transition-colors hover:bg-foreground hover:text-background focus-visible:ring-2 focus-visible:ring-ring"
              >
                Stop
              </button>
            ) : null}
            <button
              type="submit"
              disabled={!question.trim()}
              className="group inline-flex items-center gap-3 bg-foreground px-6 py-3 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-background outline-none transition-colors hover:bg-stamp focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-foreground"
            >
              Ask
              <svg aria-hidden viewBox="0 0 16 16" className="size-3.5 transition-transform group-hover:translate-x-1">
                <path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </button>
          </div>
        </div>
      </form>

      {phase === "idle" ? (
        <div className="rise mt-12" style={{ "--d": 3 } as React.CSSProperties}>
          <p className={LABEL}>Or start with one of these</p>
          <ol className="mt-4 divide-y divide-border border-y border-border">
            {EXAMPLES.map((example, i) => (
              <li key={example}>
                <button
                  type="button"
                  onClick={() => {
                    setQuestion(example);
                    ask(example);
                  }}
                  className="group flex w-full items-baseline gap-5 py-4 text-left outline-none transition-colors hover:bg-secondary focus-visible:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="font-mono text-xs text-stamp">{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex-1 text-lg leading-snug">{example}</span>
                  <span
                    aria-hidden
                    className="font-mono text-stamp opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  >
                    →
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <section aria-live="polite" aria-busy={busy} className="mt-12">
          <p className={LABEL}>Question</p>
          <h2 className="mt-2 max-w-prose text-2xl font-normal italic leading-snug text-foreground/80">“{asked}”</h2>

          {phase === "searching" ? (
            <div role="status" className="rise mt-10">
              <p className={LABEL}>Searching the report…</p>
              <div className="sweep relative mt-3 h-px overflow-hidden bg-border" />
            </div>
          ) : null}

          {phase !== "searching" && !refused && (answer || phase === "streaming") ? (
            <article className="mt-10">
              <p className={`${LABEL} mb-3`}>Answer</p>
              {answer ? (
                <Answer text={answer} streaming={phase === "streaming"} sourcePages={sourcePages} onCite={onCite} />
              ) : (
                <p role="status" className="caret text-lg italic text-muted-foreground">
                  Drafting from {sources.length} excerpts
                </p>
              )}
            </article>
          ) : null}

          {refused ? (
            <div className="mt-10">
              <RefusalStamp text={answer} />
            </div>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="rise mt-10 max-w-prose border-l-4 border-stamp bg-secondary/60 py-4 pl-5 pr-4"
            >
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-stamp">
                {error.code === "quota" ? "Quota reached" : error.code === "invalid" ? "Check the question" : "Couldn't finish"}
              </p>
              <p className="mt-2 text-lg leading-relaxed">{error.message}</p>
              {sources.length > 0 ? (
                <p className="mt-2 text-muted-foreground">
                  Retrieval worked, so the excerpts it found are still listed below.
                </p>
              ) : null}
              {error.code !== "invalid" ? (
                <button
                  type="button"
                  onClick={() => ask(asked)}
                  className="mt-4 border border-foreground px-4 py-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] outline-none transition-colors hover:bg-foreground hover:text-background focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Try again
                </button>
              ) : null}
            </div>
          ) : null}

          {sources.length > 0 ? (
            <Sources sources={sources} open={sourcesOpen} onToggle={toggleSources} activeId={cite?.id ?? null} />
          ) : null}
        </section>
      )}
    </div>
  );
}
