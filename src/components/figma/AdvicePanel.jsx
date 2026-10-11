import { TrendingUp, ShieldAlert, ArrowDownRight, Search, Eye } from "lucide-react";

// The company lead's decision advice, stored on the run's Briefing record. Every item is an option
// to weigh, never a directive; money figures come from the computed impact candidates, so the panel
// labels them "Illustrative scenario" like the rest of the app.

const KINDS = {
  opportunity: { label: "Opportunity", cls: "bg-emerald-50 text-emerald-700", Icon: TrendingUp },
  risk_response: { label: "Risk response", cls: "bg-amber-50 text-amber-700", Icon: ShieldAlert },
  exit_or_reduce: { label: "Exit / reduce", cls: "bg-red-50 text-red-700", Icon: ArrowDownRight },
  investigate: { label: "Investigate", cls: "bg-blue-50 text-blue-700", Icon: Search },
  monitor: { label: "Monitor", cls: "bg-slate-100 text-slate-600", Icon: Eye },
};

const HORIZONS = { now: "inaction costs now", this_quarter: "this quarter", next_12_months: "within 12 months" };
const CONFIDENCE = { 5: "high confidence", 4: "high confidence", 3: "medium confidence", 2: "low confidence", 1: "low confidence" };

const money = (n) => `${n < 0 ? "-" : "+"}$${Math.abs(n)}m`;

export default function AdvicePanel({ briefing }) {
  if (!briefing) return null;
  const advice = briefing.company?.advice || [];
  const summary = briefing.company?.outlook?.summary;
  const asOf = briefing.as_of ? new Date(briefing.as_of).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";

  return (
    <section className="mb-8">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-base font-bold text-slate-800">Decision advice</h2>
        {asOf && <span className="text-[10px] text-slate-400">from the {asOf} briefing</span>}
      </div>
      {summary && <p className="text-sm text-slate-600 leading-relaxed mb-4 max-w-3xl">{summary}</p>}
      {!advice.length ? (
        <p className="text-sm text-slate-400">No decision advice in this scan's briefing.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {advice.map((a, i) => {
            const k = KINDS[a.kind] || KINDS.monitor;
            return (
              <div key={i} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded inline-flex items-center gap-1 ${k.cls}`}>
                    <k.Icon className="w-3 h-3" />{k.label}
                  </span>
                  <span className="text-[10px] text-slate-400">{HORIZONS[a.horizon] || a.horizon}</span>
                  <span className="text-[10px] text-slate-400">· {CONFIDENCE[a.confidence] || "medium confidence"}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-800">{a.action}</h3>
                {a.rationale && <p className="text-[11px] text-slate-600 leading-snug">{a.rationale}</p>}
                {a.economics && (
                  <p className="text-[11px] text-slate-700 bg-slate-50 border border-slate-100 rounded px-2 py-1.5">
                    Illustrative scenario, not a forecast: EBITDA {money(a.economics.ebitda_delta)}/yr while it lasts
                    (range {money(a.economics.ebitda_low)} to {money(a.economics.ebitda_high)}), EV {money(a.economics.ev_delta)} ({a.economics.ev_pct}%).
                  </p>
                )}
                {a.check_first && <p className="text-[11px] text-slate-500 italic">Check first: {a.check_first}</p>}
                {(a.sources || []).length > 0 && (
                  <p className="text-[10px] text-slate-400">
                    {a.sources.length} source(s): {a.sources.slice(0, 3).map((s) => s.title).join(" · ")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
