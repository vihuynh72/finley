import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { fmtDriver, fmtM, type TopicId } from "@/lib/data";
import { driverSteps, ebitdaDelta, financials, monthly, presetValues, tornado } from "@/lib/model";
import { useApp, useClient, type Preset } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Delta, Formula } from "./bits";
import { BridgeChart, MonthlyChart, SimpleBars, TornadoChart } from "./charts";

const H = "text-xs font-bold uppercase tracking-[0.6px]";

export function ScenarioBuilder({ topicId }: { topicId: TopicId }) {
  const app = useApp();
  const client = useClient();
  const t = client.topics[topicId];
  const v = app.values[topicId] ?? {};
  const preset = app.preset[topicId] ?? "base";
  const tags = app.tags[topicId] ?? {};
  const [metric, setMetric] = useState<"rev" | "ebitda">("ebitda");
  const [naming, setNaming] = useState<string | null>(null);

  const d = t.compute(v);
  const base = financials(client), scen = financials(client, d);
  const down = financials(client, t.compute(presetValues(t, "downside")));
  const up = financials(client, t.compute(presetValues(t, "upside")));
  const months = monthly(base, scen, down, up, metric);
  const steps = driverSteps(t, v);
  const lr = t.longRange;
  const torn = tornado(t, (x) => (lr ? -lr.compute(x) : ebitdaDelta(t.compute(x))));

  const kpis = [
    { label: "Revenue", s: fmtM(scen.rev), b: fmtM(base.rev), dv: scen.rev - base.rev, f: (n: number) => fmtM(n, true) },
    { label: "Gross margin %", s: `${scen.gm.toFixed(1)}%`, b: `${base.gm.toFixed(1)}%`, dv: scen.gm - base.gm, f: (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)} pts` },
    { label: "EBITDA", s: fmtM(scen.ebitda), b: fmtM(base.ebitda), dv: scen.ebitda - base.ebitda, f: (n: number) => fmtM(n, true) },
    { label: "EBITDA margin %", s: `${scen.em.toFixed(1)}%`, b: `${base.em.toFixed(1)}%`, dv: scen.em - base.em, f: (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)} pts` },
  ];

  return (
    <div className="grid grid-cols-[429px_minmax(0,1fr)] gap-6">
      <div className="card space-y-8 self-start p-6">
        <div className="flex gap-1.5 rounded-lg border bg-popover p-1">
          {(["base", "downside", "upside", "custom"] as Preset[]).map((p) => (
            <button key={p} disabled={p === "custom"} onClick={() => p !== "custom" && app.applyPreset(topicId, p)}
              className={cn("flex-1 rounded py-1.5 text-[10px] font-bold capitalize", preset === p ? "bg-primary text-primary-foreground" : "text-muted-foreground", p === "custom" && "cursor-default")}>{p}</button>
          ))}
        </div>
        <div className="space-y-8">
          {t.drivers.map((dr) => (
            <div key={dr.id} className="space-y-3.5">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={`${topicId}-${dr.id}`} className="text-xs font-bold">
                  {dr.label}
                  {tags[dr.id] && <span className="ml-2 rounded bg-tint px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">from finding</span>}
                </label>
                <input type="number" min={dr.min} max={dr.max} step={dr.step} value={v[dr.id] ?? dr.base} aria-label={dr.label}
                  onChange={(e) => app.setDriver(topicId, dr.id, Math.min(dr.max, Math.max(dr.min, +e.target.value)))}
                  className="num w-14 rounded border bg-popover px-2 py-1 text-right text-[11px] font-bold" />
              </div>
              <input id={`${topicId}-${dr.id}`} type="range" min={dr.min} max={dr.max} step={dr.step} value={v[dr.id] ?? dr.base}
                onChange={(e) => app.setDriver(topicId, dr.id, +e.target.value)} className="slider w-full" />
              <p className="num text-[9px] font-medium text-muted-foreground">base {fmtDriver(dr.base, dr.unit)} · range {fmtDriver(dr.min, dr.unit)} to {fmtDriver(dr.max, dr.unit)}</p>
            </div>
          ))}
        </div>
        <div className="space-y-3 border-t pt-6">
          <p className="num text-[9px] font-medium italic leading-relaxed text-muted-foreground">How this is calculated: {t.formula(v)}</p>
          <div className="grid grid-cols-2 gap-3 pt-3">
            {naming === null ? (
              <button className="rounded-lg bg-primary py-2.5 text-[11px] font-bold text-primary-foreground" onClick={() => setNaming("")}>Save scenario</button>
            ) : (
              <form className="col-span-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (naming.trim()) { app.saveScenario(naming.trim()); setNaming(null); } }}>
                <input autoFocus value={naming} onChange={(e) => setNaming(e.target.value)} placeholder="Scenario name" className="flex-1 rounded-lg border bg-popover px-3 text-sm" />
                <button className="rounded-lg bg-primary px-4 py-2.5 text-[11px] font-bold text-primary-foreground" type="submit">Save</button>
              </form>
            )}
            <button className="rounded-lg border py-2.5 text-[11px] font-bold hover:bg-muted" onClick={() => app.applyPreset(topicId, "base")}>Reset to base</button>
            <button className="rounded-lg border py-2.5 text-[11px] font-bold hover:bg-muted" onClick={() => app.notify(`Sent ${client.name} · ${t.name} scenario to forecast review`)}>Send to forecast review</button>
            <Link to="/scenarios" className="rounded-lg border py-2.5 text-center text-[11px] font-bold hover:bg-muted">View saved</Link>
          </div>
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-xl border bg-card p-4">
              <p className="text-[9px] font-bold uppercase text-muted-foreground">{k.label}</p>
              <p className="num pt-1 text-base font-bold">{k.s}</p>
              <p className="num pt-1 text-[9px] text-muted-foreground">base {k.b}</p>
              <Delta v={k.dv} fmt={k.f} />
            </div>
          ))}
        </div>

        {lr ? (
          <div className="glass p-6">
            <p className="mb-3 rounded-md bg-tint p-3 text-sm">{lr.note}</p>
            <h3 className={H}>{lr.label}</h3>
            <SimpleBars
              data={[
                { label: "Base", cost: lr.compute(presetValues(t, "base")) },
                { label: "Upside", cost: lr.compute(presetValues(t, "upside")) },
                { label: "Scenario", cost: lr.compute(v) },
                { label: "Downside", cost: lr.compute(presetValues(t, "downside")) },
              ]}
              keys={[{ key: "cost", name: "2028 cost", color: "var(--chart)" }]}
            />
            <Formula>{lr.formula(v)}</Formula>
          </div>
        ) : (
          <>
            <div className="glass p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className={H}>Plan-year monthly {metric === "rev" ? "revenue" : "EBITDA"}</h3>
                <div className="flex gap-2">
                  {(["rev", "ebitda"] as const).map((m) => (
                    <button key={m} onClick={() => setMetric(m)} className={cn("rounded border px-3 py-1 text-[9px] font-bold", metric === m ? "bg-card text-primary-foreground" : "text-muted-foreground")}>{m === "rev" ? "Revenue" : "EBITDA"}</button>
                  ))}
                </div>
              </div>
              <MonthlyChart data={months} />
              <Formula>Month = annual {metric === "rev" ? "revenue" : "EBITDA"} × seasonality weight (Jan 7.5% … Dec 9.0%). Scenario annual = {fmtM(metric === "rev" ? base.rev : base.ebitda)} {fmtM(metric === "rev" ? d.rev : ebitdaDelta(d), true)} = {fmtM(metric === "rev" ? scen.rev : scen.ebitda)}</Formula>
            </div>
            <div className="glass p-6">
              <h3 className={cn(H, "mb-4")}>EBITDA bridge</h3>
              <BridgeChart start={base.ebitda} steps={steps} />
              <Formula>Scenario EBITDA = {fmtM(base.ebitda)} {steps.map((s) => `${s.value >= 0 ? "+" : "−"} ${fmtM(Math.abs(s.value))} (${s.name.toLowerCase()})`).join(" ")} = {fmtM(scen.ebitda)}</Formula>
            </div>
          </>
        )}
        <div className="glass p-6">
          <h3 className={cn(H, "mb-4")}>Sensitivity {lr ? `(${lr.label})` : "(EBITDA)"}</h3>
          <TornadoChart rows={torn} />
          <Formula>{torn.map((r) => `${r.name}: ${fmtM(r.low, true)} at ${fmtDriver(r.min, r.unit)}, ${fmtM(r.high, true)} at ${fmtDriver(r.max, r.unit)}`).join(" · ")} (other drivers at base)</Formula>
        </div>
      </div>
    </div>
  );
}
