import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { base44 } from "@/api/base44Client";

export default function ActivityChart({ clientId }) {
  const [unit, setUnit] = useState("day");
  const { data } = useQuery({ queryKey: ["activity", clientId, unit], queryFn: () =>
    base44.entities.Finding.aggregate({ query: { client_id: clientId }, dateBucket: { field: "created_date", unit }, avg: "priority" }) });
  const rows = (data?.rows || []).map((r) => {
    const key = r.created_date || r.bucket || r.date;
    return { label: key ? new Date(key).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "", count: r.count, key };
  }).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  return (
    <div className="rounded-2xl bg-card border border-border p-5 h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium">Signal activity</h3>
        <div className="flex text-[11px] rounded-full border border-border overflow-hidden">
          {[["day", "Daily"], ["week", "Weekly"]].map(([u, l]) => (
            <button key={u} onClick={() => setUnit(u)} className={`px-3 py-1 ${unit === u ? "bg-accent text-accent-foreground" : ""}`}>{l}</button>
          ))}
        </div>
      </div>
      {rows.length ? (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={rows}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
            <Tooltip formatter={(v) => [v, "Findings"]} />
            <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={3} fill="hsl(var(--primary) / 0.2)" animationDuration={900} />
          </AreaChart>
        </ResponsiveContainer>
      ) : <p className="text-sm text-muted-foreground py-20 text-center">No findings yet. Run a scan to start.</p>}
    </div>
  );
}