import { Check, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { Formula, Section } from "@/components/bits";
import { ScoreChip } from "@/components/ScoreChips";
import { cn } from "@/lib/utils";
import { RangeChart, RangeLegend } from "./RangeChart";
import { dayLabel, moneyB, signed, type BacktestView, type Metric as MetricT } from "./view";

type Rec = Record<string, any>;
const tip = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--foreground)" };
const H = "text-xs font-bold uppercase tracking-[0.6px]";
const MATCH_CLS: Record<string, string> = { exact: "bg-tint text-primary-foreground", partial: "bg-warning-soft text-warning-ink", none: "bg-muted text-subtle" };

function Metric({ m }: { m: MetricT }) {
  return (
    <div className="rounded-xl border bg-card p-4" data-metric={m.label}>
      <p className="text-[9px] font-bold uppercase text-muted-foreground">{m.label}</p>
      <p className="num pt-1 text-2xl font-bold">{m.value}</p>
      <p className="pt-1 text-[10px] text-muted-foreground">{m.sub}</p>
    </div>
  );
}

// Sections A to F of the Evals page. Everything comes from the view, so a published snapshot and a
// live run with the same results render the same page.
export function Results({ v }: { v: BacktestView }) {
  const q = v.quarters, miss = q.miss;
  return (
    <>
      <Section title={`A. ${v.company} quarterly revenue, ${v.horizonLabel}`}>
        <div className="glass p-6">
          <RangeLegend />
          <RangeChart rows={q.rows} currency={v.currency} />
          <Formula>Within range = actual ≥ low and actual ≤ high. Error = (actual − midpoint) ÷ actual. Forecast written as of {dayLabel(v.cutoff)}.</Formula>
        </div>
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 overflow-hidden rounded-2xl border bg-popover">
            <table className="w-full text-sm" data-table="quarters">
              <thead className="bg-muted/60 text-left text-[10px] uppercase text-muted-foreground"><tr><th className="px-4 py-2 font-bold">Quarter</th><th className="font-bold">Midpoint</th><th className="font-bold">No-news midpoint</th><th className="font-bold">Actual</th><th className="font-bold">Error</th><th className="font-bold">Within range</th></tr></thead>
              <tbody className="divide-y">
                {q.rows.map((r) => (
                  <tr key={r.id} className={cn(!r.hit && "bg-danger-soft/60")}>
                    <td className="px-4 py-2.5 font-medium">{r.q} <span className="text-xs font-normal text-muted-foreground">{r.span}</span></td>
                    <td className="num">{moneyB(r.mid, v.currency)}</td>
                    <td className="num text-muted-foreground">{moneyB(r.baseMid, v.currency)}</td>
                    <td className="num">{moneyB(r.actual, v.currency)}</td>
                    <td className="num">{signed(r.err, 1, "%")}</td>
                    <td>{r.hit ? <span className="inline-flex items-center gap-1 text-success-ink"><Check size={14} /> {r.verdict}</span> : <span className="inline-flex items-center gap-1 font-medium text-danger-ink"><X size={14} /> {r.verdict}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {miss && (
            <div className={cn("card border-l-4 p-5", miss.hit ? "border-l-success" : "border-l-danger")}>
              <p className={cn("text-[10px] font-bold uppercase tracking-wide", miss.hit ? "text-success-ink" : "text-danger-ink")}>{miss.hit ? "Largest error" : "Miss"}</p>
              <h3 className="mt-1 text-lg font-semibold">{miss.hit ? `${miss.q} was furthest from the midpoint` : `Missed ${miss.q}`}</h3>
              <p className="mt-2 text-sm">{miss.rationale}</p>
              <p className="mt-3 text-xs text-muted-foreground">Actual {moneyB(miss.actual, v.currency)} vs range {moneyB(miss.lo, v.currency)}–{moneyB(miss.hi, v.currency)}. We show misses openly so you can judge the method.</p>
            </div>
          )}
        </div>
      </Section>

      <Section title="B. Findings Finley flagged on the cutoff date">
        {v.findings.rows.length ? (
          <div className="space-y-3">
            {(v.findings.rows as Rec[]).map((e) => (
              <div key={e.id} className="grid grid-cols-[120px_1fr_auto] gap-4 rounded-2xl border bg-popover p-4">
                <p className="num text-sm font-medium">{dayLabel(e.date)}</p>
                <div>
                  <p className="text-sm font-medium">{e.title}</p>
                  <p className="text-[10px] font-medium text-muted-foreground">Assumption: {e.assumption || "—"} · Tier {e.tier} source ({e.source || "unknown"}) · {e.direction} the assumption</p>
                  <p className="mt-1 text-sm"><span className="text-muted-foreground">What happened: </span>{e.happened || "The record doesn't say."}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase", e.held === "held" ? "bg-tint text-primary-foreground" : e.held === "did_not_hold" ? "bg-danger-soft text-danger-ink" : "bg-muted text-subtle")}>{e.held === "held" ? "Held up" : e.held === "did_not_hold" ? "Did not hold" : "Unclear"}</span>
                  <ScoreChip label="Mat" v={e.materiality * 20} title={`Materiality ${e.materiality} of 5`} />
                  <ScoreChip label="Conf" v={e.conf_pct} title={`Confidence ${e.confidence} of 5`} />
                </div>
              </div>
            ))}
          </div>
        ) : <div className="card p-5 text-sm text-muted-foreground">The backtest scan saved no findings.</div>}
      </Section>

      <Section title="C. Eval metrics">
        <div className="grid grid-cols-4 gap-4">
          <Metric m={v.metrics.coverage} />
          <Metric m={v.metrics.mae} />
          <Metric m={v.metrics.held} />
          <Metric m={v.metrics.brier} />
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div className="glass p-6">
            <h3 className={cn(H, "mb-4")}>Calibration: confidence vs share that held up</h3>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={v.findings.calibration} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mid" type="number" domain={[0, 100]} ticks={[20, 55, 85]} tickFormatter={(x) => ({ 20: "0–40", 55: "40–70", 85: "70–100" } as Record<number, string>)[x] ?? x} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <Tooltip contentStyle={tip} formatter={(val, _n, p) => [`${val}% of ${p.payload.n}`, "Held up"]} labelFormatter={() => ""} />
                <Line data={[{ mid: 0, observed: 0 }, { mid: 100, observed: 100 }]} dataKey="observed" stroke="var(--muted-foreground)" strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                <Scatter dataKey="observed" fill="var(--strong)" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
            <Formula>Each dot = share of findings in that confidence bucket that held up. Dashed line = perfect calibration. Buckets with no judged findings are left out.</Formula>
          </div>
          <div className="glass p-6">
            <h3 className={cn(H, "mb-4")}>Source tier accuracy</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={v.findings.tiers} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="tier" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <Tooltip contentStyle={tip} formatter={(val, _n, p) => [p.payload.n ? `${val}% of ${p.payload.n}` : "No findings", "Held up"]} />
                <Bar dataKey="held" fill="var(--chart)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
            <Formula>Share of findings, by their best source's tier, that held up against what happened.</Formula>
          </div>
        </div>
      </Section>

      <Section title={`D. Advice vs what ${v.company} did`}>
        <div className="overflow-hidden rounded-2xl border bg-popover">
          <table className="w-full text-sm" data-table="advice">
            <thead className="bg-muted/60 text-left text-[10px] uppercase text-muted-foreground"><tr><th className="px-4 py-2 font-bold">Finley's recommendation ({dayLabel(v.cutoff)})</th><th className="font-bold">Match</th><th className="px-4 font-bold">What {v.company} did</th></tr></thead>
            <tbody className="divide-y">
              {(v.recs.rows as Rec[]).map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-4 py-3"><span className="text-[10px] font-bold uppercase text-muted-foreground">{r.type} · by {r.expected_by}</span><p className="font-medium">{r.action}</p><p className="text-xs text-muted-foreground">{r.rationale}</p></td>
                  <td className="py-3"><span className={cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase", MATCH_CLS[r.match])}>{r.match}</span></td>
                  <td className="px-4 py-3 text-sm">{r.company_action ? <>{r.action_date && <span className="num text-xs text-muted-foreground">{dayLabel(r.action_date)} · </span>}{r.company_action}</> : "Nothing on record"}<p className="text-xs text-muted-foreground">{r.judge_rationale}</p></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Metric m={v.metrics.anticipated} />
          <Metric m={v.metrics.matched} />
          <Metric m={v.metrics.risks} />
        </div>
        {v.recs.missed && <p className="text-xs text-muted-foreground">Not anticipated: {v.recs.missed}</p>}
      </Section>

      <Section title="E. Yes/no questions about the year">
        <div className="overflow-hidden rounded-2xl border bg-popover">
          <table className="w-full text-sm" data-table="questions">
            <thead className="bg-muted/60 text-left text-[10px] uppercase text-muted-foreground"><tr><th className="px-4 py-2 font-bold">Question</th><th className="font-bold">With news</th><th className="font-bold">No news</th><th className="px-4 font-bold">Answer</th></tr></thead>
            <tbody className="divide-y">
              {v.questions.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5">{r.text}</td>
                  <td className={cn("num", r.newsCorrect ? "text-success-ink" : "text-danger-ink")}>{r.news}%</td>
                  <td className={cn("num", r.baseCorrect ? "text-success-ink" : "text-danger-ink")}>{r.base == null ? "—" : `${r.base}%`}</td>
                  <td className="px-4 text-xs"><b>{r.outcome ? "Yes" : "No"}.</b> <span className="text-muted-foreground">{r.resolution}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="F. What the news added">
        <div className="overflow-hidden rounded-2xl border bg-popover">
          <table className="w-full text-sm" data-table="gap">
            <thead className="bg-muted/60 text-left text-[10px] uppercase text-muted-foreground"><tr><th className="px-4 py-2 font-bold">Measure</th><th className="font-bold">With news</th><th className="font-bold">Without news</th><th className="px-4 font-bold">Difference (positive is better)</th></tr></thead>
            <tbody className="divide-y">
              {v.gapRows.map(([l, a, b, d]) => <tr key={l}><td className="px-4 py-2.5">{l}</td><td className="num">{a}</td><td className="num text-muted-foreground">{b}</td><td className="num px-4 font-bold">{d}</td></tr>)}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">Both forecasts use the same model and instructions; only the evidence differs. The model may remember {v.horizonLabel}, which lifts both; the difference is what Finley's scan contributed.</p>
      </Section>
    </>
  );
}
