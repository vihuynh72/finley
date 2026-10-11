import type { AgentUsage } from "../../shared/agent.ts";
import { companyMarket } from "../../shared/market.ts";
import { sendAlertEmail } from "./alert.ts";
import { buildBriefing } from "./briefing.ts";
import { buildCharts, buildScenarios } from "./charts.ts";
import { runCompanyTeam } from "./company.ts";
import { buildCorpus, coverageNote, marketContext, type RawArticle, type Search } from "./corpus.ts";
import { checkResearch } from "./evidence.ts";
import { buildFindings, updateAssumptions } from "./findings.ts";
import { quantifyCandidates } from "./impacts.ts";
import { runCompanyLead } from "./lead.ts";
import { buildMarketPicture } from "./picture.ts";
import { runResearchSwarm } from "./research.ts";
import { answerQuestions, runScenarioAgent } from "./scenario.ts";

// The agent pipeline after Bright Data collection: three rounds of agents, everything else in code.
//   Round 1  research swarm (3 agents) + stock snapshot + the client's earlier findings and questions
//   Round 2  research lead (market picture)  |  company team (thesis tester, impact estimator)
//   Round 3  company lead (findings, outlook)  |  scenario agent (what-if questions)
// Each round has a deadline so the run ends well inside Base44's 5-minute limit.
//
// startedAt is the stopwatch for that limit; asOf (default startedAt) is the moment the run reasons
// from: "today" in prompts, market data, recent findings. A backtest (eval/stages.ts) passes a past
// asOf and backtest: true, which also skips earlier findings, saved questions and alert emails, since
// those come from after the cutoff.

const FINISH_BY_MS = 270_000; // after the handler started, leaving time for the final writes

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
    companyMarket(client, new Date(asOf)),
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
    const [pic, team] = await Promise.all([
      soft("research lead", buildMarketPicture(research, marketContext(client), corpus.today, { deadline: within(90_000), usage }), null),
      runCompanyTeam(research, client, market, corpus.today, { deadline: within(90_000), usage }),
    ]);
    picture = pic; thesis = team.thesis;
    errors.push(...team.failed);
    const developments = picture?.developments ?? research.developments;
    candidates = quantifyCandidates(client, team.impacts.candidates, new Set(developments.map((d: any) => d.id)), picture?.merged_into ?? {});
    await base44.entities.Run.update(run_id, { stage: "scenario" });
    const challenged = (thesis.ledger || []).filter((l: any) => l.challenging_ids?.length)
      .map((l: any) => `${client.assumptions?.[l.assumption_index]?.text ?? "?"}: ${l.strongest_counterpoint}`);
    // Round 3 may use all the time left. The lead runs at high: in a live test xhigh couldn't finish in 110s.
    [lead, scenario] = await Promise.all([
      soft("company lead", runCompanyLead({ client, today: corpus.today, market, developments, picture, thesis, candidates, prior }, { deadline: stopAt, usage, effort: "high" }), null),
      soft("scenario agent", runScenarioAgent({ client, today: corpus.today, market, candidates, challenged, asked }, { deadline: stopAt, usage }), null),
    ]);
  }

  const developments = picture?.developments ?? research.developments, mergedInto = picture?.merged_into ?? {};
  const built = buildFindings({ findings: lead?.findings ?? [], developments, mergedInto, candidates, articles: corpus.articles,
    ledger: thesis.ledger, client, run_id, today: corpus.today, prior });
  const created = built.records.length ? await base44.entities.Finding.bulkCreate(built.records) : [];
  const saved = Array.isArray(created) && created.length === built.records.length ? created : built.records;
  const assumptions = updateAssumptions(client, thesis.ledger, developments, mergedInto, corpus.today);
  await base44.entities.Client.update(client.id, { assumptions, last_run_at: new Date().toISOString() });

  // Findings are saved, so from here a failure ends the run as done, with the briefing marked partial.
  let briefing_id = "";
  try {
    const used = candidates.filter((c) => built.candidate_ids.includes(c.id));
    const titleOf = (id: string) => developments.find((d: any) => d.id === (mergedInto[id] || id))?.title ?? "";
    const alert_email = ctx.backtest
      ? { status: "skipped_backtest", to: "", subject: "", sent_at: "", finding_ids: [], error: "" }
      : await sendAlertEmail(base44, ctx.user?.email, client, saved.filter((f: any) => f.is_alert), market, coverageNote(corpus));
    if (alert_email.status === "failed") errors.push(`alert email: ${alert_email.error}`);
    const briefing = await base44.entities.Briefing.create(buildBriefing({
      client, run_id, startedAt: ctx.startedAt, asOf, corpus, research, market, picture, thesis, lead, assumptions, saved, ongoing: built.ongoing, dropped: built.dropped,
      scenarios: buildScenarios(client, used, market.snapshot, scenario?.stories ?? null), questions: answerQuestions(client, market, scenario?.questions ?? [], titleOf),
      charts: buildCharts(client, saved, assumptions), alert_email, usage, errors,
    }));
    briefing_id = briefing.id;
  } catch (e) {
    errors.push(`briefing: ${(e as Error).message}`);
  }
  await base44.entities.Run.update(run_id, { stage: "done", findings_count: saved.length, ...(briefing_id ? { briefing_id } : {}) });
  return { ok: true, findings: saved.length, briefing_id, errors };
}
