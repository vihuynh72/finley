import type { AgentUsage } from "../../shared/agent.ts";
import { hasFinancials } from "../../shared/finance.ts";
import { companyMarket } from "../../shared/market.ts";
import { sendAlertEmail } from "./alert.ts";
import { buildBriefing } from "./briefing.ts";
import { buildCharts, buildScenarios } from "./charts.ts";
import { runCompanyTeam } from "./company.ts";
import { buildCorpus, coverageNote, marketContext, type RawArticle, type Search } from "./corpus.ts";
import { checkResearch } from "./evidence.ts";
import { buildAdvice, buildFindings, resolveOutcomes, updateAssumptions } from "./findings.ts";
import { quantifyCandidates } from "./impacts.ts";
import { runCompanyLead } from "./lead.ts";
import { buildMarketPicture } from "./picture.ts";
import { runResearchSwarm } from "./research.ts";
import { answerQuestions, runScenarioAgent } from "./scenario.ts";

// The agent pipeline after Bright Data collection: three rounds of agents, everything else in code.
//   Round 1  research swarm (3 agents) + stock snapshot + the client's earlier findings and questions
//   Round 2  research lead (market picture)  |  company team (thesis tester, impact estimator)
//   Round 3  company lead (findings, outlook)  |  scenario agent (what-if questions; only with financials)
// Each round has a deadline so the run ends well inside Base44's 5-minute limit.
//
// startedAt is the stopwatch for that limit; asOf (default startedAt) is the moment the run reasons
// from: "today" in prompts, market data, recent findings. A backtest (eval/stages.ts) passes a past
// asOf and backtest: true, which also skips earlier findings, saved questions, alert emails and stock
// market data, since those come from after the cutoff.

const FINISH_BY_MS = 270_000; // after the handler started, leaving time for the final writes
// Yahoo's history is adjusted for every later stock split, so a past close can be far from the price
// quoted at the time (and would hint at the split). Backtests leave market data out.
const BACKTEST_MARKET_NOTE = "Stock market data is not available for this date; use the share price in the client's public facts, if any.";

export async function runAgentPipeline(ctx: { base44: any; user: any; run_id: string; client: Record<string, any>; searches: Search[];
  results: PromiseSettledResult<RawArticle[]>[]; articles: RawArticle[]; startedAt: number; asOf?: number; backtest?: boolean }) {
  const { base44, client, run_id } = ctx;
  const usage: AgentUsage[] = [], errors: string[] = [];
  const stopAt = ctx.startedAt + FINISH_BY_MS;
  const within = (ms: number) => Math.min(Date.now() + ms, stopAt);
  const soft = <T>(label: string, work: Promise<T>, fallback: T) => work.catch((e) => { errors.push(`${label}: ${e.message}`); return fallback; });
  const asOf = ctx.asOf ?? ctx.startedAt;
  const corpus = buildCorpus(client, ctx.searches, ctx.results, ctx.articles, new Date(asOf));
  const monthAgo = new Date(asOf - 30 * 86_400_000).toISOString();

  // Round 1. The research swarm throws only if all three agents fail, which fails the run.
  const [swarm, market, prior, asked] = await Promise.all([
    runResearchSwarm(corpus, client, { deadline: within(100_000), usage }),
    ctx.backtest ? Promise.resolve({ snapshot: null, note: BACKTEST_MARKET_NOTE }) : companyMarket(client, new Date(asOf)),
    ctx.backtest ? [] : soft("earlier findings", base44.entities.Finding.filter({ client_id: client.id }, { sort: "-created_date", limit: 30 })
      .then((p: any) => (p.items || []).filter((f: any) => (f.created_date || "") >= monthAgo)), []),
    ctx.backtest ? [] : soft("saved scenarios", base44.entities.Scenario.filter({ client_id: client.id }, { sort: "-created_date", limit: 20 })
      .then((p: any) => (p.items || []).map((s: any) => s.question).filter(Boolean)), []),
  ]);
  const research = checkResearch(corpus, swarm);
  errors.push(...research.failed_agents);
  const empty = { ledger: [], profile_checks: [] };
  let picture: any = null, thesis: any = empty, lead: any = null, scenario: any = null, candidates: any[] = [];

  // Nothing material found: skip rounds 2 and 3 rather than spend tokens on an empty scan.
  if (research.developments.length) {
    await base44.entities.Run.update(run_id, { stage: "company" });
    // Round 2 must end early enough to leave round 3 (the findings) a real window; a slow collection
    // plus a full round 2 used to leave the lead only seconds, and the run finished with nothing.
    const r2Deadline = Math.min(Date.now() + 90_000, stopAt - 75_000);
    const [pic, team] = await Promise.all([
      soft("research lead", buildMarketPicture(research, marketContext(client), corpus.today, { deadline: r2Deadline, usage }), null),
      runCompanyTeam(research, client, market, corpus.today, { deadline: r2Deadline, usage }),
    ]);
    picture = pic; thesis = team.thesis;
    errors.push(...team.failed);
    const developments = picture?.developments ?? research.developments, mergedInto = picture?.merged_into ?? {};
    candidates = quantifyCandidates(client, team.impacts.candidates, new Set(developments.filter((d: any) => d.grounded).map((d: any) => d.id)), mergedInto);
    await base44.entities.Run.update(run_id, { stage: "scenario" });
    const challenged = (thesis.ledger || []).filter((l: any) => l.challenging_ids?.length)
      .map((l: any) => `${client.assumptions?.[l.assumption_index]?.text ?? "?"}: ${l.strongest_counterpoint}`);
    // Round 3 may use all the time left. The lead runs at high: in a live test xhigh couldn't finish in 110s.
    // Without financials no what-if can be answered, so the scenario agent is skipped rather than paid for.
    [lead, scenario] = await Promise.all([
      soft("company lead", runCompanyLead({ client, today: corpus.today, market, developments, mergedInto, picture, thesis, candidates, prior }, { deadline: stopAt, usage, effort: "high" }), null),
      hasFinancials(client) ? soft("scenario agent", runScenarioAgent({ client, today: corpus.today, market, developments, candidates, challenged, asked }, { deadline: stopAt, usage }), null) : null,
    ]);
  }

  const developments = picture?.developments ?? research.developments, mergedInto = picture?.merged_into ?? {};
  const built = buildFindings({ findings: lead?.findings ?? [], developments, mergedInto, candidates, articles: corpus.articles,
    ledger: thesis.ledger, client, run_id, today: corpus.today, prior });
  const advice = buildAdvice({ advice: lead?.advice ?? [], developments, mergedInto, candidates, articles: corpus.articles });
  const created = built.records.length ? await base44.entities.Finding.bulkCreate(built.records) : [];
  const saved = Array.isArray(created) && created.length === built.records.length ? created : built.records;

  // Close the loop: outcomes the lead judged against today's news are written back onto the earlier
  // findings they settle, so the dashboard's track record grows as scans run.
  try {
    for (const o of resolveOutcomes(lead?.outcomes ?? [], prior, developments, mergedInto)) {
      await base44.entities.Finding.update(o.id, { outcome: o.outcome, outcome_at: corpus.today, outcome_source: "pipeline", outcome_reason: o.reason });
    }
  } catch (e) {
    errors.push(`outcomes: ${(e as Error).message}`);
  }

  // Findings are saved, so from here a failure no longer fails the run: it is recorded and the briefing
  // is marked partial (a failed run would hide saved findings, and the next run would skip them as repeats).
  let assumptions: Record<string, any>[] = client.assumptions || [];
  try {
    const computed = updateAssumptions(client, thesis.ledger, developments, mergedInto, corpus.today);
    // The analyst may edit the profile while a run is in flight: updateAssumptions returns a new object
    // only where it wrote a status, so apply just status+note onto a fresh copy matched by text. An
    // assumption whose text changed keeps the analyst's version; its status is retried next run.
    const fresh = await soft("client re-read", base44.entities.Client.get(client.id), client);
    assumptions = (fresh.assumptions || []).map((a: any, i: number) =>
      computed[i] !== client.assumptions?.[i] && computed[i]?.text === a.text ? { ...a, status: computed[i].status, note: computed[i].note } : a);
    await base44.entities.Client.update(client.id, { assumptions, last_run_at: new Date().toISOString() });
  } catch (e) {
    errors.push(`assumptions: ${(e as Error).message}`);
  }
  let briefing_id = "";
  try {
    const titleOf = (raw: string) => { const id = String(raw).trim().toUpperCase(); return developments.find((d: any) => d.id === (mergedInto[id] || id))?.title ?? ""; };
    const alert_email = ctx.backtest
      ? { status: "skipped_backtest", to: "", subject: "", sent_at: "", finding_ids: [], error: "" }
      : await sendAlertEmail(base44, ctx.user?.email, client, saved.filter((f: any) => f.is_alert), market, coverageNote(corpus));
    if (alert_email.status === "failed") errors.push(`alert email: ${alert_email.error}`);
    const briefing = await base44.entities.Briefing.create(buildBriefing({
      client, run_id, startedAt: ctx.startedAt, asOf, corpus, research, market, picture, thesis, lead, assumptions, advice, saved, ongoing: built.ongoing, dropped: built.dropped,
      scenarios: buildScenarios(client, candidates.filter((c) => c.quantified), market.snapshot, scenario?.stories ?? null), questions: answerQuestions(client, market, scenario?.questions ?? [], titleOf),
      charts: buildCharts(client, saved, assumptions), alert_email, usage, errors,
    }));
    briefing_id = briefing.id;
  } catch (e) {
    errors.push(`briefing: ${(e as Error).message}`);
  }
  // The lead alone writes findings: if it failed on a scan with news, say so, rather than show "Briefing
  // ready" with nothing new, which the analyst would read as a quiet news day. Other problems leave the
  // run done (its findings are saved) with the error saying what went wrong.
  const leadFailed = !lead && research.developments.length > 0;
  await base44.entities.Run.update(run_id, { stage: leadFailed ? "failed" : "done", findings_count: saved.length, ...(briefing_id ? { briefing_id } : {}),
    ...(leadFailed ? { error: errors.find((e) => e.startsWith("company lead")) ?? "company lead failed" }
      : errors.length ? { error: `Finished with problems: ${errors.join(" | ")}`.slice(0, 900) } : {}) });
  return { ok: !leadFailed, findings: saved.length, briefing_id, errors };
}
