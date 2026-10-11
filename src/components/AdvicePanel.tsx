import { ArrowDownRight, Clock, Eye, Search, ShieldAlert, TrendingUp } from "lucide-react";
import type { ComponentType } from "react";
import { fmtM } from "@/lib/data";
import { cn } from "@/lib/utils";
import { KeywordChips } from "./KeywordChips";

// The company lead's decision advice, stored on the scan's Briefing (runPipeline/findings.ts buildAdvice).
// Shown as minimal summaries: kind, horizon, the action, and a confidence bar.

type Icon = ComponentType<{ size?: number }>;
const KINDS: Record<string, { label: string; cls: string; Icon: Icon }> = {
  opportunity: { label: "Opportunity", cls: "bg-tint text-primary-foreground", Icon: TrendingUp },
  risk_response: { label: "Risk response", cls: "bg-warning-soft text-warning-ink", Icon: ShieldAlert },
  exit_or_reduce: { label: "Exit / reduce", cls: "bg-danger-soft text-danger-ink", Icon: ArrowDownRight },
  investigate: { label: "Investigate", cls: "bg-secondary text-foreground", Icon: Search },
  monitor: { label: "Monitor", cls: "bg-muted text-subtle", Icon: Eye },
};
const HORIZONS: Record<string, string> = { now: "Now", this_quarter: "This quarter", next_12_months: "12 months" };

type Advice = {
  action: string; kind: string; confidence?: number; horizon?: string;
  economics?: { ebitda_delta: number } | null;
};

export function AdvicePanel({ briefing }: { briefing: Record<string, any> | null }) {
  if (!briefing) return null;
  const advice: Advice[] = briefing["company"]?.advice ?? [];
  const asOf = briefing["as_of"] ? new Date(briefing["as_of"]).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  if (!advice.length) return null;

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-lg font-medium">Decision advice</h3>
        {asOf && <span className="text-[10px] text-muted-foreground">from the {asOf} briefing</span>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {advice.map((a, i) => {
          const k = KINDS[a.kind] ?? KINDS["monitor"]!;
          return (
            <div key={i} className="flex flex-col gap-3 rounded-2xl border border-muted bg-popover p-4 transition-colors hover:border-border">
              <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className={cn("inline-flex items-center gap-1 rounded px-2 py-1 font-bold", k.cls)}><k.Icon size={12} />{k.label}</span>
                {a.horizon && <span className="inline-flex items-center gap-1 text-muted-foreground"><Clock size={10} />{HORIZONS[a.horizon] ?? a.horizon}</span>}
              </div>
              <KeywordChips text={a.action} />
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>Confidence</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${(a.confidence ?? 3) * 20}%` }} />
                </div>
                {a.economics && <span className="num font-semibold text-foreground">EBITDA {fmtM(a.economics.ebitda_delta, true)}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}