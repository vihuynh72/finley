import { secrets } from "base44:runtime";
import { type AgentUsage, MODEL } from "../../../shared/agent.ts";
import { searchNews } from "../../../shared/brightdata.ts";
import { caseCurrency, EVAL_CASES, type EvalCase } from "../../../shared/eval/cases.ts";
import { type FindingVerdict, type Forecast, gap, type RecMatch, scoreCondition, type ScoredFinding, scoreFindings } from "../../../shared/eval/scoring.ts";
import { planKeywords, profileFingerprint } from "../../../shared/keywords.ts";
import { runAgentPipeline } from "../pipeline.ts";
import { planSearches } from "../searches.ts";
import { collectPairs, corpusFromSources, corpusStats, pairsFor, type SourceRow, toRows, type Window, windowsFor } from "./collect.ts";
import { newsEvidence, runForecast } from "./forecast.ts";
import { judgeFindings, judgeRecommendations } from "./judge.ts";

// A backtest (EvalRun) runs in stages, each inside one invocation of runPipeline:
//   plan      reset the backtest client to the case profile; keyword plan as of the cutoff (pretraining)
//   collect   every plan search x date window before the cutoff, through Bright Data -> EvalSource rows
//   analyze   the agent pipeline over that news, as of the cutoff (needs an invocation of its own)
//   forecast  news and no-news forecasts of the horizon, in parallel
//   score     judges label recommendations and findings; shared/eval/scoring.ts computes every number
// The caller re-invokes ({ eval: { eval_run_id } }) until stage is "done" or "failed". A failed run
// resumes from the failed stage with { retry: true }; finished work (collected news, a forecast) is kept.

type Rec = Record<string, any>;
interface Ctx { base44: any; user: any; ev: Rec; c: EvalCase; startedAt: number; usage: AgentUsage[]; req: Rec }

const BUDGET_MS = 280_000; // of the invocation, inside Base44's 5-minute limit
const COLLECT_UNTIL_MS = 200_000; // no new search starts after this; each can take up to 2 x 25 s
const NEEDS: Record<string, number> = { plan: 150_000, collect: 40_000, forecast: 170_000, score: 170_000 };

const first = async (page: Promise<any>) => ((await page)?.items ?? [])[0] ?? null;
async function allRows(entity: any, query: Rec): Promise<Rec[]> {
  const out: Rec[] = [];
  let cursor: string | null = null;
  do {
    const page: any = await entity.filter(query, { limit: 1000, ...(cursor ? { cursor } : {}) });
    out.push(...(page.items || []));
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return out;
}
const secret = (name: string) => (secrets.get(name) || "").trim() || undefined;

async function plan(x: Ctx): Promise<Rec> {
  const E = x.base44.entities, c = x.c;
  // The backtest client is the case profile as of the cutoff, reset on every run: a pipeline run
  // writes assumption statuses into it. Its name stays the company's, since searches use it.
  const profile = { ...c.profile, eval_case: c.key, assumptions: (c.profile.assumptions || []).map((a: Rec) => ({ ...a, status: "monitoring", note: "" })) };
  let clientId = x.ev.client_id || (await first(E.Client.filter({ eval_case: c.key }, { sort: "-created_date", limit: 1 })))?.id;
  if (clientId) await E.Client.update(clientId, profile);
  else clientId = (await E.Client.create(profile)).id;
  const client = await E.Client.get(clientId);
  const fingerprint = await profileFingerprint(client);
  const latest = await first(E.KeywordPlan.filter({ client_id: clientId }, { sort: "-created_date", limit: 1 }));
  let planRec = latest && latest.as_of === c.cutoff && latest.profile_fingerprint === fingerprint && !x.req.replan ? latest : null;
  if (!planRec) {
    const made = await planKeywords(client, { today: c.cutoff, deadline: Date.now() + 130_000, usage: x.usage });
    if (!made.keyword_count) throw new Error("Keyword planner returned no usable keywords");
    planRec = await E.KeywordPlan.create({ client_id: clientId, profile_fingerprint: fingerprint, as_of: c.cutoff, ...made });
  }
  const windows = windowsFor(c.cutoff, Number(x.req.lookback_days) || 365, Number(x.req.windows) || 4);
  const searches = planSearches(client, planRec);
  return {
    stage: "collect", client_id: clientId, plan_id: planRec.id, windows, lookback_from: windows[0].from,
    corpus_key: [c.key, planRec.id, windows.map((w) => w.from).join(","), searches.length].join("|"), collected_pairs: [], corpus_stats: {}, corpus_complete: false,
  };
}

async function collect(x: Ctx): Promise<Rec> {
  const E = x.base44.entities, ev = x.ev, c = x.c;
  const client = await E.Client.get(ev.client_id);
  const searches = planSearches(client, await E.KeywordPlan.get(ev.plan_id));
  const windows: Window[] = ev.windows;
  const done = new Set<string>(ev.collected_pairs || []);
  // News already collected for the same plan and windows (an earlier run) is reused, not paid for again.
  if (!done.size && x.req.reuse_corpus !== false) {
    const donor = await first(E.EvalRun.filter({ corpus_key: ev.corpus_key, corpus_complete: true }, { sort: "-created_date", limit: 1 }));
    if (donor && donor.id !== ev.id) return { stage: "analyze", corpus_complete: true, collected_pairs: donor.collected_pairs, corpus_stats: donor.corpus_stats };
  }
  const all = pairsFor(searches, windows);
  const res = await collectPairs({
    pairs: all.filter((p) => !done.has(p.key)), stopAt: x.startedAt + COLLECT_UNTIL_MS, concurrency: 6,
    fetch: (p) => searchNews(searches[p.search_index].query, { ...windows[p.window_index], limit: 10, timeoutMs: 25_000 }),
    toRows: (p, found, at) => toRows(ev.corpus_key, p, searches[p.search_index], windows[p.window_index], found, c.cutoff, ev.lookback_from, at),
    save: async (rows, keys) => {
      for (let i = 0; i < rows.length; i += 100) await E.EvalSource.bulkCreate(rows.slice(i, i + 100));
      keys.forEach((k) => done.add(k));
      await E.EvalRun.update(ev.id, { collected_pairs: [...done] });
    },
  });
  const failed: string[] = [...(ev.corpus_stats?.failed_pairs_all || []), ...res.failed];
  if (res.remaining.length) return { collected_pairs: [...done], corpus_stats: { ...(ev.corpus_stats || {}), failed_pairs_all: failed, collected: done.size, total: all.length } };
  if (failed.length > all.length / 2) {
    // Saved before failing: a retry re-fetches exactly these pairs (they are already marked collected).
    await E.EvalRun.update(ev.id, { corpus_stats: { ...(ev.corpus_stats || {}), failed_pairs_all: failed, collected: done.size, total: all.length } });
    throw new Error(`Bright Data failed on ${failed.length} of ${all.length} searches; first error: ${failed[0]}`);
  }
  const stats = { ...corpusStats((await allRows(E.EvalSource, { corpus_key: ev.corpus_key })) as SourceRow[], searches, windows, failed), failed_pairs_all: failed, collected: all.length, total: all.length };
  if (!stats.kept) throw new Error(`No dated news before ${c.cutoff} was found (${stats.fetched} results fetched)`);
  return { stage: "analyze", corpus_complete: true, collected_pairs: [...done], corpus_stats: stats };
}

async function analyze(x: Ctx): Promise<Rec> {
  const E = x.base44.entities, ev = x.ev;
  const client = await E.Client.get(ev.client_id);
  const searches = planSearches(client, await E.KeywordPlan.get(ev.plan_id));
  const rows = (await allRows(E.EvalSource, { corpus_key: ev.corpus_key })) as SourceRow[];
  const { results, articles } = corpusFromSources(searches, rows, new Set<number>(ev.corpus_stats?.failed_searches || []));
  if (!articles.length) throw new Error("No dated news before the cutoff to analyse");
  const asOf = Date.parse(`${x.c.cutoff}T23:59:59Z`);
  const run = await E.Run.create({ client_id: client.id, stage: "research", kind: "backtest", as_of: new Date(asOf).toISOString(), eval_run_id: ev.id, articles_count: articles.length });
  try {
    const out = await runAgentPipeline({ base44: x.base44, user: x.user, run_id: run.id, client, searches, results, articles, startedAt: x.startedAt, asOf, backtest: true });
    if (!out.ok) throw new Error(`The company lead failed, so the backtest scan has no findings: ${out.errors.find((e: string) => e.startsWith("company lead")) ?? "no detail"}`);
    return { stage: "forecast", run_id: run.id, briefing_id: out.briefing_id, errors: [...(ev.errors || []), ...out.errors.map((e: string) => `analyze: ${e}`)].slice(-20) };
  } catch (e) {
    await E.Run.update(run.id, { stage: "failed", error: (e as Error).message }).catch(() => {});
    throw e;
  }
}

const runFindings = async (x: Ctx) => ((await x.base44.entities.Finding.filter({ run_id: x.ev.run_id }, { sort: "-priority", limit: 30 }))?.items ?? []) as Rec[];

// Runs the missing jobs in parallel, saves what finished, and throws if any failed (a retry runs only those).
async function settle(x: Ctx, field: string, have: Rec, jobs: [string, () => Promise<unknown>][]) {
  const settled = await Promise.allSettled(jobs.map(([, job]) => job()));
  const errors: string[] = [];
  settled.forEach((s, i) => (s.status === "fulfilled" ? (have[jobs[i][0]] = s.value) : errors.push(`${jobs[i][0]}: ${s.reason?.message ?? s.reason}`)));
  if (errors.length) {
    await x.base44.entities.EvalRun.update(x.ev.id, { [field]: have });
    throw new Error(errors.join(" | "));
  }
  return have;
}

async function forecast(x: Ctx): Promise<Rec> {
  const ev = x.ev, model = secret("EVAL_MODEL"), m = model || MODEL;
  // Each forecast records its model. A kept one made by another model (EVAL_MODEL changed before a
  // retry) is redone, so the news and no-news conditions always differ only in their evidence.
  const missing = (["news", "no_news"] as const).filter((k) => !ev.forecasts?.[k] || (ev.forecasts[k].model ?? m) !== m);
  const briefing = missing.includes("news") && ev.briefing_id ? await x.base44.entities.Briefing.get(ev.briefing_id).catch(() => null) : null;
  const evidence = missing.includes("news") ? newsEvidence(briefing, await runFindings(x)) : "";
  const opts = { deadline: x.startedAt + BUDGET_MS - 10_000, usage: x.usage, ...(model ? { model } : {}) };
  const forecasts = await settle(x, "forecasts", { ...(ev.forecasts || {}) }, missing.map((k) => [k, () => runForecast(x.c, k, evidence, opts).then((f) => ({ ...f, model: m }))]));
  return { stage: "score", forecasts, model: m };
}

// A finding as the Evals page shows it: dated, tied to an assumption, with its best source.
function scored(f: Rec): ScoredFinding {
  const sources = [...(f.sources || [])].sort((a: Rec, b: Rec) => (a.tier ?? 3) - (b.tier ?? 3));
  return {
    id: f.id, title: f.title || "", date: f.event_date || String(f.created_date || "").slice(0, 10),
    assumption: f.assumptions_affected?.[0] || f.drivers_affected?.[0] || "", confidence: Number(f.confidence) || 1, materiality: Number(f.materiality) || 1,
    tier: Number(sources[0]?.tier) || 3, source: sources[0]?.outlet || sources[0]?.title || "",
    direction: ["challenged", "under_pressure"].includes(f.effect) ? "Challenges" : "Supports",
  };
}

async function score(x: Ctx): Promise<Rec> {
  const ev = x.ev, c = x.c, model = secret("EVAL_JUDGE_MODEL"), m = model || MODEL;
  const findings = await runFindings(x);
  const opts = { deadline: x.startedAt + BUDGET_MS - 10_000, usage: x.usage, ...(model ? { model } : {}) };
  // judgments._models records which model made each judgment; one made by another model is redone.
  const have: Rec = { ...(ev.judgments || {}), _models: { ...(ev.judgments?._models || {}) } };
  const need = (k: string) => !have[k] || (have._models[k] ?? m) !== m;
  const jobs: [string, () => Promise<unknown>][] = [];
  const job = (k: string, run: () => Promise<unknown>) => { if (need(k)) jobs.push([k, () => run().then((r) => { have._models[k] = m; return r; })]); };
  job("recs_news", () => judgeRecommendations(c, ev.forecasts?.news, { ...opts, label: "news" }));
  job("recs_no_news", () => judgeRecommendations(c, ev.forecasts?.no_news, { ...opts, label: "no-news" }));
  job("findings", () => judgeFindings(c, findings, opts));
  const j = await settle(x, "judgments", have, jobs);
  const news = scoreCondition(c, ev.forecasts.news as Forecast, j.recs_news as RecMatch[]);
  const noNews = scoreCondition(c, ev.forecasts.no_news as Forecast, j.recs_no_news as RecMatch[]);
  const summary = {
    company: c.company, cutoff: c.cutoff, horizon: c.horizon, currency: caseCurrency(c), news, no_news: noNews, gap: gap(news, noNews),
    findings: scoreFindings(findings.map(scored), j.findings as FindingVerdict[]),
    corpus: ev.corpus_stats ?? {}, caveats: c.caveats,
    unchecked_answers: [...c.quarters, ...c.kpis, ...c.questions, ...c.actions].filter((a) => a.check).length,
  };
  return { stage: "done", judgments: j, summary, judge_model: m, finished_at: new Date().toISOString() };
}

const STAGES: Record<string, (x: Ctx) => Promise<Rec>> = { plan, collect, analyze, forecast, score };

export const evalView = (ev: Rec) => ({
  eval_run_id: ev.id, case_key: ev.case_key, stage: ev.stage, done: ev.stage === "done", failed: ev.stage === "failed",
  failed_stage: ev.failed_stage || "", error: ev.error || "",
  collected: ev.corpus_stats?.collected ?? (ev.collected_pairs || []).length, total: ev.corpus_stats?.total ?? null,
});

// One step of a backtest: runs stages until the invocation's time is used up, then returns progress.
export async function runEvalStep(base44: any, user: any, req: Rec, startedAt: number) {
  const E = base44.entities;
  let ev: Rec;
  if (req.eval_run_id) ev = await E.EvalRun.get(req.eval_run_id);
  else {
    const c = EVAL_CASES[req.case_key || "netflix-2023"];
    if (!c) throw new Error(`Unknown eval case "${req.case_key}"`);
    ev = await E.EvalRun.create({ case_key: c.key, cutoff: c.cutoff, stage: "queued", errors: [], usage: [] });
  }
  const c = EVAL_CASES[ev.case_key];
  if (!c) throw new Error(`Unknown eval case "${ev.case_key}"`);
  if (req.retry && ev.stage === "failed") {
    const patch: Rec = { stage: ev.failed_stage || "plan", error: "" };
    if (patch.stage === "collect") { // fetch the failed searches again
      const failed = new Set((ev.corpus_stats?.failed_pairs_all || []).map((f: string) => f.split(": ")[0]));
      patch.collected_pairs = (ev.collected_pairs || []).filter((k: string) => !failed.has(k));
      patch.corpus_stats = { ...(ev.corpus_stats || {}), failed_pairs_all: [] };
    }
    await E.EvalRun.update(ev.id, patch);
    ev = { ...ev, ...patch };
  }
  if (ev.stage === "done" || ev.stage === "failed") return evalView(ev);
  // Another invocation is working on this run (a double click, or an overlapping retry): back off.
  if (ev.lease_until && Date.parse(ev.lease_until) > Date.now()) return { ...evalView(ev), busy: true };
  await E.EvalRun.update(ev.id, { lease_until: new Date(startedAt + 300_000).toISOString() });

  const usage: AgentUsage[] = [];
  let stage = "";
  try {
    for (;;) {
      stage = ev.stage === "queued" ? "plan" : ev.stage;
      if (!STAGES[stage]) break;
      const elapsed = Date.now() - startedAt;
      // The agent pipeline takes a whole invocation, so analysis only starts at the top of one.
      if (stage === "analyze" ? elapsed > 20_000 : elapsed + (NEEDS[stage] ?? 60_000) > BUDGET_MS) break;
      if (ev.stage !== stage) { ev = { ...ev, stage }; await E.EvalRun.update(ev.id, { stage }); }
      const patch = await STAGES[stage]({ base44, user, ev, c, startedAt, usage, req });
      ev = { ...ev, ...patch, usage: [...(ev.usage || []), ...usage.splice(0)].slice(-80) };
      await E.EvalRun.update(ev.id, { ...patch, usage: ev.usage });
      if (stage === "analyze" || !patch.stage || patch.stage === stage) break; // analysis used the time; collect ran out of it
    }
  } catch (e) {
    const msg = (e as Error).message || String(e);
    ev = { ...ev, stage: "failed", failed_stage: stage, error: msg.slice(0, 1000), errors: [...(ev.errors || []), `${stage}: ${msg}`].slice(-20) };
    await E.EvalRun.update(ev.id, { stage: "failed", failed_stage: stage, error: ev.error, errors: ev.errors, usage: [...(ev.usage || []), ...usage].slice(-80) }).catch(() => {});
  } finally {
    await E.EvalRun.update(ev.id, { lease_until: new Date().toISOString() }).catch(() => {});
  }
  return evalView(ev);
}
