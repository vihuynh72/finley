import { motion } from "framer-motion";
import { fmtM } from "@/lib/finley";

export default function MetricCards({ base, scen }) {
  const items = [
    ["REVENUE", fmtM(scen.rev), fmtM(base.rev), scen.rev - base.rev, fmtM],
    ["GROSS MARGIN %", `${scen.gmPct.toFixed(1)}%`, `${base.gmPct.toFixed(1)}%`, scen.gmPct - base.gmPct, (d) => `${d.toFixed(2)} pts`],
    ["EBITDA", fmtM(scen.ebitda), fmtM(base.ebitda), scen.ebitda - base.ebitda, fmtM],
    ["EBITDA MARGIN %", `${scen.marginPct.toFixed(1)}%`, `${base.marginPct.toFixed(1)}%`, scen.marginPct - base.marginPct, (d) => `${d.toFixed(2)} pts`],
  ];
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {items.map(([l, v, b, d, f]) => (
        <div key={l} className="rounded-xl bg-card border border-border p-3">
          <p className="text-[10px] tracking-wider text-muted-foreground">{l}</p>
          <motion.p key={v} initial={{ opacity: 0.4, y: -3 }} animate={{ opacity: 1, y: 0 }} className="text-lg font-semibold">{v}</motion.p>
          <p className="text-[10px] text-muted-foreground">base {b}</p>
          <p className={`text-[10px] ${Math.abs(d) < 1e-6 ? "text-muted-foreground" : d < 0 ? "text-destructive" : "text-foreground"}`}>
            {Math.abs(d) < 1e-6 ? "no change" : `${d > 0 ? "+" : ""}${f(d)}`}
          </p>
        </div>
      ))}
    </div>
  );
}