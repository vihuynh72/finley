import assert from "node:assert/strict";
import { compileTopic, parseExpr, scenarioFor, topicsFromPlan, type TopicSpec } from "../../base44/shared/topics.ts";

// The prototype's Halvorsen "input" topic, written as a spec: the compiled topic must give the
// prototype's numbers (COGS Δ = $31.68M × 11% × oat% × (1 − locked%)).
const oats: TopicSpec = {
  id: "oats", name: "Oats and ingredients", subject: "Oats", assumption: "Gross margin holds at 34%", baseValue: "34.0% gross margin",
  drivers: [
    { id: "oat", label: "Oat price change", min: 0, max: 15, step: 0.5, base: 0, unit: "pct" },
    { id: "locked", label: "Share of volume locked", min: 0, max: 100, step: 5, base: 50, unit: "pct" },
  ],
  delta: { cogs: "31.68 * 0.11 * oat / 100 * (1 - locked / 100)" },
  formula: "COGS Δ = $31.68M × 11% oats × {oat} × (1 − {locked}) = {cogs}",
  presets: { downside: { oat: 15, locked: 25 }, upside: { oat: 0 } },
};

Deno.test("compiled spec reproduces the prototype's numbers and formula text", () => {
  const t = compileTopic(oats);
  assert.ok(Math.abs(t.compute({ oat: 15 }).cogs - 0.26136) < 1e-9); // other drivers fall back to base (50% locked)
  assert.equal(t.formula({ oat: 9, locked: 50 }), "COGS Δ = $31.68M × 11% oats × 9% × (1 − 50%) = $157K");
  assert.deepEqual(t.compute({}), { rev: 0, cogs: 0, opex: 0 });
});

Deno.test("expressions: precedence, unary minus, functions, zero divisor", () => {
  const names = new Set(["a", "b"]);
  const ev = (src: string, v: Record<string, number>) => {
    const t = compileTopic({ ...oats, drivers: [{ id: "a", label: "a", min: -100, max: 100, step: 1, base: 0, unit: "pct" }, { id: "b", label: "b", min: -100, max: 100, step: 1, base: 0, unit: "pct" }], delta: { rev: src }, formula: "{rev}", presets: { downside: {}, upside: {} } });
    return t.compute(v).rev;
  };
  assert.equal(ev("1 + 2 * 3", {}), 7);
  assert.equal(ev("-(a - b) * 2", { a: 5, b: 2 }), -6);
  assert.equal(ev("max(a, b, 10) + min(a, b) + abs(-3)", { a: 4, b: -1 }), 12);
  assert.equal(ev("a / b", { a: 4, b: 0 }), 0);
  assert.equal(ev("2e1 / 4", {}), 5);
  assert.throws(() => parseExpr("a + c", names), /unknown driver "c"/);
  assert.throws(() => parseExpr("alert(1)", names), /unknown function alert/);
  assert.throws(() => parseExpr("a; b", names), /unexpected ";"/);
  assert.throws(() => parseExpr("(a + b", names), /expected "\)"/);
  assert.throws(() => parseExpr("a b", names), /unexpected "b"/);
});

Deno.test("invalid specs fail loudly with every problem", () => {
  const bad = { ...oats, id: "Bad Id", drivers: [{ ...oats.drivers[0], base: 99 }, { ...oats.drivers[0] }], formula: "{nope}", presets: { downside: { zzz: 1 }, upside: {} } };
  assert.throws(() => compileTopic(bad as TopicSpec), (e: Error) =>
    /lowercase slug/.test(e.message) && /outside/.test(e.message) && /duplicate driver/.test(e.message) && /\{nope\}/.test(e.message) && /unknown driver "zzz"/.test(e.message));
});

Deno.test("long-range topics render their own value", () => {
  const t = compileTopic({ ...oats, id: "fee", delta: {}, formula: "FY Δ = {cogs}", longRange: { note: "2028", label: "2028 cost", value: "oat * locked / 100", formula: "2028 cost = {value}" } });
  assert.equal(t.longRange!.compute({ oat: 2, locked: 50 }), 1);
  assert.equal(t.longRange!.formula({ oat: 2, locked: 50 }), "2028 cost = $1.00M");
});

Deno.test("topicsFromPlan: one compiling tab per exposure, unique slugs, client assumption reused", () => {
  const client = { annual_revenue: 48, gross_margin_pct: 34, opex: 11, assumptions: [{ text: "Gross margin holds at 34%", driver: "Oat prices" }] };
  const plan = { exposures: [
    { name: "Oat prices", category: "input_costs", driver: "Oat prices", why: "Oats are 11% of COGS", sensitivity: "high", keywords: ["oat prices"] },
    { name: "Oat prices", category: "supply_chain", driver: "Freight", why: "w", sensitivity: "low", keywords: [] },
    { name: "Snack bar price war", category: "pricing_competition", driver: "Bar pricing", why: "x", sensitivity: "medium", keywords: [] },
    { name: "Packaging fees", category: "regulation_policy", driver: "Regulation", why: "y", sensitivity: "low", keywords: [] },
    { name: "Wages", category: "labor_talent", driver: "Payroll", why: "z", sensitivity: "medium", keywords: [] },
    { name: "Rates & FX", category: "macro_financial", driver: "FX", why: "z", sensitivity: "medium", keywords: [] },
    { name: "Grocery demand", category: "demand_customers", driver: "Volume", why: "z", sensitivity: "medium", keywords: [] },
  ] };
  const specs = topicsFromPlan(client, plan);
  assert.deepEqual(specs.map((s) => s.id), ["oat-prices", "oat-prices-2", "snack-bar-price-war", "packaging-fees", "wages", "rates-fx", "grocery-demand"]);
  assert.equal(specs[0].assumption, "Gross margin holds at 34%");
  for (const s of specs) {
    const t = compileTopic(s);
    for (const p of ["downside", "upside"] as const) assert.ok(Number.isFinite(t.compute(t.presets[p]).rev));
    assert.ok(t.formula({}).length > 5);
  }
  // A 10% cost shock on 25% of $31.68M COGS.
  assert.ok(Math.abs(compileTopic(specs[0]).compute({ shock: 10 }).cogs - 0.792) < 1e-9);
});

Deno.test("scenarioFor maps an impact estimate onto role drivers", () => {
  const [input, , pricing] = topicsFromPlan({ annual_revenue: 48, gross_margin_pct: 34, opex: 11 }, { exposures: [
    { name: "Oats", category: "input_costs" }, { name: "x", category: "input_costs" }, { name: "Price war", category: "pricing_competition" }] });
  assert.deepEqual(scenarioFor(input, { pnl_line: "cogs", shock_pct: 9, exposure_pct: 11, pass_through_pct: 0 }), { shock: 9, exposure: 10, pass: 0 });
  // No exposure slider on pricing: a -12% shock on 30% of revenue becomes -3.5% (snapped to the 0.5 step).
  assert.deepEqual(scenarioFor(pricing, { pnl_line: "price", shock_pct: -12, exposure_pct: 30 }), { price: -3.5 });
  assert.equal(scenarioFor(pricing, { pnl_line: "cogs", shock_pct: 5, exposure_pct: 100 }), undefined);
  assert.equal(scenarioFor(input, { pnl_line: "cogs", shock_pct: 0, exposure_pct: 100 }), undefined);
});
