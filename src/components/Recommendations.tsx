import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Check, ChevronDown, ChevronRight, CircleCheck, Clock, Copy, Eye, HelpCircle, Pencil, X } from "lucide-react";
import { KeywordChips } from "./KeywordChips";
import { fmtM } from "@/lib/data";
import { financials } from "@/lib/model";
import { fmtK, recsFor, type Rec } from "@/lib/recs";
import { useApp, useClient } from "@/lib/store";
import { cn } from "@/lib/utils";
import { ScoreChip } from "./ScoreChips";
import { Section } from "./bits";

const typeCls: Record<Rec["type"], string> = {
  "Change assumption": "bg-primary text-primary-foreground",
  "Get information": "bg-tint text-strong",
  "Hold and watch": "bg-warning-soft text-warning-ink",
  "No action needed": "bg-muted text-muted-foreground",
};

const typeIcon: Record<Rec["type"], typeof Pencil> = {
  "Change assumption": Pencil, "Get information": HelpCircle, "Hold and watch": Eye, "No action needed": CircleCheck,
};

export function useRecSummary() {
  const app = useApp();
  const client = useClient();
  const recs = useMemo(() => recsFor(client), [client]);
  const dismissedF = (id: string) => app.findingStatus(id) === "dismissed";
  const live = (r: Rec) => app.recStatus[r.id] !== "dismissed" && !dismissedF(r.findings[0]);
  const current = financials(client).ebitda;
  const sum = (k: "base" | "downside" | "upside") => recs.filter(live).reduce((a, r) => a + (r[k] ?? 0), 0);
  const recBase = current + sum("base");
  const decided = Object.entries(app.recStatus).filter(([id, s]) => recs.some((r) => r.id === id) && (s === "accepted" || s === "dismissed"));
  return {
    recs, current, recBase, down: current + sum("downside"), up: recBase + sum("upside"),
    evidenceChanged: (r: Rec) => r.findings.some(dismissedF), live,
    findingCount: new Set(recs.flatMap((r) => r.findings)).size,
    acceptedRate: decided.length ? Math.round((decided.filter(([, s]) => s === "accepted").length / decided.length) * 100) : null,
  };
}

function RangeBar({ down, base, current, up }: { down: number; base: number; current: number; up: number }) {
  const lo = Math.min(down, base, current), hi = Math.max(up, base, current), span = hi - lo || 1;
  const pos = (v: number) => `${((v - lo) / span) * 100}%`;
  const marks: [string, number, string][] = [["Downside", down, "bg-danger"], ["Recommended", base, "bg-primary"], ["Current", current, "bg-foreground"], ["Upside", up, "bg-success"]];
  return (
    <div className="mt-4 px-2">
      <div className="relative h-2 rounded-full bg-muted">
        <div className="absolute inset-y-0 rounded-full bg-primary/30" style={{ left: pos(down), right: `calc(100% - ${pos(up)})` }} />
        {marks.map(([l, v, c]) => <span key={l} title={`${l}: ${fmtM(v)}`} className={cn("absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-background", c)} style={{ left: pos(v) }} />)}
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
        {marks.map(([l, v, c]) => <span key={l} className="num flex items-center gap-1.5"><span className={cn("h-2 w-2 rounded-sm", c)} />{l} {fmtM(v)}</span>)}
      </div>
    </div>
  );
}

function RecCard({ r, evidence, live }: { r: Rec; evidence: boolean; live: boolean }) {
  const app = useApp();
  const nav = useNavigate();
  const client = useClient();
  const [draftOpen, setDraftOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(r.draft ?? "");
  const st = app.recStatus[r.id] ?? "open";
  const findings = r.findings.map((id) => client.findings.find((f) => f.id === id)).filter(Boolean) as typeof client.findings;
  const primary = findings[0];

  if (st !== "open") {
    return (
      <div className="card flex items-center justify-between px-4 py-2.5 text-sm">
        <span className="truncate"><b className="capitalize">{st}</b> by you · <span className="text-muted-foreground">{r.headline}</span></span>
        <button className="shrink-0 text-xs text-strong underline" onClick={() => app.setRecStatus(r.id, "open")}>Undo</button>
      </div>
    );
  }
  const title = r.headline.replace(/^Before changing the plan, find out:\s*/i, "");
  const TypeIcon = typeIcon[r.type];
  return (
    <div className="card p-4">
      <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen((o) => !o)}>
        <span title={r.label ?? r.type} aria-label={r.label ?? r.type} className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full", typeCls[r.type])}><TypeIcon size={14} /></span>
        <KeywordChips text={title} className="flex-1" />
        {evidence && <span className="shrink-0 rounded bg-warning px-2 py-0.5 text-[11px] font-medium text-on-bright">Evidence changed</span>}
        <span className="num shrink-0 text-[11px] text-muted-foreground">{r.confidence}</span>
        <ChevronDown size={16} className={cn("shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="mt-4 space-y-3 border-t pt-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <ScoreChip label="Confidence" v={r.confidence} title="Same scoring as findings: source reliability × corroboration" />
        <span className="rounded border px-2 py-0.5 text-muted-foreground">{r.effort}</span>
        <span className="text-muted-foreground">{r.timing}</span>
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-sm text-subtle">{r.why}</p>
      <div className="flex flex-wrap gap-2">
        {findings.map((f) => (
          <button key={f.id} onClick={() => app.openDrawer(f)} className={cn("rounded-full border px-2.5 py-0.5 text-xs hover:border-strong", app.findingStatus(f.id) === "dismissed" && "line-through opacity-60")}>
            Finding: {f.title}
          </button>
        ))}
      </div>
      <div className="rounded-md bg-muted/50 px-3 py-2">
        <p className="text-sm font-medium">{live ? r.impactText : "No impact (linked evidence dismissed)"}</p>
        <p className="num text-[11px] text-muted-foreground">{r.formula}</p>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <button className="inline-flex items-center gap-1.5 rounded-full bg-[#4CAF50] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#43A047]" onClick={() => app.setRecStatus(r.id, "accepted", r.type === "Change assumption" ? r.findings : undefined)}><Check size={12} /> Accept</button>
        <button className="inline-flex items-center gap-1.5 rounded-full border border-warning-line bg-warning-soft px-4 py-1.5 text-xs font-semibold text-warning-ink hover:brightness-95" onClick={() => app.setRecStatus(r.id, "snoozed")}><Clock size={12} /> Snooze</button>
        <button className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-danger-ink hover:bg-danger-soft" onClick={() => app.setRecStatus(r.id, "dismissed")}><X size={12} /> Dismiss</button>
        {primary?.scenario && (
          <button className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-foreground px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-foreground hover:text-background" onClick={() => { app.useFinding(primary); nav({ to: "/topics/$topicId", params: { topicId: primary.topicId }, hash: "builder" }); }}>Open in scenario builder <ArrowUpRight size={12} /></button>
        )}
        {r.draft && <button className="btn" onClick={() => setDraftOpen((o) => !o)}>Draft question for client</button>}
      </div>
      {draftOpen && (
        <div className="space-y-2">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} className="w-full rounded-md border bg-background p-2 text-sm" />
          <button className="btn" onClick={() => { navigator.clipboard?.writeText(draft); app.notify("Question copied"); }}><Copy size={14} /> Copy</button>
        </div>
      )}
      </div>}
    </div>
  );
}

export function Recommendations() {
  const app = useApp();
  const s = useRecSummary();
  const [quietOpen, setQuietOpen] = useState(false);
  const [sumOpen, setSumOpen] = useState(false);
  const accepted = s.recs.filter((r) => app.recStatus[r.id] === "accepted");
  const autoText = accepted.length ? accepted.slice(0, 5).map((r) => r.summary).join(" ") : "";
  const [edited, setEdited] = useState<Record<string, string>>({});
  const text = edited[app.clientId + autoText] ?? autoText;
  if (!s.recs.length) return null;
  const active = s.recs.filter((r) => r.type !== "No action needed");
  const quiet = s.recs.filter((r) => r.type === "No action needed");
  const diff = s.recBase - s.current;

  return (
    <Section title="Recommended next steps">
      <div className="glass p-5">
        <h3 className="text-sm font-semibold">If you accept these recommendations</h3>
        <div className="num mt-3 grid grid-cols-3 gap-4">
          <div><p className="text-xs text-muted-foreground">Current base EBITDA</p><p className="text-xl font-semibold">{fmtM(s.current)}</p></div>
          <div><p className="text-xs text-muted-foreground">Recommended base EBITDA</p><p className="text-xl font-semibold">{fmtM(s.recBase)} <span className={cn("text-xs font-medium", diff < 0 ? "text-danger-ink" : diff > 0 ? "text-success-ink" : "text-muted-foreground")}>{Math.abs(diff) < 1e-9 ? "no change" : `${diff < 0 ? "down" : "up"} ${fmtK(diff)}`}</span></p></div>
          <div><p className="text-xs text-muted-foreground">Recommended range</p><p className="text-xl font-semibold">{fmtM(s.down)} <span className="text-xs font-normal text-muted-foreground">downside to</span> {fmtM(s.up)} <span className="text-xs font-normal text-muted-foreground">upside</span></p></div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Based on {active.length || s.recs.length} recommendation{(active.length || s.recs.length) > 1 ? "s" : ""} from {s.findingCount} finding{s.findingCount > 1 ? "s" : ""}. Nothing is applied until you accept.</p>
        <RangeBar down={s.down} base={s.recBase} current={s.current} up={s.up} />
        <details className="mt-3 border-t pt-2 text-[11px] text-muted-foreground"><summary className="cursor-pointer font-medium text-foreground">How this is calculated</summary><p className="num mt-1">Recommended base = current {fmtM(s.current)} + base-case changes. Upside = recommended base + upside-only items. Downside = current + downside-only items. Dismissed recommendations and dismissed evidence are excluded.</p></details>
      </div>

      <div className="space-y-3">
        {active.map((r) => <RecCard key={r.id} r={r} evidence={s.evidenceChanged(r)} live={s.live(r)} />)}
      </div>

      {quiet.length > 0 && (
        <div className="space-y-2">
          <button className="flex items-center gap-1 text-sm font-medium" onClick={() => setQuietOpen((o) => !o)}>
            {quietOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />} No action needed ({quiet.length})
          </button>
          {quietOpen && quiet.map((r) => <RecCard key={r.id} r={r} evidence={s.evidenceChanged(r)} live={s.live(r)} />)}
        </div>
      )}

      <div className="card p-4">
        <button className="flex w-full items-center justify-between text-sm font-medium" onClick={() => setSumOpen((o) => !o)}>
          <span className="flex items-center gap-1">{sumOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />} Client summary</span>
          <span className="rounded bg-warning-soft px-1.5 py-0.5 text-[11px] text-warning-ink">Draft. Review before sending.</span>
        </button>
        {sumOpen && (
          <div className="mt-3 space-y-2">
            <textarea rows={4} value={text} placeholder="Accept recommendations above to draft talking points for the client."
              onChange={(e) => setEdited((x) => ({ ...x, [app.clientId + autoText]: e.target.value }))} className="w-full rounded-md border bg-background p-2 text-sm" />
            <button className="btn" disabled={!text} onClick={() => { navigator.clipboard?.writeText(text); app.notify("Client summary copied"); }}><Check size={14} /> Copy</button>
          </div>
        )}
      </div>
    </Section>
  );
}