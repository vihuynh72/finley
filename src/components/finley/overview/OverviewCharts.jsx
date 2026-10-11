import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TOPIC_PAGES, baseOf, findingDelta, fmtM, topicOf } from "@/lib/finley";

export default function OverviewCharts({ client, findings }) {
  const b = baseOf(client);
  const deltas = TOPIC_PAGES.map((t) => ({ name: t.short, value: findings.filter((f) => topicOf(f) === t.label).reduce((s, f) => s + findingDelta(b, f), 0) }));
  const combined = b.ebitda + deltas.reduce((s, d) => s + d.value, 0);
  const data = [{ name: "Base", value: b.ebitda }, ...deltas, { name: "Combined", value: combined }];
  const ratio = b.ebitda ? Math.max(0, Math.min(1, combined / b.ebitda)) : 0;
  return (
    <div className="grid lg:grid-cols-3 gap-4 mb-6">
      <div className="lg:col-span-2 rounded-2xl bg-card border border-border p-5">
        <h3 className="font-medium mb-4">Combined scenario EBITDA bridge</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtM} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={60} />
            <Tooltip formatter={(v) => fmtM(v)} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} animationDuration={900}>
              {data.map((d, i) => <Cell key={i} fill={d.value < 0 ? "hsl(var(--foreground))" : "hsl(var(--primary))"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-[10px] text-muted-foreground mt-2">Topic bars sum quantified finding impacts (illustrative, rejected findings excluded).</p>
      </div>
      <div className="rounded-2xl bg-card border border-border p-5 flex flex-col">
        <h3 className="font-medium">FY monthly EBITDA</h3>
        <div className="relative flex-1 min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={[{ v: ratio }, { v: 1 - ratio }]} dataKey="v" innerRadius="70%" outerRadius="88%" startAngle={90} endAngle={-270} stroke="none" animationDuration={1000}>
                <Cell fill="hsl(var(--primary))" /><Cell fill="hsl(var(--foreground))" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <p className="text-2xl font-light text-center">{fmtM(combined)}</p>
        <p className="text-[11px] text-muted-foreground text-center">Projected EBITDA · {Math.round(ratio * 100)}% of base</p>
      </div>
    </div>
  );
}