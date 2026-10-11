import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { fmtM, topicName, type Finding } from "@/lib/data";
import { scoreFinding } from "@/lib/scores";
import { ScoreChip } from "./ScoreChips";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { StatusPill } from "./bits";

export const sevCls: Record<Finding["severity"], string> = {
  urgent: "border-danger-line bg-danger-soft text-danger-ink", review: "border-warning-line bg-warning-soft text-warning-ink", info: "border-border bg-muted text-subtle",
};
const CONF = { low: 1, medium: 2, high: 3 };
// Only web links become hrefs: a source URL comes from a news search and could be anything.
const safeUrl = (u?: string) => (u && /^https?:\/\//i.test(u) ? u : undefined);

export function FindingDrawer() {
  const app = useApp();
  const nav = useNavigate();
  const f = app.drawer;
  const client = app.client;
  if (!f || !client) return null;
  const st = app.findingStatus(f.id);
  const sc = scoreFinding(client, f, app.overrides);
  const act = (s: "review" | "research" | "dismissed") => { app.setFindingStatus(f.id, s); app.openDrawer(null); };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-foreground/20" onClick={() => app.openDrawer(null)} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-[480px] flex-col overflow-y-auto border-l bg-popover p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex gap-2 text-xs">
              <span className={cn("rounded border px-2 py-0.5 text-[9px] font-bold uppercase", sevCls[f.severity])}>{f.severity}</span>
              <span className="text-muted-foreground">{topicName(client, f.topicId)} · {f.date}</span>
            </div>
            <h3 className="text-xl font-semibold leading-snug">{f.title}</h3>
            <StatusPill status={f.effect} />
          </div>
          <button className="btn px-2" aria-label="Close" onClick={() => app.openDrawer(null)}><X size={16} /></button>
        </div>

        <div className="mt-6 space-y-5 text-sm">
          <div className="border-l-4 border-foreground pl-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What happened</p>
            <ul className="list-disc space-y-1 pl-4">{f.facts.map((x) => <li key={x}>{x}</li>)}</ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {f.sources.map((s) => (
                safeUrl(s.url)
                  ? <a key={s.name} href={safeUrl(s.url)} target="_blank" rel="noreferrer" title={s.title} className="rounded border px-2 py-0.5 text-xs hover:border-strong">{s.name} · <span className="text-muted-foreground">{s.type}</span></a>
                  : <span key={s.name} className="rounded border px-2 py-0.5 text-xs">{s.name} · <span className="text-muted-foreground">{s.type}</span></span>
              ))}
            </div>
          </div>
          <div className="border-l-4 border-dashed border-strong bg-tint/40 py-2 pl-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-strong">What it may mean · AI interpretation</p>
            <p>{f.interpretation}</p>
            {f.nextStep && <p className="mt-2"><span className="font-medium">Suggested next step: </span>{f.nextStep}</p>}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Confidence</p>
            <div className="flex gap-1">{[1, 2, 3].map((i) => <span key={i} className={cn("h-2 w-12 rounded-full", i <= CONF[f.confidence] ? "bg-primary" : "bg-muted")} />)}</div>
            <p className="mt-1.5"><b className="capitalize">{f.confidence}.</b> {f.confidenceReason}</p>
          </div>
          <div className="glass p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Why this score</p>
              <ScoreChip label="Priority" v={sc.priority} />
            </div>
            <table className="num w-full text-xs">
              <thead><tr className="text-left text-muted-foreground"><th className="pb-1 font-medium">Component</th><th className="pb-1 font-medium">Weight</th><th className="pb-1 font-medium">Value</th><th className="pb-1 text-right font-medium">Points</th></tr></thead>
              <tbody>
                {([["Materiality", 0.5, sc.materiality], ["Confidence", 0.3, sc.confidence], ["Urgency", 0.2, sc.urgency]] as const).map(([n, w, v]) => (
                  <tr key={n} className="border-t"><td className="py-1">{n}</td><td>{w * 100}%</td><td>{v}</td><td className="text-right">{(w * v).toFixed(1)}</td></tr>
                ))}
              </tbody>
            </table>
            <ul className="num mt-3 space-y-1.5 border-t pt-2 text-[11px] leading-relaxed text-muted-foreground">
              <li><b className="text-foreground">Materiality {sc.materiality}:</b> {fmtM(sc.impact)} ({sc.impactBasis}) ÷ {fmtM(sc.baseEbitda)} base EBITDA = {sc.impactPct.toFixed(1)}% → ×10, capped at 100.</li>
              <li><b className="text-foreground">Source reliability {sc.reliability}:</b> average of {sc.sourceScores.map((s) => `${s.name} (Tier ${s.tier}, ${s.score})`).join(", ")}.</li>
              <li><b className="text-foreground">Confidence {sc.confidence}:</b> {sc.reliability} × {sc.corroboration} ({sc.corrobLabel}).</li>
              <li><b className="text-foreground">Urgency {sc.urgency}:</b> takes effect in about {sc.days} days (estimated from severity) → 100 within 90 days, 50 within a year, 20 beyond.</li>
              <li><b className="text-foreground">Priority {sc.priority}</b> = 0.5 × {sc.materiality} + 0.3 × {sc.confidence} + 0.2 × {sc.urgency}.</li>
            </ul>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What would change this view</p>
            <p>{f.changeView || "Not stated."}</p>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Note</span>
            <textarea value={app.notes[f.id] ?? ""} onChange={(e) => app.setNote(f.id, e.target.value)} rows={3}
              className="w-full rounded-md border bg-background p-2 text-sm" placeholder="Add a note for the review…" />
          </label>
          {st !== "open" && <p className="text-xs text-muted-foreground">Current status: <b className="capitalize">{st === "review" ? "In forecast review" : st === "research" ? "Needs research" : "Dismissed"}</b> · <button className="text-strong underline" onClick={() => app.setFindingStatus(f.id, "open")}>Reopen</button></p>}
        </div>

        <div className="mt-6 flex flex-wrap gap-2 border-t pt-4">
          {f.scenario && (
            <button className="btn" onClick={() => { app.useFinding(f); app.openDrawer(null); nav({ to: "/topics/$topicId", params: { topicId: f.topicId }, hash: "builder" }); }}>Use in scenario</button>
          )}
          <button className="btn btn-primary" onClick={() => act("review")}>Add to forecast review</button>
          <button className="btn" onClick={() => act("research")}>Needs research</button>
          <button className="btn" onClick={() => act("dismissed")}>Dismiss as not material</button>
        </div>
      </aside>
    </>
  );
}
