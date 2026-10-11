import { fmtM } from "@/lib/finley";

// Topic-specific scenario levers. Each compute returns revenue and EBITDA deltas in USD millions.
const p = (v) => v / 100;

export const LEVERS = {
  "input-costs": {
    levers: [
      { key: "cost", label: "Component cost change", min: -10, max: 15, base: 0, unit: "%" },
      { key: "locked", label: "Share of supply locked at contract prices", min: 0, max: 100, base: 50, unit: "%" },
    ],
    presets: { downside: { cost: 10, locked: 30 }, upside: { cost: -5, locked: 50 } },
    compute: (b, v) => { const c = b.cogs * 0.6 * p(v.cost) * (1 - p(v.locked)); return { rev: 0, ebitda: -c }; },
    formula: (b, v, d) => `COGS Δ = ${fmtM(b.cogs)} × 60% components × ${v.cost}% × (1 − ${v.locked}% locked) = ${fmtM(-d.ebitda)}`,
  },
  "pricing-competition": {
    levers: [
      { key: "cut", label: "Price cut to match competitor", min: 0, max: 12, base: 0, unit: "%" },
      { key: "vol", label: "Volume lost if not matching", min: 0, max: 10, base: 0, unit: "%" },
    ],
    presets: { downside: { cut: 8, vol: 4 }, upside: { cut: 0, vol: 0 } },
    compute: (b, v) => {
      const seg = b.rev * 0.51, r1 = -seg * p(v.cut), r2 = -seg * p(v.vol);
      return { rev: r1 + r2, ebitda: r1 + r2 * b.gm };
    },
    formula: (b, v, d) => `EBITDA Δ = −(${fmtM(b.rev * 0.51)} iPhone × ${v.cut}%) − (${fmtM(b.rev * 0.51)} × ${v.vol}% × ${(b.gm * 100).toFixed(1)}% margin) = ${fmtM(d.ebitda)}`,
  },
  "demand-customers": {
    levers: [{ key: "china", label: "Greater China demand change", min: -20, max: 10, base: 0, unit: "%" }],
    presets: { downside: { china: -9 }, upside: { china: 5 } },
    compute: (b, v) => { const r = b.rev * 0.17 * p(v.china); return { rev: r, ebitda: r * b.gm }; },
    formula: (b, v, d) => `EBITDA Δ = ${fmtM(b.rev * 0.17)} China revenue × ${v.china}% × ${(b.gm * 100).toFixed(1)}% margin = ${fmtM(d.ebitda)}`,
  },
  "logistics-freight": {
    levers: [{ key: "freight", label: "Freight cost change", min: -20, max: 50, base: 0, unit: "%" }],
    presets: { downside: { freight: 25 }, upside: { freight: -10 } },
    compute: (b, v) => ({ rev: 0, ebitda: -b.cogs * 0.02 * p(v.freight) }),
    formula: (b, v, d) => `COGS Δ = ${fmtM(b.cogs)} × 2% freight share × ${v.freight}% = ${fmtM(-d.ebitda)}`,
  },
  regulation: {
    levers: [
      { key: "tariff", label: "Tariff rate", min: 0, max: 25, base: 0, unit: "%" },
      { key: "exposed", label: "Share of COGS exposed", min: 0, max: 100, base: 40, unit: "%" },
      { key: "pass", label: "Cost passed through to price", min: 0, max: 100, base: 0, unit: "%" },
    ],
    presets: { downside: { tariff: 25, exposed: 40, pass: 20 }, upside: { tariff: 0, exposed: 40, pass: 0 } },
    compute: (b, v) => { const c = b.cogs * p(v.exposed) * p(v.tariff), r = c * p(v.pass); return { rev: r, ebitda: r - c }; },
    formula: (b, v, d) => `EBITDA Δ = −${fmtM(b.cogs)} × ${v.exposed}% exposed × ${v.tariff}% tariff × (1 − ${v.pass}% passed on) = ${fmtM(d.ebitda)}`,
  },
};

export const baseValues = (def) => Object.fromEntries(def.levers.map((l) => [l.key, l.base]));

// Bridge: add one lever at a time from base.
export function bridgeSteps(def, b, v) {
  let cur = baseValues(def), prev = 0;
  return def.levers.map((l) => {
    cur = { ...cur, [l.key]: v[l.key] };
    const total = def.compute(b, cur).ebitda, step = total - prev;
    prev = total;
    return { label: l.label, value: step };
  });
}

// Sensitivity: each lever from min to max with the others at base.
export const sensitivity = (def, b) =>
  def.levers.map((l) => {
    const at = (x) => def.compute(b, { ...baseValues(def), [l.key]: x }).ebitda;
    return { label: l.label, low: at(l.min), high: at(l.max), min: l.min, max: l.max };
  });