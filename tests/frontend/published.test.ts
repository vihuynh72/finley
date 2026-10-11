// Published backtests: the snapshot checks, the loader the frontend uses, and the view model that
// sections A to F of the Evals page (and the landing chart) render from. Uses the SYNTHETIC fixture.
import assert from "node:assert/strict";
import { NETFLIX_2023 as c } from "../../base44/shared/eval/cases.ts";
import { buildPublished, checkPublished } from "../../base44/shared/eval/published.ts";
import { scoreQuarters } from "../../base44/shared/eval/scoring.ts";
import { caseKeyOf, snapshotIndex } from "../../src/components/evals/snapshots.ts";
import { resultsOf, viewFromEvalRun, viewFromPublished } from "../../src/components/evals/view.ts";
import { syntheticRecords, syntheticSnapshot } from "./fixtures/synthetic-backtest.ts";

const real = () => syntheticSnapshot({ dryRun: false });

Deno.test("the synthetic fixture is a dry run by default, and a dry run is refused", () => {
  const p = syntheticSnapshot();
  assert.equal(p.dry_run, true);
  assert.deepEqual(checkPublished(p, "netflix-2023"), ["dry run: fake services, not results"]);
  assert.deepEqual(checkPublished(real(), "netflix-2023"), []);
});

Deno.test("checkPublished refuses the wrong case or format, missing results, and news after the cutoff", () => {
  assert.match(checkPublished(real(), "other-case").join(), /case netflix-2023, expected other-case/);
  assert.match(checkPublished({ ...real(), format: 2 }).join(), /format 2/);
  assert.match(checkPublished({ ...real(), summary: { ...real().summary, news: { quarters: { rows: [] } } } }).join(), /no scored quarters/);
  assert.match(checkPublished({ ...real(), summary: { ...real().summary, no_news: undefined } }).join(), /no no-news condition/);
  const late = { ...real(), sources: [...real().sources, { title: "x", outlet: "y", date: "2023-01-02", url: "u", query: "q", window: "" }] };
  assert.match(checkPublished(late).join(), /1 sources undated or after the cutoff/);
  const undated = { ...real(), sources: [...real().sources, { title: "x", outlet: "y", date: "", url: "u", query: "q", window: "" }] };
  assert.match(checkPublished(undated).join(), /1 sources undated or after the cutoff/);
  assert.deepEqual(checkPublished(null as any), ["not an object"]);
});

Deno.test("buildPublished keeps only dated news on or before the cutoff, once per link, and counts every model call", () => {
  const r = syntheticRecords();
  const p = real();
  assert.deepEqual(p.sources.map((s) => s.url.split("/").pop()), ["news-2", "news-3", "news-1", "news-4"]); // by date; news-5 duplicates news-1
  assert.ok(p.sources.every((s) => s.date && s.date <= c.cutoff));
  assert.equal(p.sources.find((s) => s.flag)?.flag, "mentions 2024");
  // The EvalRun's own calls plus the analyze stage's agents, which the pipeline records on the Briefing.
  assert.equal(p.run.usage.calls, r.ev.usage.length + r.briefing.stats.agents.length);
  assert.deepEqual(p.run.pipeline_models.sort(), ["synthetic-pipeline", "synthetic-pipeline-2"]);
  assert.equal(p.run.model, "synthetic-forecaster");
  assert.equal(p.run.judge_model, "synthetic-judge");
  assert.equal(p.findings[0].title, r.findings[0].title); // highest priority first
  assert.ok(!("review_status" in p.findings[0]) && !("id" in p.findings[0]), "analyst state and ids are dropped");
  assert.equal(p.briefing?.advice.length, 1);
  assert.equal(p.keyword_plan?.exposures.length, 2);
  assert.throws(() => buildPublished({ ...r, ev: { ...r.ev, stage: "forecast" }, origin: "local-runner" }), /not finished/);
});

Deno.test("a published snapshot and the live EvalRun it came from give the same sections A to F", () => {
  const { ev } = syntheticRecords();
  const live = viewFromEvalRun(ev), pub = viewFromPublished(real());
  assert.equal(live.kind, "live");
  assert.equal(pub.kind, "published");
  assert.deepEqual(resultsOf(pub), resultsOf(live));
  assert.equal(live.provenance, null);
  assert.equal(live.saw, null);
});

Deno.test("the view's numbers are the scoring code's numbers", () => {
  const { ev } = syntheticRecords();
  const v = viewFromPublished(real());
  const q = scoreQuarters(c, ev.forecasts.news);
  assert.equal(v.quarters.hits, q.hits);
  assert.equal(v.quarters.hits, 3); // Q3's actual $8.54B is above the synthetic $8.15B-$8.50B range
  assert.equal(v.quarters.maePct, q.mae_pct);
  assert.equal(v.metrics.coverage.value, "3 of 4");
  assert.equal(v.metrics.coverage.sub, "Quarters inside the 80% range (75%)");
  assert.equal(v.metrics.mae.value, `${q.mae_pct}%`);
  assert.deepEqual(v.quarters.rows.map((r) => r.verdict), ["Yes", "Yes", "No, above range", "Yes"]);
  assert.deepEqual(v.quarters.rows.map((r) => r.baseMid), ev.summary.no_news.quarters.rows.map((r: any) => r.mid));
  assert.equal(v.quarters.miss?.id, "2023-Q3");
  assert.equal(v.quarters.miss?.rationale, "Synthetic: the range assumed a slower paid-sharing ramp.");
  // Decisions in the answer key, recovered from the summary alone.
  assert.equal(v.decisions, c.actions.filter((a) => a.kind === "decision").length);
  assert.equal(v.metrics.anticipated.value, `2 of ${v.decisions}`); // R1 exact on paid sharing, R2 partial on the ad plan
  assert.equal(v.metrics.held.value, "75%");
  assert.equal(v.metrics.held.sub, "3 of 4 findings the record can judge");
  assert.equal(v.questions.length, c.questions.length);
  assert.equal(v.questions[0].news, 75);
  assert.equal(v.questions[0].base, 63); // 0.5 + 0.25 * 0.5 = 0.625
  const g = ev.summary.gap;
  assert.deepEqual(v.gapRows[0], ["Quarters inside the range", "3 of 4", `${ev.summary.no_news.quarters.hits} of 4`, g.quarter_hits > 0 ? `+${g.quarter_hits}` : g.quarter_hits < 0 ? `−${-g.quarter_hits}` : "0"]);
  assert.equal(v.gapRows.length, 7);
  assert.equal(v.caveat, c.caveats[1]);
});

Deno.test("anticipated counts partial matches too, as the scoring code does", () => {
  const { ev } = syntheticRecords();
  const v = viewFromEvalRun(ev);
  assert.deepEqual(ev.summary.news.recommendations.anticipated.sort(), ["a_ads_growth", "a_paid_sharing"]);
  assert.equal(v.metrics.anticipated.value, `2 of ${v.decisions}`);
});

Deno.test("the published view carries its provenance and what Finley saw, all from the snapshot", () => {
  const p = real(), v = viewFromPublished(p);
  assert.deepEqual(v.provenance, {
    origin: "local-runner", publishedAt: "2026-10-01T11:00:00.000Z", finishedAt: "2026-10-01T10:19:00.000Z", model: "synthetic-forecaster", judgeModel: "synthetic-judge",
    pipelineModels: p.run.pipeline_models, calls: 9, newsKept: 4, errors: ["analyze: synthetic non-fatal problem"],
  });
  assert.equal(v.saw?.sources.length, 4);
  assert.equal(v.saw?.outlets, 2);
  assert.equal(v.saw?.firstDate, "2022-10-05");
  assert.equal(v.saw?.lastDate, "2022-12-31");
  assert.equal(v.saw?.flagged, 1);
  assert.equal(v.saw?.findings.length, 4);
  assert.equal(v.saw?.exposures.length, 2);
  assert.equal(v.saw?.keywordCount, 3);
  assert.equal(v.saw?.briefing?.headline, "Synthetic headline: growth returns if paid sharing lands");
});

Deno.test("the loader lists known cases from file names and refuses snapshots with problems", async () => {
  assert.equal(caseKeyOf("../evals/published/netflix-2023.json"), "netflix-2023");
  const warnings: string[] = [];
  let loads = 0;
  const files = {
    "../evals/published/netflix-2023.json": async () => { loads++; return { default: syntheticSnapshot() }; }, // a dry run
    "../evals/published/unknown-case.json": async () => real(),
  };
  const idx = snapshotIndex(files, (m) => warnings.push(m));
  assert.deepEqual(idx.cases(), ["netflix-2023"]); // only cases the app knows
  assert.equal(await idx.load("netflix-2023"), null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /netflix-2023 is not shown: dry run/);
  assert.deepEqual((await idx.check("netflix-2023")).problems, ["dry run: fake services, not results"]);
  assert.equal(loads, 1, "loaded and checked once");
  assert.equal(warnings.length, 1, "warned once");
  assert.equal(await idx.load("no-such-case"), null);

  const ok = snapshotIndex({ "../evals/published/netflix-2023.json": async () => real() }, (m) => warnings.push(m));
  const p = await ok.load("netflix-2023");
  assert.equal(p?.case_key, "netflix-2023");
  assert.equal(p?.dry_run, false);

  // A snapshot filed under the wrong case name is refused.
  const misfiled = snapshotIndex({ "../evals/published/netflix-2023.json": async () => ({ ...real(), case_key: "other" }) }, () => {});
  assert.equal(await misfiled.load("netflix-2023"), null);

  // A chunk that fails to load can be retried.
  let fail = true;
  const flaky = snapshotIndex({ "../evals/published/netflix-2023.json": async () => { if (fail) throw new Error("chunk failed"); return real(); } }, () => {});
  await assert.rejects(flaky.load("netflix-2023"), /chunk failed/);
  fail = false;
  assert.equal((await flaky.load("netflix-2023"))?.case_key, "netflix-2023");
});
