import { motion } from "framer-motion";
import { fmtM } from "@/lib/finley";

export default function SensitivityChart({ rows }) {
  const max = Math.max(1e-9, ...rows.flatMap((r) => [Math.abs(r.low), Math.abs(r.high)]));
  return (
    <div className="rounded-2xl bg-card border border-border p-5">
      <p className="text-[11px] tracking-widest font-medium mb-4">SENSITIVITY (EBITDA)</p>
      <div className="space-y-4">
        {rows.map((r) => {
          const lo = Math.min(r.low, r.high), hi = Math.max(r.low, r.high);
          return (
            <div key={r.label}>
              <p className="text-xs mb-1">{r.label}</p>
              <div className="relative h-5 bg-secondary rounded">
                <div className="absolute inset-y-0 left-1/2 w-px bg-foreground" />
                <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.6 }}
                  className="absolute inset-y-0 bg-primary rounded origin-center"
                  style={{ left: `${50 + (lo / max) * 50}%`, width: `${((hi - lo) / max) * 50}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>{fmtM(lo)}</span><span>{fmtM(hi)}</span></div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground mt-3">How this is calculated: {rows.map((r) => `${r.label}: ${fmtM(r.low)} at ${r.min}%, ${fmtM(r.high)} at ${r.max}%`).join(" · ")} (other drivers at base)</p>
    </div>
  );
}