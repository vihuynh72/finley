// What the Evals page (sections A to F) and the landing page show about one finished backtest, built
// from either a published snapshot (src/evals/published/<case_key>.json) or a live EvalRun that reached
// "done". Both carry the same `summary` and `forecasts` (runPipeline/eval/stages.ts writes them; the
// snapshot copies them), so the same data always gives the same numbers, whichever way it arrived.
// Pure: no React and no Base44 calls, so the Deno tests import it (tests/frontend/published.test.ts).

import { caseCurrency, CURRENCY_SYMBOL, type Currency, EVAL_CASES } from "../../../base44/shared/eval/cases.ts";
import type { PublishedBacktest, PublishedSource } from "../../../base44/shared/eval/published.ts";

type Rec = Record<string, any>;

export const pctOf = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
export const signed = (n: number | null | undefined, digits = 1, unit = "") =>
  (n == null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(digits)}${unit}`);
// Billions of the case's reporting currency, e.g. "$8.16B" or "€4.27B".
export const moneyB = (n: number | null | undefined, currency: Currency = "USD") => (n == null ? "—" : `${CURRENCY_SYMBOL[currency] ?? "$"}${n.toFixed(2)}B`);
// "Dec 31, 2022" for a day; "undated" for nothing.
export const dayLabel = (iso: string | null | undefined) =>
  (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "undated");
// A run's finish time as a day (UTC), e.g. "Oct 12, 2026".
export const runDay = (iso: string | null | undefined) => {
  const t = Date.parse(iso || "");
  return Number.isFinite(t) ? new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "date unknown";
};

export interface Metric { label: string; value: string; sub: string }
export interface QuarterRow {
  id: string; q: string; span: string; actual: number; lo: number | null; mid: number | null; hi: number | null;
  hit: boolean; missing: boolean; err: number | null; baseMid: number | null; rationale: string;
  verdict: string; // "Yes", "No, above range", "No, below range" or "No forecast"
}
export interface QuestionRow { id: string; text: string; news: number; newsCorrect: boolean; base: number | null; baseCorrect: boolean; outcome: boolean; resolution: string }

// Where a published snapshot came from, for the provenance line.
export interface Provenance {
  origin: string; publishedAt: string; finishedAt: string; model: string; judgeModel: string; pipelineModels: string[];
  calls: number; newsKept: number; errors: string[];
}

// What Finley saw on the cutoff date, from the snapshot alone.
export interface Saw {
  briefing: { headline: string; summary: string; outlook: Rec | null; advice: Rec[] } | null;
  findings: Rec[];
  exposures: Rec[]; keywordCount: number;
  sources: PublishedSource[]; outlets: number; firstDate: string; lastDate: string; flagged: number;
}

export interface BacktestView {
  kind: "published" | "live";
  caseKey: string; company: string; cutoff: string; horizonLabel: string;
  currency: Currency; // of the quarterly revenue figures
  finishedAt: string; // ISO
  caveat: string; unchecked: number;
  corpus: Rec; // EvalRun.corpus_stats as the summary kept it
  quarters: { rows: QuarterRow[]; hits: number; n: number; maePct: number | null; miss: QuarterRow | null };
  findings: { rows: Rec[]; calibration: Rec[]; tiers: Rec[] };
  metrics: { coverage: Metric; mae: Metric; held: Metric; brier: Metric; anticipated: Metric; matched: Metric; risks: Metric };
  decisions: number; // the company's decisions in the answer key
  recs: { rows: Rec[]; missed: string };
  questions: QuestionRow[];
  gapRows: [string, string, string, string][]; // measure, with news, without news, difference
  provenance: Provenance | null; // published only
  saw: Saw | null; // published only
}

const verdictOf = (r: Rec) => (r.hit ? "Yes" : r.missing ? "No forecast" : r.actual > r.hi ? "No, above range" : "No, below range");
const pctStr = (n: number | null | undefined) => (n == null ? "—" : `${n}%`);

// Sections A to F from a finished run's summary and forecasts.
function results(caseKey: string, s: Rec, forecasts: Rec, finishedAt: string) {
  const news: Rec = s.news ?? {}, base: Rec = s.no_news ?? {}, f: Rec = s.findings ?? {}, g: Rec = s.gap ?? {};
  const nq: Rec = news.quarters ?? { rows: [], hits: 0, n: 0, mae_pct: null };
  const bq: Rec = base.quarters ?? { rows: [], hits: 0, n: 0, mae_pct: null };
  const baseMid = new Map<string, number | null>((bq.rows ?? []).map((r: Rec) => [r.id, r.mid ?? null]));
  const rationale = new Map<string, string>(((forecasts?.news?.quarters ?? []) as Rec[]).map((x) => [x.id, x.rationale ?? ""]));
  const rows: QuarterRow[] = (nq.rows ?? []).map((r: Rec) => ({
    id: r.id, q: r.q, span: r.span, actual: r.actual, lo: r.lo ?? null, mid: r.mid ?? null, hi: r.hi ?? null, hit: !!r.hit, missing: !!r.missing,
    err: r.err ?? null, baseMid: baseMid.get(r.id) ?? null, rationale: rationale.get(r.id) ?? "", verdict: verdictOf(r),
  }));
  const miss = [...rows].filter((r) => !r.missing).sort((a, b) => Math.abs(b.err ?? 0) - Math.abs(a.err ?? 0))[0] ?? null;

  const nr: Rec = news.recommendations ?? { rows: [], anticipated: [], missed: [] };
  const br: Rec = base.recommendations ?? { rows: [], anticipated: [], missed: [] };
  // Every decision in the answer key is either anticipated or missed, so the summary alone gives the count.
  const decisions = (nr.anticipated?.length ?? 0) + (nr.missed?.length ?? 0);
  const nk: Rec = news.kpis ?? { direction_correct: 0, n: 0 }, bk: Rec = base.kpis ?? { direction_correct: 0, n: 0 };
  const nQ: Rec = news.questions ?? { rows: [], correct: 0, n: 0, brier: null }, bQ: Rec = base.questions ?? { rows: [], correct: 0, n: 0, brier: null };
  const baseQ = new Map<string, Rec>((bQ.rows ?? []).map((r: Rec) => [r.id, r]));
  const pct = (p: number | null | undefined) => `${Math.round((p ?? 0) * 100)}%`;

  return {
    caseKey, company: s.company ?? "", cutoff: s.cutoff ?? "", horizonLabel: s.horizon?.label ?? "", finishedAt,
    // Runs scored before the summary recorded a currency: the case definition says which it is.
    currency: (s.currency ?? (EVAL_CASES[caseKey] ? caseCurrency(EVAL_CASES[caseKey]) : "USD")) as Currency,
    caveat: s.caveats?.[1] ?? "", unchecked: Number(s.unchecked_answers) || 0, corpus: s.corpus ?? {},
    quarters: { rows, hits: nq.hits ?? 0, n: nq.n ?? rows.length, maePct: nq.mae_pct ?? null, miss },
    findings: {
      rows: f.rows ?? [],
      calibration: (f.calibration ?? []).filter((b: Rec) => b.observed != null),
      tiers: (f.tiers ?? []).map((t: Rec) => ({ ...t, held: t.held ?? 0 })),
    },
    metrics: {
      coverage: { label: "Range coverage", value: `${nq.hits} of ${nq.n}`, sub: `Quarters inside the 80% range (${pctOf(nq.hits, nq.n)}%)` },
      mae: { label: "Mean absolute error", value: pctStr(nq.mae_pct), sub: "Average |actual − midpoint| ÷ actual" },
      held: { label: "Findings that held up", value: pctStr(f.directional_pct), sub: `${f.held ?? 0} of ${f.decided ?? 0} findings the record can judge` },
      brier: { label: "Question Brier score", value: String(nQ.brier ?? "—"), sub: `0 is perfect, 0.25 is always guessing 50% · no news: ${bQ.brier ?? "—"}` },
      anticipated: { label: "Decisions anticipated", value: `${nr.anticipated?.length ?? 0} of ${decisions}`, sub: `Without the news: ${br.anticipated?.length ?? 0} of ${decisions}` },
      matched: { label: "Advice that matched", value: pct(nr.precision_lenient), sub: `Exact matches only: ${pct(nr.precision_strict)}` },
      risks: { label: "Risk events flagged", value: `${nr.risk_events_flagged ?? 0} of ${nr.risk_events ?? 0}`, sub: "Risks the advice prepared for" },
    },
    decisions,
    recs: { rows: nr.rows ?? [], missed: ((nr.missed ?? []) as Rec[]).map((m) => `${m.text} (${dayLabel(m.date)})`).join(" · ") },
    questions: ((nQ.rows ?? []) as Rec[]).map((r): QuestionRow => {
      const b = baseQ.get(r.id);
      return { id: r.id, text: r.text, news: Math.round(r.probability * 100), newsCorrect: !!r.correct, base: b ? Math.round(b.probability * 100) : null,
        baseCorrect: !!b?.correct, outcome: !!r.outcome, resolution: r.resolution ?? "" };
    }),
    gapRows: [
      ["Quarters inside the range", `${nq.hits} of ${nq.n}`, `${bq.hits} of ${bq.n}`, signed(g.quarter_hits, 0)],
      ["Mean error on the midpoint", pctStr(nq.mae_pct), pctStr(bq.mae_pct), signed(g.quarter_mae_pct, 2, " pts")],
      ["KPI direction right", `${nk.direction_correct} of ${nk.n}`, `${bk.direction_correct} of ${bk.n}`, signed(g.kpi_direction, 0)],
      ["Yes/no questions right", `${nQ.correct} of ${nQ.n}`, `${bQ.correct} of ${bQ.n}`, signed(g.question_correct, 0)],
      ["Brier score (lower is better)", String(nQ.brier ?? "—"), String(bQ.brier ?? "—"), signed(g.question_brier, 3)],
      ["Advice that matched a real decision", pct(nr.precision_lenient), pct(br.precision_lenient), signed(g.rec_precision == null ? null : g.rec_precision * 100, 0, " pts")],
      ["Company decisions anticipated", `${nr.anticipated?.length ?? 0} of ${decisions}`, `${br.anticipated?.length ?? 0} of ${decisions}`, signed(g.rec_recall == null ? null : g.rec_recall * 100, 0, " pts")],
    ] as [string, string, string, string][],
  };
}

export function viewFromEvalRun(ev: Rec): BacktestView {
  if (ev?.stage !== "done" || !ev.summary) throw new Error(`EvalRun ${ev?.id} is not finished`);
  return { kind: "live", ...results(ev.case_key, ev.summary, ev.forecasts ?? {}, ev.finished_at || ev.updated_date || ""), provenance: null, saw: null };
}

export function viewFromPublished(p: PublishedBacktest): BacktestView {
  const sources = p.sources ?? [];
  const dates = sources.map((x) => x.date).filter(Boolean).sort();
  return {
    kind: "published",
    ...results(p.case_key, p.summary, p.forecasts ?? {}, p.run?.finished_at ?? ""),
    provenance: {
      origin: p.origin, publishedAt: p.published_at, finishedAt: p.run?.finished_at ?? "", model: p.run?.model ?? "", judgeModel: p.run?.judge_model ?? "",
      pipelineModels: p.run?.pipeline_models ?? [], calls: p.run?.usage?.calls ?? 0, newsKept: sources.length, errors: p.run?.errors ?? [],
    },
    saw: {
      briefing: p.briefing ?? null,
      findings: p.findings ?? [],
      exposures: p.keyword_plan?.exposures ?? [], keywordCount: p.keyword_plan?.keyword_count ?? 0,
      sources, outlets: new Set(sources.map((x) => x.outlet).filter(Boolean)).size, firstDate: dates[0] ?? "", lastDate: dates[dates.length - 1] ?? "",
      flagged: sources.filter((x) => x.flag).length,
    },
  };
}

// The parts of a view that come from the run's results (sections A to F), without where it came from.
export const resultsOf = (v: BacktestView) => {
  const { kind: _k, provenance: _p, saw: _s, ...rest } = v;
  return rest;
};
