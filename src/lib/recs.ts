// "Recommended next steps", decided by fixed rules from the client's findings and each topic's
// driver model, so every number on a recommendation traces to a formula. Values in $M (same as the
// client base). One recommendation per topic that has findings, built from its strongest finding.
import { fmtM, type Client, type Finding } from "./data";
import { baseValues, ebitdaDelta, presetValues } from "./model";

export type RecType = "Change assumption" | "Get information" | "Hold and watch" | "No action needed";
export type RecStatus = "open" | "accepted" | "snoozed" | "dismissed";
export interface Rec {
  id: string; type: RecType; label?: string; headline: string; why: string; findings: string[];
  impactText: string; formula: string; confidence: number; effort: "Quick" | "Some work" | "Needs client";
  timing: string; base?: number; downside?: number; upside?: number; draft?: string; summary: string;
}

const RANK = { urgent: 0, review: 1, info: 2 } as const;
const CONF_PCT = { high: 85, medium: 60, low: 35 } as const;
export const fmtK = (x: number) => (Math.abs(x) < 1 ? `$${Math.round(Math.abs(x) * 1000)}K` : fmtM(Math.abs(x)));
const dayLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const sentence = (s: string) => (s.trim().endsWith(".") ? s.trim() : `${s.trim()}.`);

export function recsFor(c: Client, isDismissed: (findingId: string) => boolean = () => false): Rec[] {
  const timing = c.reforecastDue ? `Before reforecast on ${dayLabel(c.reforecastDue)}` : "Before the next reforecast";
  const out: Rec[] = [];
  for (const t of c.topicOrder) {
    const topic = c.topics[t];
    const fs = c.findings.filter((f) => f.topicId === t && !isDismissed(f.id))
      .sort((a, b) => RANK[a.severity] - RANK[b.severity] || b.scores.priority - a.scores.priority);
    const top: Finding | undefined = fs[0];
    if (!topic || !top) continue;
    const linked = fs.slice(0, 3).map((f) => f.id);
    const vals = { ...baseValues(topic), ...(top.scenario ?? {}) };
    const eff = top.scenario ? ebitdaDelta(topic.compute(vals)) : 0;
    const worst = ebitdaDelta(topic.compute(presetValues(topic, "downside")));
    const formula = top.scenario ? topic.formula(vals) : "No range given with this finding yet; impact not quantified";
    const conf = CONF_PCT[top.confidence];
    const id = `rec-${t}-${top.id}`;
    const adverse = top.effect === "Challenged" || top.effect === "Under pressure";
    const why = sentence(`${top.title}${top.interpretation ? `. ${top.interpretation}` : ""}`);

    if (adverse && top.confidence === "high" && eff < 0) {
      out.push({ id, type: "Change assumption", headline: `Consider lowering the plan for ${topic.name.toLowerCase()}: “${topic.assumption}” no longer holds.`,
        why, findings: linked, impactText: `EBITDA down ${fmtK(eff)}`, formula, confidence: conf, effort: "Quick", timing,
        base: eff, ...(worst < eff ? { downside: worst - eff } : {}),
        summary: `${sentence(top.title)} We have lowered the ${topic.name.toLowerCase()} assumption, about ${fmtK(eff)} of EBITDA.` });
    } else if (adverse && top.changeView) {
      out.push({ id, type: "Get information", headline: `Before changing the plan, find out: ${top.changeView.replace(/\.$/, "")}.`,
        why: `${why} Evidence so far: ${top.confidenceReason || `${top.confidence} confidence`}`, findings: linked,
        impactText: eff ? `Up to ${fmtK(eff)} EBITDA at stake` : "Impact depends on the answer", formula, confidence: conf,
        effort: "Needs client", timing, ...(eff < 0 ? { downside: eff } : {}),
        draft: `Quick question before we finalize the reforecast: ${top.changeView.replace(/\.$/, "")}? We are watching this: ${top.title}.`,
        summary: `We are confirming ${top.changeView.replace(/\.$/, "").toLowerCase()} before deciding whether ${topic.name.toLowerCase()} changes the plan.` });
    } else if (adverse) {
      out.push({ id, type: "Hold and watch", headline: `Keep ${topic.name.toLowerCase()} at plan in the base case, and carry the risk in the downside.`,
        why: `${why} The evidence is ${top.confidence} confidence, too weak to change the base case.`, findings: linked,
        impactText: eff ? `Up to ${fmtK(eff)} EBITDA at risk, downside case only` : "Risk not yet quantified", formula, confidence: conf,
        effort: "Some work", timing, ...(eff < 0 ? { downside: eff } : {}),
        summary: `${sentence(top.title)} Until it is confirmed we are keeping ${topic.name.toLowerCase()} at plan and carrying the risk in the downside case.` });
    } else if (top.effect === "Supported" && eff > 0) {
      out.push({ id, type: "Change assumption", label: "Change assumption, upside only", headline: `Consider adding the ${topic.name.toLowerCase()} upside to the upside case, not the base.`,
        why, findings: linked, impactText: `Up to ${fmtK(eff)} EBITDA, upside case only`, formula, confidence: conf, effort: "Quick", timing, upside: eff,
        summary: `${sentence(top.title)} That adds about ${fmtK(eff)} of EBITDA to the upside case.` });
    } else {
      out.push({ id, type: "No action needed", headline: `${topic.name} assumption is holding.`, why, findings: linked,
        impactText: eff ? `About ${fmtK(eff)} ${eff > 0 ? "upside" : "risk"}, too small to change the base` : "No change", formula,
        confidence: conf, effort: "Quick", timing, ...(eff > 0 ? { upside: eff } : {}),
        summary: `${topic.name} is holding; no change to the forecast.` });
    }
  }
  return out;
}
