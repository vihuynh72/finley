import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { fmtDriver, fmtM, topicName } from "@/lib/data";
import { baseValues, combinedDelta, financials } from "@/lib/model";
import { useApp, useClient } from "@/lib/store";
import { Delta, Section } from "@/components/bits";
import { SimpleBars } from "@/components/charts";
import { PromptPanel } from "@/components/PromptPanel";

export const Route = createFileRoute("/scenarios")({
  head: () => ({
    meta: [
      { title: "Prompt scenarios — Finley" },
      { name: "description", content: "Ask a what-if question to build a reforecast scenario, then compare saved scenarios side by side: revenue, gross profit, EBITDA and driver values." },
      { property: "og:title", content: "Prompt scenarios — Finley" },
      { property: "og:description", content: "Ask a what-if question to build a reforecast scenario, then compare saved scenarios side by side." },
    ],
  }),
  component: Scenarios,
});

const COLORS = ["var(--base-line)", "var(--chart)", "var(--success)", "var(--warning)"];

function Scenarios() {
  const app = useApp();
  const client = useClient();
  const [sel, setSel] = useState<string[]>([]);
  const base = financials(client);
  const rows = app.saved.map((s) => {
    const f = financials(client, combinedDelta(client, s.values));
    const changed = client.topicOrder.filter((t) => { const b = baseValues(client.topics[t]); return Object.keys(b).some((k) => s.values[t]?.[k] !== undefined && b[k] !== s.values[t]?.[k]); });
    return { s, f, changed };
  });
  const chosen = rows.filter((r) => sel.includes(r.s.id));
  const toggle = (id: string) => setSel((x) => (x.includes(id) ? x.filter((y) => y !== id) : x.length >= 3 ? x : [...x, id]));

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">{client.name}</p>
        <h1 className="text-3xl font-semibold">Prompt scenarios</h1>
      </div>

      <PromptPanel key={client.id} />

      <Section title="Saved scenarios" right={<span className="text-xs text-muted-foreground">Select 2 or 3 to compare</span>}>
        {rows.length ? (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs text-muted-foreground">
                <tr>{["", "Name", "Created", "Topics changed", "Revenue", "Gross margin", "EBITDA", "vs base"].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {rows.map(({ s, f, changed }) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2"><input type="checkbox" aria-label={`Compare ${s.name}`} checked={sel.includes(s.id)} onChange={() => toggle(s.id)} className="accent-primary" /></td>
                    <td className="px-4 py-2 font-medium">{s.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{s.created}</td>
                    <td className="px-4 py-2">
                      {changed.length ? changed.map((t, i) => <span key={t}>{i > 0 && ", "}<Link to="/topics/$topicId" params={{ topicId: t }} className="text-strong hover:underline">{topicName(client, t)}</Link></span>) : <span className="text-muted-foreground">None</span>}
                    </td>
                    <td className="num px-4 py-2">{fmtM(f.rev)}</td>
                    <td className="num px-4 py-2">{f.gm.toFixed(1)}%</td>
                    <td className="num px-4 py-2">{fmtM(f.ebitda)}</td>
                    <td className="px-4 py-2"><Delta v={f.ebitda - base.ebitda} fmt={(n) => fmtM(n, true)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card p-5 text-sm text-muted-foreground">No saved scenarios for {client.name} yet. Open a topic like <Link to="/topics/$topicId" params={{ topicId: "input" }} className="text-strong hover:underline">Input costs</Link> and use “Save scenario”.</div>
        )}
      </Section>

      {chosen.length >= 2 && (
        <Section title="Comparison">
          <div className="glass p-5">
            <SimpleBars
              data={[
                { label: "Revenue", base: base.rev, ...Object.fromEntries(chosen.map((c) => [c.s.id, c.f.rev])) },
                { label: "Gross profit", base: base.gp, ...Object.fromEntries(chosen.map((c) => [c.s.id, c.f.gp])) },
                { label: "EBITDA", base: base.ebitda, ...Object.fromEntries(chosen.map((c) => [c.s.id, c.f.ebitda])) },
              ]}
              keys={[{ key: "base", name: "Base case", color: COLORS[0] }, ...chosen.map((c, i) => ({ key: c.s.id, name: c.s.name, color: COLORS[i + 1] }))]}
            />
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs text-muted-foreground">
                <tr><th className="px-4 py-2 font-medium">Driver</th><th className="px-4 py-2 font-medium">Base</th>{chosen.map((c) => <th key={c.s.id} className="px-4 py-2 font-medium">{c.s.name}</th>)}</tr>
              </thead>
              <tbody className="divide-y">
                {client.topicOrder.flatMap((t) => client.topics[t].drivers.map((d) => (
                  <tr key={`${t}-${d.id}`}>
                    <td className="px-4 py-2"><span className="text-xs text-muted-foreground">{topicName(client, t)} · </span>{d.label}</td>
                    <td className="num px-4 py-2 text-muted-foreground">{fmtDriver(d.base, d.unit)}</td>
                    {chosen.map((c) => { const v = c.s.values[t][d.id]; return <td key={c.s.id} className={`num px-4 py-2 ${v !== d.base ? "font-semibold text-strong" : ""}`}>{fmtDriver(v, d.unit)}</td>; })}
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}
