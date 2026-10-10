import { type AgentUsage, MODEL, runAgent } from "./agent.ts";
import { profileText } from "./claude.ts";
import { choice, list, obj, str } from "./schema.ts";

// Keyword planner: reads a client's profile and maps the external forces that could make the
// business volatile (memory prices, export rules, customer budgets...), each with news-search
// keywords. Those keywords become the Bright Data searches, so scans watch what moves this client.

export const CATEGORIES = ["company_specific", "pricing_competition", "demand_customers", "input_costs", "supply_chain",
  "regulation_policy", "geopolitics_trade", "labor_talent", "macro_financial", "technology_shifts"] as const;
const SENSITIVITY = ["high", "medium", "low"] as const;
const MAX_KEYWORDS = 200;

export interface Exposure { name: string; category: string; driver: string; why: string; sensitivity: string; keywords: string[] }
export interface KeywordPlan { model: string; keyword_count: number; exposures: Exposure[] }

const PLAN_SCHEMA = obj({
  exposures: list(obj({
    name: str("Short name of the external force, e.g. 'Memory chip prices'"),
    category: choice(CATEGORIES),
    driver: str("The client driver or assumption this force moves; reuse the client's own driver name when one fits"),
    why: str("One sentence on how this force moves the client's revenue, costs or valuation"),
    sensitivity: choice(SENSITIVITY, "How strongly this force can move the client's numbers"),
    keywords: list(str("A news search query of 2 to 6 words"), "4 to 12 search queries for this force"),
  }), "15 to 25 forces, most important first"),
});

const RULES = `You are Finley's monitoring planner. A financial analyst (FP&A) has just entered a client company's profile. Work out which external forces could make this business volatile, up or down, and write the news-search keywords that will watch each force. Every keyword becomes a Google News search, so these keywords decide what the whole system can see.

How to think:
- Start from the client's main products or services and the markets they sell into, then work outward along the value chain: what the client buys and from where, who its customers are and what drives their budgets, who it competes with, and which rules govern each link.
- Include second-order forces, not just obvious ones. For a GPU maker, for example: memory and wafer prices, gold and rare-metal prices, chip export controls, visa rules for engineers, data-centre power limits, hyperscaler capital spending, and competitors' accelerator launches.
- Cover upside as well as downside; a demand boom moves the numbers too.
- Give every assumption and driver in the profile at least one force that watches it.

How to write keywords:
- 2 to 6 words, phrased the way a journalist would put the topic in a headline: "DRAM contract prices", "US chip export controls", "H-1B visa rules", "rare earth export ban", "hyperscaler capex".
- Specific enough to return relevant news, broad enough to return news most weeks. No single generic words, quotes, boolean operators or dates.
- Use names where they matter: the client, its major products and customers, and each named competitor.
- Never repeat a keyword or a near-duplicate across forces.
- Aim for 5 to 20 keywords in total.`;

export async function planKeywords(client: Record<string, any>, opts: { usage?: AgentUsage[]; deadline?: number } = {}): Promise<KeywordPlan> {
  const call = {
    name: "keywords/planner",
    system: RULES,
    schema: PLAN_SCHEMA,
    // Live test on a fictional GPU maker: high found 23 forces / 115 keywords in 55s; xhigh found
    // 24 / 125 in 123s. Same coverage at half the wait, so high it is.
    effort: "high" as const,
    deadline: opts.deadline,
    prompt: `Today is ${new Date().toISOString().slice(0, 10)}.\n\n<client_profile>\n${profileText(client)}\n</client_profile>\n\nMap the forces that could make this business volatile and write the search keywords for each.`,
  };
  // An empty or cut-off answer is rare; one retry with less thinking is cheap insurance.
  const answer = await runAgent<{ exposures: Exposure[] }>(call, opts.usage)
    .catch(() => runAgent<{ exposures: Exposure[] }>({ ...call, effort: "medium" }, opts.usage));
  return { model: MODEL, ...normalizePlan(answer.exposures || []) };
}

// Identifies the profile version a plan was built from, so a plan is rebuilt only when the analyst
// changes what they entered. The pipeline's own writes (assumption statuses, notes, last_run_at) and
// the financial numbers are left out: they don't change which forces to watch.
export async function profileFingerprint(client: Record<string, any>): Promise<string> {
  const basis = JSON.stringify([client.name, client.industry, client.business_model, client.revenue_streams,
    client.cost_structure, client.financial_drivers, client.strategic_objectives, client.competitors || [],
    (client.assumptions || []).map((a: any) => [a.text, a.driver])]);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(basis)));
  return [...digest.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const canon = (value: string, allowed: readonly string[], fallback: string) =>
  allowed.find((a) => a === (value || "").trim().toLowerCase()) ?? fallback;

// Turns a model-written keyword into a clean search query, or "" if it's unusable.
export function cleanKeyword(raw: string): string {
  const q = (raw || "").replace(/["“”`]/g, "").replace(/\b(AND|OR|NOT)\b|[()]/g, " ").replace(/\s+/g, " ").trim();
  return q.length >= 3 && q.split(" ").length <= 8 ? q : "";
}

// Drops unusable and duplicate keywords (ignoring case) across the whole plan, keeps forces in the
// model's priority order, and stops at 200 keywords so later, lower-priority forces are trimmed first.
export function normalizePlan(exposures: Exposure[]): { keyword_count: number; exposures: Exposure[] } {
  const seen = new Set<string>();
  const cleaned = exposures.filter((e) => (e.name || "").trim()).map((e) => ({
    name: e.name.trim(),
    category: canon(e.category, CATEGORIES, "company_specific"),
    driver: (e.driver || "").trim(),
    why: (e.why || "").trim().slice(0, 240), // keeps a 200-keyword plan well under Base44's 20K-char field cap
    sensitivity: canon(e.sensitivity, SENSITIVITY, "medium"),
    keywords: (e.keywords || []).map(cleanKeyword).filter((k) => {
      const key = k.toLowerCase();
      if (!k || seen.has(key) || seen.size >= MAX_KEYWORDS) return false;
      seen.add(key);
      return true;
    }),
  })).filter((e) => e.keywords.length);
  return { keyword_count: seen.size, exposures: cleaned };
}
