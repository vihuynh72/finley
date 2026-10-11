// News dates as Bright Data returns them ("23 hours ago", "Oct 3, 2026", "2022-04-19") as ISO days.
// Relative dates count back from `now`, the real time of the search: a backtest search run today
// that says "2 years ago" resolves to a recent date, which the backtest's cutoff filter then rejects.

const UNIT_MS: Record<string, number> = { minute: 6e4, hour: 3.6e6, day: 8.64e7, week: 6.048e8, month: 2.592e9, year: 3.1536e10 };

const UNIT_ALIAS: Record<string, string> = { min: "minute", mins: "minute", hr: "hour", hrs: "hour", wk: "week", wks: "week", mo: "month", mos: "month", yr: "year", yrs: "year" };

export function isoDay(raw: string, now: Date): string {
  const text = (raw || "").trim().toLowerCase();
  const rel = text.match(/^(\d+|an?)\s+(minute|hour|day|week|month|year|mins?|hrs?|wks?|mos?|yrs?)s?\s+ago$/);
  const unit = rel ? UNIT_ALIAS[rel[2]] ?? rel[2] : "";
  let ms = rel ? now.getTime() - (Number(rel[1]) || 1) * UNIT_MS[unit]
    : text === "yesterday" ? now.getTime() - UNIT_MS.day
    : /^\d{4}-\d{2}-\d{2}$/.test(text) ? Date.parse(`${text}T12:00:00Z`) // a bare ISO day stays that day in any timezone
    : Date.parse(raw);
  // "Oct 3" has no year, and Date.parse reads it as 2001: take the latest such day not after `now`.
  if (!rel && Number.isFinite(ms) && !/\b\d{4}\b/.test(text)) {
    const d = new Date(ms);
    d.setFullYear(now.getFullYear());
    if (d.getTime() > now.getTime() + UNIT_MS.day) d.setFullYear(now.getFullYear() - 1);
    ms = d.getTime();
  }
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : "";
}

export const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
export const dayMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
