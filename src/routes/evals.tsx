import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { base44 } from "@/api/base44Client";
import { Formula, Section } from "@/components/bits";
import { ScoreChip } from "@/components/ScoreChips";
import { DEFAULT_CASE, runBacktest, STAGE_LABEL, type Progress } from "@/lib/evals";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { EVAL_CASES } from "../../base44/shared/eval/cases.ts";

export const Route = createFileRoute("/evals")({
  head: () => ({
    meta: [
      { title: "Evals — Finley" },
      { name: "description", content: "Backtest: Finley frozen at a past date, scored against what the company reported and did over the following year." },
    ],
  }),
  component: Evals,
});

type Rec = Record<string, any>;
const tip = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--foreground)" };
const H = "text-xs font-bold uppercase tracking-[0.6px]";
const pctOf = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
const signed = (n: number | null | undefined, digits = 1, unit = "") => (n == null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(digits)}${unit}`);
const dayLabel = (iso: string) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "undated");
const MATCH_CLS: Record<string, string> = { exact: "bg-tint text-primary-foreground", partial: "bg-warning-soft text-warning-ink", none: "bg-muted text-subtle" };

function RangeChart({ rows }: { rows: Rec[] }) {
  const vals = rows.flatMap((r) => [r.actual, r.lo, r.hi].filter((v) => v != null) as number[]);
  if (!vals.length) return null;
  const min = Math.floor(Math.min(...vals) * 0.97 * 2) / 2, max = Math.ceil(Math.max(...vals) * 1.03 * 2) / 2;
  const W = 760, HH = 280, pad = { l: 52, r: 16, t: 16, b: 40 };
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * (HH - pad.t - pad.b);
  const step = (W - pad.l - pad.r) / rows.length;
  const ticks = Array.from({ length: 5 }, (_, i) => min + ((max - min) * i) / 4);
  return (
    <svg viewBox={`0 0 ${W} ${HH}`} className="w-full" role="img" aria-label="Predicted range vs actual revenue by quarter">
      {ticks.map((t) => (
        <g key={t}><line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" /><text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={10} fill="var(--muted-foreground)">${t.toFixed(1)}B</text></g>
      ))}
      {rows.map((r, i) => {
        const cx = pad.l + step * i + step / 2;
        return (
          <g key={r.id}>
            {r.lo != null && <rect x={cx - 22} y={y(r.hi)} width={44} height={Math.max(2, y(r.lo) - y(r.hi))} rx={6} fill="var(--chart)" fillOpacity={0.6} stroke="var(--strong)" strokeOpacity={0.3}><title>{`Predicted $${r.lo}B–$${r.hi}B`}</title></rect>}
            {r.mid != null && <line x1={cx - 26} x2={cx + 26} y1={y(r.mid)} y2={y(r.mid)} stroke="var(--strong)" strokeWidth={2.5}><title>{`Midpoint $${r.mid}B`}</title></line>}
            <circle cx={cx} cy={y(r.actual)} r={6} fill="var(--foreground)"><title>{`Actual $${r.actual}B`}</title></circle>
            <g transform={`translate(${cx + 32}, ${y(r.actual) - 9})`}>
              <circle cx={9} cy={9} r={9} fill={r.hit ? "var(--success)" : "var(--danger)"} />
              <text x={9} y={13} textAnchor="middle" fontSize={12} fontWeight={700} fill={r.hit ? "var(--on-bright)" : "#fff"}>{r.hit ? "✓" : "✕"}</text>
            </g>
            <text x={cx} y={HH - 20} textAnchor="middle" fontSize={12} fill="var(--foreground)">{r.q}</text>
            <text x={cx} y={HH - 6} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)">{r.span}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Metric({ label, value, sub, title }: { label: string; value: string; sub: string; title?: string }) {
  return (
    <div className="rounded-xl border bg-card p-4" title={title}>
      <p className="text-[9px] font-bold uppercase text-muted-foreground">{label}</p>
      <p className="num pt-1 text-2xl font-bold">{value}</p>
      <p className="pt-1 text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function Evals() {
  const app = useApp();
  const qc = useQueryClient();
  const nav = useNavigate();
  const c = EVAL_CASES[DEFAULT_CASE];
  const runs = useQuery({
    queryKey: ["evalRuns", DEFAULT_CASE],
    queryFn: async () => ((await base44.entities.EvalRun.filter({ case_key: DEFAULT_CASE }, { sort: "-created_date", limit: 10 }))?.items ?? []) as Rec[],
  });
  const [progress, setProgress] = useState<Progress | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const all = runs.data ?? [];
  const done = all.find((r) => r.stage === "done");
  const latest = all[0];
  const unfinished = latest && !["done", "failed"].includes(latest.stage) ? latest : null;
  const failed = latest?.stage === "failed" ? latest : null;
  const s: Rec | undefined = done?.summary;

  const start = async (o: { evalRunId?: string; retry?: boolean }) => {
    if (!app.requireSignIn("run a backtest")) return;
    setRunning(true); setError(""); setProgress(null);
    try {
      const p = await runBacktest({ ...o, caseKey: DEFAULT_CASE, onProgress: setProgress });
      if (p?.failed) setError(`${STAGE_LABEL[p.stage] ?? p.stage}: ${p.error}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
      await Promise.all([qc.invalidateQueries({ queryKey: ["evalRuns"] }), qc.invalidateQueries({ queryKey: ["clients"] })]);
    }
  };
  const openClient = () => { const ev = done ?? latest; if (ev?.client_id) { app.setClientId(ev.client_id); nav({ to: "/dashboard" }); } };

  const runCard = (
    <div className="card flex items-start justify-between gap-6 p-6">
      <div className="max-w-3xl space-y-2 text-sm">
        <p>
          We freeze {c.company} at <b>{dayLabel(c.cutoff)}</b>: Finley builds its keyword plan as of that day, collects only news dated before it, runs the
          full agent pipeline, then forecasts {c.horizon.label.toLowerCase()} twice, with that news and without it. A judge matches the advice to what {c.company} actually did; every score is computed in code.
        </p>
        {s?.corpus?.fetched != null && (
          <p className="text-xs text-muted-foreground">
            News: {s.corpus.kept} of {s.corpus.fetched} results kept ({s.corpus.unique_kept} unique stories) from {s.corpus.searches} searches × {s.corpus.windows} date windows.
            Left out: {s.corpus.excluded?.after_cutoff ?? 0} dated after the cutoff, {s.corpus.excluded?.undated ?? 0} undated, {s.corpus.excluded?.before_lookback ?? 0} too old.
            {s.corpus.flagged ? ` ${s.corpus.flagged} kept but flagged for naming later years.` : ""}
          </p>
        )}
        {(progress || running) && (
          <p className="flex items-center gap-2 text-xs font-medium">
            {running && <Loader2 size={12} className="animate-spin" />}
            {STAGE_LABEL[progress?.stage ?? "queued"] ?? progress?.stage}
            {progress?.stage === "collect" && progress.total ? ` · ${progress.collected} of ${progress.total} searches` : ""}
            {progress?.busy ? " · another step is still running, waiting…" : ""}
          </p>
        )}
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger-ink">{error}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        {unfinished && !running ? (
          <button className="btn btn-primary" onClick={() => start({ evalRunId: unfinished.id })}>Resume backtest</button>
        ) : failed && !running ? (
          <div className="flex gap-2">
            <button className="btn" onClick={() => start({})}>Start new backtest</button>
            <button className="btn btn-primary" onClick={() => start({ evalRunId: failed.id, retry: true })}>Retry from {failed.failed_stage || "the start"}</button>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={() => start({})} disabled={running}>{running ? <><Loader2 size={12} className="animate-spin" /> Running…</> : done ? "Run again" : "Run backtest"}</button>
        )}
        <p className="max-w-xs text-right text-[10px] text-muted-foreground">Takes about 10 to 15 minutes. You can leave this page; come back and resume.</p>
      </div>
    </div>
  );

  const header = (
    <div className="space-y-1">
      <p className="text-[11px] font-bold uppercase tracking-[1.1px] text-muted-foreground">Backtest · {c.company} · as of {dayLabel(c.cutoff)} → {c.horizon.label}</p>
      <h1 className="text-[32px] font-normal leading-[48px]">Evals</h1>
    </div>
  );

  if (runs.isLoading) return <div className="space-y-10">{header}<p className="text-sm text-muted-foreground">Loading backtests…</p></div>;
  if (!s) return <div className="space-y-10">{header}<Section title="Run the backtest">{runCard}</Section></div>;

  const news = s.news, base = s.no_news, f = s.findings;
  const q: Rec[] = news.quarters.rows;
  const baseQ = new Map<string, Rec>(base.quarters.rows.map((r: Rec) => [r.id, r]));
  const miss = [...q].filter((r) => !r.missing).sort((a, b) => Math.abs(b.err) - Math.abs(a.err))[0];
  const calib = (f.calibration as Rec[]).filter((b) => b.observed != null);
  const tiers = (f.tiers as Rec[]).map((t) => ({ ...t, held: t.held ?? 0 }));
  const decisions = c.actions.filter((a) => a.kind === "decision").length;
  const gapRows: [string, string, string, string][] = [
    ["Quarters inside the range", `${news.quarters.hits} of ${news.quarters.n}`, `${base.quarters.hits} of ${base.quarters.n}`, signed(s.gap.quarter_hits, 0)],
    ["Mean error on the midpoint", `${news.quarters.mae_pct ?? "—"}%`, `${base.quarters.mae_pct ?? "—"}%`, signed(s.gap.quarter_mae_pct, 2, " pts")],
    ["KPI direction right", `${news.kpis.direction_correct} of ${news.kpis.n}`, `${base.kpis.direction_correct} of ${base.kpis.n}`, signed(s.gap.kpi_direction, 0)],
    ["Yes/no questions right", `${news.questions.correct} of ${news.questions.n}`, `${base.questions.correct} of ${base.questions.n}`, signed(s.gap.question_correct, 0)],
    ["Brier score (lower is better)", String(news.questions.brier), String(base.questions.brier), signed(s.gap.question_brier, 3)],
    ["Advice that matched a real decision", `${Math.round((news.recommendations.precision_lenient ?? 0) * 100)}%`, `${Math.round((base.recommendations.precision_lenient ?? 0) * 100)}%`, signed(s.gap.rec_precision == null ? null : s.gap.rec_precision * 100, 0, " pts")],
    ["Company decisions anticipated", `${news.recommendations.anticipated.length} of ${decisions}`, `${base.recommendations.anticipated.length} of ${decisions}`, signed(s.gap.rec_recall == null ? null : s.gap.rec_recall * 100, 0, " pts")],
  ];

  return (
    <div className="space-y-10">
      {header}

      <div className="flex items-start gap-3 rounded-2xl border border-warning-line bg-warning-soft p-4 text-sm text-warning-ink">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <p>
          <b>Read with care.</b> {s.caveats?.[1] ?? ""} {s.unchecked_answers ? `${s.unchecked_answers} answer-key figures are still marked unchecked against ${c.company}'s filings.` : ""}{" "}
          Run finished {new Date(done!.finished_at || done!.updated_date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.{" "}
          <button className="underline" onClick={openClient}>Open the backtest client's dashboard</button> to see what Finley showed on {dayLabel(c.cutoff)}.
        </p>
      </div>

      <Section title={`A. ${c.company} ${c.horizon.label.toLowerCase()} quarterly revenue`}>
        <div className="glass p-6">
          <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-3 w-4 rounded-sm" style={{ background: "var(--chart)" }} /> Predicted 80% range (with news)</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: "var(--strong)" }} /> Midpoint</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-foreground" /> Actual (reported)</span>
          </div>
          <RangeChart rows={q} />
          <Formula>Within range = actual ≥ low and actual ≤ high. Error = (actual − midpoint) ÷ actual. Forecast written as of {dayLabel(c.cutoff)}.</Formula>
        </div>
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 overflow-hidden rounded-2xl border bg-popover">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-[10px] uppercase text-muted-foreground"><tr><th className="px-4 py-2 font-bold">Quarter</th><th className="font-bold">Midpoint</th><th className="font-bold">No-news midpoint</th><th className="font-bold">Actual</th><th className="font-bold">Error</th><th className="font-bold">Within range</th></tr></thead>
              <tbody className="divide-y">
                {q.map((r) => (
                  <tr key={r.id} className={cn(!r.hit && "bg-danger-soft/60")}>
                    <td className="px-4 py-2.5 font-medium">{r.q} <span className="text-xs font-normal text-muted-foreground">{r.span}</span></td>
                    <td className="num">{r.mid == null ? "—" : `$${r.mid.toFixed(2)}B`}</td>
                    <td className="num text-muted-foreground">{baseQ.get(r.id)?.mid == null ? "—" : `$${baseQ.get(r.id)!.mid.toFixed(2)}B`}</td>
                    <td className="num">${r.actual.toFixed(2)}B</td>
                    <td className="num">{signed(r.err, 1, "%")}</td>
                    <td>{r.hit ? <span className="inline-flex items-center gap-1 text-success-ink"><Check size={14} /> Yes</span> : <span className="inline-flex items-center gap-1 font-medium text-danger-ink"><X size={14} /> {r.missing ? "No forecast" : r.actual > r.hi ? "No, above range" : "No, below range"}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {miss && (
            <div className={cn("card border-l-4 p-5", miss.hit ? "border-l-success" : "border-l-danger")}>
              <p className={cn("text-[10px] font-bold uppercase tracking-wide", miss.hit ? "text-success-ink" : "text-danger-ink")}>{miss.hit ? "Largest error" : "Miss"}</p>
              <h3 className="mt-1 text-lg font-semibold">{miss.hit ? `${miss.q} was furthest from the midpoint` : `Missed ${miss.q}`}</h3>
              <p className="mt-2 text-sm">{(done?.forecasts?.news?.quarters as Rec[] | undefined)?.find((x) => x.id === miss.id)?.rationale ?? ""}</p>
              <p className="mt-3 text-xs text-muted-foreground">Actual ${miss.actual.toFixed(2)}B vs range ${miss.lo?.toFixed(2)}B–${miss.hi?.toFixed(2)}B. We show misses openly so you can judge the method.</p>
            </div>
          )}
        </div>
      </Section>

      <Section title="B. Findings Finley flagged on the cutoff date">
        {f.rows.length ? (
          <div className="space-y-3">
            {(f.rows as Rec[]).map((e) => (
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
          <Metric label="Range coverage" value={`${news.quarters.hits} of ${news.quarters.n}`} sub={`Quarters inside the 80% range (${pctOf(news.quarters.hits, news.quarters.n)}%)`} />
          <Metric label="Mean absolute error" value={`${news.quarters.mae_pct ?? "—"}%`} sub="Average |actual − midpoint| ÷ actual" />
          <Metric label="Findings that held up" value={f.directional_pct == null ? "—" : `${f.directional_pct}%`} sub={`${f.held} of ${f.decided} findings the record can judge`} />
          <Metric label="Question Brier score" value={String(news.questions.brier)} sub={`0 is perfect, 0.25 is always guessing 50% · no news: ${base.questions.brier}`} />
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div className="glass p-6">
            <h3 className={cn(H, "mb-4")}>Calibration: confidence vs share that held up</h3>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={calib} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="mid" type="number" domain={[0, 100]} ticks={[20, 55, 85]} tickFormatter={(v) => ({ 20: "0–40", 55: "40–70", 85: "70–100" } as Record<number, string>)[v] ?? v} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <Tooltip contentStyle={tip} formatter={(v, _n, p) => [`${v}% of ${p.payload.n}`, "Held up"]} labelFormatter={() => ""} />
                <Line data={[{ mid: 0, observed: 0 }, { mid: 100, observed: 100 }]} dataKey="observed" stroke="var(--muted-foreground)" strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                <Scatter dataKey="observed" fill="var(--strong)" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
            <Formula>Each dot = share of findings in that confidence bucket that held up. Dashed line = perfect calibration. Buckets with no judged findings are left out.</Formula>
          </div>
          <div className="glass p-6">
            <h3 className={cn(H, "mb-4")}>Source tier accuracy</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={tiers} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="tier" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <Tooltip contentStyle={tip} formatter={(v, _n, p) => [p.payload.n ? `${v}% of ${p.payload.n}` : "No findings", "Held up"]} />
                <Bar dataKey="held" fill="var(--chart)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
            <Formula>Share of findings, by their best source's tier, that held up against what happened.</Formula>
          </div>
        </div>
      </Section>

      <Section title={`D. Advice vs what ${c.company} did`}>
        <div className="overflow-hidden rounded-2xl border bg-popover">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-[10px] uppercase text-muted-foreground"><tr><th className="px-4 py-2 font-bold">Finley's recommendation ({dayLabel(c.cutoff)})</th><th className="font-bold">Match</th><th className="px-4 font-bold">What {c.company} did</th></tr></thead>
            <tbody className="divide-y">
              {(news.recommendations.rows as Rec[]).map((r) => (
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
          <Metric label="Decisions anticipated" value={`${news.recommendations.anticipated.length} of ${decisions}`} sub={`Without the news: ${base.recommendations.anticipated.length} of ${decisions}`} />
          <Metric label="Advice that matched" value={`${Math.round((news.recommendations.precision_lenient ?? 0) * 100)}%`} sub={`Exact matches only: ${Math.round((news.recommendations.precision_strict ?? 0) * 100)}%`} />
          <Metric label="Risk events flagged" value={`${news.recommendations.risk_events_flagged} of ${news.recommendations.risk_events}`} sub="Risks the advice prepared for" />
        </div>
        {news.recommendations.missed.length > 0 && (
          <p className="text-xs text-muted-foreground">Not anticipated: {(news.recommendations.missed as Rec[]).map((m) => `${m.text} (${dayLabel(m.date)})`).join(" · ")}</p>
        )}
      </Section>

      <Section title="E. Yes/no questions about the year">
        <div className="overflow-hidden rounded-2xl border bg-popover">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-[10px] uppercase text-muted-foreground"><tr><th className="px-4 py-2 font-bold">Question</th><th className="font-bold">With news</th><th className="font-bold">No news</th><th className="px-4 font-bold">Answer</th></tr></thead>
            <tbody className="divide-y">
              {(news.questions.rows as Rec[]).map((r) => {
                const b = (base.questions.rows as Rec[]).find((x) => x.id === r.id);
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5">{r.text}</td>
                    <td className={cn("num", r.correct ? "text-success-ink" : "text-danger-ink")}>{Math.round(r.probability * 100)}%</td>
                    <td className={cn("num", b?.correct ? "text-success-ink" : "text-danger-ink")}>{b ? `${Math.round(b.probability * 100)}%` : "—"}</td>
                    <td className="px-4 text-xs"><b>{r.outcome ? "Yes" : "No"}.</b> <span className="text-muted-foreground">{r.resolution}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="F. What the news added">
        <div className="overflow-hidden rounded-2xl border bg-popover">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-[10px] uppercase text-muted-foreground"><tr><th className="px-4 py-2 font-bold">Measure</th><th className="font-bold">With news</th><th className="font-bold">Without news</th><th className="px-4 font-bold">Difference (positive is better)</th></tr></thead>
            <tbody className="divide-y">
              {gapRows.map(([l, a, b, d]) => <tr key={l}><td className="px-4 py-2.5">{l}</td><td className="num">{a}</td><td className="num text-muted-foreground">{b}</td><td className="num px-4 font-bold">{d}</td></tr>)}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">Both forecasts use the same model and instructions; only the evidence differs. The model may remember {c.horizon.label}, which lifts both; the difference is what Finley's scan contributed.</p>
      </Section>

      <Section title="G. Method">{runCard}</Section>
    </div>
  );
}
