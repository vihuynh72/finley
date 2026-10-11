import { type Client, type Delta, type Finding, type Topic, type TopicId, type Values, MONTHS, SEASONALITY } from "./data";

export const baseValues = (t: Topic): Values => Object.fromEntries(t.drivers.map((d) => [d.id, d.base]));
export const presetValues = (t: Topic, p: "base" | "downside" | "upside"): Values =>
  p === "base" ? baseValues(t) : { ...baseValues(t), ...t.presets[p] };

export const ebitdaDelta = (d: Delta) => d.rev - d.cogs - d.opex;
export const sumDeltas = (ds: Delta[]): Delta =>
  ds.reduce((a, d) => ({ rev: a.rev + d.rev, cogs: a.cogs + d.cogs, opex: a.opex + d.opex }), { rev: 0, cogs: 0, opex: 0 });

export interface Financials { rev: number; cogs: number; gp: number; gm: number; ebitda: number; em: number }
export const financials = (c: Client, d: Delta = { rev: 0, cogs: 0, opex: 0 }): Financials => {
  const rev = c.base.rev + d.rev, cogs = c.base.cogs + d.cogs, opex = c.base.opex + d.opex;
  const gp = rev - cogs, ebitda = gp - opex;
  // A client with no revenue entered yet would divide by zero.
  return { rev, cogs, gp, gm: rev ? (gp / rev) * 100 : 0, ebitda, em: rev ? (ebitda / rev) * 100 : 0 };
};

// Weekly points: monthly seasonality spread over 4 weeks plus a fixed, seeded week-to-week swing
// (illustrative volatility, the same every render) so the line reads like real performance.
const noise = (i: number) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return (x - Math.floor(x)) * 2 - 1; };
export const monthly = (base: Financials, scen: Financials, down: Financials, up: Financials, metric: "rev" | "ebitda") =>
  MONTHS.flatMap((m, i) => [0, 1, 2, 3].map((k) => {
    const n = i * 4 + k;
    const w = (SEASONALITY[i] / 4) * (1 + 0.06 * noise(n) + 0.03 * Math.sin(n / 2.3));
    const lo = Math.min(down[metric], up[metric]) * w, hi = Math.max(down[metric], up[metric]) * w;
    return { month: k === 0 ? m : `${m} wk${k + 1}`, base: base[metric] * SEASONALITY[i] / 4, scenario: scen[metric] * w, band: [lo, hi] as [number, number] };
  }));

/** Sequential per-driver EBITDA steps from base to current values. */
export const driverSteps = (t: Topic, v: Values) => {
  const cur: Values = baseValues(t);
  let prev = ebitdaDelta(t.compute(cur));
  return t.drivers.map((d) => {
    cur[d.id] = v[d.id] ?? d.base;
    const now = ebitdaDelta(t.compute(cur));
    const step = now - prev; prev = now;
    return { name: d.label, value: step };
  });
};

export const tornado = (t: Topic, metric: (v: Values) => number) => {
  const b = baseValues(t); const base = metric(b);
  return t.drivers
    .map((d) => ({ name: d.label, low: metric({ ...b, [d.id]: d.min }) - base, high: metric({ ...b, [d.id]: d.max }) - base, min: d.min, max: d.max, unit: d.unit }))
    .sort((a, b2) => Math.abs(b2.high - b2.low) - Math.abs(a.high - a.low));
};

export type ClientValues = Record<TopicId, Values>;
export const defaultClientValues = (c: Client): ClientValues =>
  Object.fromEntries(c.topicOrder.map((t) => [t, baseValues(c.topics[t])]));
// Values saved before a tab was added or a driver renamed fall back to base, so old scenarios still load.
export const topicValues = (c: Client, vals: ClientValues | undefined, t: TopicId): Values => ({ ...baseValues(c.topics[t]), ...(vals?.[t] ?? {}) });
export const combinedDelta = (c: Client, vals: ClientValues) =>
  sumDeltas(c.topicOrder.map((t) => c.topics[t].compute(topicValues(c, vals, t))));
export const combinedPreset = (c: Client, p: "downside" | "upside") => sumDeltas(c.topicOrder.map((t) => c.topics[t].compute(presetValues(c.topics[t], p))));

// The delta a set of findings implies, in the pipeline's own dashboard terms: each finding's impact
// revenue_pct is a revenue lever and cost_pct folds the COGS+opex effect onto the cogs line
// (shared/finance.ts findingImpact), so summing them recovers the pipeline's dollar effects.
export const findingsDelta = (c: Client, fs: Finding[]): Delta =>
  sumDeltas(fs.filter((f) => f.impact).map((f) => ({ rev: c.base.rev * f.impact!.revenue_pct / 100, cogs: c.base.cogs * f.impact!.cost_pct / 100, opex: 0 })));