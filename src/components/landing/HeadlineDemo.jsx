import { useState } from "react";
import { motion } from "framer-motion";
import { Slider } from "@/components/ui/slider";
import Reveal from "@/components/landing/Reveal";

// Sample-data demo: Halvorsen Foods, oat supplier price shock.
const BASE = 5.32, COGS = 31.68;

export default function HeadlineDemo() {
  const [pct, setPct] = useState(8);
  const delta = COGS * 0.11 * (pct / 100) * 0.5;
  const scen = BASE - delta;
  const bars = [["BASE EBITDA", BASE], ["SUPPLIER PRICE", delta], ["SCENARIO EBITDA", scen]];
  return (
    <section id="scenarios" className="max-w-6xl mx-auto px-6 py-20">
      <Reveal><h2 className="text-2xl font-semibold">From headline to EBITDA in one click.</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-8">Halvorsen Foods · Sample data</p></Reveal>
      <Reveal className="rounded-2xl bg-card border border-border p-6 grid md:grid-cols-2 gap-10">
        <div>
          <p className="text-sm mb-4">Supplier price increase: {pct}%</p>
          <Slider value={[pct]} min={0} max={15} step={1} onValueChange={([v]) => setPct(v)} />
          <div className="flex justify-between text-[11px] text-muted-foreground mt-2"><span>0%</span><span>15%</span></div>
          <p className="text-[10px] tracking-wider text-muted-foreground mt-6">SCENARIO EBITDA</p>
          <p className="text-3xl font-semibold">${scen.toFixed(2)}M <span className="text-base text-destructive">-${Math.round(delta * 1000)}K</span></p>
          <p className="text-[11px] text-muted-foreground mt-3">50% of oat volume is assumed locked at current prices.</p>
        </div>
        <div>
          <div className="flex items-end justify-around h-44 border-b border-border">
            {bars.map(([l, v], i) => (
              <motion.div key={l} animate={{ height: `${(v / BASE) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 18 }}
                className={`w-16 rounded-t ${i === 1 ? "bg-destructive/70" : "bg-primary"}`} />
            ))}
          </div>
          <div className="flex justify-around text-[10px] text-muted-foreground mt-2">{bars.map(([l]) => <span key={l}>{l}</span>)}</div>
          <p className="text-[10px] text-muted-foreground mt-4">How this is calculated: COGS Δ = $31.68M × 11% oats × {pct}% × (1 − 50%) = ${Math.round(delta * 1000)}K</p>
        </div>
      </Reveal>
    </section>
  );
}