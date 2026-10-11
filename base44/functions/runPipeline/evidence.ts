import { canon } from "../../shared/schema.ts";
import type { Article, Corpus } from "./corpus.ts";
import { type Development, FACT_BASES, MOVEMENTS, type ResearchOutput, TOPICS } from "./research.ts";

// Code checks on the research swarm's answers, so later agents only build on evidence that holds up.
// Cited article ids must exist; the quote must appear in a cited headline or snippet; every number
// in the fact must appear in the cited text. A development that fails a check is kept but marked
// grounded=false (scoring later caps its confidence); one citing no collected article is dropped.

export interface CheckedDevelopment extends Development {
  id: string; // "D0", "D1", ... across the swarm, in agent order
  agent: string; // the research agent that reported it
  grounded: boolean; // quote and numbers found in the cited articles
  outlets: string[]; // distinct publishers of the cited stories; a syndicated copy counts as its original
  headline_only: boolean; // every cited article came without a snippet
  date: string; // newest cited article's ISO day, or ""
}

export interface CheckedResearch {
  developments: CheckedDevelopment[];
  indicators: ResearchOutput["indicators"];
  name_collisions: string[]; // ids of owned articles about a different organization with a similar name
  gaps: string[];
  dropped: string[]; // developments removed, and why; reported in the briefing, never silently lost
  failed_agents: string[];
}

type Swarm = { ok: { name: string; data: ResearchOutput }[]; failed: string[] };

// Dates in an attribution ("reported on 2026-10-08", "on Oct 8, 2026") aren't claims about the event.
const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DATES = new RegExp(`\\b\\d{4}-\\d{2}-\\d{2}\\b|\\b${MONTH}\\.?\\s+\\d{1,2}(?!\\d)(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?`, "gi");
const norm = (text: string) => ` ${(text || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
const numbersIn = (text: string) => new Set((text.match(/\d+(?:[.,]\d+)*/g) || []).map((n) => n.replace(/,/g, "")));
const stripIds = (text: string) => (text || "").replace(/\s*[[(]A\d+[\])]/g, "").trim();
const citedText = (cited: Article[]) => cited.map((a) => `${a.title} ${a.snippet}`).join(" ");

// The quote may be trimmed with "..."; every fragment of two or more words must appear verbatim.
function quoteFound(quote: string, cited: Article[]): boolean {
  const text = norm(citedText(cited));
  const parts = (quote || "").split(/\.{3}|…/).map(norm).filter((p) => p.trim().split(" ").length >= 2);
  return parts.length > 0 && parts.every((p) => text.includes(p));
}

// Outlet names count as cited text: an attribution to "24/7 Wall St." or "9to5Mac" claims no number.
function numbersFound(d: Development, cited: Article[]): boolean {
  const inText = numbersIn(`${citedText(cited)} ${cited.map((a) => a.source).join(" ")}`);
  const claimed = [d.fact, ...(d.quantities || []).map((q) => q.value_text)].join(" ").replace(DATES, " ");
  return [...numbersIn(claimed)].every((n) => inText.has(n));
}

export function checkResearch(corpus: Corpus, swarm: Swarm): CheckedResearch {
  const byId = new Map(corpus.articles.map((a) => [a.id, a]));
  // Map cited ids onto real stories: unknown ids vanish, syndicated copies become their original.
  const resolve = (ids: string[]) => [...new Set((ids || [])
    .map((id) => byId.get(String(id).trim().toUpperCase())).filter((a): a is Article => !!a)
    .map((a) => a.duplicate_of || a.id))];
  const out: CheckedResearch = { developments: [], indicators: [], name_collisions: [], gaps: [], dropped: [], failed_agents: swarm.failed };
  const seenIndicators = new Set<string>();
  for (const { name, data } of swarm.ok) {
    for (const d of data.developments || []) {
      const article_ids = resolve(d.article_ids);
      if (!article_ids.length) { out.dropped.push(`${name}: "${d.title}" cites no collected article`); continue; }
      const cited = article_ids.map((id) => byId.get(id)!);
      const clean = { ...d, title: stripIds(d.title), fact: stripIds(d.fact), interpretation: stripIds(d.interpretation) };
      out.developments.push({
        ...clean, id: `D${out.developments.length}`, agent: name, article_ids,
        fact_basis: canon(d.fact_basis, FACT_BASES, "unconfirmed_report"), topic: canon(d.topic, TOPICS, "company_specific"),
        movement: canon(d.movement, MOVEMENTS, "new"),
        grounded: quoteFound(d.quote, cited) && numbersFound(clean, cited),
        outlets: [...new Set(cited.map((a) => a.source))],
        headline_only: cited.every((a) => !a.snippet),
        date: cited.map((a) => a.date).sort().pop() || "",
      });
    }
    // Indicators are chart data, so the same rule as facts: the value's numbers must be in the cited text.
    // The same figure from the same stories, sent by two agents, is kept once.
    for (const i of (data.indicators || []).slice(0, 4)) {
      const article_ids = resolve(i.article_ids), numbers = [...numbersIn(i.value_text || "")];
      const inText = numbersIn(citedText(article_ids.map((id) => byId.get(id)!)));
      const key = `${[...article_ids].sort()}|${numbers.sort()}`;
      if (!numbers.length || !numbers.every((n) => inText.has(n)) || seenIndicators.has(key)) continue;
      seenIndicators.add(key);
      out.indicators.push({ ...i, article_ids });
    }
    out.name_collisions = [...new Set([...out.name_collisions, ...resolve(data.name_collision_ids)])];
    out.gaps.push(...(data.gaps || []).map((g) => `${name}: ${g}`));
  }
  return out;
}

// Compact view of checked developments for the agents downstream: no article text, roughly 80 tokens
// each, so later rounds stay cheap and fast however much news was collected. Figures are the numbers
// as the source wrote them, so the impact estimator and scenario agent can size shocks from them.
export function renderDevelopments(developments: CheckedDevelopment[]): string {
  const attr = (text: string) => (text || "").replace(/"/g, "'");
  const figures = (d: CheckedDevelopment) => (d.quantities || []).filter((q) => q.value_text).map((q) => `${q.value_text} (${q.what})`).join("; ");
  return developments.map((d) => `<development id="${d.id}" topic="${d.topic}" moved="${attr(d.variable)}: ${d.movement}" basis="${d.fact_basis}" date="${d.date || "unknown"}" outlets="${d.outlets.length}" source_check="${d.grounded ? "passed" : "failed"}"${d.headline_only ? ' evidence="headline only"' : ""}>\n${d.fact}${figures(d) ? `\nFigures: ${figures(d)}` : ""}\nIndustry meaning: ${d.interpretation}\n</development>`).join("\n");
}
