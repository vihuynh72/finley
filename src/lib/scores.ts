import type { Client, Finding, Source, SourceType } from "./data";
import { baseValues, ebitdaDelta, presetValues } from "./model";

export type Tier = 1 | 2 | 3 | 4;
export const TIER_SCORE: Record<Tier, number> = { 1: 95, 2: 80, 3: 55, 4: 25 };
export const TIER_DESC: Record<Tier, string> = {
  1: "Company filings and press releases, government data, regulator publications",
  2: "Major financial and trade press",
  3: "Industry blogs, analyst newsletters",
  4: "Unverified blogs, social media",
};
export interface TierOverride { tier: Tier; reason: string; at: string }
export type Overrides = Record<string, TierOverride>;

// The backend tiers each source from its outlet and URL (base44/shared/sources.ts); this fallback
// covers sources that arrive without one.
export function defaultTier(name: string, type: SourceType, tier?: Tier): Tier {
  if (tier) return tier;
  if (type === "Primary company" || type === "Government") return 1;
  if (type === "Trade press") return /survey|newsletter/i.test(name) ? 3 : 2;
  return 4;
}
export const sourceTier = (s: Source, o: Overrides): Tier => o[s.name]?.tier ?? defaultTier(s.name, s.type, s.tier);

const clamp = (x: number) => Math.max(0, Math.min(100, Math.round(x)));
const URGENCY_DAYS = { urgent: 60, review: 200, info: 400 } as const;

export interface Score {
  materiality: number; reliability: number; confidence: number; urgency: number; priority: number;
  impact: number; baseEbitda: number; impactPct: number; impactBasis: string;
  corroboration: number; corrobLabel: string; days: number;
  sourceScores: { name: string; tier: Tier; score: number }[];
}

export function scoreFinding(c: Client, f: Finding, o: Overrides = {}): Score {
  const t = c.topics[f.topicId];
  const baseEbitda = Math.abs(c.base.rev - c.base.cogs - c.base.opex) || 1;
  let impact: number, impactBasis: string;
  if (!t) {
    impact = 0;
    impactBasis = "no topic model for this finding";
  } else if (f.scenario) {
    impact = Math.abs(ebitdaDelta(t.compute({ ...baseValues(t), ...f.scenario })));
    impactBasis = "midpoint of the finding's illustrative range";
  } else {
    impact = Math.abs(ebitdaDelta(t.compute(presetValues(t, "downside")))) / 2;
    impactBasis = "half the topic's downside case (no range given)";
  }
  const impactPct = (impact / baseEbitda) * 100;
  const materiality = clamp(impactPct * 10);
  const sourceScores = f.sources.map((s) => { const tier = sourceTier(s, o); return { name: s.name, tier, score: TIER_SCORE[tier] }; });
  const reliability = clamp(sourceScores.reduce((a, s) => a + s.score, 0) / Math.max(1, sourceScores.length));
  const tiers = sourceScores.map((s) => s.tier);
  const conflict = tiers.includes(4) && tiers.some((x) => x <= 2);
  const corroboration = conflict ? 0.6 : sourceScores.length >= 2 ? 1 : 0.8;
  const corrobLabel = conflict ? "sources conflict" : sourceScores.length >= 2 ? "2+ independent sources agree" : "one source";
  const confidence = clamp(reliability * corroboration);
  const days = URGENCY_DAYS[f.severity];
  const urgency = days <= 90 ? 100 : days <= 365 ? 50 : 20;
  const priority = clamp(0.5 * materiality + 0.3 * confidence + 0.2 * urgency);
  return { materiality, reliability, confidence, urgency, priority, impact, baseEbitda, impactPct, impactBasis, corroboration, corrobLabel, days, sourceScores };
}

export interface SourceRow { name: string; type: SourceType; defaultTier: Tier; findings: string[]; url?: string }
export function allSources(c: Client | null): SourceRow[] {
  const m = new Map<string, SourceRow>();
  for (const f of c?.findings ?? []) for (const s of f.sources) {
    const r = m.get(s.name) ?? { name: s.name, type: s.type, defaultTier: defaultTier(s.name, s.type, s.tier), findings: [], ...(s.url ? { url: s.url } : {}) };
    r.findings.push(f.id); m.set(s.name, r);
  }
  return [...m.values()].sort((a, b) => a.defaultTier - b.defaultTier || a.name.localeCompare(b.name));
}
