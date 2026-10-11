// SYNTHETIC test data, not results. A finished Netflix backtest made up for tests: the forecasts, judge
// labels, findings, briefing and news below are invented, every model is named "synthetic-*" and every
// link points at example.com. The scores are computed with the repo's own scoring code, exactly as
// runPipeline/eval/stages.ts score() does, so the numbers are consistent with the made-up inputs.
// syntheticSnapshot() is a dry run unless asked otherwise, so a copy of it is refused by the app.
// Never copy any of this into src/evals/published/.

import { NETFLIX_2023 as c } from "../../../base44/shared/eval/cases.ts";
import { buildPublished, type PublishedBacktest } from "../../../base44/shared/eval/published.ts";
import { type FindingVerdict, type Forecast, gap, type RecMatch, scoreCondition, type ScoredFinding, scoreFindings } from "../../../base44/shared/eval/scoring.ts";

type Rec = Record<string, any>;
const S = "https://example.com/synthetic";

const news: Forecast = {
  quarters: [
    { id: "2023-Q1", low: 7.95, mid: 8.15, high: 8.35, rationale: "Synthetic: price rises offset the strong dollar." },
    { id: "2023-Q2", low: 8.05, mid: 8.25, high: 8.45, rationale: "Synthetic: paid sharing begins." },
    { id: "2023-Q3", low: 8.15, mid: 8.35, high: 8.5, rationale: "Synthetic: the range assumed a slower paid-sharing ramp." },
    { id: "2023-Q4", low: 8.4, mid: 8.65, high: 8.9, rationale: "Synthetic: seasonal peak." },
  ],
  kpis: [
    { id: "rev_growth", direction: "up", point: 5, low: 2, high: 8 },
    { id: "op_margin", direction: "flat", point: 20.5, low: 19, high: 22 },
    { id: "net_adds", direction: "up", point: 14, low: 6, high: 22 },
    { id: "excess_return", direction: "flat", point: 2, low: -20, high: 25 },
  ],
  questions: c.questions.map((q, i) => ({ id: q.id, probability: [0.75, 0.7, 0.6, 0.8, 0.65, 0.5, 0.3, 0.4, 0.6, 0.2, 0.1, 0.35][i] ?? 0.5 })),
  recommendations: [
    { id: "R1", type: "expand", action: "Synthetic: charge for password sharing in the US by mid-year", rationale: "Synthetic rationale.", expected_by: "2023-06", evidence: [] },
    { id: "R2", type: "expand", action: "Synthetic: grow the ad-supported plan", rationale: "Synthetic rationale.", expected_by: "2023-09", evidence: [] },
    { id: "R3", type: "risk", action: "Synthetic: plan the slate around a writers' strike", rationale: "Synthetic rationale.", expected_by: "2023-05", evidence: [] },
    { id: "R4", type: "cut", action: "Synthetic: sell the games studios", rationale: "Synthetic rationale.", expected_by: "2023-12", evidence: [] },
  ],
  outlook: "Synthetic outlook.",
};
const noNews: Forecast = {
  ...news,
  quarters: news.quarters.map((q) => ({ ...q, low: q.low - 0.3, mid: q.mid - 0.25, high: q.high - 0.2, rationale: "Synthetic no-news range." })),
  questions: news.questions.map((q) => ({ ...q, probability: 0.5 + (q.probability - 0.5) * 0.5 })),
  recommendations: news.recommendations.filter((r) => ["R2", "R4"].includes(r.id)),
};
const recsNews: RecMatch[] = [
  { rec_id: "R1", action_id: "a_paid_sharing", label: "exact", rationale: "Synthetic judge label." },
  { rec_id: "R2", action_id: "a_ads_growth", label: "partial", rationale: "Synthetic judge label." },
  { rec_id: "R3", action_id: "r_strikes", label: "exact", rationale: "Synthetic judge label." },
  { rec_id: "R4", action_id: "", label: "none", rationale: "Synthetic judge label." },
];
const recsNoNews: RecMatch[] = [
  { rec_id: "R2", action_id: "a_ads_growth", label: "partial", rationale: "Synthetic judge label." },
  { rec_id: "R4", action_id: "", label: "none", rationale: "Synthetic judge label." },
];

const src = (slug: string, outlet: string, tier: number, date: string) => ({ title: `Synthetic: ${slug}`, url: `${S}/${slug}`, outlet, type: "Trade press", tier, date });
// Finding records as the backtest scan would save them.
const findings: Rec[] = [
  { id: "sf1", title: "Synthetic: Netflix to widen paid sharing in early 2023", exposure: "Synthetic password sharing", topic_key: "company_specific", effect: "supported",
    event_date: "2022-10-18", materiality: 4, confidence: 5, urgency: 4, priority: 80, is_alert: true, facts: ["Synthetic fact one."], why_it_matters: "Synthetic: could restart growth.",
    assumptions_affected: ["Paid memberships return to steady growth in 2023"], sources: [src("paid-sharing", "Synthetic Wire", 1, "2022-10-18")], review_status: "pending", run_id: "synthetic-run" },
  { id: "sf2", title: "Synthetic: ad tier launches at $6.99", exposure: "Synthetic streaming prices", topic_key: "pricing_competition", effect: "supported",
    event_date: "2022-11-03", materiality: 3, confidence: 4, urgency: 3, priority: 36, is_alert: false, facts: ["Synthetic fact two."], why_it_matters: "Synthetic: lowers the entry price.",
    assumptions_affected: ["Price increases and the ad plan keep ARM at least flat"], sources: [src("ad-tier", "Synthetic Daily", 2, "2022-11-03")], review_status: "pending", run_id: "synthetic-run" },
  { id: "sf3", title: "Synthetic: writers' guild signals a hard line", exposure: "Synthetic labor talks", topic_key: "labor_talent", effect: "challenged",
    event_date: "2022-12-12", materiality: 3, confidence: 3, urgency: 3, priority: 27, is_alert: false, facts: ["Synthetic fact three."], why_it_matters: "Synthetic: a strike pauses production.",
    assumptions_affected: ["Content amortization grows slower than revenue"], sources: [src("wga", "Synthetic Trade", 2, "2022-12-12")], review_status: "pending", run_id: "synthetic-run" },
  { id: "sf4", title: "Synthetic: rival price rise pressures churn", exposure: "Synthetic streaming prices", topic_key: "pricing_competition", effect: "under_pressure",
    event_date: "2022-12-08", materiality: 2, confidence: 2, urgency: 2, priority: 8, is_alert: false, facts: ["Synthetic fact four."], why_it_matters: "Synthetic: churn risk.",
    assumptions_affected: ["Disney+, HBO Max and Prime Video do not raise churn"], sources: [src("rival-price", "Synthetic Blog", 3, "2022-12-08")], review_status: "pending", run_id: "synthetic-run" },
];
const verdicts: FindingVerdict[] = [
  { finding_id: "sf1", held: "held", happened: "Synthetic: it happened." },
  { finding_id: "sf2", held: "held", happened: "Synthetic: it happened." },
  { finding_id: "sf3", held: "held", happened: "Synthetic: it happened." },
  { finding_id: "sf4", held: "did_not_hold", happened: "Synthetic: it did not." },
];

// stages.ts scored(): a finding as the Evals page shows it.
const scored = (f: Rec): ScoredFinding => {
  const sources = [...(f.sources || [])].sort((a: Rec, b: Rec) => (a.tier ?? 3) - (b.tier ?? 3));
  return {
    id: f.id, title: f.title || "", date: f.event_date || "", assumption: f.assumptions_affected?.[0] || f.drivers_affected?.[0] || "",
    confidence: Number(f.confidence) || 1, materiality: Number(f.materiality) || 1, tier: Number(sources[0]?.tier) || 3, source: sources[0]?.outlet || sources[0]?.title || "",
    direction: ["challenged", "under_pressure"].includes(f.effect) ? "Challenges" : "Supports",
  };
};

// EvalSource rows: kept ones (one duplicate link, one flagged) and the kinds the collector leaves out.
const row = (i: number, date: string, included: boolean, extra: Rec = {}) => ({
  id: `ses${i}`, corpus_key: "synthetic-corpus", query: i % 2 ? "Netflix" : "Netflix password sharing", search_index: i % 2, window_index: 3,
  window_from: "2022-10-01", window_to: "2022-12-31", title: `Synthetic: news item ${i}`, url: `${S}/news-${i}`, source: i % 3 ? "Synthetic Wire" : "Synthetic Daily",
  date_raw: date, date, snippet: "Synthetic snippet.", included, exclusion: included ? "" : date ? "after_cutoff" : "undated", flag: "", ...extra,
});
const sources: Rec[] = [
  row(1, "2022-12-20", true), row(2, "2022-10-05", true), row(3, "2022-11-15", true, { flag: "mentions 2024" }), row(4, "2022-12-31", true),
  row(5, "2022-12-01", true, { url: `${S}/news-1` }), // same link as row 1, kept once
  row(6, "2023-01-04", false), row(7, "", false),
];

const corpus = { searches: 2, windows: 4, fetched: 7, kept: 5, unique_kept: 4, excluded: { undated: 1, after_cutoff: 1, before_lookback: 0 }, flagged: 1, collected: 8, total: 8 };
const usage = (agent: string, model: string) => ({ agent, model, effort: "high", ms: 1000, input_tokens: 100, output_tokens: 50, thinking_tokens: 10 });

export function syntheticRecords() {
  const n = scoreCondition(c, news, recsNews), b = scoreCondition(c, noNews, recsNoNews);
  const summary = {
    company: c.company, cutoff: c.cutoff, horizon: c.horizon, news: n, no_news: b, gap: gap(n, b),
    findings: scoreFindings(findings.map(scored), verdicts), corpus, caveats: c.caveats,
    unchecked_answers: [...c.quarters, ...c.kpis, ...c.questions, ...c.actions].filter((a) => a.check).length,
  };
  const ev: Rec = {
    id: "synthetic-eval-run", case_key: c.key, cutoff: c.cutoff, stage: "done", created_date: "2026-10-01T10:00:00.000Z", updated_date: "2026-10-01T10:20:00.000Z",
    finished_at: "2026-10-01T10:19:00.000Z", client_id: "synthetic-client", plan_id: "synthetic-plan", run_id: "synthetic-run", briefing_id: "synthetic-briefing",
    corpus_key: "synthetic-corpus", corpus_stats: corpus, model: "synthetic-forecaster", judge_model: "synthetic-judge", errors: ["analyze: synthetic non-fatal problem"],
    usage: [usage("keywords/planner", "synthetic-pipeline"), usage("eval/forecast-news", "synthetic-forecaster"), usage("eval/forecast-no_news", "synthetic-forecaster"),
      usage("eval/judge-recs-news", "synthetic-judge"), usage("eval/judge-recs-no-news", "synthetic-judge"), usage("eval/judge-findings", "synthetic-judge")],
    forecasts: { news, no_news: noNews }, judgments: { recs_news: recsNews, recs_no_news: recsNoNews, findings: verdicts }, summary,
  };
  const briefing: Rec = {
    id: "synthetic-briefing", run_id: "synthetic-run", as_of: "2022-12-31T23:59:59.000Z", headline: "Synthetic headline: growth returns if paid sharing lands",
    summary: "Synthetic outlook summary.",
    company: {
      outlook: { verdict: "Synthetic verdict", summary: "Synthetic outlook summary.", conditions: [{ if_condition: "synthetic condition", then_effect: "synthetic effect", signpost: "synthetic signpost" }] },
      advice: [{ action: "Synthetic advice: prepare for paid sharing", kind: "opportunity", horizon: "this_quarter", confidence: 4, rationale: "Synthetic rationale.", sources: [{ title: "Synthetic source" }] }],
    },
    stats: { agents: [usage("research/company", "synthetic-pipeline"), usage("company/lead", "synthetic-pipeline"), usage("research/market", "synthetic-pipeline-2")] },
  };
  const plan: Rec = {
    id: "synthetic-plan", as_of: c.cutoff, keyword_count: 3,
    exposures: [
      { name: "Synthetic password sharing", category: "company_specific", driver: "Paid memberships", why: "Synthetic why.", sensitivity: "high", keywords: ["Netflix password sharing"] },
      { name: "Synthetic streaming prices", category: "pricing_competition", driver: "Pricing", why: "Synthetic why.", sensitivity: "medium", keywords: ["streaming price increase", "ad tier"] },
    ],
  };
  return { ev, findings, briefing, plan, sources };
}

// The synthetic run as a published snapshot. dry_run is true unless dryRun: false is passed.
export function syntheticSnapshot(opts: { dryRun?: boolean } = {}): PublishedBacktest {
  const r = syntheticRecords();
  return buildPublished({ ...r, origin: "local-runner", dryRun: opts.dryRun ?? true, now: "2026-10-01T11:00:00.000Z" });
}
