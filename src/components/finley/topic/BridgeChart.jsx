import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtM, fmtDelta } from "@/lib/finley";

// Waterfall: an invisible "pad" bar lifts each step to where the running total stands.
export default function BridgeChart({ baseEbitda, steps }) {
  let run = baseEbitda;
  const mid = steps.map((s) => { const start = run; run += s.value; return { name: s.label, pad: Math.min(start, run), bar: Math.abs(s.value), value: s.value }; });
  const data = [{ name: "Base EBITDA", pad: 0, bar: baseEbitda, value: baseEbitda }, ...mid, { name: "Scenario EBITDA", pad: 0, bar: run, value: run }];
  return (
    <div className="rounded-2xl bg-card border border-border p-5">
      <p className="text-[11px] tracking-widest font-medium mb-3">EBITDA BRIDGE</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
          <YAxis tickFormatter={fmtM} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={60} />
          <Tooltip formatter={(v, k, p) => (k === "bar" ? fmtM(p.payload.value) : null)} />
          <Bar dataKey="pad" stackId="a" fill="transparent" />
          <Bar dataKey="bar" stackId="a" radius={[3, 3, 0, 0]} animationDuration={600}>
            {data.map((d, i) => <Cell key={i} fill={i > 0 && i < data.length - 1 && d.value < 0 ? "hsl(var(--destructive))" : "hsl(var(--primary))"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-muted-foreground mt-2">How this is calculated: Scenario EBITDA = {fmtM(baseEbitda)} {steps.map((s) => `${fmtDelta(s.value)} (${s.label.toLowerCase()})`).join(" ")} = {fmtM(run)}</p>
    </div>
  );
}