// Deterministic financial maths. Agents estimate inputs (how big a shock, how exposed the client is);
// this file computes every number. simulate() is a line-for-line port of src/lib/scenarioModel.js,
// so figures in the Briefing, the email and the dashboard always agree. Money is USD millions.

export interface Levers { price_change_pct: number; volume_change_pct: number; cogs_change_pct: number; opex_change_pct: number; multiple_change: number }
export interface Pnl { revenue: number; gross_margin_pct: number; ebitda: number; ebitda_margin_pct: number; ev: number }
export interface ImpactParams { pnl_line: string; shock_pct: number; exposure_pct: number; pass_through_pct: number }

export const NO_CHANGE: Levers = { price_change_pct: 0, volume_change_pct: 0, cogs_change_pct: 0, opex_change_pct: 0, multiple_change: 0 };
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number(n) || 0));
// Round half away from zero, so a loss rounds like the matching gain (-1.75 -> -1.8, as +1.75 -> +1.8).
// The tiny relative nudge absorbs float error: (1 - 0.0175) - 1 is -0.017499999999999982, not -0.0175.
const round = (n: number, places: number) => Math.sign(n) * Math.round(Math.abs(n) * (1 + 1e-12) * 10 ** places) / 10 ** places;
export const r1 = (n: number) => round(n, 1);
export const r2 = (n: number) => round(n, 2);

export function simulate(c: Record<string, any>, l: Partial<Levers>): Pnl {
  const rev0 = c.annual_revenue || 0;
  const gm0 = (c.gross_margin_pct || 0) / 100;
  const cogs0 = rev0 * (1 - gm0);
  const opex0 = c.opex || 0;
  const mult0 = c.ev_ebitda_multiple || 0;
  const rev = rev0 * (1 + (l.price_change_pct || 0) / 100) * (1 + (l.volume_change_pct || 0) / 100);
  const cogs = cogs0 * (1 + (l.volume_change_pct || 0) / 100) * (1 + (l.cogs_change_pct || 0) / 100);
  const opex = opex0 * (1 + (l.opex_change_pct || 0) / 100);
  const ebitda = rev - cogs - opex;
  return { revenue: rev, gross_margin_pct: rev ? ((rev - cogs) / rev) * 100 : 0, ebitda, ebitda_margin_pct: rev ? (ebitda / rev) * 100 : 0, ev: ebitda * (mult0 + (l.multiple_change || 0)) };
}

export const hasFinancials = (c: Record<string, any>) => (c.annual_revenue || 0) > 0 && c.gross_margin_pct != null;

// An agent's impact estimate as model levers: a shock of shock_pct on the exposed share of one P&L line.
// For a cost shock, the share passed on to customers moves price by that share of the cost change.
export function leversFor(c: Record<string, any>, p: ImpactParams): Levers {
  const size = (Number(p.shock_pct) || 0) * clamp(p.exposure_pct, 0, 100) / 100;
  const rev0 = c.annual_revenue || 0, cogs0 = rev0 * (1 - (c.gross_margin_pct || 0) / 100);
  const l = { ...NO_CHANGE };
  if (p.pnl_line === "cogs") {
    l.cogs_change_pct = size;
    if (rev0) l.price_change_pct = clamp(p.pass_through_pct, 0, 100) / 100 * size * cogs0 / rev0;
  } else if (p.pnl_line === "price") l.price_change_pct = size;
  else if (p.pnl_line === "volume") l.volume_change_pct = size;
  else if (p.pnl_line === "opex") l.opex_change_pct = size;
  else if (p.pnl_line === "valuation") l.multiple_change = (c.ev_ebitda_multiple || 0) * size / 100;
  return l;
}

export const addLevers = (all: Levers[]): Levers =>
  all.reduce((s, l) => ({ price_change_pct: s.price_change_pct + l.price_change_pct, volume_change_pct: s.volume_change_pct + l.volume_change_pct,
    cogs_change_pct: s.cogs_change_pct + l.cogs_change_pct, opex_change_pct: s.opex_change_pct + l.opex_change_pct, multiple_change: s.multiple_change + l.multiple_change }), { ...NO_CHANGE });

// Run-rate EBITDA change and the EV change two ways: capitalised at the multiple if the effect
// persists, or just the quarters it lasts if it's transitory (a two-quarter price spike isn't worth 9x).
export function effectOf(c: Record<string, any>, l: Levers, quarters = 4) {
  const base = simulate(c, {}), s = simulate(c, l);
  const ebitda_delta = s.ebitda - base.ebitda;
  const ev_persistent = s.ev - base.ev;
  const ev_transitory = ebitda_delta * clamp(quarters, 1, 8) / 4 + (l.multiple_change || 0) * base.ebitda;
  const pct = (d: number, of: number) => (of ? r1((d / Math.abs(of)) * 100) : 0);
  return { base, scenario: s, ebitda_delta: r2(ebitda_delta), ebitda_pct: pct(ebitda_delta, base.ebitda),
    ev_persistent: r2(ev_persistent), ev_persistent_pct: pct(ev_persistent, base.ev), ev_transitory: r2(ev_transitory), ev_transitory_pct: pct(ev_transitory, base.ev) };
}

// Finding.impact in the dashboard's terms. EbitdaCharts reads revenue_pct as a price lever and cost_pct
// as a COGS lever, so volume is folded into both and opex into cost: the dashboard's EBITDA then
// comes out exactly right.
export function findingImpact(c: Record<string, any>, l: Levers, rationale: string) {
  const cogs0 = (c.annual_revenue || 0) * (1 - (c.gross_margin_pct || 0) / 100), opex0 = c.opex || 0, v = l.volume_change_pct / 100;
  const cost = cogs0 ? (cogs0 * ((1 + v) * (1 + l.cogs_change_pct / 100) - 1) + opex0 * l.opex_change_pct / 100) / cogs0 * 100 : 0;
  return { revenue_pct: r1(((1 + l.price_change_pct / 100) * (1 + v) - 1) * 100), cost_pct: r1(cost),
    margin_pts: r1(simulate(c, l).gross_margin_pct - simulate(c, {}).gross_margin_pct), rationale };
}

// Materiality 1-5 from the EBITDA effect, against EBITDA (or revenue when EBITDA is thin), plus the
// same bands in dollars for prompts, so agents and code score on one scale.
function bands(c: Record<string, any>) {
  const base = simulate(c, {});
  const thin = Math.abs(base.ebitda) <= 0.05 * base.revenue;
  return { thin, unit: thin ? base.revenue : Math.abs(base.ebitda), cuts: thin ? [0.2, 0.5, 1, 2] : [1, 3, 5, 10] };
}
export function materialityBand(c: Record<string, any>, ebitdaDelta: number): number {
  const { unit, cuts } = bands(c);
  return unit ? 1 + cuts.filter((x) => Math.abs(ebitdaDelta) / unit * 100 >= x).length : 1;
}
export function materialityRubric(c: Record<string, any>): string {
  if (!hasFinancials(c)) return "Materiality (1-5): no financials were entered, so judge by the likely effect on revenue, margins and cash.";
  const { thin, unit, cuts } = bands(c);
  const $ = cuts.map((x) => `$${r2(unit * x / 100)}m`);
  return `Materiality (1-5), by the illustrative effect on annual ${thin ? "revenue" : "EBITDA"} of $${r2(unit)}m: 1 under ${$[0]}; 2 ${$[0]}-${$[1]}; 3 ${$[1]}-${$[2]}, or reverses a key assumption; 4 ${$[2]}-${$[3]}, or challenges a core assumption or objective; 5 over ${$[3]}, or threatens liquidity or the strategy.`;
}

// Listed clients: the share price implied by an EV change at a constant multiple. Client has no net-debt
// field, so this assumes equity moves with EV (true when net debt is small); callers must say so.
export const impliedPrice = (close: number, evPct: number) => r2(close * (1 + evPct / 100));
