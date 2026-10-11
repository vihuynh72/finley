import type { EvalCase } from "./cases.ts";

// Deterministic backtest scoring. Agents produce forecasts and a judge labels matches; every number
// on the scorecard is computed here, so the same stored answers always give the same scores.

export type Direction = "up" | "flat" | "down";
export interface Forecast {
  quarters: { id: string; low: number; mid: number; high: number; rationale?: string }[]; // USD B
  kpis: { id: string; direction: Direction; point: number; low: number; high: number; rationale?: string }[];
  questions: { id: string; probability: number; rationale?: string }[];
  recommendations: { id: string; type: "expand" | "defend" | "cut" | "risk"; action: string; rationale: string; expected_by: string; evidence: string[] }[];
  outlook: string;
}
export interface RecMatch { rec_id: string; action_id: string; label: "exact" | "partial" | "none"; rationale: string }
export interface FindingVerdict { finding_id: string; held: "held" | "did_not_hold" | "unclear"; happened: string }
export interface ScoredFinding { id: string; title: string; date: string; assumption: string; confidence: number; materiality: number; tier: number; source: string; direction: "Challenges" | "Supports" }

const round = (n: number, p = 1) => Math.round(n * 10 ** p) / 10 ** p;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const clampP = (p: unknown) => Math.min(0.99, Math.max(0.01, Number.isFinite(Number(p)) ? Number(p) : 0.5));

export function actualDirection(actual: number, base: number, band: number): Direction {
  return actual > base + band ? "up" : actual < base - band ? "down" : "flat";
}

// Confidence 1-5 on the frontend's 0-100 scale, for the calibration buckets it draws.
export const CONFIDENCE_PCT: Record<number, number> = { 1: 20, 2: 40, 3: 60, 4: 80, 5: 95 };
export const CALIBRATION_BUCKETS = [
  { bucket: "0–40", mid: 20, lo: 0, hi: 40 }, { bucket: "40–70", mid: 55, lo: 40, hi: 70 }, { bucket: "70–100", mid: 85, lo: 70, hi: 101 },
];

export function scoreQuarters(c: EvalCase, f: Forecast | null) {
  const rows = c.quarters.map((q) => {
    const p = f?.quarters?.find((x) => x.id === q.id);
    if (!p) return { id: q.id, q: q.label, span: q.span, actual: q.actual, lo: null, mid: null, hi: null, hit: false, err: null, missing: true };
    const [lo, hi] = [Math.min(p.low, p.high), Math.max(p.low, p.high)];
    return { id: q.id, q: q.label, span: q.span, actual: q.actual, lo, mid: p.mid, hi, hit: q.actual >= lo && q.actual <= hi, err: round(((q.actual - p.mid) / q.actual) * 100, 2), missing: false };
  });
  const answered = rows.filter((r) => !r.missing);
  return { rows, hits: rows.filter((r) => r.hit).length, n: rows.length, mae_pct: answered.length ? round(mean(answered.map((r) => Math.abs(r.err!))), 2) : null };
}

export function scoreKpis(c: EvalCase, f: Forecast | null) {
  const rows = c.kpis.map((k) => {
    const p = f?.kpis?.find((x) => x.id === k.id);
    const actual_direction = actualDirection(k.actual, k.base, k.flat_band);
    if (!p) return { id: k.id, name: k.name, unit: k.unit, actual: k.actual, actual_direction, predicted: null, correct: false, in_range: false, abs_error: null, missing: true };
    const [lo, hi] = [Math.min(p.low, p.high), Math.max(p.low, p.high)];
    return { id: k.id, name: k.name, unit: k.unit, actual: k.actual, actual_direction, predicted: p, correct: p.direction === actual_direction,
      in_range: k.actual >= lo && k.actual <= hi, abs_error: round(Math.abs(k.actual - p.point), 2), missing: false };
  });
  return { rows, direction_correct: rows.filter((r) => r.correct).length, in_range: rows.filter((r) => r.in_range).length, n: rows.length };
}

// Brier score: mean (p - outcome)^2; 0 is perfect, always answering 50% scores 0.25. A missing
// answer counts as 50%, so skipping a question never helps.
export function scoreQuestions(c: EvalCase, f: Forecast | null) {
  const rows = c.questions.map((q) => {
    const answer = f?.questions?.find((x) => x.id === q.id);
    const p = answer ? clampP(answer.probability) : 0.5;
    const o = q.outcome ? 1 : 0;
    return { id: q.id, text: q.text, probability: p, outcome: q.outcome, resolution: q.resolution, correct: (p >= 0.5) === q.outcome, brier: round((p - o) ** 2, 4), missing: !answer };
  });
  const brier = round(mean(rows.map((r) => r.brier)), 4);
  const calibration = CALIBRATION_BUCKETS.map((b) => {
    const inB = rows.filter((r) => r.probability * 100 >= b.lo && r.probability * 100 < b.hi);
    return { bucket: b.bucket, mid: b.mid, n: inB.length, mean_forecast: inB.length ? round(mean(inB.map((r) => r.probability * 100)), 1) : null,
      observed: inB.length ? round((inB.filter((r) => r.outcome).length / inB.length) * 100, 1) : null };
  });
  return { rows, n: rows.length, correct: rows.filter((r) => r.correct).length, brier, brier_skill: round(1 - brier / 0.25, 3), calibration };
}

// Precision: share of recommendations that match something the company did (exact, or exact or
// partial). Recall: share of the company's decisions that at least one recommendation anticipated.
export function scoreRecommendations(c: EvalCase, f: Forecast | null, matches: RecMatch[]) {
  const recs = f?.recommendations ?? [];
  const decisions = c.actions.filter((a) => a.kind === "decision");
  const risks = c.actions.filter((a) => a.kind === "risk_event");
  const byRec = new Map<string, RecMatch>();
  for (const m of matches || []) {
    const valid = c.actions.some((a) => a.id === m.action_id);
    if (!recs.some((r) => r.id === m.rec_id) || byRec.has(m.rec_id)) continue;
    byRec.set(m.rec_id, valid ? m : { ...m, action_id: "", label: "none" });
  }
  const rows = recs.map((r) => {
    const m = byRec.get(r.id) ?? { rec_id: r.id, action_id: "", label: "none" as const, rationale: "not judged" };
    const action = c.actions.find((a) => a.id === m.action_id);
    return { ...r, match: m.label, action_id: m.action_id, company_action: action?.text ?? "", action_date: action?.date ?? "", judge_rationale: m.rationale };
  });
  const hit = (label: string, strict: boolean) => label === "exact" || (!strict && label === "partial");
  const anticipated = (strict: boolean) => decisions.filter((d) => rows.some((r) => r.action_id === d.id && hit(r.match, strict)));
  const riskRecs = rows.filter((r) => r.type === "risk");
  return {
    rows, n: rows.length,
    precision_strict: rows.length ? round(rows.filter((r) => hit(r.match, true)).length / rows.length, 3) : null,
    precision_lenient: rows.length ? round(rows.filter((r) => hit(r.match, false)).length / rows.length, 3) : null,
    recall_strict: decisions.length ? round(anticipated(true).length / decisions.length, 3) : null,
    recall_lenient: decisions.length ? round(anticipated(false).length / decisions.length, 3) : null,
    anticipated: anticipated(false).map((d) => d.id),
    missed: decisions.filter((d) => !anticipated(false).includes(d)).map((d) => ({ id: d.id, date: d.date, text: d.text })),
    risk_events_flagged: risks.filter((e) => riskRecs.some((r) => r.action_id === e.id && hit(r.match, false))).length, risk_events: risks.length,
  };
}

// Whether the findings flagged at the cutoff held up: directional accuracy, by confidence bucket
// (calibration) and by source tier.
export function scoreFindings(findings: ScoredFinding[], verdicts: FindingVerdict[]) {
  const rows = findings.map((f) => {
    const v = (verdicts || []).find((x) => x.finding_id === f.id);
    return { ...f, held: v?.held ?? "unclear", happened: v?.happened ?? "", conf_pct: CONFIDENCE_PCT[f.confidence] ?? 60 };
  });
  const decided = rows.filter((r) => r.held !== "unclear");
  const share = (xs: typeof rows) => {
    const d = xs.filter((r) => r.held !== "unclear");
    return d.length ? round((d.filter((r) => r.held === "held").length / d.length) * 100, 1) : null;
  };
  return {
    rows, n: rows.length, decided: decided.length, held: decided.filter((r) => r.held === "held").length,
    directional_pct: share(rows),
    calibration: CALIBRATION_BUCKETS.map((b) => {
      const inB = rows.filter((r) => r.conf_pct >= b.lo && r.conf_pct < b.hi);
      return { bucket: b.bucket, mid: b.mid, n: inB.filter((r) => r.held !== "unclear").length, observed: share(inB) };
    }),
    tiers: [1, 2, 3, 4].map((t) => { const inT = rows.filter((r) => r.tier === t); return { tier: `Tier ${t}`, n: inT.filter((r) => r.held !== "unclear").length, held: share(inT) }; }),
  };
}

export function scoreCondition(c: EvalCase, f: Forecast | null, matches: RecMatch[]) {
  return { quarters: scoreQuarters(c, f), kpis: scoreKpis(c, f), questions: scoreQuestions(c, f), recommendations: scoreRecommendations(c, f, matches) };
}

// News run minus no-news run on the headline metrics: what the 2022 news added beyond the model's
// own knowledge. Positive is better for every entry (Brier and MAE are flipped).
export function gap(news: ReturnType<typeof scoreCondition>, base: ReturnType<typeof scoreCondition>) {
  const d = (a: number | null, b: number | null, flip = false) => (a == null || b == null ? null : round(flip ? b - a : a - b, 3));
  return {
    quarter_hits: news.quarters.hits - base.quarters.hits,
    quarter_mae_pct: d(news.quarters.mae_pct, base.quarters.mae_pct, true),
    kpi_direction: news.kpis.direction_correct - base.kpis.direction_correct,
    question_brier: d(news.questions.brier, base.questions.brier, true),
    question_correct: news.questions.correct - base.questions.correct,
    rec_precision: d(news.recommendations.precision_lenient, base.recommendations.precision_lenient),
    rec_recall: d(news.recommendations.recall_lenient, base.recommendations.recall_lenient),
  };
}
