import { type AgentUsage, runAgent } from "../../shared/agent.ts";
import { profileText } from "../../shared/claude.ts";
import { effectOf, hasFinancials, impliedPrice, leversFor, r1, r2 } from "../../shared/finance.ts";
import { snapshotText } from "../../shared/market.ts";
import { canon, choice, list, obj, str } from "../../shared/schema.ts";
import { IMPACT_FIELDS, PNL_LINES } from "./company.ts";
import { type CheckedDevelopment, renderDevelopments } from "./evidence.ts";
import { type Quantified, renderCandidates } from "./impacts.ts";

// Scenario agent (round 3, alongside the company lead): what-if questions the analyst could ask next,
// each written as impact inputs so code can answer it at once, plus downside/central/upside story lines.
// The agent writes no figures; every answer below is computed with finance.ts.

interface Question { question: string; why_now: string; kind: string; development_ids: string[]; pnl_line: string; shock_pct: number; exposure_pct: number; pass_through_pct: number; persistence: string; duration_quarters: number }
export interface ScenarioOutput { questions: Question[]; stories: { downside: string; central: string; upside: string; signposts: string[] } }

const SCENARIO_SCHEMA = obj({
  questions: list(obj({
    question: str("A what-if naming the metric, e.g. 'What happens to EBITDA and the share price if DRAM prices fall 20% for two quarters?'"),
    why_now: str("One sentence tying it to today's evidence"),
    kind: choice(["evidence_sized", "stress", "upside"]),
    development_ids: list(str()),
    ...IMPACT_FIELDS,
  }), "5 to 8 questions: sizes seen in the evidence, plus one or two stress cases"),
  stories: obj({
    downside: str("2 sentences: how things play out if the adverse effects dominate"),
    central: str("2 sentences: the most likely path"),
    upside: str("2 sentences: how things play out if the favourable effects dominate"),
    signposts: list(str(), "At most 4 early signs of which path is unfolding"),
  }),
});

const RULES = `You are the scenario analyst on Finley's company team. Suggest the what-if questions a financial analyst (FP&A) should explore next for this client, and sketch the downside, central and upside stories. Code computes every answer, so express each question as impact inputs (the same kind as the impact candidates) and never write money figures yourself.
- Ground each question in today's evidence: use magnitudes the developments report, plus one or two stress cases.
- Name the metric in each question: EBITDA or margin; enterprise value only if the profile gives an EV/EBITDA multiple; share price only for a listed client.
- Don't repeat the questions the analyst has already asked.
- Plain English; never put ids in prose fields.`;

// Only called for a client with financials: without them no answer can be computed.
export function runScenarioAgent(input: { client: Record<string, any>; today: string; market: { snapshot: any; note: string }; developments: CheckedDevelopment[];
  candidates: Quantified[]; challenged: string[]; asked: string[] }, opts: { deadline: number; usage: AgentUsage[] }) {
  return runAgent<ScenarioOutput>({
    name: "scenario/designer", system: RULES, schema: SCENARIO_SCHEMA, deadline: opts.deadline,
    prompt: `Today is ${input.today}.\n\n<client_profile>\n${profileText(input.client)}\n</client_profile>\n\n<market_data>\n${snapshotText(input.market)}\n</market_data>\n\n<developments>\n${renderDevelopments(input.developments)}\n</developments>\n\n<impact_candidates>\n${renderCandidates(input.candidates)}\n</impact_candidates>\n\n<challenged_assumptions>\n${input.challenged.join("\n") || "none"}\n</challenged_assumptions>\n\n<already_asked>\n${input.asked.join("\n") || "none"}\n</already_asked>\n\nWrite the questions and the three stories.`,
  }, opts.usage);
}

// Answers each question with the same maths as the impact candidates, and drafts it in the Scenario
// entity's shape so a future "save this scenario" button can store it as is.
export function answerQuestions(client: Record<string, any>, market: { snapshot: any }, questions: Question[], titleOf: (id: string) => string) {
  const valued = client.ev_ebitda_multiple > 0; // no multiple entered: no enterprise value or share price to give
  const listed = valued && market.snapshot && market.snapshot.close > 0;
  return (questions || []).slice(0, 8).map((q) => {
    const pnl_line = canon(q.pnl_line, PNL_LINES, "cogs");
    const persistent = canon(q.persistence, ["persistent"], "transitory") === "persistent";
    const quarters = persistent ? 4 : Math.min(8, Math.max(1, Math.round(Number(q.duration_quarters) || 1)));
    const levers = leversFor(client, { pnl_line, shock_pct: q.shock_pct, exposure_pct: q.exposure_pct, pass_through_pct: q.pass_through_pct });
    const e = effectOf(client, levers, quarters);
    const ev_pct = persistent ? e.ev_persistent_pct : e.ev_transitory_pct;
    const lasts = persistent ? "Persistent" : `Transitory for ${quarters} quarter${quarters > 1 ? "s" : ""}`;
    const answer = hasFinancials(client) ? {
      revenue: r2(e.scenario.revenue), ebitda: r2(e.scenario.ebitda), ebitda_delta: e.ebitda_delta, ebitda_pct: e.ebitda_pct,
      gross_margin_pct: r1(e.scenario.gross_margin_pct), ebitda_margin_pct: r1(e.scenario.ebitda_margin_pct),
      ev_delta: valued ? (persistent ? e.ev_persistent : e.ev_transitory) : null, ev_pct: valued ? ev_pct : null,
      implied_share_price: listed ? impliedPrice(market.snapshot.close, ev_pct) : null,
      basis: !valued ? `${lasts}. No EV/EBITDA multiple entered, so no enterprise value or share price.` : `${persistent ? "Persistent: EV at the constant multiple" : `${lasts}: EV moves by the EBITDA earned meanwhile`}${listed ? `; share price from the ${market.snapshot.close_date} close of ${market.snapshot.close}, assuming net debt is small` : ""}.`,
    } : null;
    return { ...q, pnl_line, answer, scenario_draft: { question: q.question, narrative: q.why_now, ...levers,
      lever_rationale: `${q.shock_pct}% on ${q.exposure_pct}% of ${pnl_line}${pnl_line === "cogs" && q.pass_through_pct ? `, ${q.pass_through_pct}% passed on to prices` : ""}`, evidence: (q.development_ids || []).map(titleOf).filter(Boolean), risks: [] } };
  });
}
