import { effectOf, findingImpact, hasFinancials, type Levers, leversFor, materialityBand, NO_CHANGE, r2 } from "../../shared/finance.ts";
import { canon, clampScore } from "../../shared/schema.ts";
import { PNL_LINES } from "./company.ts";
import { UI_TOPICS } from "./research.ts";

// Turns the impact estimator's inputs into money with finance.ts: the central effect, a range from the
// plausible shock bounds, the dashboard's Finding.impact, and a materiality band for scoring. The
// derivation is spelled out in plain words, so every figure shows where it came from.

export interface Candidate {
  development_ids: string[]; topic: string; driver: string; assumption_indexes: number[]; effect: string; mechanism: string; estimate: string;
  pnl_line: string; shock_pct: number; exposure_pct: number; pass_through_pct: number; persistence: string; duration_quarters: number;
  shock_min_pct: number; shock_max_pct: number; shock_basis: string; exposure_basis: string; likelihood: number; horizon: string;
}
export interface Quantified extends Candidate {
  id: string; // "C0", "C1", ...
  quantified: boolean; levers: Levers; quarters: number;
  ebitda_delta: number; ebitda_low: number; ebitda_high: number; // USD m a year while it lasts
  ev_delta: number; ev_pct: number; // persistent: capitalised at the multiple; transitory: the quarters it lasts
  band: number; // materiality band of the central EBITDA effect
  impact: { revenue_pct: number; cost_pct: number; margin_pts: number; rationale: string } | null;
}

const money = (n: number) => `${n < 0 ? "-" : "+"}$${Math.abs(n)}m`;

// `grounded` holds the ids of developments that passed the source check; other ids are dropped.
export function quantifyCandidates(client: Record<string, any>, candidates: Candidate[], grounded: Set<string>, mergedInto: Record<string, string> = {}): Quantified[] {
  const financials = hasFinancials(client);
  return (candidates || []).slice(0, 8).map((c, i): Quantified => {
    const pnl_line = canon(c.pnl_line, PNL_LINES, "cogs");
    const development_ids = [...new Set((c.development_ids || []).map((id) => String(id).trim().toUpperCase())
      .map((id) => mergedInto[id] || id).filter((id) => grounded.has(id)))];
    const base = { ...c, id: `C${i}`, pnl_line, development_ids, topic: canon(c.topic, Object.keys(UI_TOPICS), "input_costs"), likelihood: clampScore(c.likelihood) };
    // Money only for shocks whose size a verified source reported: an assumed size, or one from a claim
    // that failed the source check, is an invented number, and CLAUDE.md wants no impact rather than that.
    const ok = financials && development_ids.length > 0 && canon(c.estimate, ["quantified"], "") === "quantified" && canon(c.shock_basis, ["article"], "") === "article"
      && Number.isFinite(Number(c.shock_pct)) && Number(c.shock_pct) !== 0 && Number(c.exposure_pct) > 0;
    if (!ok) return { ...base, quantified: false, levers: { ...NO_CHANGE }, quarters: 0, ebitda_delta: 0, ebitda_low: 0, ebitda_high: 0, ev_delta: 0, ev_pct: 0, band: 1, impact: null };
    const persistent = canon(c.persistence, ["persistent"], "transitory") === "persistent";
    const quarters = persistent ? 4 : Math.min(8, Math.max(1, Math.round(Number(c.duration_quarters) || 1)));
    const at = (shock: number) => leversFor(client, { pnl_line, shock_pct: shock, exposure_pct: c.exposure_pct, pass_through_pct: c.pass_through_pct });
    const levers = at(c.shock_pct);
    const central = effectOf(client, levers, quarters);
    // Unparseable bounds are dropped, not coerced to 0 (a zero would fake a best case in the range).
    const ends = [[c.shock_min_pct, c.shock_max_pct].map(Number).filter(Number.isFinite), Number(c.shock_pct)]
      .flat().map((s) => effectOf(client, at(s), quarters).ebitda_delta);
    const valued = client.ev_ebitda_multiple > 0; // no multiple entered, no EV to speak of
    const [ev_delta, ev_pct] = !valued ? [0, 0] : persistent ? [central.ev_persistent, central.ev_persistent_pct] : [central.ev_transitory, central.ev_transitory_pct];
    const how = `${c.shock_pct > 0 ? "+" : ""}${c.shock_pct}% on ${c.exposure_pct}% of ${pnl_line === "cogs" ? "COGS" : pnl_line} (shock: ${c.shock_basis}; exposure: ${c.exposure_basis})` +
      (pnl_line === "cogs" && c.pass_through_pct ? `, ${c.pass_through_pct}% passed on to prices` : "");
    const lasts = persistent ? "persistent" : `lasting ${quarters} quarter${quarters > 1 ? "s" : ""}`;
    const ev = valued ? `; EV ${money(ev_delta)}` : "";
    const rationale = `Illustrative scenario, not a forecast: ${how}, ${lasts}. EBITDA ${money(central.ebitda_delta)} a year while it lasts (range ${money(Math.min(...ends))} to ${money(Math.max(...ends))})${ev}.`;
    // A valuation shock moves the multiple, not EBITDA, so an EBITDA band would always read 1: leave it unbanded.
    return { ...base, quantified: true, levers, quarters, ebitda_delta: central.ebitda_delta, ebitda_low: r2(Math.min(...ends)), ebitda_high: r2(Math.max(...ends)),
      ev_delta, ev_pct, band: pnl_line === "valuation" ? 0 : materialityBand(client, central.ebitda_delta), impact: findingImpact(client, levers, rationale) };
  });
}

// Compact view for the company lead and the scenario agent: the computed money next to the inputs.
export function renderCandidates(candidates: Quantified[]): string {
  if (!candidates.length) return "No impact candidates this scan.";
  return candidates.map((c) => `<candidate id="${c.id}" topic="${c.topic}" driver="${(c.driver || "").replace(/"/g, "'")}" effect="${c.effect}" likelihood="${c.likelihood}" horizon="${c.horizon}" developments="${c.development_ids.join(",")}"${
    c.quantified ? ` ebitda_per_year="${money(c.ebitda_delta)} (range ${money(c.ebitda_low)} to ${money(c.ebitda_high)})"${c.ev_delta ? ` ev="${money(c.ev_delta)} (${c.ev_pct}%)"` : ""}${c.band ? ` materiality_band="${c.band}"` : ""}` : ' quantified="no"'}>\n${c.mechanism}${c.impact ? `\n${c.impact.rationale}` : ""}\n</candidate>`).join("\n");
}
