import { AskPanel } from "@/components/ask-panel";

const delay = (n: number) => ({ "--d": n }) as React.CSSProperties;

export default function Home() {
  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 content-start gap-x-16 gap-y-12 px-5 py-10 md:grid-cols-[17rem_minmax(0,1fr)] md:px-10 md:py-16">
      <header className="md:sticky md:top-16 md:self-start">
        <div className="rise border-y-[3px] border-double border-foreground py-3" style={delay(0)}>
          <p className="font-mono text-[11px] uppercase tracking-[0.24em]">Document Desk · Vol. 01</p>
        </div>
        <h1 className="rise mt-8 text-5xl font-semibold leading-[0.95] tracking-tight md:text-6xl" style={delay(1)}>
          Ask the <em className="font-normal text-stamp">Annual Report</em>
        </h1>
        <p className="rise mt-6 max-w-[30ch] text-lg leading-snug text-muted-foreground" style={delay(2)}>
          Plain questions, answered only from the U.S. Government Publishing Office&rsquo;s FY&nbsp;2018 report, with
          the pages to prove it.
        </p>
        <dl
          className="rise mt-8 space-y-4 border-t border-border pt-5 font-mono text-[11px] uppercase tracking-[0.14em]"
          style={delay(3)}
        >
          <div>
            <dt className="text-muted-foreground">Source</dt>
            <dd className="mt-1">GPO Annual Report, FY 2018</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Method</dt>
            <dd className="mt-1">Top 5 passages · cited by PDF page</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">House rule</dt>
            <dd className="mt-1 text-stamp">If it isn&rsquo;t in the document, it says so.</dd>
          </div>
        </dl>
      </header>
      <AskPanel />
    </main>
  );
}
