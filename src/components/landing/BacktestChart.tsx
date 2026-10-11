import { motion } from "framer-motion";
import { RangeChart, RangeLegend } from "@/components/evals/RangeChart";
import type { QuarterRow } from "@/components/evals/view";
import { NETFLIX_2023 } from "../../../base44/shared/eval/cases.ts";

// Netflix's actual 2023 quarterly revenue (USD B), the answer key the backtest scores against.
// Bars start at zero; shown when no published backtest is bundled with the build.
const QUARTERS = NETFLIX_2023.quarters;
const MAX = 10;
const pct = (v: number) => `${(v / MAX) * 100}%`;
const usd = (v: number) => `$${v.toFixed(2)}B`;

export function BacktestChart() {
  return (
    <div
      className="flex items-end justify-around h-56 border-b border-border pt-8"
      role="img"
      aria-label={`${NETFLIX_2023.company} quarterly revenue, actual: ${QUARTERS.map((q) => `${q.label} ${usd(q.actual)}`).join(", ")}`}
    >
      {QUARTERS.map((q, i) => (
        <div key={q.id} className="relative w-16 h-full" title={`${q.label} (${q.span}): ${usd(q.actual)} revenue`}>
          <motion.div initial={{ opacity: 0, scaleY: 0 }} whileInView={{ opacity: 1, scaleY: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}
            className="absolute inset-x-0 bottom-0 rounded-t bg-primary/60 border border-b-0 border-primary origin-bottom"
            style={{ height: pct(q.actual) }} />
          <span className="absolute left-1/2 -translate-x-1/2 mb-1 text-[11px] font-medium text-foreground whitespace-nowrap" style={{ bottom: pct(q.actual) }}>{usd(q.actual)}</span>
          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground whitespace-nowrap">{q.label}</span>
        </div>
      ))}
    </div>
  );
}

// The published backtest's predicted 80% range (with news) against the actual, quarter by quarter.
// Every number comes from the published snapshot; nothing here is computed for show.
export function PublishedBacktestChart({ rows }: { rows: QuarterRow[] }) {
  return (
    <div>
      <RangeLegend />
      <RangeChart rows={rows} label={`${NETFLIX_2023.company} quarterly revenue: Finley's predicted 80% range vs actual, ${rows.map((r) => `${r.q} range ${r.lo ?? "none"} to ${r.hi ?? "none"}, actual ${r.actual}, ${r.hit ? "inside" : "outside"}`).join("; ")}`} />
    </div>
  );
}
