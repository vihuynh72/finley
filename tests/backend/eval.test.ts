import assert from "node:assert/strict";
import { EVAL_CASES, NETFLIX_2023, publicCase } from "../../base44/shared/eval/cases.ts";
import { actualDirection, type Forecast, gap, scoreCondition, scoreFindings, scoreQuestions, scoreQuarters, scoreRecommendations } from "../../base44/shared/eval/scoring.ts";
import { classifySource } from "../../base44/shared/sources.ts";
import { addDays, isoDay } from "../../base44/shared/dates.ts";
import { newsSearchUrl, parseNews } from "../../base44/shared/brightdata.ts";

const c = NETFLIX_2023;
const F = (x: Partial<Forecast>) => x as Forecast; // tests build only the parts they score

Deno.test("the Netflix case is internally consistent", () => {
  assert.equal(EVAL_CASES["netflix-2023"], c);
  const ids = [...c.quarters, ...c.kpis, ...c.questions, ...c.actions].map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, "ids are unique");
  for (const q of c.quarters) assert.ok(q.start >= c.horizon.start && q.end <= c.horizon.end);
  for (const a of c.actions) assert.ok(a.date >= c.horizon.start && a.date <= c.horizon.end, `${a.id} inside the horizon`);
  // FY2023 revenue from the quarters agrees with the KPI (8.16+8.19+8.54+8.83 = 33.72 vs 31.62).
  const fy = c.quarters.reduce((s, q) => s + q.actual, 0);
  assert.ok(Math.abs((fy / 31.62 - 1) * 100 - c.kpis.find((k) => k.id === "rev_growth")!.actual) < 0.1);
  assert.ok(c.questions.some((q) => !q.outcome) && c.questions.some((q) => q.outcome), "both yes and no questions");
});

Deno.test("publicCase leaks no outcome", () => {
  const text = JSON.stringify(publicCase(c));
  for (const q of c.questions) assert.ok(!text.includes(q.resolution), `resolution of ${q.id}`);
  for (const a of c.actions) assert.ok(!text.includes(a.text), `action ${a.id}`);
  for (const o of c.outcomes) assert.ok(!text.includes(o));
  assert.ok(!/"actual"|"outcome"|"resolution"/.test(text));
});

Deno.test("quarter ranges: coverage and mean absolute error", () => {
  const f = F({ quarters: [{ id: "2023-Q1", low: 7.9, mid: 8.0, high: 8.2 }, { id: "2023-Q2", low: 8.3, mid: 8.4, high: 8.5 }] });
  const s = scoreQuarters(c, f);
  assert.equal(s.n, 4);
  assert.equal(s.hits, 1); // Q1 8.16 inside 7.9-8.2; Q2 8.19 below 8.3; Q3/Q4 missing
  assert.equal(s.rows[0].err, 1.96); // (8.16 - 8.0) / 8.16
  assert.equal(s.mae_pct, round2((1.96 + Math.abs((8.19 - 8.4) / 8.19 * 100)) / 2));
});
const round2 = (n: number) => Math.round(n * 100) / 100;

Deno.test("questions: Brier score, missing answers count as 50%, calibration buckets", () => {
  const all = (p: number) => F({ questions: c.questions.map((q) => ({ id: q.id, probability: q.outcome ? p : 1 - p })) });
  assert.equal(scoreQuestions(c, all(1)).brier, 0.0001); // clamped to 0.99
  assert.equal(scoreQuestions(c, null).brier, 0.25);
  const s = scoreQuestions(c, all(0.8));
  assert.equal(s.correct, c.questions.length);
  assert.equal(s.brier, 0.04);
  assert.ok(Math.abs(s.brier_skill - 0.84) < 1e-9);
  const hi = s.calibration.find((b) => b.bucket === "70–100")!;
  assert.equal(hi.n, c.questions.filter((q) => q.outcome).length);
  assert.equal(hi.observed, 100);
});

Deno.test("recommendations: precision, recall, invalid judge ids ignored", () => {
  const f = F({ recommendations: [
    { id: "R1", type: "expand", action: "Charge for password sharing", rationale: "", expected_by: "2023-Q2", evidence: [] },
    { id: "R2", type: "defend", action: "Raise prices", rationale: "", expected_by: "2023-Q4", evidence: [] },
    { id: "R3", type: "risk", action: "Plan for a writers' strike", rationale: "", expected_by: "2023-Q2", evidence: [] },
    { id: "R4", type: "expand", action: "Buy a theme park", rationale: "", expected_by: "2023-Q4", evidence: [] },
  ] });
  const s = scoreRecommendations(c, f, [
    { rec_id: "R1", action_id: "a_paid_sharing", label: "exact", rationale: "" },
    { rec_id: "R2", action_id: "a_price_rise", label: "partial", rationale: "" },
    { rec_id: "R3", action_id: "r_strikes", label: "exact", rationale: "" },
    { rec_id: "R4", action_id: "made_up", label: "exact", rationale: "" },
  ]);
  assert.equal(s.precision_strict, 0.5);
  assert.equal(s.precision_lenient, 0.75);
  const decisions = c.actions.filter((a) => a.kind === "decision").length;
  assert.equal(s.recall_strict, round3(1 / decisions));
  assert.equal(s.recall_lenient, round3(2 / decisions));
  assert.equal(s.risk_events_flagged, 1);
  assert.equal(s.rows.find((r) => r.id === "R4")!.match, "none");
});
const round3 = (n: number) => Math.round(n * 1000) / 1000;

Deno.test("findings: directional accuracy, calibration and tiers skip unclear verdicts", () => {
  const f = (id: string, confidence: number, tier: number) => ({ id, title: id, date: "2022-10-18", assumption: "", confidence, materiality: 4, tier, source: "x", direction: "Challenges" as const });
  const s = scoreFindings([f("a", 5, 1), f("b", 4, 2), f("c", 2, 4), f("d", 3, 2)], [
    { finding_id: "a", held: "held", happened: "" }, { finding_id: "b", held: "did_not_hold", happened: "" }, { finding_id: "c", held: "unclear", happened: "" },
  ]);
  assert.equal(s.decided, 2);
  assert.equal(s.directional_pct, 50);
  assert.equal(s.tiers[0].held, 100);
  assert.equal(s.tiers[3].held, null);
  assert.equal(s.calibration.find((b) => b.bucket === "70–100")!.observed, 50);
});

Deno.test("gap: news minus no-news, lower-is-better metrics flipped", () => {
  const perfect = { quarters: c.quarters.map((q) => ({ id: q.id, low: q.actual - 0.1, mid: q.actual, high: q.actual + 0.1 })),
    kpis: c.kpis.map((k) => ({ id: k.id, direction: actualDirection(k.actual, k.base, k.flat_band), point: k.actual, low: k.actual, high: k.actual })),
    questions: c.questions.map((q) => ({ id: q.id, probability: q.outcome ? 0.9 : 0.1 })), recommendations: [], outlook: "" } as Forecast;
  const g = gap(scoreCondition(c, perfect, []), scoreCondition(c, null, []));
  assert.equal(g.quarter_hits, 4);
  assert.equal(g.kpi_direction, 4);
  assert.ok(g.question_brier! > 0);
});

Deno.test("source tiers from outlet and URL", () => {
  assert.deepEqual(classifySource("SEC", "https://www.sec.gov/Archives/x"), { type: "Government", tier: 1 });
  assert.deepEqual(classifySource("Business Wire", "https://www.businesswire.com/news/1"), { type: "Primary company", tier: 1 });
  assert.deepEqual(classifySource("Netflix", "https://about.netflix.com/en/news/x", "Netflix"), { type: "Primary company", tier: 1 });
  assert.deepEqual(classifySource("Reuters", "https://www.reuters.com/business/x", "Netflix"), { type: "Trade press", tier: 2 });
  assert.deepEqual(classifySource("CNBC", "", "Netflix"), { type: "Trade press", tier: 2 });
  assert.deepEqual(classifySource("Streaming Media Blog", "https://streamingblog.example/x"), { type: "Blog unverified", tier: 4 });
  assert.deepEqual(classifySource("Someone", "https://medium.com/@a/b"), { type: "Blog unverified", tier: 4 });
  assert.deepEqual(classifySource("Cord Cutters News", "https://cordcuttersnews.com/x"), { type: "Trade press", tier: 3 });
  // A major outlet's URL that mentions the client is still press, not the company.
  assert.deepEqual(classifySource("CNBC", "https://www.cnbc.com/2022/04/19/netflix-earnings.html", "Netflix"), { type: "Trade press", tier: 2 });
});

Deno.test("dates: relative, absolute and ISO; helpers", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  assert.equal(isoDay("2 days ago", now), "2026-10-08");
  assert.equal(isoDay("an hour ago", now), "2026-10-10");
  assert.equal(isoDay("Apr 19, 2022", now), "2022-04-19");
  assert.equal(isoDay("2022-04-19", now), "2022-04-19");
  assert.equal(isoDay("", now), "");
  assert.equal(isoDay("sometime", now), "");
  assert.equal(addDays("2022-12-31", 1), "2023-01-01");
});

Deno.test("Bright Data news URL with a Google date window, and result parsing", () => {
  assert.equal(newsSearchUrl("netflix ads"), "https://www.google.com/search?q=netflix%20ads&tbm=nws&brd_json=1");
  const u = new URL(newsSearchUrl("netflix ads", { from: "2022-01-01", to: "2022-03-31" }));
  assert.equal(u.searchParams.get("tbs"), "cdr:1,cd_min:1/1/2022,cd_max:3/31/2022");
  assert.equal(u.searchParams.get("tbm"), "nws");
  assert.throws(() => newsSearchUrl("x", { from: "2022-01-01" }));
  const items = parseNews(JSON.stringify({ news: [{ title: "T", link: "https://a.example/1", source: "A", date: "Apr 19, 2022", description: "S" }] }));
  assert.deepEqual(items, [{ title: "T", url: "https://a.example/1", source: "A", date: "Apr 19, 2022", snippet: "S" }]);
  assert.throws(() => parseNews("<html>"), /non-JSON/);
});
