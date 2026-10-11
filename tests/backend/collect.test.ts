import assert from "node:assert/strict";
import { collectPairs, corpusFromSources, pairsFor, screen, toRows, windowsFor } from "../../base44/functions/runPipeline/eval/collect.ts";
import type { Search } from "../../base44/functions/runPipeline/corpus.ts";

const fetchedAt = new Date("2026-10-10T12:00:00Z");
const art = (date: string, title = "Netflix news", url = `https://example.com/${Math.random()}`) => ({ title, url, source: "Reuters", date, snippet: "" });

Deno.test("windows cover the lookback year back to back, ending on the cutoff", () => {
  const w = windowsFor("2022-12-31");
  assert.equal(w.length, 4);
  assert.equal(w[0].from, "2022-01-01");
  assert.equal(w[3].to, "2022-12-31");
  for (let i = 1; i < w.length; i++) assert.equal(Date.parse(w[i].from) - Date.parse(w[i - 1].to), 86_400_000);
});

Deno.test("screening keeps only articles dated inside the lookback, before the cutoff", () => {
  const s = (date: string, title?: string) => screen(art(date, title), "2022-12-31", "2022-01-01", fetchedAt);
  assert.deepEqual(s("Dec 15, 2022"), { date: "2022-12-15", included: true, exclusion: "", flag: "" });
  assert.equal(s("3 days ago").exclusion, "after_cutoff"); // relative to the search, in 2026
  assert.equal(s("2 years ago").exclusion, "undated"); // too coarse to place against the cutoff
  assert.equal(s("").exclusion, "undated");
  assert.equal(s("Mar 3, 2023").exclusion, "after_cutoff");
  assert.equal(s("Jun 1, 2021").exclusion, "before_lookback");
  assert.equal(s("Dec 1, 2022", "Netflix ad tier could reach 40M by 2025").flag, "mentions 2025");
  assert.equal(s("Dec 1, 2022", "Netflix 2023 outlook").flag, ""); // next year is normal forward-looking coverage
});

Deno.test("the corpus keeps kept rows only, dedupes URLs in search order, and marks searches that all failed", () => {
  const searches: Search[] = [{ query: "Netflix", lens: "company" }, { query: "Disney+", lens: "competitor" }, { query: "streaming prices", lens: "market", exposure: "Pricing" }];
  const w = windowsFor("2022-12-31");
  const [p0, , , , p4] = pairsFor(searches, w);
  const rows = [
    ...toRows("k", p0, searches[0], w[0], [art("Feb 2, 2022", "a", "https://x/1"), art("2 days ago", "b", "https://x/2")], "2022-12-31", w[0].from, fetchedAt),
    ...toRows("k", p4, searches[1], w[0], [art("Feb 3, 2022", "c", "https://x/1"), art("Feb 4, 2022", "d", "https://x/3")], "2022-12-31", w[0].from, fetchedAt),
  ];
  const { results, articles } = corpusFromSources(searches, rows, new Set([2]));
  assert.deepEqual(articles.map((a) => a.url), ["https://x/1", "https://x/3"]);
  assert.equal(results[0].status, "fulfilled");
  assert.equal(results[2].status, "rejected");
  assert.equal(articles[0].date, "2022-02-02");
});

Deno.test("collectPairs retries a failing search once, records it, and stops starting work at stopAt", async () => {
  const searches: Search[] = [{ query: "Netflix", lens: "company" }];
  const w = windowsFor("2022-12-31", 365, 2);
  const pairs = pairsFor(searches, w);
  let calls = 0;
  const saved: string[] = [];
  const res = await collectPairs({
    pairs, stopAt: Date.now() + 60_000, concurrency: 2,
    fetch: (p) => { calls++; return p.window_index === 1 ? Promise.reject(new Error("timeout")) : Promise.resolve([art("Feb 2, 2022")]); },
    toRows: (p, found, at) => toRows("k", p, searches[0], w[p.window_index], found, "2022-12-31", w[0].from, at),
    save: async (rows, keys) => { saved.push(...keys); },
  });
  assert.equal(calls, 3);
  assert.deepEqual(res.failed.map((f) => f.split(": ")[0]), ["0:1"]);
  assert.deepEqual(saved.sort(), ["0:0", "0:1"]);
  const late = await collectPairs({ pairs, stopAt: Date.now() - 1, fetch: () => Promise.resolve([]), toRows: () => [], save: async () => {} });
  assert.deepEqual(late.remaining, ["0:0", "0:1"]);
});
