// Point-in-time market data for listed clients, anchored to the run's as-of date: the latest daily
// close on or before that date, recent moves and the 52-week range. Clients with no matching
// listing are treated as private and get none. Source: Yahoo Finance's public chart and search
// endpoints (keyless, unofficial); if they are unreachable the scan simply runs without prices.

export interface MarketSnapshot {
  ticker: string; name: string; exchange: string; currency: string;
  as_of: string; // the run's as-of day (ISO)
  close_date: string; // trading day of `close`: the as-of day or, if it hasn't traded yet, the last one before
  live: boolean; // close_date's session is still open, so `close` is the latest price, not a close
  close: number; prev_close: number; change_1d_pct: number; change_5d_pct: number; change_1m_pct: number;
  low_52w: number; high_52w: number; source: string;
}

const HEADERS = { "User-Agent": "Mozilla/5.0" }; // Yahoo rejects requests without a browser-like agent
const SUFFIXES = /\b(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|ag|sa|nv|se|holdings?|group|the)\b/g;
const normName = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(SUFFIXES, " ").replace(/\s+/g, " ").trim();
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const r2 = (n: number) => Math.round(n * 100) / 100;

async function yahoo(url: string) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Yahoo Finance ${res.status}`);
  return res.json();
}

// The analyst's ticker wins. Otherwise a listed stock counts only if its name matches the client's
// exactly, legal suffixes aside ("NVIDIA" = "NVIDIA Corporation"; "Lumen Compute" != "Lumen Technologies").
export async function resolveTicker(client: Record<string, any>): Promise<string> {
  if (client.ticker) return String(client.ticker).trim().toUpperCase();
  const data = await yahoo(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(client.name)}&quotesCount=5&newsCount=0`);
  const target = normName(client.name);
  const hit = (data.quotes || []).find((q: any) => q.quoteType === "EQUITY" && [q.longname, q.shortname].some((n) => n && normName(n) === target));
  return hit?.symbol || "";
}

export async function marketSnapshot(ticker: string, asOf: Date): Promise<MarketSnapshot | null> {
  const end = Math.floor(asOf.getTime() / 1000) + 86_400; // include the as-of day itself
  const data = await yahoo(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${end - 400 * 86_400}&period2=${end}&interval=1d`);
  const result = data?.chart?.result?.[0];
  const meta = result?.meta ?? {};
  const asOfDay = day(asOf.getTime());
  const asOfSec = asOf.getTime() / 1000;
  // A day counts once its session has closed by the as-of time, so a run dated June 1 before the open
  // sees May 29's close. In a live run (as-of = now) today's session in progress counts too, as live.
  const session = (meta.currentTradingPeriod?.regular?.end - meta.currentTradingPeriod?.regular?.start) || 23_400;
  const liveRun = Math.abs(Date.now() / 1000 - asOfSec) < 600;
  // Bars are stamped at the session open; shift into exchange time so each lands on its trading day.
  const bars = (result?.timestamp ?? []).map((t: number, i: number) => ({ t, day: day((t + (meta.gmtoffset ?? 0)) * 1000), close: result.indicators.quote[0].close[i] }))
    .filter((b: { t: number; close: number }) => Number.isFinite(b.close) && (b.t + session <= asOfSec || (liveRun && b.t <= asOfSec)));
  if (bars.length < 2) return null;
  const last = bars[bars.length - 1];
  const back = (n: number) => bars[Math.max(0, bars.length - 1 - n)].close;
  const pct = (from: number) => Math.round((last.close / from - 1) * 1000) / 10;
  const year = bars.filter((b: { day: string }) => b.day > day(asOf.getTime() - 365 * 86_400_000)).map((b: { close: number }) => b.close);
  return {
    ticker, name: meta.longName || meta.shortName || ticker, exchange: meta.fullExchangeName || meta.exchangeName || "", currency: meta.currency || "",
    as_of: asOfDay, close_date: last.day, live: liveRun && last.t + session > Date.now() / 1000,
    close: r2(last.close), prev_close: r2(back(1)), change_1d_pct: pct(back(1)), change_5d_pct: pct(back(5)), change_1m_pct: pct(back(21)),
    low_52w: r2(Math.min(...year)), high_52w: r2(Math.max(...year)), source: "Yahoo Finance daily prices",
  };
}

// Never throws: a scan without market data is still a scan, and the note says why it's missing.
export async function companyMarket(client: Record<string, any>, asOf = new Date()) {
  try {
    const ticker = await resolveTicker(client);
    if (!ticker) return { snapshot: null, note: "No listed stock matches this client, so it is treated as private." };
    const snapshot = await marketSnapshot(ticker, asOf);
    return { snapshot, note: snapshot ? "" : `No trading data for ${ticker} on or before ${day(asOf.getTime())}.` };
  } catch (error) {
    return { snapshot: null, note: `Market data unavailable: ${(error as Error).message}` };
  }
}

// One paragraph for agent prompts, so every agent reasons from the same dated numbers.
export function snapshotText(market: { snapshot: MarketSnapshot | null; note: string }): string {
  const s = market.snapshot;
  if (!s) return market.note;
  const sign = (n: number) => `${n > 0 ? "+" : ""}${n}%`;
  const price = s.live ? `latest price on ${s.close_date} (market still open)` : `close on ${s.close_date}`;
  // Yahoo adjusts history for every later split, so a backtest's prices can differ from news of the time.
  const historical = Date.now() - Date.parse(`${s.as_of}T00:00:00Z`) > 30 * 86_400_000;
  const adjusted = historical ? " Prices are adjusted for any later stock splits, so they can differ from prices quoted in news of the time." : "";
  return `${s.name} (${s.ticker}, ${s.exchange}), prices in ${s.currency}. As of ${s.as_of}: ${price} ${s.close}, previous close ${s.prev_close} (${sign(s.change_1d_pct)}). Over 5 trading days ${sign(s.change_5d_pct)}, over 1 month ${sign(s.change_1m_pct)}. 52-week range ${s.low_52w}-${s.high_52w}. Source: ${s.source}.${adjusted}`;
}
