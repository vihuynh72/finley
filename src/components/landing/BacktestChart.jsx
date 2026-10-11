import { motion } from "framer-motion";

// Apple FY2022 actual quarterly revenue ($B, public reports) vs illustrative predicted ranges.
export const BACKTEST = [
  { q: "Q1 FY22", actual: 123.9, low: 115, high: 121 },
  { q: "Q2 FY22", actual: 97.3, low: 93, high: 101 },
  { q: "Q3 FY22", actual: 83.0, low: 79, high: 86 },
  { q: "Q4 FY22", actual: 90.1, low: 87, high: 94 },
];
const MAX = 130;

export default function BacktestChart() {
  return (
    <div className="flex items-end justify-around h-56 border-b border-border pt-8">
      {BACKTEST.map((d, i) => {
        const miss = d.actual < d.low || d.actual > d.high;
        return (
          <div key={d.q} className="relative w-16 h-full">
            <motion.div initial={{ opacity: 0, scaleY: 0 }} whileInView={{ opacity: 1, scaleY: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}
              className="absolute inset-x-0 rounded bg-primary/60 border border-primary origin-bottom"
              style={{ bottom: `${(d.low / MAX) * 100}%`, height: `${((d.high - d.low) / MAX) * 100}%` }} />
            <div className="absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-foreground" style={{ bottom: `${(d.actual / MAX) * 100}%` }} />
            {miss && <span className="absolute -translate-x-1/4 text-[11px] text-destructive whitespace-nowrap" style={{ bottom: `${(d.actual / MAX) * 100 + 4}%` }}>${d.actual}B · miss</span>}
            <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground whitespace-nowrap">{d.q}</span>
          </div>
        );
      })}
    </div>
  );
}