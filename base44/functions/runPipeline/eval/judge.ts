import { type AgentUsage, runAgent } from "../../../shared/agent.ts";
import type { EvalCase } from "../../../shared/eval/cases.ts";
import type { FindingVerdict, Forecast, RecMatch } from "../../../shared/eval/scoring.ts";
import { choice, list, obj, str } from "../../../shared/schema.ts";

// The backtest judge labels; shared/eval/scoring.ts turns labels into numbers. The judge sees what
// happened, but never which condition (news or no news) wrote the recommendations it is grading.

const MATCH_SCHEMA = obj({
  matches: list(obj({
    rec_id: str("Recommendation id, e.g. R1"),
    action_id: str("Id of the best-matching company action, or empty when none matches"),
    label: choice(["exact", "partial", "none"]),
    rationale: str("One sentence"),
  }), "One entry per recommendation"),
});

const VERDICT_SCHEMA = obj({
  verdicts: list(obj({
    finding_id: str("Finding id, e.g. F1"),
    held: choice(["held", "did_not_hold", "unclear"]),
    happened: str("One sentence on what actually happened"),
  }), "One entry per finding"),
});

const MATCH_RULES = `You grade a backtest. Recommendations written at a cutoff date are compared with what the company actually did afterwards. For each recommendation, pick the single best-matching item from the list of actions and events, and label the match:
- exact: the company did essentially this (same action and direction) within the horizon
- partial: the company did something clearly related, but narrower, broader, or different in a material detail
- none: nothing on the list matches; use an empty action_id
A risk recommendation matches a risk event if it anticipated that event. Vague recommendations ("grow revenue", "monitor competition") match nothing. Judge only what is written; do not reward a recommendation for what it might have meant.`;

const VERDICT_RULES = `You grade a backtest. Each finding was flagged on the cutoff date from news published up to then. Using the record of what happened over the horizon, decide whether each finding held up:
- held: the development happened or continued as the finding described, and moved the company in the direction the finding claimed
- did_not_hold: it reversed, did not materialize, or moved the company the other way
- unclear: the record does not say
Write one sentence on what actually happened.`;

const record = (c: EvalCase) => [
  `<outcomes>\n${c.outcomes.map((o) => `- ${o}`).join("\n")}\n</outcomes>`,
  `<company_actions>\n${c.actions.map((a) => `- ${a.date}: ${a.text}`).join("\n")}\n</company_actions>`,
  `<resolved_questions>\n${c.questions.map((q) => `- ${q.text} ${q.outcome ? "Yes" : "No"}. ${q.resolution}`).join("\n")}\n</resolved_questions>`,
].join("\n\n");

export async function judgeRecommendations(c: EvalCase, f: Forecast | null, opts: { deadline: number; usage: AgentUsage[]; model?: string; label: string }): Promise<RecMatch[]> {
  const recs = f?.recommendations ?? [];
  if (!recs.length) return [];
  const prompt = [
    `Company: ${c.company}. Cutoff: ${c.cutoff}. Horizon: ${c.horizon.label} (${c.horizon.start} to ${c.horizon.end}).`,
    `<actions_and_events>\n${c.actions.map((a) => `- ${a.id} (${a.kind === "risk_event" ? "risk event" : "decision"}, ${a.date}): ${a.text}`).join("\n")}\n</actions_and_events>`,
    `<recommendations>\n${recs.map((r) => `- ${r.id} [${r.type}, expected by ${r.expected_by}]: ${r.action}. Why: ${r.rationale}`).join("\n")}\n</recommendations>`,
    "Label each recommendation.",
  ].join("\n\n");
  const out = await runAgent<{ matches: RecMatch[] }>({ name: `eval/judge-recs-${opts.label}`, system: MATCH_RULES, prompt, schema: MATCH_SCHEMA,
    effort: "high", deadline: opts.deadline, ...(opts.model ? { model: opts.model } : {}) }, opts.usage);
  return out.matches || [];
}

// Findings are numbered F1..Fn for the judge and mapped back to their record ids here.
export async function judgeFindings(c: EvalCase, findings: Record<string, any>[], opts: { deadline: number; usage: AgentUsage[]; model?: string }): Promise<FindingVerdict[]> {
  if (!findings.length) return [];
  const ids = findings.map((f) => f.id);
  const prompt = [
    `Company: ${c.company}. Cutoff: ${c.cutoff}. Horizon: ${c.horizon.label} (${c.horizon.start} to ${c.horizon.end}).`,
    record(c),
    `<findings>\n${findings.map((f, i) => `- F${i + 1} (${f.event_date || "undated"}, effect on the company's assumptions: ${f.effect || "unknown"}): ${f.title}. ${String(f.why_it_matters || "").slice(0, 400)}`).join("\n")}\n</findings>`,
    "Give a verdict for each finding.",
  ].join("\n\n");
  const out = await runAgent<{ verdicts: FindingVerdict[] }>({ name: "eval/judge-findings", system: VERDICT_RULES, prompt, schema: VERDICT_SCHEMA,
    effort: "high", deadline: opts.deadline, ...(opts.model ? { model: opts.model } : {}) }, opts.usage);
  return (out.verdicts || []).map((v) => ({ ...v, finding_id: ids[Number(String(v.finding_id).replace(/\D/g, "")) - 1] ?? "" })).filter((v) => v.finding_id);
}
