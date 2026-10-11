// Maps Base44 records (base44/entities) onto the dashboard's types (data.ts). Pure functions: the
// store fetches, these shape.

import { classifySource } from "../../base44/shared/sources.ts";
import { clientBase, compileTopic, scenarioFor, topicsFromPlan, type Delta, type ExposureLike, type ImpactInputs, type TopicSpec } from "../../base44/shared/topics.ts";
import type { Client, Finding, Source, SourceType, Status } from "./data";

type Rec = Record<string, any>;

// Topic tabs: one per exposure in the client's latest keyword plan. Before the planner has run, the
// client's own assumptions stand in, so a new client still gets working tabs.
export function topicSpecs(client: Rec, plan: Rec | null | undefined): TopicSpec[] {
  const specs = topicsFromPlan(client, plan);
  if (specs.length) return specs;
  const fromAssumptions: ExposureLike[] = (client["assumptions"] || []).filter((a: Rec) => a?.text).slice(0, 6)
    .map((a: Rec) => ({ name: a["driver"] || a["text"], driver: a["driver"] || "", why: a["text"], category: "company_specific", sensitivity: "medium" }));
  return topicsFromPlan(client, { exposures: fromAssumptions.length ? fromAssumptions : [{ name: "Company outlook", category: "company_specific", why: "Revenue holds at plan" }] });
}

const EFFECT: Record<string, Status> = { challenged: "Challenged", under_pressure: "Under pressure", supported: "Supported", holding: "Holding" };
const TYPES: SourceType[] = ["Primary company", "Trade press", "Government", "Blog unverified"];

// "Oct 8" for this year, "Dec 15, 2022" for earlier years (backtests).
export function shortDate(iso: string, now = new Date()): string {
  const t = Date.parse(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  if (!Number.isFinite(t)) return "undated";
  const d = new Date(t);
  const sameYear = d.getUTCFullYear() === now.getUTCFullYear();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC" });
}

// Finding.topic_key is the research team's topic (runPipeline/research.ts UI_TOPICS); keyword-plan
// categories name two of them differently.
const TOPIC_TO_CATEGORY: Record<string, string> = { regulation: "regulation_policy", logistics_freight: "supply_chain" };

// Which tab a finding belongs on: the exposure whose searches found its sources, else the first tab of
// the same category, else the first tab.
export function topicFor(f: Rec, specs: TopicSpec[]): string {
  const byName = specs.find((s) => f["exposure"] && s.name.toLowerCase() === String(f["exposure"]).toLowerCase());
  const category = TOPIC_TO_CATEGORY[f["topic_key"]] ?? f["topic_key"];
  const byCategory = specs.find((s) => s.category && s.category === category);
  return (byName ?? byCategory ?? specs[0])?.id ?? "";
}

export function toFinding(f: Rec, specs: TopicSpec[], clientName: string, base?: Delta): Finding {
  const m = Number(f["materiality"]) || 1, c = Number(f["confidence"]) || 1, u = Number(f["urgency"]) || 1;
  const priority = Number(f["priority"]) || m * c * u;
  const topicId = topicFor(f, specs);
  const spec = specs.find((s) => s.id === topicId);
  const seen = new Set<string>();
  const sources: Source[] = (f["sources"] || []).map((s: Rec): Source => {
    const outlet = s["outlet"] || String(s["title"] || "").match(/\(([^()]+)\)\s*$/)?.[1] || s["title"] || "Unknown outlet";
    const cls = TYPES.includes(s["type"]) && s["tier"] ? { type: s["type"] as SourceType, tier: Number(s["tier"]) as 1 | 2 | 3 | 4 } : classifySource(outlet, s["url"] || "", clientName);
    return { name: outlet, type: cls.type, tier: cls.tier, ...(s["url"] ? { url: s["url"] } : {}), ...(s["title"] ? { title: s["title"] } : {}) };
  }).filter((s: Source) => !seen.has(s.name) && !!seen.add(s.name));
  const impact = f["impact"] || {};
  const effect = EFFECT[f["effect"]] ?? (Number(impact["revenue_pct"] || 0) < 0 || Number(impact["cost_pct"] || 0) > 0 ? "Under pressure" : "Holding");
  const scenario = spec ? scenarioFor(spec, f["impact_inputs"] as ImpactInputs | undefined, base) : undefined;
  return {
    id: f["id"], topicId, title: f["title"] || "Untitled finding",
    severity: f["is_alert"] ? "urgent" : priority >= 60 || m >= 4 ? "review" : "info",
    confidence: c >= 4 ? "high" : c === 3 ? "medium" : "low",
    confidenceReason: f["uncertainty"] || "",
    effect, isoDate: f["event_date"] || String(f["created_date"] || "").slice(0, 10),
    date: shortDate(f["event_date"] || f["created_date"] || ""),
    facts: (f["facts"]?.length ? f["facts"] : [f["fact"]]).filter(Boolean),
    sources,
    interpretation: f["why_it_matters"] || f["interpretation"] || "",
    changeView: f["change_view"] || "",
    ...(impact["revenue_pct"] != null || impact["cost_pct"] != null
      ? { impact: { revenue_pct: Number(impact["revenue_pct"]) || 0, cost_pct: Number(impact["cost_pct"]) || 0, margin_pts: Number(impact["margin_pts"]) || 0 } }
      : {}),
    ...(scenario ? { scenario } : {}),
    nextStep: f["next_step"] || "",
    assumptions: f["assumptions_affected"] || [],
    scores: { materiality: m, confidence: c, urgency: u, priority },
    // 0-100 display scores the pipeline computed (findings.ts); older findings don't have them.
    ...(f["scores"]?.priority != null ? { pipelineScores: {
      priority: Number(f["scores"].priority) || 0, materiality: Number(f["scores"].materiality) || 0, relevance: Number(f["scores"].relevance ?? f["relevance"]) || 0,
      confidence: Number(f["scores"].confidence) || 0, urgency: Number(f["scores"].urgency) || 0 } } : {}),
    runId: f["run_id"] || "",
  };
}

export function toClient(rec: Rec, plan: Rec | null | undefined, findings: Rec[]): Client {
  const specs = topicSpecs(rec, plan);
  const topics = Object.fromEntries(specs.map((s) => [s.id, compileTopic(s)]));
  const base = clientBase(rec);
  return {
    id: rec["id"], name: rec["name"] || "Unnamed client", industry: rec["industry"] || "",
    base, topics, topicOrder: specs.map((s) => s.id),
    findings: findings.map((f) => toFinding(f, specs, rec["name"] || "", base)),
    reforecastDue: rec["reforecast_due"] || "", lastScanAt: rec["last_run_at"] || "", evalCase: rec["eval_case"] || "",
    planned: !!plan?.["exposures"]?.length, record: rec,
  };
}

// Finding.review_status <-> the dashboard's finding status.
export type FindingStatus = "open" | "review" | "research" | "dismissed";
const TO_UI: Record<string, FindingStatus> = { pending: "open", validated: "review", needs_research: "research", rejected: "dismissed" };
const TO_DB: Record<FindingStatus, string> = { open: "pending", review: "validated", research: "needs_research", dismissed: "rejected" };
export const uiStatus = (s: string | undefined): FindingStatus => TO_UI[s || "pending"] ?? "open";
export const dbStatus = (s: FindingStatus) => TO_DB[s];

// Finding.outcome: how the flag turned out, judged by a later scan ("pipeline") or by the analyst.
export type Outcome = "held" | "did_not_hold" | "unclear";
export interface FindingOutcome { outcome: Outcome; reason: string; source: string; at: string }
export const toOutcome = (f: Rec): FindingOutcome | null =>
  ["held", "did_not_hold", "unclear"].includes(f["outcome"])
    ? { outcome: f["outcome"] as Outcome, reason: f["outcome_reason"] || "", source: f["outcome_source"] || "pipeline", at: f["outcome_at"] || "" }
    : null;

// "today, 7:40 AM", "yesterday, 9:12 PM", "Oct 3, 9:12 PM", or "never".
export function scanLabel(iso: string, now = new Date()): string {
  const t = Date.parse(iso);
  if (!iso || !Number.isFinite(t)) return "never";
  const d = new Date(t);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  return days === 0 ? `today, ${time}` : days === 1 ? `yesterday, ${time}` : `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
}
