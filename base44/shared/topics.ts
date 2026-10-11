// Topic models as data. The dashboard's tabs (besides Overview, Eval and Sources) are the client's
// main exposures found during pretraining: the forces in its latest KeywordPlan (shared/keywords.ts).
// Each tab carries a small driver model: sliders, presets, a money formula and a one-line explanation.
// The frontend prototype defined those as code; here they are JSON specs, so they can be generated
// from the keyword plan, stored on records and edited by people or agents. Money expressions use a
// tiny arithmetic language over driver ids (USD millions), parsed without eval(), so a spec stored in
// the database can never run code.
//
// compileTopic() turns a spec into the frontend's Topic shape (compute, formula, presets, longRange),
// so the scenario builder, bridge and tornado work unchanged. This file has no imports on purpose:
// the frontend can copy it as is.

export const UNITS = ["pct", "usdK", "count", "usd", "unitsM", "usdPerTruck"] as const;
export type Unit = typeof UNITS[number];
export type Values = Record<string, number>;
export interface Delta { rev: number; cogs: number; opex: number }

// The keyword planner's exposure categories (shared/keywords.ts CATEGORIES).
export const CATEGORIES = ["company_specific", "pricing_competition", "demand_customers", "input_costs", "supply_chain",
  "regulation_policy", "geopolitics_trade", "labor_talent", "macro_financial", "technology_shifts"] as const;

export interface DriverSpec {
  id: string; label: string; min: number; max: number; step: number; base: number; unit: Unit;
  // Lets code fill the sliders from an impact estimate ("Use in scenario"): a shock driver takes the
  // signed % change, an exposure driver the % of the line exposed, pass_through the % passed on.
  role?: "shock" | "exposure" | "pass_through";
  line?: "cogs" | "price" | "volume" | "opex"; // the P&L line a role driver models
}
export interface TopicSpec {
  id: string; // a slug, unique per client, e.g. "password-sharing"
  name: string; // the tab's name: the exposure's name
  category?: string; sensitivity?: string; keywords?: string[]; why?: string; // from the keyword plan
  subject: string; assumption: string; baseValue: string;
  drivers: DriverSpec[];
  delta: { rev?: string; cogs?: string; opex?: string }; // expressions, USD millions vs plan
  formula: string; // template: {driver} prints its value, {rev}/{cogs}/{opex}/{ebitda} the deltas, {=expr} any amount
  presets: { downside: Values; upside: Values };
  longRange?: { note: string; label: string; value: string; formula: string }; // effects outside the plan year; {value} in formula
}
// The frontend's Topic interface (src/lib/data.ts in the prototype, with a string id), from compileTopic.
export interface Topic {
  id: string; name: string; category?: string; sensitivity?: string; keywords?: string[]; why?: string;
  subject: string; assumption: string; baseValue: string;
  drivers: DriverSpec[];
  compute: (v: Values) => Delta;
  formula: (v: Values) => string;
  presets: { downside: Values; upside: Values };
  longRange?: { note: string; label: string; compute: (v: Values) => number; formula: (v: Values) => string };
}

// Display formats, identical to the prototype's fmtM / fmtDriver so formulas read the same everywhere.
export const fmtM = (x: number, sign = false) => {
  const s = sign && x > 0 ? "+" : x < 0 ? "−" : "";
  const a = Math.abs(x);
  if (a >= 1000) return `${s}$${(a / 1000).toFixed(1)}B`;
  return a < 1 ? `${s}$${(a * 1000).toFixed(0)}K` : `${s}$${a.toFixed(2)}M`;
};
export const fmtDriver = (v: number, u: Unit) => {
  switch (u) {
    case "pct": return `${v}%`;
    case "usdK": return `$${v}K`;
    case "usd": return `$${v.toFixed(2)}`;
    case "unitsM": return `${v}M`;
    case "usdPerTruck": return `$${v.toLocaleString()}`;
    default: return `${v}`;
  }
};

export const slug = (text: string) => String(text || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "topic";

// ---------------------------------------------------------------------------------------------
// Expressions: numbers, driver ids, + - * /, unary minus, parentheses, min(), max(), abs().

type Node =
  | { k: "num"; v: number } | { k: "var"; name: string } | { k: "neg"; a: Node }
  | { k: "bin"; op: string; a: Node; b: Node } | { k: "fn"; name: "min" | "max" | "abs"; args: Node[] };

const MAX_EXPR = 400;

export function parseExpr(src: string, names: ReadonlySet<string>): Node {
  const text = String(src ?? "");
  if (text.length > MAX_EXPR) throw new Error(`expression longer than ${MAX_EXPR} characters`);
  const tokens: string[] = [];
  const re = /\s*(?:(\d+(?:\.\d+)?(?:e[+-]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|([-+*/(),]))/gy;
  let m: RegExpExecArray | null, pos = 0; // a failed sticky match resets lastIndex to 0, so track the position here
  while (pos < text.length && (m = re.exec(text))) { tokens.push(m[1] ?? m[2] ?? m[3]); pos = re.lastIndex; }
  const rest = text.slice(pos).trim();
  if (rest) throw new Error(`unexpected "${rest[0]}" in "${text}"`);
  let i = 0;
  const peek = () => tokens[i];
  const take = (t?: string) => {
    const tok = tokens[i];
    if (tok === undefined || (t && tok !== t)) throw new Error(`expected ${t ? `"${t}"` : "a value"} in "${text}"`);
    i++;
    return tok;
  };
  const expr = (): Node => {
    let a = term();
    while (peek() === "+" || peek() === "-") { const op = take(); a = { k: "bin", op, a, b: term() }; }
    return a;
  };
  const term = (): Node => {
    let a = unary();
    while (peek() === "*" || peek() === "/") { const op = take(); a = { k: "bin", op, a, b: unary() }; }
    return a;
  };
  const unary = (): Node => (peek() === "-" ? (take(), { k: "neg", a: unary() }) : peek() === "+" ? (take(), unary()) : primary());
  const primary = (): Node => {
    const tok = take();
    if (/^\d/.test(tok)) return { k: "num", v: Number(tok) };
    if (tok === "(") { const e = expr(); take(")"); return e; }
    if (/^[A-Za-z_]/.test(tok)) {
      if (peek() === "(") {
        if (tok !== "min" && tok !== "max" && tok !== "abs") throw new Error(`unknown function ${tok}() in "${text}"`);
        take("(");
        const args = [expr()];
        while (peek() === ",") { take(","); args.push(expr()); }
        take(")");
        if (tok === "abs" ? args.length !== 1 : args.length < 2) throw new Error(`${tok}() takes ${tok === "abs" ? "one argument" : "two or more"}`);
        return { k: "fn", name: tok, args };
      }
      if (!names.has(tok)) throw new Error(`unknown driver "${tok}" in "${text}"`);
      return { k: "var", name: tok };
    }
    throw new Error(`unexpected "${tok}" in "${text}"`);
  };
  if (!tokens.length) return { k: "num", v: 0 };
  const node = expr();
  if (i < tokens.length) throw new Error(`unexpected "${tokens[i]}" in "${text}"`);
  return node;
}

export function evalExpr(node: Node, v: Values): number {
  switch (node.k) {
    case "num": return node.v;
    case "var": return Number(v[node.name]) || 0;
    case "neg": return -evalExpr(node.a, v);
    case "fn": {
      const args = node.args.map((a) => evalExpr(a, v));
      return node.name === "abs" ? Math.abs(args[0]) : node.name === "min" ? Math.min(...args) : Math.max(...args);
    }
    case "bin": {
      const a = evalExpr(node.a, v), b = evalExpr(node.b, v);
      if (node.op === "+") return a + b;
      if (node.op === "-") return a - b;
      if (node.op === "*") return a * b;
      return b === 0 ? 0 : a / b; // a zero divisor reads as no effect rather than Infinity on the dashboard
    }
  }
}

// ---------------------------------------------------------------------------------------------

const PLACEHOLDER = /\{(=?)([^{}]+)\}/g;
const DELTA_NAMES = new Set(["rev", "cogs", "opex", "ebitda"]);
const RESERVED = new Set([...DELTA_NAMES, "value", "min", "max", "abs"]);

export const baseValues = (drivers: DriverSpec[]): Values => Object.fromEntries(drivers.map((d) => [d.id, d.base]));

// Checks a spec and compiles it. Throws with every problem listed, so a bad spec is caught when it
// is built or saved, never on the dashboard.
export function compileTopic(spec: TopicSpec): Topic {
  const problems: string[] = [];
  const drivers = Array.isArray(spec?.drivers) ? spec.drivers : [];
  if (!/^[a-z0-9][a-z0-9-]*$/.test(spec?.id || "")) problems.push(`topic id "${spec?.id}" must be a lowercase slug`);
  if (!String(spec?.name || "").trim()) problems.push("needs a name");
  if (!drivers.length) problems.push("needs at least one driver");
  const ids = new Set<string>();
  for (const d of drivers) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(d.id || "")) problems.push(`driver id "${d.id}" must be a plain identifier`);
    if (ids.has(d.id)) problems.push(`duplicate driver id "${d.id}"`);
    if (RESERVED.has(d.id)) problems.push(`driver id "${d.id}" is reserved`);
    ids.add(d.id);
    if (!UNITS.includes(d.unit)) problems.push(`driver "${d.id}" has unknown unit "${d.unit}"`);
    if (!(d.min <= d.base && d.base <= d.max)) problems.push(`driver "${d.id}" base ${d.base} is outside ${d.min}..${d.max}`);
    if (!(d.step > 0)) problems.push(`driver "${d.id}" needs a positive step`);
  }
  const parse = (label: string, src: string | undefined) => {
    try { return parseExpr(src ?? "0", ids); } catch (e) { problems.push(`${label}: ${(e as Error).message}`); return { k: "num", v: 0 } as Node; }
  };
  const rev = parse("delta.rev", spec?.delta?.rev), cogs = parse("delta.cogs", spec?.delta?.cogs), opex = parse("delta.opex", spec?.delta?.opex);
  const lr = spec?.longRange ? parse("longRange.value", spec.longRange.value) : null;
  const inline = new Map<string, Node>();
  const checkTemplate = (label: string, tpl: string, extra: Set<string>) => {
    for (const [, eq, body] of String(tpl ?? "").matchAll(PLACEHOLDER)) {
      if (eq) { if (!inline.has(body)) inline.set(body, parse(`${label} {=${body}}`, body)); }
      else if (!ids.has(body) && !DELTA_NAMES.has(body) && !extra.has(body)) problems.push(`${label}: unknown placeholder {${body}}`);
    }
  };
  checkTemplate("formula", spec?.formula, new Set());
  if (spec?.longRange) checkTemplate("longRange.formula", spec.longRange.formula, new Set(["value"]));
  for (const which of ["downside", "upside"] as const) {
    for (const k of Object.keys(spec?.presets?.[which] ?? {})) if (!ids.has(k)) problems.push(`presets.${which} sets unknown driver "${k}"`);
  }
  if (problems.length) throw new Error(`Topic "${spec?.id}" is invalid: ${problems.join("; ")}`);

  const base = baseValues(drivers);
  const full = (v: Values) => ({ ...base, ...(v || {}) });
  const compute = (v: Values): Delta => { const x = full(v); return { rev: evalExpr(rev, x), cogs: evalExpr(cogs, x), opex: evalExpr(opex, x) }; };
  const byId = new Map(drivers.map((d) => [d.id, d]));
  const render = (tpl: string, x: Values, extra: Record<string, number>) => {
    let delta: Delta | null = null;
    return tpl.replace(PLACEHOLDER, (_all, eq: string, body: string) => {
      if (eq) return fmtM(evalExpr(inline.get(body)!, x));
      const d = byId.get(body);
      if (d) return fmtDriver(Number(x[body]), d.unit);
      if (body in extra) return fmtM(extra[body]);
      delta ??= compute(x);
      return fmtM(body === "ebitda" ? delta.rev - delta.cogs - delta.opex : delta[body as keyof Delta]);
    });
  };
  return {
    id: spec.id, name: spec.name, category: spec.category, sensitivity: spec.sensitivity, keywords: spec.keywords, why: spec.why,
    subject: spec.subject, assumption: spec.assumption, baseValue: spec.baseValue,
    drivers: drivers.map((d) => ({ ...d })),
    compute,
    formula: (v) => render(spec.formula, full(v), {}),
    presets: { downside: { ...spec.presets.downside }, upside: { ...spec.presets.upside } },
    ...(spec.longRange && lr ? {
      longRange: {
        note: spec.longRange.note, label: spec.longRange.label,
        compute: (v: Values) => evalExpr(lr, full(v)),
        formula: (v: Values) => { const x = full(v); return render(spec.longRange!.formula, x, { value: evalExpr(lr, x) }); },
      },
    } : {}),
  };
}

// ---------------------------------------------------------------------------------------------
// Topics from the keyword plan: one tab per exposure, most important first, each with a driver model
// chosen by the exposure's category and sized from the client's own financials.

const r2 = (n: number) => Math.round(n * 100) / 100;
const lit = (n: number) => String(r2(n));

export function clientBase(c: Record<string, any>): Delta {
  const rev = Number(c.annual_revenue) || 0;
  const gm = Number(c.gross_margin_pct);
  return { rev, cogs: rev * (1 - (Number.isFinite(gm) ? gm : 0) / 100), opex: Number(c.opex) || 0 };
}

export interface ExposureLike { name: string; category?: string; driver?: string; why?: string; sensitivity?: string; keywords?: string[] }

// Wider slider ranges and presets for forces the planner rated more sensitive.
const SWING: Record<string, number> = { high: 1.5, medium: 1, low: 0.6 };

type Model = Pick<TopicSpec, "drivers" | "delta" | "formula" | "presets"> & { baseValue: string };

function modelFor(category: string, e: ExposureLike, b: Delta): Model {
  const k = SWING[e.sensitivity || "medium"] ?? 1;
  const R = lit(b.rev), C = lit(b.cogs), O = lit(b.opex);
  const span = (n: number) => Math.max(1, Math.round(n * k));
  const short = e.name.length > 32 ? `${e.name.slice(0, 30)}…` : e.name;
  switch (category) {
    case "input_costs": case "supply_chain": case "geopolitics_trade":
      return {
        baseValue: `${fmtM(b.cogs)} COGS`,
        drivers: [
          { id: "shock", label: `${short}: cost change`, min: -span(10), max: span(20), step: 0.5, base: 0, unit: "pct", role: "shock", line: "cogs" },
          { id: "exposure", label: "Share of COGS exposed", min: 0, max: 100, step: 5, base: 25, unit: "pct", role: "exposure", line: "cogs" },
          { id: "pass", label: "Share passed on to prices", min: 0, max: 100, step: 5, base: 0, unit: "pct", role: "pass_through", line: "cogs" },
        ],
        delta: { cogs: `${C} * exposure / 100 * shock / 100`, rev: `${C} * exposure / 100 * shock / 100 * pass / 100` },
        formula: `COGS Δ = ${fmtM(b.cogs)} × {exposure} exposed × {shock} = {cogs}; passed on to prices {pass} = {rev}`,
        presets: { downside: { shock: span(12), exposure: 40 }, upside: { shock: -span(5) } },
      };
    case "pricing_competition":
      return {
        baseValue: "0% price change",
        drivers: [
          { id: "price", label: `${short}: price change`, min: -span(8), max: span(8), step: 0.5, base: 0, unit: "pct", role: "shock", line: "price" },
          { id: "vol", label: "Volume change from the price move", min: -span(8), max: span(8), step: 0.5, base: 0, unit: "pct" },
        ],
        delta: { rev: `${R} * (price + vol) / 100`, cogs: `${C} * vol / 100` },
        formula: `Revenue Δ = ${fmtM(b.rev)} × ({price} price + {vol} volume) = {rev}; COGS Δ = {cogs}; EBITDA Δ = {ebitda}`,
        presets: { downside: { price: -span(5), vol: -span(2) }, upside: { price: span(3) } },
      };
    case "labor_talent":
      return {
        baseValue: `${fmtM(b.opex)} opex`,
        drivers: [
          { id: "wage", label: `${short}: cost change`, min: -span(5), max: span(10), step: 0.5, base: 0, unit: "pct", role: "shock", line: "opex" },
          { id: "share", label: "Payroll share of opex", min: 0, max: 100, step: 5, base: 50, unit: "pct", role: "exposure", line: "opex" },
        ],
        delta: { opex: `${O} * share / 100 * wage / 100` },
        formula: `Opex Δ = ${fmtM(b.opex)} × {share} payroll × {wage} = {opex}`,
        presets: { downside: { wage: span(6) }, upside: { wage: -span(2) } },
      };
    case "regulation_policy": {
      const cap = Math.max(50, Math.round(b.rev * 10)); // up to ~1% of revenue, in $K
      return {
        baseValue: "$0 new compliance cost",
        drivers: [{ id: "cost", label: `${short}: cost per year`, min: 0, max: cap, step: Math.max(10, Math.round(cap / 20)), base: 0, unit: "usdK", role: "shock", line: "opex" }],
        delta: { opex: "cost / 1000" },
        formula: "Opex Δ = {cost} a year = {opex}",
        presets: { downside: { cost: Math.round(cap / 2) }, upside: { cost: 0 } },
      };
    }
    case "macro_financial":
      return {
        baseValue: `${fmtM(b.rev)} revenue`,
        drivers: [
          { id: "move", label: `${short}: effect on revenue`, min: -span(10), max: span(6), step: 0.5, base: 0, unit: "pct", role: "shock", line: "price" },
          { id: "exposure", label: "Share of revenue exposed", min: 0, max: 100, step: 5, base: 40, unit: "pct", role: "exposure", line: "price" },
        ],
        delta: { rev: `${R} * exposure / 100 * move / 100` },
        formula: `Revenue Δ = ${fmtM(b.rev)} × {exposure} exposed × {move} = {rev}`,
        presets: { downside: { move: -span(6) }, upside: { move: span(3) } },
      };
    default: // company_specific, demand_customers, technology_shifts and anything unknown: a volume driver
      return {
        baseValue: `${fmtM(b.rev)} revenue`,
        drivers: [{ id: "vol", label: `${short}: volume change vs plan`, min: -span(12), max: span(12), step: 0.5, base: 0, unit: "pct", role: "shock", line: "volume" }],
        delta: { rev: `${R} * vol / 100`, cogs: `${C} * vol / 100` },
        formula: `Revenue Δ = ${fmtM(b.rev)} × {vol} = {rev}; EBITDA Δ = {ebitda}`,
        presets: { downside: { vol: -span(8) }, upside: { vol: span(6) } },
      };
  }
}

// One topic spec per exposure. The assumption shown is the client's own when its driver names the
// exposure's driver; otherwise the exposure's "why".
export function topicsFromPlan(client: Record<string, any>, plan: { exposures?: ExposureLike[] } | null | undefined, max = 8): TopicSpec[] {
  const b = clientBase(client);
  const used = new Set<string>();
  const assumptions: any[] = client.assumptions || [];
  return (plan?.exposures || []).filter((e) => String(e?.name || "").trim()).slice(0, max).map((e) => {
    let id = slug(e.name), n = 2;
    while (used.has(id)) id = `${slug(e.name)}-${n++}`;
    used.add(id);
    const category = CATEGORIES.includes(e.category as any) ? String(e.category) : "company_specific";
    const own = assumptions.find((a) => e.driver && String(a?.driver || "").toLowerCase() === e.driver.toLowerCase());
    const { baseValue, ...model } = modelFor(category, e, b);
    return {
      id, name: e.name.trim(), category, sensitivity: e.sensitivity || "medium", keywords: e.keywords || [], why: e.why || "",
      subject: e.driver || e.name, assumption: own?.text || e.why || `${e.name} holds at plan`, baseValue, ...model,
    };
  });
}

// Driver values that express an impact estimate (the impact estimator's inputs) on a topic, for the
// frontend's "Use in scenario" button. Only drivers with a matching role and line are filled.
export interface ImpactInputs { pnl_line: string; shock_pct: number; exposure_pct: number; pass_through_pct?: number }
export function scenarioFor(spec: Pick<TopicSpec, "drivers">, inputs: ImpactInputs | null | undefined): Values | undefined {
  if (!inputs || !Number(inputs.shock_pct)) return undefined;
  const on = spec.drivers.filter((d) => d.role && (!d.line || d.line === inputs.pnl_line));
  const shock = on.find((d) => d.role === "shock");
  if (!shock) return undefined;
  const exposure = on.find((d) => d.role === "exposure");
  const pass = on.find((d) => d.role === "pass_through");
  const snap = (d: DriverSpec, n: number) => Math.min(d.max, Math.max(d.min, Math.round(n / d.step) * d.step));
  const out: Values = {};
  // Without an exposure slider the shock applies to the whole line, so scale it by the exposed share.
  out[shock.id] = snap(shock, exposure ? Number(inputs.shock_pct) : Number(inputs.shock_pct) * (Number(inputs.exposure_pct) || 100) / 100);
  if (exposure) out[exposure.id] = snap(exposure, Number(inputs.exposure_pct) || 0);
  if (pass && inputs.pass_through_pct != null) out[pass.id] = snap(pass, Number(inputs.pass_through_pct) || 0);
  return out;
}
