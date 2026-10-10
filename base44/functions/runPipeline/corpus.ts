// What the research swarm reads. entry.ts runs the Bright Data searches (searches.ts picks them) and
// dedupes the results; this module numbers, dates and labels those articles for the agents.

export type Lens = "company" | "competitor" | "regulation" | "market";
export type Search = { query: string; lens: Lens }; // one Bright Data search, and which research agent reads its results
export type RawArticle = { title: string; url: string; source: string; date: string; snippet: string };

export interface Article {
  id: string; // "A<n>": n is the index in entry.ts's deduped articles, so ids map straight back to sources
  title: string; url: string; source: string;
  snippet: string; // "" when Bright Data returned only a headline
  date: string; // ISO day from Bright Data's relative date ("3 days ago"), or "" if unreadable
  lens: Lens; // the first search that found it, the same order the URL dedupe used
  query: string; mentions_client: boolean;
  duplicate_of: string; // id of an earlier article with the same headline (a syndicated copy), or ""
}

export interface Corpus { today: string; articles: Article[]; failed_queries: string[] }

const UNIT_MS: Record<string, number> = { minute: 6e4, hour: 3.6e6, day: 8.64e7, week: 6.048e8, month: 2.592e9, year: 3.1536e10 };
const MAX_CHARS = 180_000; // about 55K tokens, well under Haiku 5.5's 100K-token price step

// Bright Data gives news dates as text such as "23 hours ago" or "Oct 3, 2026".
export function isoDay(raw: string, now: Date): string {
  const text = (raw || "").trim().toLowerCase();
  const rel = text.match(/^(\d+|an?)\s+(minute|hour|day|week|month|year)s?\s+ago$/);
  const ms = rel ? now.getTime() - (Number(rel[1]) || 1) * UNIT_MS[rel[2]]
    : text === "yesterday" ? now.getTime() - UNIT_MS.day : Date.parse(raw);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : "";
}

const clean = (text: string) => (text || "").replace(/[<>"]/g, "").replace(/\s+/g, " ").trim();
const headlineKey = (title: string) => clean(title).toLowerCase().replace(/\s[-–|]\s[^-–|]+$/, "").replace(/[^a-z0-9]+/g, " ").trim();

// results[i] holds what searches[i] found (entry.ts runs them in order); raw is entry.ts's deduped list.
export function buildCorpus(client: Record<string, any>, searches: Search[], results: PromiseSettledResult<RawArticle[]>[], raw: RawArticle[], now = new Date()): Corpus {
  const firstQuery = new Map<string, number>();
  results.forEach((r, i) => r.status === "fulfilled" && r.value.forEach((a) => firstQuery.has(a.url) || firstQuery.set(a.url, i)));
  const name = (client.name || "").toLowerCase();
  const headlines = new Map<string, string>();
  const articles = raw.map((a, i): Article => {
    const q = firstQuery.get(a.url) ?? 0;
    const key = headlineKey(a.title);
    const duplicate_of = (key && headlines.get(key)) || "";
    if (key && !duplicate_of) headlines.set(key, `A${i}`);
    return {
      id: `A${i}`, title: clean(a.title), url: a.url, source: clean(a.source) || "unknown outlet",
      snippet: clean(a.snippet), date: isoDay(a.date, now), lens: searches[q].lens, query: searches[q].query,
      mentions_client: !!name && `${a.title} ${a.snippet}`.toLowerCase().includes(name), duplicate_of,
    };
  });
  const failed_queries = searches.filter((_, i) => results[i]?.status === "rejected").map((s) => s.query);
  return { today: now.toISOString().slice(0, 10), articles, failed_queries };
}

// Tier 1 sees the market the client operates in, not the client's thesis: no assumptions,
// objectives or financials, so the market picture isn't shaped by what the client hopes for.
export function marketContext(client: Record<string, any>): string {
  const drivers = [...new Set((client.assumptions || []).map((a: any) => a.driver).filter(Boolean))];
  return [
    `Client: ${client.name} (${client.industry || "industry not given"})`,
    `Business model: ${client.business_model || "not given"}`,
    `Revenue streams: ${client.revenue_streams || "not given"}`,
    `Cost structure: ${client.cost_structure || "not given"}`,
    `Key financial drivers: ${client.financial_drivers || "not given"}`,
    `Named competitors: ${(client.competitors || []).join(", ") || "none"}`,
    `Drivers the analyst tracks: ${drivers.join("; ") || "none"}`,
  ].join("\n");
}

export function coverageNote(corpus: Corpus): string {
  const stories = corpus.articles.filter((a) => !a.duplicate_of);
  const count = (lens: Lens) => stories.filter((a) => a.lens === lens).length;
  const failed = corpus.failed_queries.length ? ` Failed searches: ${corpus.failed_queries.join("; ")}.` : "";
  const headlineOnly = stories.filter((a) => !a.snippet).length;
  return `${stories.length} unique stories from ${corpus.articles.length} articles: company ${count("company")}, competitors ${count("competitor")}, regulation ${count("regulation")}, market ${count("market")}. Headline-only (no snippet): ${headlineOnly}.${failed}`;
}

// One agent's view: articles in its own lenses in full, everything else as headlines it can use
// to corroborate. Newest first; anything over the size budget is counted, never silently dropped.
export function renderArticles(corpus: Corpus, own: Lens[]): string {
  const copies = new Map<string, string[]>();
  corpus.articles.forEach((a) => a.duplicate_of && copies.set(a.duplicate_of, [...(copies.get(a.duplicate_of) ?? []), a.source]));
  const stories = corpus.articles.filter((a) => !a.duplicate_of).sort((x, y) => y.date.localeCompare(x.date));
  const blocks: string[] = [];
  let size = 0, omitted = 0;
  for (const a of [...stories.filter((s) => own.includes(s.lens)), ...stories.filter((s) => !own.includes(s.lens))]) {
    const yours = own.includes(a.lens);
    const also = copies.has(a.id) ? ` also_ran_it="${copies.get(a.id)!.join(", ")}"` : "";
    const body = yours ? `\n${a.snippet || "(headline only, no snippet)"}` : "";
    const block = `<article id="${a.id}" yours="${yours}" lens="${a.lens}" date="${a.date || "unknown"}" outlet="${a.source}"${also}>\n${a.title}${body}\n</article>`;
    if (size + block.length > MAX_CHARS) { omitted++; continue; }
    blocks.push(block); size += block.length;
  }
  if (omitted) blocks.push(`(${omitted} more articles omitted to stay within the input budget)`);
  return blocks.join("\n");
}
