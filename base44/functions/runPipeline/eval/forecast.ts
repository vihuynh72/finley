import { type AgentUsage, runAgent } from "../../../shared/agent.ts";
import { profileText } from "../../../shared/claude.ts";
import type { EvalCase } from "../../../shared/eval/cases.ts";
import { publicCase } from "../../../shared/eval/cases.ts";
import type { Forecast } from "../../../shared/eval/scoring.ts";
import { choice, list, num, obj, str } from "../../../shared/schema.ts";

// The backtest's forecaster. Two conditions get the same instructions and differ only in evidence:
//   news     the company profile, the facts public at the cutoff, and Finley's briefing and findings
//            from the news it collected up to the cutoff
//   no_news  the profile and the public facts only
// The model may remember what happened after the cutoff; the gap between the two conditions is what
// the news added (shared/eval/cases.ts caveats).

const FORECAST_SCHEMA = obj({
  quarters: list(obj({
    id: str("Quarter id exactly as given, e.g. 2023-Q1"),
    low: num("Low end of an 80% range, USD billions"), mid: num("Best estimate, USD billions"), high: num("High end of an 80% range, USD billions"),
    rationale: str("One sentence"),
  })),
  kpis: list(obj({
    id: str("KPI id exactly as given"), direction: choice(["up", "flat", "down"], "Compared with the KPI's base value"),
    point: num("Best estimate, in the KPI's unit"), low: num("Low end of an 80% range"), high: num("High end of an 80% range"), rationale: str("One sentence"),
  })),
  questions: list(obj({ id: str("Question id exactly as given"), probability: num("Probability the answer is yes, 0 to 1"), rationale: str("One sentence") })),
  recommendations: list(obj({
    id: str("R1, R2, ..."),
    type: choice(["expand", "defend", "cut", "risk"], "expand: an opportunity to grow; defend: protect the base; cut: stop or reduce something; risk: a threat to prepare for"),
    action: str("One concrete action management could take, e.g. 'Launch paid sharing in the US'"),
    rationale: str("Why, in one or two sentences"),
    expected_by: str("Month you expect it, YYYY-MM"),
    evidence: list(str("A finding title or known fact it rests on")),
  }), "4 to 8 recommendations"),
  outlook: str("Three sentences: how the company will do over the horizon and why"),
});

const SYSTEM = `You are Finley's forecasting analyst, writing a forecast as of a past date for a backtest.

Rules:
- It is the cutoff date given below. Use only the information provided: the company profile, the facts public at the cutoff, and any briefing provided. Do not use anything you may remember about events after the cutoff. If you notice yourself recalling a later event, set it aside and reason only from what is given.
- Ranges are 80% intervals: the actual value should fall inside about four times in five. Make them as narrow as the evidence allows, no narrower.
- Probabilities are calibrated: 0.7 means you expect "yes" seven times in ten. Avoid 0 and 1.
- Answer every quarter, KPI and question id given, using the ids exactly.
- Recommendations: 4 to 8 specific actions management could take during the horizon (expand, defend, cut), plus the main risks to prepare for (type risk). Name a concrete action ("Raise US prices on the Standard plan"), not an aim ("grow revenue"). Each must follow from the evidence you were given.`;

const clip = (s: unknown, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

// What the news condition sees from the backtest run: the briefing's picture and outlook, the
// assumption tests, and each finding with its evidence. Capped well under the input budget.
export function newsEvidence(briefing: Record<string, any> | null, findings: Record<string, any>[]): string {
  const b = briefing ?? {};
  const parts: string[] = [];
  if (b.headline || b.summary) parts.push(`<market_picture>\n${clip(b.headline, 300)}\n${clip(b.summary, 1500)}\n${clip(b.market?.overview, 2000)}\n</market_picture>`);
  const themes = (b.market?.themes || []).slice(0, 8).map((t: any) => `- ${clip(t?.name, 160)}: ${clip(t?.summary, 300)}`);
  if (themes.length) parts.push(`<themes>\n${themes.join("\n")}\n</themes>`);
  const o = b.company?.outlook;
  if (o) {
    const ifs = (o.conditions || []).map((x: any) => `- If ${clip(x.if_condition, 200)}, then ${clip(x.then_effect, 200)} (signpost: ${clip(x.signpost, 150)})`);
    parts.push(`<company_outlook verdict="${clip(o.verdict, 20)}">\n${clip(o.summary, 1200)}${ifs.length ? `\n${ifs.join("\n")}` : ""}\n</company_outlook>`);
  }
  const tests = (b.company?.assumptions || []).map((a: any) => `- ${clip(a.text, 200)}: ${a.status}${a.note ? ` (${clip(a.note, 200)})` : ""}${a.counterpoint ? `; strongest counterpoint: ${clip(a.counterpoint, 200)}` : ""}`);
  if (tests.length) parts.push(`<assumption_tests>\n${tests.join("\n")}\n</assumption_tests>`);
  const fs = findings.slice(0, 12).map((f, i) => [
    `<finding n="${i + 1}" date="${f.event_date || ""}" materiality="${f.materiality}" confidence="${f.confidence}" effect="${f.effect || ""}">`,
    `Title: ${clip(f.title, 200)}`, `Facts: ${clip((f.facts || [f.fact]).join(" "), 900)}`, `Why it matters: ${clip(f.why_it_matters, 500)}`,
    `Sources: ${(f.sources || []).slice(0, 4).map((s: any) => `${s.outlet || s.title} (tier ${s.tier ?? "?"})`).join("; ")}`, "</finding>",
  ].join("\n"));
  parts.push(fs.length ? `<findings>\n${fs.join("\n")}\n</findings>` : "<findings>The scan saved no findings.</findings>");
  return parts.join("\n\n");
}

export function forecastPrompt(c: EvalCase, condition: "news" | "no_news", evidence: string): string {
  const pub = publicCase(c);
  return [
    `Cutoff (today): ${c.cutoff}. Horizon: ${c.horizon.label} (${c.horizon.start} to ${c.horizon.end}).`,
    `<company_profile>\n${profileText(c.profile)}\n</company_profile>`,
    `<public_at_cutoff>\n${pub.known_at_cutoff.map((k) => `- ${k}`).join("\n")}\n</public_at_cutoff>`,
    condition === "news" ? `<briefing note="Finley's scan of news published up to the cutoff">\n${evidence}\n</briefing>` : "No news scan is available. Reason from the profile and the public facts only.",
    `<quarters unit="USD billions, quarterly revenue">\n${pub.quarters.map((q) => `- ${q.id}: ${q.label} (${q.span})`).join("\n")}\n</quarters>`,
    `<kpis>\n${pub.kpis.map((k) => `- ${k.id}: ${k.name}, unit ${k.unit}, base value ${k.base} (${k.base_note})`).join("\n")}\n</kpis>`,
    `<questions>\n${pub.questions.map((q) => `- ${q.id}: ${q.text}`).join("\n")}\n</questions>`,
    "Write the forecast.",
  ].join("\n\n");
}

// Ranges sorted, probabilities clamped and recommendation ids made unique, so scoring sees clean input.
export function normalizeForecast(f: Forecast): Forecast {
  const sort3 = (a: number, b: number, c: number) => [a, b, c].map(Number).sort((x, y) => x - y);
  return {
    quarters: (f.quarters || []).map((q) => { const [low, mid, high] = sort3(q.low, q.mid, q.high); return { ...q, low, mid, high }; }),
    kpis: (f.kpis || []).map((k) => { const [low, , high] = sort3(k.low, k.point, k.high); return { ...k, low, high }; }),
    questions: (f.questions || []).map((q) => ({ ...q, probability: Math.min(1, Math.max(0, Number(q.probability) || 0)) })),
    recommendations: (f.recommendations || []).slice(0, 10).map((r, i) => ({ ...r, id: `R${i + 1}` })),
    outlook: f.outlook || "",
  };
}

export async function runForecast(c: EvalCase, condition: "news" | "no_news", evidence: string, opts: { deadline: number; usage: AgentUsage[]; model?: string }) {
  const call = {
    name: `eval/forecast-${condition}`, system: SYSTEM, prompt: forecastPrompt(c, condition, evidence), schema: FORECAST_SCHEMA,
    effort: "high" as const, deadline: opts.deadline, ...(opts.model ? { model: opts.model } : {}),
  };
  return normalizeForecast(await runAgent<Forecast>(call, opts.usage));
}
