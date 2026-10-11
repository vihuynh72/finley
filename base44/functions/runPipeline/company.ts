import { type AgentUsage, runSwarm } from "../../shared/agent.ts";
import { profileText } from "../../shared/claude.ts";
import { snapshotText } from "../../shared/market.ts";
import { choice, int, list, num, obj, score, str } from "../../shared/schema.ts";
import { type CheckedResearch, renderDevelopments } from "./evidence.ts";
import { UI_TOPICS } from "./research.ts";

// Company team (round 2, alongside the research lead): two agents, because two short answers in
// parallel finish sooner than one long one. The thesis tester checks the client's own assumptions and
// profile against the evidence; the impact estimator sizes how developments reach the numbers.

// Impact inputs shared with the scenario agent's what-if questions. Code turns them into model levers.
export const PNL_LINES = ["cogs", "price", "volume", "opex", "valuation"] as const;
export const IMPACT_FIELDS = {
  pnl_line: choice(PNL_LINES, "The P&L line the shock lands on"),
  shock_pct: num("Signed percent change in the driver versus plan, central case: -20 means it falls 20%. Measure against plan: spending that grows 25% instead of a planned 30% is about -4% versus plan, not -25%"),
  exposure_pct: num("Percent of that P&L line exposed, e.g. 25 if memory is 25% of COGS; 100 for the whole line"),
  pass_through_pct: num("For pnl_line cogs only: percent of the cost change passed on to customer prices; 0 for every other line"),
  persistence: choice(["transitory", "persistent"]),
  duration_quarters: int("Quarters the effect lasts if transitory, 1 to 8"),
};

const THESIS_SCHEMA = obj({
  ledger: list(obj({
    assumption_index: int("The [n] index of the assumption in the profile"),
    challenging_ids: list(str(), "Developments that cut against it; look for these first"),
    supporting_ids: list(str(), "Developments that support it"),
    strongest_counterpoint: str("The strongest evidence or argument against it, even if it holds; '' if none"),
    note: str("At most 120 characters for the analyst, naming the outlet and date of the key evidence; '' if none"),
    signpost: str("What to watch that would confirm or break it"),
  }), "Exactly one entry per assumption in the profile"),
  profile_checks: list(obj({
    profile_area: choice(["business_model", "revenue_streams", "cost_structure", "financial_drivers", "strategic_objectives", "competitors", "financials"]),
    relation: choice(["consistent", "contradicts", "new_information", "profile_may_be_stale"]),
    finding: str("What the news says, attributed to its outlet and date"),
    development_ids: list(str()),
    implication: str("One sentence on what it means for the profile or plan"),
  }), "Where the news bears on what the analyst entered; at most 6, most important first"),
});

const IMPACTS_SCHEMA = obj({
  candidates: list(obj({
    development_ids: list(str()),
    topic: choice(Object.keys(UI_TOPICS), "The one dashboard topic this belongs to"),
    driver: str("The client driver it moves, written exactly as in the profile's assumptions when one fits"),
    assumption_indexes: list(int(), "[n] indexes of the assumptions it bears on"),
    effect: choice(["favorable", "adverse", "mixed"]),
    mechanism: str("One sentence: how the development reaches the client's numbers"),
    estimate: choice(["quantified", "insufficient_evidence"], "insufficient_evidence when it can't be expressed with these inputs; then leave numbers at 0"),
    ...IMPACT_FIELDS,
    shock_min_pct: num("Lower end of the plausible shock range"), shock_max_pct: num("Upper end of the plausible shock range"),
    shock_basis: choice(["article", "assumed"]), exposure_basis: choice(["profile", "article", "assumed"]),
    likelihood: score("Chance it reaches the client over the horizon: 1 under 10%, 2 10-30%, 3 30-50%, 4 50-80%, 5 over 80%"),
    horizon: choice(["this_quarter", "next_two_quarters", "within_a_year", "longer"]),
  }), "One per development or group of developments that could move a financial driver; at most 8; empty is fine"),
});

const SHARED = `Rules for the whole company team:
- Use only the developments, profile and market data provided, and cite development ids. A development with source_check="failed" did not match its source, so treat it as weak.
- Flag, never decide: you never edit the client's assumptions or plan; the analyst does.
- Be concise and specific. Never put ids in prose fields.`;

const THESIS_RULES = `You are the thesis tester on Finley's company team, supporting a financial analyst (FP&A) who advises the client below. Test the client's own assumptions and profile against today's evidence and the latest market data.
- For each assumption, look for evidence against it first, then for it, and give the strongest counterpoint even when it holds up.
- Compare news about the company itself with what the analyst entered: contradictions, new information, and places where the profile may be out of date.
${SHARED}`;

const IMPACT_RULES = `You are the impact estimator on Finley's company team. For each development that could move one of the client's financial drivers, estimate the inputs of an illustrative impact: which P&L line, how big a shock, how exposed the client is, how much it can pass on to customers, and how long it lasts. Code computes the money; never calculate revenue, EBITDA or value yourself.
- Treat favourable and adverse effects with equal care.
- Use the magnitude a development reports as the central shock (shock_basis article), including its figures. If no development reports a size, mark the candidate insufficient_evidence: an assumed size would be an invented number, and code shows no impact for it.
- Bracket the central shock with shock_min_pct and shock_max_pct: how differently it could plausibly land for this client, e.g. only part of a price rise reaching its contracts, a partial reversal, or a further move. Code builds the downside and upside cases from these ends, so don't collapse them onto the central value unless the outcome is truly fixed.
- Take exposure from the profile's cost structure or revenue mix when stated (exposure_basis profile); otherwise assume cautiously.
- Cyclical prices are usually transitory. If a mechanism can't be expressed with these inputs, mark it insufficient_evidence rather than force a number.
${SHARED}`;

export async function runCompanyTeam(research: CheckedResearch, client: Record<string, any>, market: { snapshot: any; note: string }, today: string, opts: { deadline: number; usage: AgentUsage[] }) {
  const context = `Today is ${today}.\n\n<client_profile>\n${profileText(client)}\n</client_profile>\n\n<market_data>\n${snapshotText(market)}\n</market_data>\n\n<developments>\n${renderDevelopments(research.developments)}\n</developments>`;
  const team = await runSwarm<any>([
    { name: "company/thesis", system: THESIS_RULES, schema: THESIS_SCHEMA, deadline: opts.deadline, prompt: `${context}\n\nTest every assumption and the profile against this evidence.` },
    { name: "company/impacts", system: IMPACT_RULES, schema: IMPACTS_SCHEMA, deadline: opts.deadline, prompt: `${context}\n\nEstimate the impact inputs for each development that could move a financial driver.` },
  ], opts.usage).catch((e) => ({ ok: [], failed: [String(e.message)] }));
  const get = (name: string) => team.ok.find((r) => r.name === name)?.data;
  return { thesis: get("company/thesis") ?? { ledger: [], profile_checks: [] }, impacts: get("company/impacts") ?? { candidates: [] }, failed: team.failed };
}
