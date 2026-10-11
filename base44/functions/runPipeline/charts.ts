import { addLevers, effectOf, hasFinancials, impliedPrice, type Levers, leversFor, NO_CHANGE, r1, r2, simulate } from "../../shared/finance.ts";
import type { Quantified } from "./impacts.ts";
import { UI_TOPICS } from "./research.ts";

// Deterministic numbers for the Briefing, from the same maths as the dashboard: plan / downside / central
// / upside cases built from this scan's quantified impacts, and chart-ready series.

const at = (client: Record<string, any>, c: Quantified, shock: number) =>
  leversFor(client, { pnl_line: c.pnl_line, shock_pct: shock, exposure_pct: c.exposure_pct, pass_through_pct: c.pass_through_pct });
const rounded = (l: Levers): Levers => ({ price_change_pct: r2(l.price_change_pct), volume_change_pct: r2(l.volume_change_pct),
  cogs_change_pct: r2(l.cogs_change_pct), opex_change_pct: r2(l.opex_change_pct), multiple_change: r2(l.multiple_change) });

// Downside and upside add up every quantified impact at its worst or best plausible shock; the central
// case counts only impacts at least 30% likely (likelihood 3+), at their central size. These are the
// impacts the scenario agent wrote its stories from. Run-rate view: as if the effects persisted for a
// year, with EV at the constant multiple.
export function buildScenarios(client: Record<string, any>, quantified: Quantified[], snapshot: any, stories: Record<string, any> | null) {
  if (!hasFinancials(client) || !quantified.length) return null;
  const valued = client.ev_ebitda_multiple > 0, priced = valued && snapshot?.close > 0;
  // Unparseable bounds drop out rather than read as 0, which would fake a no-change best case.
  const options = quantified.map((c) => [c.shock_min_pct, c.shock_pct, c.shock_max_pct].map(Number).filter(Number.isFinite).map((s) => at(client, c, s)));
  // Worse or better by EV, which carries both EBITDA and multiple effects; EBITDA breaks ties (no multiple).
  const value = (l: Levers) => { const p = simulate(client, l); return [p.ev, p.ebitda]; };
  const above = (a: Levers, b: Levers) => { const [ea, ba] = value(a), [eb, bb] = value(b); return ea !== eb ? ea > eb : ba > bb; };
  const pick = (up: boolean) => options.map((o) => o.reduce((a, b) => ((up ? above(b, a) : above(a, b)) ? b : a)));
  const make = (id: string, label: string, levers: Levers, story: string) => {
    const e = effectOf(client, levers);
    return { id, label, story: story || "", levers: rounded(levers), revenue: r2(e.scenario.revenue), ebitda: r2(e.scenario.ebitda),
      ebitda_margin_pct: r1(e.scenario.ebitda_margin_pct), ebitda_delta: e.ebitda_delta,
      ev: valued ? r2(e.scenario.ev) : null, ev_delta: valued ? e.ev_persistent : null, ev_pct: valued ? e.ev_persistent_pct : null,
      implied_share_price: priced ? impliedPrice(snapshot.close, e.ev_persistent_pct) : null };
  };
  const central = quantified.filter((c) => c.likelihood >= 3).map((c) => at(client, c, Number(c.shock_pct)));
  return {
    basis: "Illustrative scenarios, not forecasts: downside and upside add up this scan's quantified impacts at their worst or best plausible size; central counts only those at least 30% likely, at their central size. All as if they persisted for a year" +
      (valued ? ", with EV at the constant multiple" : "; no EV/EBITDA multiple entered, so no enterprise value") +
      (priced ? ` and the share price scaled from the ${snapshot.close_date} close assuming net debt is small.` : "."),
    cases: [make("plan", "Plan (no change)", NO_CHANGE, ""), make("downside", "Downside", addLevers(pick(false)), stories?.downside),
      make("central", "Central", addLevers(central), stories?.central), make("upside", "Upside", addLevers(pick(true)), stories?.upside)],
    signposts: stories?.signposts ?? [],
  };
}

export function buildCharts(client: Record<string, any>, saved: Record<string, any>[], assumptions: Record<string, any>[]) {
  const health = ["monitoring", "supported", "challenged", "under_review"].map((status) => ({ status, count: assumptions.filter((a) => (a.status || "monitoring") === status).length }));
  if (!hasFinancials(client)) return { ebitda_bridge: [], sensitivity: [], assumption_health: health };
  // Same aggregation as EbitdaCharts: revenue_pct summed as a price lever and cost_pct as a COGS lever, per topic.
  // Scope is this run only; the dashboard sums every finding it loads.
  const base = simulate(client, {}).ebitda;
  const sum = (fs: Record<string, any>[]) => ({ ...NO_CHANGE, price_change_pct: fs.reduce((s, f) => s + (f.impact?.revenue_pct || 0), 0), cogs_change_pct: fs.reduce((s, f) => s + (f.impact?.cost_pct || 0), 0) });
  const steps = Object.entries(UI_TOPICS).map(([topic, label]) => ({ step: topic, label, kind: "delta",
    value: r2(simulate(client, sum(saved.filter((f) => f.impact && f.drivers_affected?.[0] === label))).ebitda - base) }));
  const ebitda_bridge = [{ step: "baseline", label: "Plan EBITDA", kind: "total", value: r2(base) }, ...steps,
    { step: "combined", label: "With this scan's findings", kind: "total", value: r2(simulate(client, sum(saved.filter((f) => f.impact))).ebitda) }];
  // What a 1% move in each lever (or 1x on the multiple) is worth: plain arithmetic, no judgement.
  const sensitivity = (["price_change_pct", "volume_change_pct", "cogs_change_pct", "opex_change_pct", "multiple_change"] as const).map((lever) => {
    const e = effectOf(client, { ...NO_CHANGE, [lever]: 1 });
    return { lever, unit: lever === "multiple_change" ? "1x" : "1%", ebitda_delta: e.ebitda_delta, ev_delta: e.ev_persistent };
  });
  return { ebitda_bridge, sensitivity, assumption_health: health };
}
