import { secrets } from "base44:runtime";

// Google News searches through Bright Data's SERP API. Live scans search the latest news; backtests
// pass a date window (Google's custom date range, tbs=cdr) so only news from that window comes back.
// Results still go through a date filter afterwards (runPipeline/eval/collect.ts): the window is a request to
// Google, not a guarantee.

// Same shape as runPipeline/corpus.ts RawArticle.
export interface RawArticle { title: string; url: string; source: string; date: string; snippet: string }

export interface SearchOptions {
  from?: string; to?: string; // ISO days; both or neither
  limit?: number; // results kept, default 8 (Google returns about 10 per page)
  timeoutMs?: number;
}

const usDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`bad date "${iso}"`);
  return `${m}/${d}/${y}`;
};

export function newsSearchUrl(q: string, opts: Pick<SearchOptions, "from" | "to"> = {}): string {
  const params = [`q=${encodeURIComponent(q)}`, "tbm=nws"];
  if (opts.from || opts.to) {
    if (!opts.from || !opts.to) throw new Error("a date window needs both from and to");
    params.push("hl=en", "gl=us", `tbs=${encodeURIComponent(`cdr:1,cd_min:${usDate(opts.from)},cd_max:${usDate(opts.to)}`)}`);
  }
  params.push("brd_json=1");
  return `https://www.google.com/search?${params.join("&")}`;
}

export async function searchNews(q: string, opts: SearchOptions = {}): Promise<RawArticle[]> {
  // Read per request: Base44 resolves secrets inside the handler, and a module-level read is undefined.
  const rawZone = (secrets.get("BRIGHTDATA_SERP_ZONE") || "").trim();
  const zone = (rawZone.match(/zone\W+([\w-]+)/) || [null, rawZone])[1];
  const res = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: { Authorization: `Bearer ${secrets.get("BRIGHTDATA_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ zone, url: newsSearchUrl(q, opts), format: "raw" }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 45000),
  });
  // Bright Data can report the real failure only in this header, even on a 200 with an empty body.
  const brdError = res.headers.get("x-brd-error");
  if (!res.ok) throw new Error(`Bright Data ${res.status}: ${(brdError || (await res.text())).slice(0, 200)}`);
  if (brdError) throw new Error("Bright Data: " + brdError.slice(0, 200));
  return parseNews(await res.text(), opts.limit ?? 8);
}

export function parseNews(body: string, limit = 8): RawArticle[] {
  let data: any;
  try { data = JSON.parse(body); } catch { throw new Error(`Bright Data returned non-JSON: ${body.slice(0, 120)}`); }
  const items = data?.news || data?.organic || [];
  return items.slice(0, limit).map((n: any) => ({
    title: n.title || "", url: n.link || n.url || "", source: n.source || n.display_link || "", date: n.date || "", snippet: n.description || n.snippet || "",
  }));
}
