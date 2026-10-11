import { ArrowDownRight, Eye, Search, ShieldAlert, TrendingUp, type LucideIcon } from "lucide-react";
import { fmtM } from "@/lib/data";
import { cn } from "@/lib/utils";

// The company lead's decision advice, stored on the scan's Briefing (runPipeline/findings.ts buildAdvice).
// Every item is an option to weigh, never a directive; money figures come from the computed impact
// candidate, so they carry the same "illustrative scenario" label as the rest of the app.

const KINDS: Record<string, { label: string; cls: string; Icon: LucideIcon }> = {
  opportunity: { label: "Opportunity", cls: "bg-tint text-primary-foreground", Icon: TrendingUp },
  risk_response: { label: "Risk response", cls: "bg-warning-soft text-warning-ink", Icon: ShieldAlert },
  exit_or_reduce: { label: "Exit / reduce", cls: "bg-danger-soft text-danger-ink", Icon: ArrowDownRight },
  investigate: { label: "Investigate", cls: "bg-secondary text-foreground", Icon: Search },
  monitor: { label: "Monitor", cls: "bg-muted text-subtle", Icon: Eye },
};
const HORIZONS: Record<string, string> = { now: "inaction costs now", this_quarter: "this quarter", next_12_months: "within 12 months" };
const CONFIDENCE: Record<number, string> = { 5: "high confidence", 4: "high confidence", 3: "medium confidence", 2: "low confidence", 1: "low confidence" };

type Advice = {
  action: string; kind: string; rationale?: string; check_first?: string; confidence?: number; horizon?: string;
  sources?: { title?: string; url?: string }[];
  economics?: { ebitda_delta: number; ebitda_low: number; ebitda_high: number; ev_delta: number; ev_pct: number } | null;
};

export function AdvicePanel({ briefing }: { briefing: Record<string, any> | null }) {
  if (!briefing) return null;
  const advice: Advice[] = briefing["company"]?.advice ?? [];
  const summary: string = briefing["company"]?.outlook?.summary ?? "";
  const asOf = briefing["as_of"] ? new Date(briefing["as_of"]).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  if (!advice.length && !summary) return null;

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-lg font-medium">Decision advice</h3>
        {asOf && <span className="text-[10px] text-muted-foreground">from the {asOf} briefing</span>}
      </div>
      {summary && <p className="max-w-3xl text-sm leading-relaxed text-subtle">{summary}</p>}
      {!advice.length ? (
        <p className="text-sm text-muted-foreground">No decision advice in this scan's briefing.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {advice.map((a, i) => {
            const k = KINDS[a.kind] ?? KINDS["monitor"]!;
            return (
              <div key={i} className="flex flex-col gap-2 rounded-2xl border border-muted bg-popover p-4">
                <div className="flex flex-wrap items-center gap-2 text-[10px]">
                  <span className={cn("inline-flex items-center gap-1 rounded px-2 py-1 font-bold", k.cls)}><k.Icon size={12} />{k.label}</span>
                  {a.horizon && <span className="text-muted-foreground">{HORIZONS[a.horizon] ?? a.horizon}</span>}
                  <span className="text-muted-foreground">· {CONFIDENCE[a.confidence ?? 3] ?? "medium confidence"}</span>
                </div>
                <p className="text-sm font-semibold">{a.action}</p>
                {a.rationale && <p className="text-xs leading-snug text-subtle">{a.rationale}</p>}
                {a.economics && (
                  <p className="num rounded-lg bg-muted px-2.5 py-1.5 text-[11px]">
                    Illustrative scenario, not a forecast: EBITDA {fmtM(a.economics.ebitda_delta, true)} a year while it lasts
                    (range {fmtM(a.economics.ebitda_low, true)} to {fmtM(a.economics.ebitda_high, true)}), EV {fmtM(a.economics.ev_delta, true)} ({a.economics.ev_pct}%).
                  </p>
                )}
                {a.check_first && <p className="text-[11px] italic text-muted-foreground">Check first: {a.check_first}</p>}
                {!!a.sources?.length && (
                  <p className="text-[10px] text-muted-foreground">{a.sources.length} source{a.sources.length === 1 ? "" : "s"}: {a.sources.slice(0, 3).map((s) => s.title).join(" · ")}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
