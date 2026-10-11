import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import PasteNotes from "@/components/client/PasteNotes";
import AssumptionsEditor from "@/components/client/AssumptionsEditor";

const TEXT = [["business_model", "Business model"], ["revenue_streams", "Revenue streams"], ["cost_structure", "Cost structure"], ["financial_drivers", "Key financial drivers"], ["strategic_objectives", "Strategic objectives"]];
const NUM = [["annual_revenue", "Annual revenue ($m)"], ["gross_margin_pct", "Gross margin (%)"], ["opex", "Opex ($m)"], ["ev_ebitda_multiple", "EV/EBITDA multiple"]];

export default function ClientForm() {
  const navigate = useNavigate();
  const [f, setF] = useState({ name: "", industry: "", competitors: "", assumptions: [] });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const applyAI = (p) => setF({ ...f, ...p, competitors: (p.competitors || []).join(", "), assumptions: (p.assumptions || []).map((a) => ({ ...a, status: "monitoring" })) });

  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    const data = { ...f, competitors: f.competitors.split(",").map((s) => s.trim()).filter(Boolean), assumptions: f.assumptions.filter((a) => a.text) };
    NUM.forEach(([k]) => { data[k] = data[k] === "" || data[k] == null ? undefined : Number(data[k]); });
    const c = await base44.entities.Client.create(data);
    // Fire-and-forget: the keyword planner maps this profile's external forces into the Bright Data
    // searches every scan runs. Without a plan the pipeline falls back to generic searches.
    base44.functions.invoke("planKeywords", { client_id: c.id }).catch(() => {});
    navigate(`/clients/${c.id}`);
  };

  return (
    <form onSubmit={submit} className="max-w-3xl">
      <h1 className="text-2xl font-semibold mb-1">New client intelligence profile</h1>
      <p className="text-sm text-muted-foreground mb-6">This context is what the agents analyze every development against.</p>
      <PasteNotes onStructured={applyAI} />
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div><Label>Company name</Label><Input required value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div><Label>Industry</Label><Input value={f.industry} onChange={(e) => set("industry", e.target.value)} /></div>
      </div>
      {TEXT.map(([k, l]) => (
        <div key={k} className="mb-4"><Label>{l}</Label><Textarea rows={2} value={f[k] || ""} onChange={(e) => set(k, e.target.value)} /></div>
      ))}
      <div className="mb-4"><Label>Competitors (comma separated)</Label><Input value={f.competitors} onChange={(e) => set("competitors", e.target.value)} /></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {NUM.map(([k, l]) => (<div key={k}><Label className="text-xs">{l}</Label><Input type="number" step="any" value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} /></div>))}
      </div>
      <Label className="block mb-2">Key assumptions to monitor</Label>
      <AssumptionsEditor value={f.assumptions} onChange={(v) => set("assumptions", v)} />
      <Button type="submit" className="mt-8" disabled={saving}>{saving ? "Saving…" : "Create client"}</Button>
    </form>
  );
}