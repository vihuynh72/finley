import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import LeverPanel from "@/components/finley/topic/LeverPanel";
import MetricCards from "@/components/finley/topic/MetricCards";
import MonthlyChart from "@/components/finley/topic/MonthlyChart";
import BridgeChart from "@/components/finley/topic/BridgeChart";
import SensitivityChart from "@/components/finley/topic/SensitivityChart";
import { baseOf, fmtDelta } from "@/lib/finley";
import { baseValues, bridgeSteps, sensitivity } from "@/lib/levers";

const view = (rev, cogs, opex) => ({ rev, ebitda: rev - cogs - opex, gmPct: rev ? ((rev - cogs) / rev) * 100 : 0, marginPct: rev ? ((rev - cogs - opex) / rev) * 100 : 0 });

export default function ScenarioBuilder({ client, topic, def, values, setValues, preset, setPreset, findings, onSaved }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const b = baseOf(client), d = def.compute(b, values);
  const base = view(b.rev, b.cogs, b.opex), scen = view(b.rev + d.rev, b.cogs + d.rev - d.ebitda, b.opex);
  const formula = def.formula(b, values, d);

  const applyPreset = (p) => { setPreset(p); if (p !== "custom") setValues(p === "base" ? baseValues(def) : { ...baseValues(def), ...def.presets[p] }); };
  const change = (k, v) => { setPreset("custom"); setValues({ ...values, [k]: v }); };

  const save = async () => {
    setSaving(true);
    await base44.entities.Scenario.create({
      client_id: client.id, question: `${topic.label}: ${def.levers.map((l) => `${l.label} ${values[l.key]}${l.unit}`).join(", ")}`,
      narrative: `EBITDA ${fmtDelta(d.ebitda)} vs base. ${formula}`,
      price_change_pct: b.rev ? (d.rev / b.rev) * 100 : 0, cogs_change_pct: b.cogs ? ((d.rev - d.ebitda) / b.cogs) * 100 : 0,
      lever_rationale: `Topic levers (${preset}) from the ${topic.label} scenario builder.`,
    });
    setSaving(false); onSaved();
    toast({ title: "Scenario saved" });
  };
  const send = async () => {
    const ids = findings.filter((f) => f.review_status !== "rejected").map((f) => f.id);
    await Promise.all(ids.map((id) => base44.entities.Finding.update(id, { incorporate: true })));
    toast({ title: "Sent to forecast review", description: `${ids.length} finding${ids.length === 1 ? "" : "s"} flagged for the reforecast.` });
  };

  return (
    <div id="builder" className="grid lg:grid-cols-[320px_1fr] gap-4">
      <LeverPanel def={def} values={values} preset={preset} onPreset={applyPreset} onChange={change} formula={formula} onSave={save} onSend={send} saving={saving} />
      <div className="space-y-4 min-w-0">
        <MetricCards base={base} scen={scen} />
        <MonthlyChart base={base} scen={scen} />
        <BridgeChart baseEbitda={b.ebitda} steps={bridgeSteps(def, b, values)} />
        <SensitivityChart rows={sensitivity(def, b)} />
      </div>
    </div>
  );
}