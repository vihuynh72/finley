import { type AgentUsage, type Effort, runAgent } from "../../shared/agent.ts";
import { profileText } from "../../shared/claude.ts";
import { materialityRubric } from "../../shared/finance.ts";
import { snapshotText } from "../../shared/market.ts";
import { choice, list, obj, score, str } from "../../shared/schema.ts";
import { type CheckedDevelopment, renderDevelopments } from "./evidence.ts";
import { type Quantified, renderCandidates } from "./impacts.ts";
import { UI_TOPICS } from "./research.ts";

// Company lead (round 3): the thesis-aware central analyst. It decides what reaches the analyst as
// findings, scores them on one rubric, and answers "will the company do well if this continues?".
// Code then checks every id and score (findings.ts) before anything is saved.

export interface LeadFinding {
  title: string; development_ids: string[]; candidate_id: string; topic: string; novelty: string; prior_title: string;
  why_it_matters: string; counter_summary: string; key_unknown: string; next_step: string; materiality: number; confidence: number; urgency: number;
}
export interface LeadAdvice {
  action: string; kind: string; development_ids: string[]; candidate_id: string;
  rationale: string; check_first: string; confidence: number; horizon: string;
}
export interface LeadOutcome {
  finding_id: string; verdict: string; basis: string; development_ids: string[];
}
export interface LeadOutput {
  findings: LeadFinding[];
  advice: LeadAdvice[];
  outcomes: LeadOutcome[];
  outlook: { verdict: string; summary: string; conditions: { if_condition: string; then_effect: string; signpost: string }[] };
  watchlist: { indicator: string; threshold: string; why: string }[];
}

const LEAD_SCHEMA = obj({
  findings: list(obj({
    title: str("At most 12 words: what happened and why it matters to the client"),
    development_ids: list(str(), "The developments it rests on"),
    candidate_id: str("The impact candidate that quantifies it, e.g. C2, or '' if none"),
    topic: choice(Object.keys(UI_TOPICS)), novelty: choice(["new", "escalation", "repeat"]),
    prior_title: str("Title of the earlier finding it repeats or escalates, or ''"),
    why_it_matters: str("A conditional hypothesis: 'If <development> persists, <driver> moves <direction>, affecting <P&L line or assumption>.'"),
    counter_summary: str("The strongest contrary evidence, or 'No contrary evidence found in this scan.'"),
    key_unknown: str("The one thing that would most change this assessment"),
    next_step: str("A check the analyst can finish within a day, then the signpost to watch"),
    materiality: score("Materiality, per the rubric"), confidence: score("Confidence, per the rubric"), urgency: score("Urgency, per the rubric"),
  }), "0 to 8 findings that matter for this client, most important first. Zero is a valid answer."),
  advice: list(obj({
    action: str("At most 15 words, phrased as an option to weigh: 'Evaluate exiting the low-margin retail segment', 'Prepare a hedge for DRAM costs'"),
    kind: choice(["opportunity", "risk_response", "exit_or_reduce", "investigate", "monitor"],
      "opportunity: pursue a demand pocket, segment or cost opening. risk_response: prepare or hedge against an adverse move. exit_or_reduce: standing still looks clearly costly. investigate: worth a check before any decision. monitor: not actionable yet"),
    development_ids: list(str(), "The developments the advice rests on"),
    candidate_id: str("The impact candidate carrying the economics, e.g. C2, or '' if none"),
    rationale: str("1 to 2 sentences: the evidence and why it is worth weighing now. No money figures; those come from the candidate."),
    check_first: str("The check or signpost that would confirm or kill this advice before the analyst acts on it"),
    confidence: score("How worth raising this is: evidence strength plus economic size, same honesty as the rubric"),
    horizon: choice(["now", "this_quarter", "next_12_months"], "When inaction starts costing"),
  }), "0 to 4 decision-level suggestions for the analyst's client conversation. Only what the evidence supports; empty is a valid answer."),
  outcomes: list(obj({
    finding_id: str("The [P#] label of the earlier finding it settles, e.g. P2"),
    verdict: choice(["held", "did_not_hold"], "held: later news shows the flagged effect materialised; did_not_hold: events proved it wrong"),
    basis: str("One sentence on what settled it, for the analyst"),
    development_ids: list(str(), "The developments that settle it"),
  }), "Earlier findings today's news settles. Only ones clearly settled by cited developments; most stay unresolved and are left out. Empty is normal."),
  outlook: obj({
    verdict: choice(["positive", "negative", "mixed", "neutral"], "If today's developments persist, is the company better or worse off?"),
    summary: str("2 to 3 sentences: will the company do well if these developments continue, and why?"),
    conditions: list(obj({ if_condition: str(), then_effect: str(), signpost: str() }), "At most 3 if-then statements"),
  }),
  watchlist: list(obj({ indicator: str(), threshold: str("The level or event that would change the assessment"), why: str() }), "At most 5"),
});

const RULES = `You are the lead analyst on Finley's company team. A financial analyst (FP&A) advises the client below and will review everything you write; you flag, they decide. Decide which developments matter for this client, and why.

Rules:
- Every finding rests on cited developments. Merge findings that share one underlying shock, and quantify each shock with at most one candidate.
- Actively look for evidence that CHALLENGES the client's thesis and objectives, and say when new evidence contradicts a finding the analyst validated.
- Compare with the earlier findings: label repeats and escalations. Don't re-raise a finding the analyst rejected unless the facts changed, and if they did, say what changed.
- Never invent numbers: money figures come only from the computed candidates. A development with source_check="failed" did not match its source, so it can't carry a finding alone.
- Give the analyst decision advice, not just findings: opportunities worth pursuing, positions worth reducing or exiting, risks worth preparing for. Phrase every item as an option to evaluate, never a directive - the analyst and their client decide.
- Match conviction to evidence: "exit_or_reduce" only when the economics or corroborated evidence make standing still clearly costly; otherwise "investigate" or "monitor". If you can't name what would prove the advice wrong, don't give it.
- Close the loop on earlier findings: when today's developments settle one - the flagged effect materialised (held) or events proved it wrong (did_not_hold) - report it in outcomes, citing the developments that settle it. An open question staying open is not a verdict; leave those out, and never re-judge a finding whose outcome is already set.
- Plain English for a finance reader. Never put ids in prose fields.`;

const RUBRIC = `Scoring, integers 1-5, checked by code afterwards:
- Confidence (the fact is true and reaches the client as described): 5 a primary source, or 2+ independent outlets with the claim explicit; 4 one reputable outlet, explicit; 3 a single source or headline only; 2 an unconfirmed report, forecast or opinion, or a several-step inference; 1 speculation or a possible name mix-up.
- Urgency (when it can reach the numbers or a decision): 5 already hitting this quarter, or a decision due within about 10 days; 4 likely this or next quarter; 3 within 2-3 quarters; 2 within 4-6 quarters; 1 later or unknown.
- When a finding uses a quantified candidate, start from its materiality_band and move at most one step, for a stated strategic reason.
- Urgent alerts go out at materiality 4+, confidence 3+ and urgency 4+, so keep those scores for what truly needs attention now.`;

export interface LeadInput {
  client: Record<string, any>; today: string; market: { snapshot: any; note: string }; developments: CheckedDevelopment[]; mergedInto: Record<string, string>;
  picture: { headline: string; overview: string; conflicts: { question: string; assessment: string }[] } | null;
  thesis: { ledger: any[]; profile_checks: any[] }; candidates: Quantified[]; prior: Record<string, any>[];
}

export function runCompanyLead(input: LeadInput, opts: { deadline: number; usage: AgentUsage[]; effort: Effort }) {
  const { client, picture, thesis } = input;
  // The thesis tester saw the developments before the research lead merged them: point its ids at the survivors.
  const refs = (list: string[]) => [...new Set((list || []).map((id) => String(id).trim().toUpperCase()).map((id) => input.mergedInto[id] || id))].join(",");
  const ledger = (thesis.ledger || []).map((l: any) => `[${l.assumption_index}] ${client.assumptions?.[l.assumption_index]?.text ?? "?"}: against ${refs(l.challenging_ids) || "none"}; for ${refs(l.supporting_ids) || "none"}. Counterpoint: ${l.strongest_counterpoint || "none"}`).join("\n");
  const checks = (thesis.profile_checks || []).map((p: any) => `${p.profile_area} (${p.relation}): ${p.finding} [${refs(p.development_ids)}]`).join("\n");
  const prior = input.prior.map((f, i) => `- [P${i + 1}] ${String(f.created_date || "").slice(0, 10)} "${f.title}" (${f.review_status}${f.outcome ? `; outcome: ${f.outcome} (${f.outcome_source || "pipeline"})` : "; unresolved"}${f.feedback ? `; analyst: ${f.feedback}` : ""}${f.incorporate ? "; included in advice" : ""})`).join("\n");
  const market = picture ? `${picture.headline}\n${picture.overview}${picture.conflicts.map((c) => `\nSources disagree: ${c.question} ${c.assessment}`).join("")}` : "Not available this scan.";
  return runAgent<LeadOutput>({
    name: "company/lead", system: RULES, schema: LEAD_SCHEMA, deadline: opts.deadline, effort: opts.effort,
    prompt: `Today is ${input.today}.\n\n<client_profile>\n${profileText(client)}\n</client_profile>\n\n<market_data>\n${snapshotText(input.market)}\n</market_data>\n\n<market_picture>\n${market}\n</market_picture>\n\n<developments>\n${renderDevelopments(input.developments)}\n</developments>\n\n<assumption_tests>\n${ledger || "none"}\n</assumption_tests>\n\n<profile_checks>\n${checks || "none"}\n</profile_checks>\n\n<impact_candidates>\n${renderCandidates(input.candidates)}\n</impact_candidates>\n\n<earlier_findings>\n${prior || "none in the last 30 days"}\n</earlier_findings>\n\n<rubric>\n${materialityRubric(client)}\n${RUBRIC}\n</rubric>\n\nWrite the findings, the advice, the outlook and the watchlist.`,
  }, opts.usage);
}
