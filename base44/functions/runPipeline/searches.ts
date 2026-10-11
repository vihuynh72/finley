import type { Lens, Search } from "./corpus.ts";

// The Bright Data searches for one scan. The client and its competitors are always searched; the
// client's latest keyword plan (built by planKeywords) supplies the rest, high-sensitivity forces
// first. A client with no plan yet keeps the original fixed searches.

const MAX_PLAN_SEARCHES = 20;
const RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

// Which research agent reads what a keyword finds (see OWNERS in research.ts). Demand, input-cost,
// supply-chain, macro and technology keywords all go to the market agent.
const LENS_BY_CATEGORY: Record<string, Lens> = {
  company_specific: "company", pricing_competition: "competitor",
  regulation_policy: "regulation", geopolitics_trade: "regulation",
};

type PlanLike = { exposures?: { name?: string; category: string; sensitivity: string; keywords?: string[] }[] } | null | undefined;

export function planSearches(client: Record<string, any>, plan: PlanLike): Search[] {
  const core: Search[] = [
    { query: client.name, lens: "company" },
    ...(client.competitors || []).slice(0, 3).map((name: string): Search => ({ query: name, lens: "competitor" })),
  ];
  if (!plan?.exposures?.length) {
    const industry = client.industry || client.name;
    return [...core, { query: `${industry} regulation`, lens: "regulation" }, { query: `${industry} market outlook`, lens: "market" }];
  }
  const seen = new Set(core.map((s) => (s.query || "").toLowerCase()));
  const ranked = [...plan.exposures].sort((a, b) => (RANK[a.sensitivity] ?? 1) - (RANK[b.sensitivity] ?? 1));
  const fromPlan: Search[] = [];
  for (const force of ranked) {
    for (const query of force.keywords || []) {
      const key = query.toLowerCase();
      if (seen.has(key) || fromPlan.length >= MAX_PLAN_SEARCHES) continue;
      seen.add(key);
      fromPlan.push({ query, lens: LENS_BY_CATEGORY[force.category] ?? "market", exposure: force.name || "" });
    }
  }
  return [...core, ...fromPlan];
}
