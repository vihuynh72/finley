import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { simulate } from "@/lib/scenarioModel";

const LEVERS = [["price_change_pct", "Price %"], ["volume_change_pct", "Volume %"], ["cogs_change_pct", "COGS %"], ["opex_change_pct", "Opex %"], ["multiple_change", "Multiple Δ (x)"]];

export default function ScenarioResult({ client, scenario }) {
  const [l, setL] = useState(scenario);
  const [saved, setSaved] = useState(true);
  const rows = simulate(client, l);
  const set = (k, v) => { setL({ ...l, [k]: v === "" ? 0 : Number(v) }); setSaved(false); };
  const save = async () => { await base44.entities.Scenario.update(scenario.id, Object.fromEntries(LEVERS.map(([k]) => [k, l[k]]))); setSaved(true); };

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-xs text-amber-400 mb-1">Illustrative scenario · not a forecast</div>
      <h4 className="font-medium">{scenario.question}</h4>
      <p className="text-sm text-muted-foreground mt-2">{scenario.narrative}</p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
        {LEVERS.map(([k, lab]) => (<div key={k}><div className="text-xs text-muted-foreground">{lab}</div><Input type="number" step="any" className="h-8" value={l[k] ?? 0} onChange={(e) => set(k, e.target.value)} /></div>))}
      </div>
      <p className="text-xs text-muted-foreground mt-2">{scenario.lever_rationale}</p>
      <table className="w-full text-sm mt-4">
        <thead><tr className="text-xs text-muted-foreground text-left"><th className="py-1">Metric</th><th>Baseline</th><th>Scenario</th><th>Δ</th></tr></thead>
        <tbody>{rows.map(([m, b, s]) => (
          <tr key={m} className="border-t border-border"><td className="py-1.5">{m}</td><td>{b.toFixed(1)}</td><td>{s.toFixed(1)}</td>
            <td className={s - b >= 0 ? "text-emerald-400" : "text-red-400"}>{(s - b >= 0 ? "+" : "") + (s - b).toFixed(1)}</td></tr>
        ))}</tbody>
      </table>
      {!saved && <Button size="sm" className="mt-3" onClick={save}>Save adjusted assumptions</Button>}
      <div className="grid md:grid-cols-2 gap-4 mt-4 text-xs">
        <div><div className="text-muted-foreground mb-1">Evidence used</div><ul className="list-disc pl-4 space-y-1">{(scenario.evidence || []).map((e, i) => <li key={i}>{e}</li>)}</ul></div>
        <div><div className="text-muted-foreground mb-1">What could make this wrong</div><ul className="list-disc pl-4 space-y-1">{(scenario.risks || []).map((e, i) => <li key={i}>{e}</li>)}</ul></div>
      </div>
    </div>
  );
}