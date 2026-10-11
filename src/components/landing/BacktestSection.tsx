import { Link } from "@tanstack/react-router";
import { Reveal } from "@/components/landing/Reveal";
import { BacktestChart } from "@/components/landing/BacktestChart";
import { NETFLIX_2023 } from "../../../base44/shared/eval/cases.ts";

const cutoff = new Date(`${NETFLIX_2023.cutoff}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export function BacktestSection() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20">
      <Reveal><h2 className="text-2xl font-semibold">We grade ourselves in public.</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-8">
          {NETFLIX_2023.company} {NETFLIX_2023.horizon.label.toLowerCase()} quarterly revenue: actual. Finley is frozen at {cutoff} and scored against these quarters.
        </p></Reveal>
      <Reveal className="rounded-2xl bg-card border border-border p-6">
        <BacktestChart />
        <p className="mt-10 text-[11px] rounded-lg bg-warning-soft text-warning-ink px-3 py-2">
          Backtest data. Actual figures are from {NETFLIX_2023.company}'s public quarterly reports. Finley's predicted ranges and scores appear on the Evals page once a backtest has run.
        </p>
        <Link to="/evals" className="inline-block mt-4 text-[11px] tracking-widest hover:underline">SEE THE FULL EVALS →</Link>
      </Reveal>
    </section>
  );
}
