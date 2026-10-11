import type { RawArticle as SearchResult } from "../../../shared/brightdata.ts";
import { addDays, isoDay } from "../../../shared/dates.ts";
import type { RawArticle, Search } from "../corpus.ts";

// Backtest news collection. Every keyword-plan search runs once per date window over the year before
// the cutoff (Google's custom date range), and each result is screened by its own date: Google's
// window is a request, not a guarantee, so anything undated or dated after the cutoff is left out.
// Results are stored as EvalSource rows, kept or not, so the corpus can be audited and re-used.

export interface Window { from: string; to: string }
export interface Pair { key: string; search_index: number; window_index: number } // key "search:window"
export interface SourceRow {
  corpus_key: string; search_index: number; query: string; lens: string; exposure: string; window_from: string; window_to: string;
  title: string; url: string; source: string; date_raw: string; date: string; snippet: string; included: boolean; exclusion: string; flag: string;
}

// n back-to-back windows covering the lookback period, oldest first, the last ending on the cutoff.
// Searching each window separately gives a story from February the same chance as one from December.
export function windowsFor(cutoff: string, lookbackDays = 365, n = 4): Window[] {
  const start = addDays(cutoff, -(lookbackDays - 1));
  return Array.from({ length: n }, (_, i) => ({
    from: addDays(start, Math.round((i * lookbackDays) / n)),
    to: addDays(start, Math.round(((i + 1) * lookbackDays) / n) - 1),
  }));
}

export const pairsFor = (searches: Search[], windows: Window[]): Pair[] =>
  searches.flatMap((_, s) => windows.map((_, w) => ({ key: `${s}:${w}`, search_index: s, window_index: w })));

// "3 weeks ago" counts back from the day of the search, years after the cutoff, so a coarse relative
// date can't place a story on either side of it. Hours and days ago resolve to after the cutoff anyway.
const COARSE = /^(\d+|an?)\s+(week|month|year)s?\s+ago$/i;

export function screen(a: SearchResult, cutoff: string, lookbackFrom: string, fetchedAt: Date) {
  const raw = (a.date || "").trim();
  const date = COARSE.test(raw) ? "" : isoDay(raw, fetchedAt);
  const exclusion = !date ? "undated" : date > cutoff ? "after_cutoff" : date < lookbackFrom ? "before_lookback" : "";
  // Kept but flagged: text naming a year after the cutoff's next year suggests a misdated page. The
  // next year itself is normal in forward-looking coverage ("2023 outlook").
  const year = Number(cutoff.slice(0, 4));
  const later = [...`${a.title} ${a.snippet}`.matchAll(/\b(20\d\d)\b/g)].map((m) => Number(m[1])).filter((y) => y > year + 1);
  return { date, included: !exclusion, exclusion, flag: later.length ? `mentions ${Math.max(...later)}` : "" };
}

export function toRows(corpus_key: string, pair: Pair, search: Search, window: Window, found: SearchResult[], cutoff: string, lookbackFrom: string, fetchedAt: Date): SourceRow[] {
  return found.filter((a) => a.url).map((a) => ({
    corpus_key, search_index: pair.search_index, query: search.query, lens: search.lens, exposure: search.exposure || "",
    window_from: window.from, window_to: window.to, title: a.title, url: a.url, source: a.source, date_raw: a.date, snippet: a.snippet,
    ...screen(a, cutoff, lookbackFrom, fetchedAt),
  }));
}

// Fetches pairs with a small worker pool until they run out or stopAt passes (no new fetch starts after
// it). A pair that fails twice is recorded as failed and still counts as collected, so a resumed run
// doesn't retry it forever; EvalRun retry clears failed pairs. save() calls run one at a time.
export async function collectPairs(x: {
  pairs: Pair[]; stopAt: number; concurrency?: number;
  fetch: (pair: Pair) => Promise<SearchResult[]>;
  toRows: (pair: Pair, found: SearchResult[], fetchedAt: Date) => SourceRow[];
  save: (rows: SourceRow[], keys: string[]) => Promise<void>;
}) {
  const queue = [...x.pairs];
  const failed: string[] = [];
  let rows: SourceRow[] = [], keys: string[] = [], saving = Promise.resolve();
  const flush = () => {
    if (!keys.length) return saving;
    const batch = rows, done = keys;
    rows = []; keys = [];
    return (saving = saving.then(() => x.save(batch, done)));
  };
  const worker = async () => {
    while (queue.length && Date.now() < x.stopAt) {
      const pair = queue.shift()!;
      let found: SearchResult[] | null = null, error = "";
      for (let attempt = 0; attempt < 2 && !found && (attempt === 0 || Date.now() < x.stopAt); attempt++) {
        found = await x.fetch(pair).catch((e) => { error = (e as Error).message; return null; });
      }
      if (!found) failed.push(`${pair.key}: ${error.slice(0, 160)}`);
      rows.push(...x.toRows(pair, found ?? [], new Date()));
      keys.push(pair.key);
      if (rows.length >= 80) await flush();
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, x.concurrency ?? 6) }, worker));
  await flush();
  return { failed, remaining: queue.map((p) => p.key) };
}

// Rebuilds what runPipeline/entry.ts hands the agent pipeline: results[i] holds what searches[i] found
// (kept articles only), and articles is the URL-deduped list in search order. A search whose every
// window failed counts as a failed search, as a failed live search does.
export function corpusFromSources(searches: Search[], rows: SourceRow[], failedSearches: Set<number> = new Set()) {
  const kept = rows.filter((r) => r.included)
    .sort((a, b) => a.search_index - b.search_index || a.window_from.localeCompare(b.window_from) || b.date.localeCompare(a.date) || a.url.localeCompare(b.url));
  const toRaw = (r: SourceRow): RawArticle => ({ title: r.title, url: r.url, source: r.source, date: r.date, snippet: r.snippet });
  const results: PromiseSettledResult<RawArticle[]>[] = searches.map((_, i) => {
    const mine = kept.filter((r) => r.search_index === i).map(toRaw);
    return !mine.length && failedSearches.has(i) ? { status: "rejected", reason: new Error("every date window failed") } : { status: "fulfilled", value: mine };
  });
  const seen = new Set<string>();
  const articles = results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])).filter((a) => !seen.has(a.url) && !!seen.add(a.url));
  return { results, articles };
}

// What the Evals page shows about the corpus: how much was fetched, kept, and why the rest was left out.
export function corpusStats(rows: SourceRow[], searches: Search[], windows: Window[], failedPairs: string[]) {
  const by = (reason: string) => rows.filter((r) => r.exclusion === reason).length;
  const kept = rows.filter((r) => r.included);
  const failedSearches = searches.map((_, i) => i).filter((i) => windows.every((_, w) => failedPairs.some((f) => f.startsWith(`${i}:${w}:`))));
  return {
    searches: searches.length, windows: windows.length, fetched: rows.length, kept: kept.length, unique_kept: new Set(kept.map((r) => r.url)).size,
    excluded: { undated: by("undated"), after_cutoff: by("after_cutoff"), before_lookback: by("before_lookback") },
    flagged: kept.filter((r) => r.flag).length, failed_pairs: failedPairs.slice(0, 40), failed_pair_count: failedPairs.length, failed_searches: failedSearches,
    by_window: windows.map((w) => ({ ...w, kept: kept.filter((r) => r.window_from === w.from).length })),
  };
}
