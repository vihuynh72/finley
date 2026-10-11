import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { secrets } from "base44:runtime";
import { claudeJSON, profileText } from "../../shared/claude.ts";
import { searchNews } from "../../shared/brightdata.ts";
import { runEvalStep } from "./eval/stages.ts";
import { planSearches } from "./searches.ts";
import { runAgentPipeline } from "./pipeline.ts";

const AGENTS = {
  competition: "competitive developments: launches, pricing changes, funding, M&A, partnerships, substitutes",
  market: "market opportunities: demand shifts, industry growth, new segments, enabling technologies",
  risk: "financial, regulatory, geopolitical, supply-chain and financing risks",
};

export default async function (req) {
  const startedAt = Date.now(); // the run's as-of moment, and the clock for Base44's 5-minute limit
  const base44 = createClientFromRequest(req);
  let run_id;
  try {
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    // Backtests (Evals page): { eval: { case_key } } starts one, { eval: { eval_run_id } } advances it.
    if (body.eval) return Response.json(await runEvalStep(base44, user, body.eval, startedAt));
    run_id = body.run_id;
    const run = await base44.entities.Run.get(run_id);
    const client = await base44.entities.Client.get(run.client_id);
    // A backtest client is frozen at its cutoff; a live scan would mix today's news into it.
    if (client.eval_case) throw new Error("This is a backtest client. Run it from the Evals page.");
    // One scan per client at a time: a second one would save the same findings and send the same alerts.
    const others = await base44.entities.Run.filter({ client_id: client.id }, { sort: "-created_date", limit: 5 }).catch(() => null);
    const busy = (others?.items || []).find((r) => r.id !== run_id && !["done", "failed"].includes(r.stage) && Date.now() - Date.parse(r.created_date) < 6 * 60_000);
    if (busy) throw new Error("Another scan for this client is still running. Wait for it to finish.");
    const profile = profileText(client);

    // 1. Collection via Bright Data
    await base44.entities.Run.update(run_id, { stage: "collecting" });
    // Searches come from the client's latest keyword plan (planKeywords); no plan means the original fixed list.
    const plans = await base44.entities.KeywordPlan.filter({ client_id: client.id }, { sort: "-created_date", limit: 1 }).catch(() => null);
    const searches = planSearches(client, plans?.items?.[0]);
    const queries = searches.map((s) => s.query);
    const results = await Promise.allSettled(queries.map((q) => searchNews(q)));
    const seen = new Set();
    const articles = results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])).filter((a) => a.url && !seen.has(a.url) && seen.add(a.url));
    if (!articles.length) throw new Error("No articles collected: " + results.map((r) => r.reason?.message).filter(Boolean).join(" | "));
    await base44.entities.Run.update(run_id, { stage: "research", articles_count: articles.length });
    // The agent pipeline (pipeline.ts) runs from here. Setting the PIPELINE_V1 secret to "1" rolls back
    // to the original pipeline below.
    if (secrets.get("PIPELINE_V1") !== "1") {
      return Response.json(await runAgentPipeline({ base44, user, run_id, client, searches, results, articles, startedAt }));
    }
    const corpus = articles.map((a, i) => `[${i}] ${a.title} — ${a.source} ${a.date}\n${a.snippet}`).join("\n");

    // 2. Research agent team (parallel specialists)
    const research = await Promise.all(Object.entries(AGENTS).map(async ([agent, focus]) => {
      const r = await claudeJSON(
        `You are a research agent specializing in ${focus}. Only use the provided articles. Separate observed facts from interpretation.`,
        `Context company:\n${profile}\n\nArticles:\n${corpus}\n\nReturn JSON {developments: [{title, fact, interpretation, source_ids: [article indexes]}]} with up to 4 developments relevant to your specialty.`
      );
      return (r.developments || []).map((d) => ({ ...d, agent }));
    }));
    const developments = research.flat();

    // 3. Company-focused thesis analyst
    await base44.entities.Run.update(run_id, { stage: "company" });
    const devText = developments.map((d, i) => `[${i}] (${d.agent}) ${d.title}\nFact: ${d.fact}\nInterpretation: ${d.interpretation}`).join("\n\n");
    const analysis = await claudeJSON(
      "You are the thesis-aware central analyst. Deduplicate developments, weigh conflicting evidence, and connect each to the company's financial drivers and assumptions. Actively look for evidence that CHALLENGES the thesis. Score materiality, confidence, urgency 1-5 using explicit criteria: materiality = potential effect on revenue/margins/cash; confidence = source reliability and corroboration; urgency = how soon action may be needed.",
      `${profile}\n\nDevelopments:\n${devText}\n\nReturn JSON {findings: [{dev_index, title, why_it_matters, drivers_affected: [strings], assumption_effects: [{index, effect: "supported"|"challenged"|"under_review", note}], next_step, uncertainty, materiality, confidence, urgency}], keep only material ones, max 8}.`,
      6000
    );
    const findings = analysis.findings || [];

    // 4. Scenario agent team: illustrative impacts
    await base44.entities.Run.update(run_id, { stage: "scenario" });
    const scen = await claudeJSON(
      "You are a scenario agent. Estimate ILLUSTRATIVE financial impacts only where evidence is sufficient; otherwise return null impact. Never overstate.",
      `${profile}\n\nFindings:\n${findings.map((f, i) => `[${i}] ${f.title}: ${f.why_it_matters}`).join("\n")}\n\nReturn JSON {impacts: [{finding_index, revenue_pct, cost_pct, margin_pts, cash_flow_pct, rationale} or with null numbers if insufficient]}.`
    );
    const impacts = {};
    (scen.impacts || []).forEach((x) => { impacts[x.finding_index] = x; });

    // 5. Persist findings, alerts, assumption statuses
    const records = findings.map((f, i) => {
      const d = developments[f.dev_index] || {};
      const sources = (d.source_ids || []).map((id) => articles[id]).filter(Boolean).map((a) => ({ title: `${a.title} (${a.source})`, url: a.url, date: a.date }));
      const m = f.materiality || 1, c = f.confidence || 1, u = f.urgency || 1;
      const imp = impacts[i];
      return {
        client_id: client.id, run_id, agent: d.agent, title: f.title, fact: d.fact, interpretation: d.interpretation,
        why_it_matters: f.why_it_matters, drivers_affected: f.drivers_affected || [],
        assumptions_affected: (f.assumption_effects || []).map((e) => client.assumptions?.[e.index]?.text).filter(Boolean),
        next_step: f.next_step, uncertainty: f.uncertainty, materiality: m, confidence: c, urgency: u,
        priority: m * c * u, is_alert: m >= 4 && c >= 3 && u >= 4, sources,
        impact: imp && imp.revenue_pct != null ? imp : undefined, review_status: "pending",
      };
    });
    if (records.length) await base44.entities.Finding.bulkCreate(records);

    const assumptions = [...(client.assumptions || [])];
    findings.forEach((f) => (f.assumption_effects || []).forEach((e) => {
      if (assumptions[e.index]) assumptions[e.index] = { ...assumptions[e.index], status: e.effect, note: e.note };
    }));
    await base44.entities.Client.update(client.id, { assumptions, last_run_at: new Date().toISOString() });
    await base44.entities.Run.update(run_id, { stage: "done", findings_count: records.length });
    return Response.json({ ok: true, findings: records.length });
  } catch (error) {
    if (run_id) await base44.entities.Run.update(run_id, { stage: "failed", error: error.message });
    return Response.json({ error: error.message }, { status: 500 });
  }
}