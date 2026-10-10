import { type AgentUsage, runAgent } from "../../shared/agent.ts";
import { choice, list, obj, str } from "../../shared/schema.ts";
import { type CheckedDevelopment, type CheckedResearch, renderDevelopments } from "./evidence.ts";

// Research lead: one agent turns the three researchers' checked developments into a market picture a
// finance reader can grasp in a minute. It reads the compact developments, not the articles, so it's
// cheap, and it runs alongside the company agents, so it adds no wait. Code applies its merges.

type Ref = { development_ids: string[] };
export interface MarketPicture {
  headline: string; overview: string; watch: string[];
  themes: (Ref & { name: string; summary: string })[];
  conflicts: (Ref & { question: string; assessment: string })[];
  players: (Ref & { name: string; role: string })[];
  merges: { keep_id: string; duplicate_ids: string[] }[];
}

const PICTURE_SCHEMA = obj({
  headline: str("One sentence: the most important thing happening in this market right now"),
  overview: str("3 to 5 plain-English sentences: what is happening, who is moving, and what it adds up to"),
  themes: list(obj({ name: str(), summary: str("1 to 2 sentences"), development_ids: list(str()) }), "At most 5, most important first"),
  conflicts: list(obj({ question: str("What the sources disagree about"), development_ids: list(str()),
    assessment: str("Which side the evidence favours, or that it is unresolved") }), "Genuine disagreements only; empty if none"),
  players: list(obj({ name: str(), role: choice(["client", "competitor", "customer", "supplier", "regulator", "investor", "other"]),
    development_ids: list(str()) }), "Organizations moving this market"),
  merges: list(obj({ keep_id: str("The best-sourced development"), duplicate_ids: list(str()) }), "Developments that describe the same event"),
  watch: list(str(), "At most 4 short lines: what to watch next"),
});

const RULES = `You are the lead analyst of Finley's market-research team. Three researchers have recorded today's developments, and each has been checked against its sources. Turn them into a market picture a finance reader can grasp in a minute: what is happening, who is moving, what to watch, and where the sources disagree.

Rules:
- Use only the developments provided, and cite development ids for every theme, conflict and player.
- Describe the market, not what it means for the client's plans; another team does that.
- A development with source_check="failed" did not match its source. Never build a theme on such developments alone.
- Merge developments that describe the same event, keeping the best-sourced one.
- Flag a conflict only for a real disagreement (different numbers or opposite claims), not a difference in emphasis.
- Plain English, no jargon. Never put ids in prose fields.`;

export async function buildMarketPicture(research: CheckedResearch, context: string, today: string, opts: { deadline: number; usage: AgentUsage[] }) {
  const answer = await runAgent<MarketPicture>({
    name: "research/lead", system: RULES, schema: PICTURE_SCHEMA, deadline: opts.deadline,
    prompt: `Today is ${today}.\n\n<client_market>\n${context}\n</client_market>\n\n<developments>\n${renderDevelopments(research.developments)}\n</developments>\n\n<blind_spots>\n${research.gaps.join("\n") || "none reported"}\n</blind_spots>\n\nWrite the market picture.`,
  }, opts.usage);
  return applyPicture(research.developments, answer);
}

// Applies the lead's merges (the kept development gains the duplicates' articles and outlets) and
// keeps every reference pointing at a development that still exists. Adds a dated timeline.
export function applyPicture(developments: CheckedDevelopment[], picture: MarketPicture) {
  const byId = new Map(developments.map((d) => [d.id, { ...d }]));
  const mergedInto: Record<string, string> = {};
  for (const m of picture.merges || []) {
    const keep = byId.get(m.keep_id);
    if (!keep || mergedInto[m.keep_id]) continue;
    for (const id of m.duplicate_ids || []) {
      const dup = byId.get(id);
      if (!dup || id === m.keep_id || mergedInto[id]) continue;
      mergedInto[id] = m.keep_id;
      keep.article_ids = [...new Set([...keep.article_ids, ...dup.article_ids])];
      keep.outlets = [...new Set([...keep.outlets, ...dup.outlets])];
      keep.date = [keep.date, dup.date].sort().pop() || "";
    }
  }
  const kept = [...byId.values()].filter((d) => !mergedInto[d.id]);
  const fix = <T extends Ref>(items: T[]) => (items || []).map((x) => ({ ...x, development_ids:
    [...new Set((x.development_ids || []).map((id) => mergedInto[id] || id).filter((id) => byId.has(id)))] }));
  return {
    headline: picture.headline, overview: picture.overview, watch: (picture.watch || []).slice(0, 4),
    themes: fix(picture.themes).slice(0, 5), conflicts: fix(picture.conflicts), players: fix(picture.players),
    developments: kept, merged_into: mergedInto,
    timeline: kept.filter((d) => d.date).sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ id: d.id, date: d.date, title: d.title, topic: d.topic, movement: d.movement })),
  };
}
