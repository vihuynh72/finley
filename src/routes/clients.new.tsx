import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Sparkles } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { base44 } from "@/api/base44Client";
import { Section } from "@/components/bits";
import { useApp } from "@/lib/store";

export const Route = createFileRoute("/clients/new")({
  head: () => ({ meta: [{ title: "New client — Finley" }] }),
  component: NewClient,
});

type Form = Record<string, string>;
const TEXT = [
  ["business_model", "Business model", "How the company makes money"],
  ["revenue_streams", "Revenue streams", "Products, segments, regions"],
  ["cost_structure", "Cost structure", "Main costs and what drives them"],
  ["financial_drivers", "Key financial drivers", "Volumes, prices, input costs, FX…"],
  ["strategic_objectives", "Strategic objectives", "What management is trying to do this year"],
] as const;
const NUMS = [
  ["annual_revenue", "Annual revenue ($M)"], ["gross_margin_pct", "Gross margin %"], ["opex", "Operating expenses ($M)"], ["ev_ebitda_multiple", "EV/EBITDA multiple"],
] as const;
const field = "w-full rounded-lg border bg-popover px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const L = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <label className="block space-y-1.5"><span className="text-xs font-bold">{label}</span>{children}{hint && <span className="block text-[10px] text-muted-foreground">{hint}</span>}</label>
);

// Assumptions as one per line, "text | driver"; the driver is what the dashboard groups by.
const parseAssumptions = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean)
  .map((l) => { const [t, d] = l.split("|").map((x) => x.trim()); return { text: t, driver: d || "", status: "monitoring" }; });

function NewClient() {
  const app = useApp();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [f, setF] = useState<Form>({});
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

  const structure = async () => {
    setBusy("Structuring notes…"); setError("");
    try {
      const res = await base44.functions.invoke("structureProfile", { notes });
      const p = res.data?.profile;
      if (!p) throw new Error(res.data?.error || "No profile returned");
      setF((x) => ({
        ...x,
        ...Object.fromEntries(["name", "industry", "ticker", ...TEXT.map(([k]) => k)].filter((k) => p[k]).map((k) => [k, String(p[k])])),
        ...Object.fromEntries(NUMS.map(([k]) => k).filter((k) => Number.isFinite(Number(p[k])) && p[k] !== null).map((k) => [k, String(p[k])])),
        competitors: Array.isArray(p.competitors) ? p.competitors.join(", ") : String(p.competitors || x["competitors"] || ""),
        assumptions: Array.isArray(p.assumptions) ? p.assumptions.map((a: any) => [a.text, a.driver].filter(Boolean).join(" | ")).join("\n") : x["assumptions"] || "",
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      setBusy("Saving client…");
      const num = (k: string) => (f[k]?.trim() ? Number(f[k]) : undefined);
      const rec = await base44.entities.Client.create({
        name: f["name"]?.trim(), industry: f["industry"]?.trim() || "", ticker: f["ticker"]?.trim().toUpperCase() || "",
        ...Object.fromEntries(TEXT.map(([k]) => [k, f[k]?.trim() || ""])),
        ...Object.fromEntries(NUMS.map(([k]) => [k, num(k)]).filter(([, v]) => v !== undefined && Number.isFinite(v))),
        competitors: (f["competitors"] || "").split(",").map((s) => s.trim()).filter(Boolean),
        assumptions: parseAssumptions(f["assumptions"] || ""),
        ...(f["reforecast_due"] ? { reforecast_due: f["reforecast_due"] } : {}),
      });
      // Pretraining: map the forces that move this client and the news keywords that watch them.
      // These become the client's topic tabs and the first scan's searches.
      setBusy("Mapping what to watch (about a minute)…");
      await base44.functions.invoke("planKeywords", { client_id: rec.id }).catch((err: Error) => setError(`Saved, but the keyword plan failed: ${err.message}. Scans will build it.`));
      await qc.invalidateQueries({ queryKey: ["clients"] });
      app.setClientId(rec.id);
      nav({ to: "/dashboard" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-[1.1px] text-muted-foreground">Clients</p>
        <h1 className="text-[32px] font-normal leading-[48px]">New client</h1>
      </div>

      <Section title="Shortcut: paste notes">
        <div className="card space-y-3 p-6">
          <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} className={field}
            placeholder="Paste 10-K excerpts, meeting notes or a pitch deck summary; Claude fills in the form below for you to check." />
          <button type="button" className="btn" disabled={!notes.trim() || !!busy} onClick={structure}><Sparkles size={12} /> Structure with AI</button>
        </div>
      </Section>

      <form onSubmit={save} className="space-y-10">
        <Section title="Company">
          <div className="card grid grid-cols-3 gap-5 p-6">
            <L label="Name *"><input required className={field} value={f["name"] || ""} onChange={(e) => set("name", e.target.value)} /></L>
            <L label="Industry"><input className={field} value={f["industry"] || ""} onChange={(e) => set("industry", e.target.value)} /></L>
            <L label="Ticker" hint="Listed companies only; used for the market snapshot"><input className={field} value={f["ticker"] || ""} onChange={(e) => set("ticker", e.target.value)} /></L>
            {TEXT.map(([k, label, hint]) => (
              <div key={k} className="col-span-3"><L label={label}><textarea rows={2} className={field} placeholder={hint} value={f[k] || ""} onChange={(e) => set(k, e.target.value)} /></L></div>
            ))}
            <div className="col-span-3"><L label="Competitors" hint="Comma separated"><input className={field} value={f["competitors"] || ""} onChange={(e) => set("competitors", e.target.value)} /></L></div>
          </div>
        </Section>

        <Section title="Plan-year financials">
          <div className="card grid grid-cols-5 gap-5 p-6">
            {NUMS.map(([k, label]) => (
              <L key={k} label={label}><input type="number" step="any" className={field} value={f[k] || ""} onChange={(e) => set(k, e.target.value)} /></L>
            ))}
            <L label="Reforecast due"><input type="date" className={field} value={f["reforecast_due"] || ""} onChange={(e) => set("reforecast_due", e.target.value)} /></L>
            <p className="col-span-5 text-[10px] text-muted-foreground">Check these if the AI filled them in: it estimates figures the notes don't give. Every scenario on the dashboard is sized from them.</p>
          </div>
        </Section>

        <Section title="Forecast assumptions">
          <div className="card space-y-2 p-6">
            <textarea rows={5} className={field} value={f["assumptions"] || ""} onChange={(e) => set("assumptions", e.target.value)}
              placeholder={"One per line: assumption | driver\nGross margin holds at 34% | Input costs\nBar line pricing stays flat | Pricing"} />
            <p className="text-[10px] text-muted-foreground">Finley tests each assumption against the news on every scan.</p>
          </div>
        </Section>

        {error && <p className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-ink">{error}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={!!busy || !f["name"]?.trim()}>
            {busy ? <><Loader2 size={12} className="animate-spin" /> {busy}</> : "Save client"}
          </button>
          {app.clients.length > 0 && <button type="button" className="btn" onClick={() => nav({ to: "/dashboard" })}>Cancel</button>}
        </div>
      </form>
    </div>
  );
}
