"use client";

import { memo } from "react";
import type { AskSource } from "@/lib/ask-protocol";

type Props = {
  sources: AskSource[];
  open: boolean;
  onToggle: () => void;
  activeId: number | null;
};

// The retrieved excerpts the model was given: the audit trail for every answer.
export const Sources = memo(function Sources({ sources, open, onToggle, activeId }: Props) {
  const pages = [...new Set(sources.map((s) => s.page))];

  return (
    <section aria-labelledby="sources-heading" className="rise mt-12 border-t-[3px] border-double border-border pt-4">
      <h2 id="sources-heading" className="text-base font-normal">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="sources-list"
          onClick={onToggle}
          className="group flex w-full flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em]">Sources</span>
          <span className="flex-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {sources.length} excerpts · PDF pp. {pages.join(", ")}
          </span>
          <span
            aria-hidden
            className="font-mono text-lg leading-none text-stamp transition-transform duration-300 group-hover:scale-125"
          >
            {open ? "−" : "+"}
          </span>
        </button>
      </h2>

      <div
        id="sources-list"
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <ol className="space-y-7 pt-6">
            {sources.map((s, i) => (
              <li
                key={s.id}
                id={`source-${s.id}`}
                tabIndex={-1}
                className={`border-l-2 py-1 pl-5 outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  s.id === activeId ? "flash border-stamp" : "border-border"
                }`}
              >
                <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  <span>Excerpt {String(i + 1).padStart(2, "0")}</span>
                  <span className="font-semibold text-stamp">PDF p. {s.page}</span>
                  <span className="flex items-center gap-2">
                    <span
                      role="img"
                      aria-label={`Similarity ${s.score.toFixed(3)}`}
                      className="relative block h-1 w-20 bg-border"
                    >
                      <span
                        className="absolute inset-y-0 left-0 bg-foreground"
                        style={{ width: `${Math.max(0, Math.min(1, s.score)) * 100}%` }}
                      />
                    </span>
                    {s.score.toFixed(3)}
                  </span>
                </div>
                <p className="whitespace-pre-line text-[0.95rem] leading-relaxed text-foreground/85">{s.content}</p>
              </li>
            ))}
          </ol>
          <p className="pb-2 pt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Page numbers are PDF page indices, not the printed page numbers.
          </p>
        </div>
      </div>
    </section>
  );
});
