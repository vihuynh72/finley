import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Reveal } from "@/components/landing/Reveal";
import { BacktestChart, PublishedBacktestChart } from "@/components/landing/BacktestChart";
import { runDay, viewFromPublished } from "@/components/evals/view";
import { usePublished } from "@/lib/published";
import { NETFLIX_2023 } from "../../../base44/shared/eval/cases.ts";

const cutoff = new Date(`${NETFLIX_2023.cutoff}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export function BacktestSection() {
  // A published backtest is a static file of this build (src/evals/published); nothing calls an API.
  const pub = usePublished(NETFLIX_2023.key);
  const view = useMemo(() => (pub.snapshot ? viewFromPublished(pub.snapshot) : null), [pub.snapshot]);
  const q = view?.quarters;
  return (
    <section className="max-w-6xl mx-auto px-6 py-20">
      <Reveal><h2 className="text-2xl font-semibold">We grade ourselves in public.</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-8">
          {q
            ? <>Finley frozen at {cutoff} forecast {NETFLIX_2023.company}'s {NETFLIX_2023.horizon.label.toLowerCase()} quarterly revenue. Here is its 80% range for each quarter against what {NETFLIX_2023.company} reported.</>
            : <>{NETFLIX_2023.company} {NETFLIX_2023.horizon.label.toLowerCase()} quarterly revenue: actual. Finley is frozen at {cutoff} and scored against these quarters.</>}
        </p></Reveal>
      <Reveal className="rounded-2xl bg-card border border-border p-6">
        {view && q ? (
          <div data-published-backtest>
            <PublishedBacktestChart rows={q.rows} />
            <div className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2">
              <p className="text-sm"><span className="num text-2xl font-semibold">{q.hits} of {q.n}</span> quarters inside the range</p>
              <p className="text-sm"><span className="num text-2xl font-semibold">{q.maePct == null ? "—" : `${q.maePct}%`}</span> mean absolute error on the midpoint</p>
            </div>
            <p className="mt-6 text-[11px] rounded-lg bg-warning-soft text-warning-ink px-3 py-2">
              From the published backtest, run {runDay(view.finishedAt)}. Forecast as of {cutoff} with the news Finley collected up to that day; actual figures are from {NETFLIX_2023.company}'s public quarterly reports.
              The model may remember 2023, so the Evals page also shows a forecast made without the news.
            </p>
          </div>
        ) : (
          <>
            <BacktestChart />
            <p className="mt-10 text-[11px] rounded-lg bg-warning-soft text-warning-ink px-3 py-2">
              Backtest data. Actual figures are from {NETFLIX_2023.company}'s public quarterly reports. Finley's predicted ranges and scores appear on the Evals page once a backtest has run.
            </p>
          </>
        )}
        <Link to="/evals" className="inline-block mt-4 text-[11px] tracking-widest hover:underline">SEE THE FULL EVALS →</Link>
      </Reveal>
    </section>
  );
}
