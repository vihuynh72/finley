import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MONTHS, WEIGHTS, fmtM } from "@/lib/finley";

export default function MonthlyChart({ base, scen }) {
  const [metric, setMetric] = useState("ebitda");
  const data = MONTHS.map((m, i) => ({ m, base: base[metric] * WEIGHTS[i], scenario: scen[metric] * WEIGHTS[i] }));
  return (
    <div className="rounded-2xl bg-card border border-border p-5">
      <div className="flex justify-between items-center mb-3">
        <p className="text-[11px] tracking-widest font-medium">FY MONTHLY {metric === "rev" ? "REVENUE" : "EBITDA"}</p>
        <div className="flex gap-1 text-[10px]">
          {[["rev", "Revenue"], ["ebitda", "EBITDA"]].map(([k, l]) => (
            <button key={k} onClick={() => setMetric(k)} className={`px-2 py-1 rounded border border-border ${metric === k ? "bg-secondary" : ""}`}>{l}</button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid stroke="hsl(var(--border))" />
          <XAxis dataKey="m" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmtM} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={60} />
          <Tooltip formatter={(v) => fmtM(v)} />
          <Line dataKey="base" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" dot={false} />
          <Line dataKey="scenario" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} animationDuration={600} />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-muted-foreground mt-2">How this is calculated: Month = annual value × seasonality weight (Oct 7% … Dec 13% … Sep 9%). Scenario annual = {fmtM(base.ebitda)} {scen.ebitda - base.ebitda >= 0 ? "+" : "−"} {fmtM(Math.abs(scen.ebitda - base.ebitda))} = {fmtM(scen.ebitda)}</p>
    </div>
  );
}