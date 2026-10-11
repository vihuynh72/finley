import { motion } from "framer-motion";

// [label, status, pill classes]. Amber in the original maps to the warning tokens (same hues in light mode).
const TILES: [string, string, string][] = [
  ["INPUT COSTS", "Challenged", "bg-destructive/10 text-destructive"],
  ["PRICING", "Under pressure", "bg-warning-line text-warning-ink"],
  ["DEMAND", "Supported", "bg-primary/50"],
  ["REGULATION", "Holding", "bg-secondary text-muted-foreground"],
];

export function HeroCard() {
  return (
    <motion.div initial={{ opacity: 0, y: 30, rotate: 1 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: 0.8, delay: 0.2 }}
      className="rounded-2xl bg-card border border-border p-5 shadow-sm">
      <div className="grid grid-cols-2 gap-3 mb-4">
        {TILES.map(([t, s, cls], i) => (
          <motion.div key={t} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 + i * 0.1 }}
            className="rounded-xl border border-border bg-background p-3">
            <p className="text-[10px] tracking-wider text-muted-foreground">{t}</p>
            <span className={`inline-block mt-2 text-[11px] px-2 py-0.5 rounded ${cls}`}>{s}</span>
          </motion.div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-background p-4">
        <p className="text-[10px] tracking-wider text-muted-foreground">WHAT HAPPENED</p>
        <p className="text-sm mt-1">Supplier announces 8% oat price increase from next quarter.</p>
        <p className="text-[10px] tracking-wider text-muted-foreground mt-3">AI INTERPRETATION</p>
        <p className="text-sm mt-1 text-muted-foreground">Unhedged volume would raise COGS and squeeze gross margin below the 34% assumption.</p>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="text-2xl font-semibold text-destructive mt-3">-$139K EBITDA</motion.p>
        <p className="text-[10px] text-muted-foreground mt-2">How this is calculated: $31.68M COGS × 11% oats × 8% × (1 − 50% locked) = $139K</p>
        <p className="text-[10px] text-muted-foreground mt-1">Sample data</p>
      </div>
    </motion.div>
  );
}
