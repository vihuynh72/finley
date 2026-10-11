import { canon, clampScore } from "../../shared/schema.ts";
import type { Article } from "./corpus.ts";
import type { CheckedDevelopment } from "./evidence.ts";
import type { Quantified } from "./impacts.ts";
import type { LeadFinding } from "./lead.ts";
import { UI_TOPICS } from "./research.ts";

// Turns the lead's findings into Finding records the dashboard already understands, with code (not the
// model) deciding what the evidence can support: unknown ids are dropped, repeats aren't saved twice,
// confidence is capped by the evidence, materiality stays within one step of the computed money.

// The urgent-alert rule. Keep in sync with the empty-state text in src/components/dashboard/FindingsList.jsx
// and the "High" badge (priority >= 60) in src/components/figma/UrgentFindingsList.jsx.
export const isAlert = (m: number, c: number, u: number) => m >= 4 && c >= 3 && u >= 4;

const AGENT_BY_TOPIC: Record<string, string> = { pricing_competition: "competition", demand_customers: "market" }; // the rest: "risk"
const WEAK_BASIS = new Set(["forecast", "unconfirmed_report", "opinion"]);
const PRIMARY_BASIS = new Set(["company_statement", "official_data"]); // a primary source needs no second outlet
const days = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 86_400_000;
// Only bracketed id references like "(D4)" or "[D4, C2]": product names such as "A400" must survive.
const stripIds = (text: string) => (text || "").replace(/\s*[[(](?:[ACD]\d+(?:,\s*)?)+[\])]/g, "").trim();

interface Inputs {
  findings: LeadFinding[]; developments: CheckedDevelopment[]; mergedInto: Record<string, string>; candidates: Quantified[]; articles: Article[];
  ledger: any[]; client: Record<string, any>; run_id: string; today: string; prior: Record<string, any>[];
}

const candId = (value: unknown) => String(value ?? "").toUpperCase().match(/C\d+/)?.[0] ?? "";

export function buildFindings(x: Inputs) {
  const devs = new Map(x.developments.map((d) => [d.id, d]));
  const articles = new Map(x.articles.map((a) => [a.id, a]));
  // Agents sometimes echo ids in lowercase ("d4"); normalize before resolving merges and lookups.
  const normId = (id: unknown) => x.mergedInto[String(id).trim().toUpperCase()] || String(id).trim().toUpperCase();
  const ids = (list: string[]) => [...new Set((list || []).map(normId).filter((id) => devs.has(id)))];
  const records: Record<string, any>[] = [], ongoing: Record<string, any>[] = [], dropped: string[] = [];
  const counted = new Set<string>(); // candidates already carried by a record: one shock is summed once
  for (const f of (x.findings || []).slice(0, 8)) {
    const cited = ids(f.development_ids).map((id) => devs.get(id)!);
    const solid = cited.filter((d) => d.grounded), unverified = cited.length - solid.length; // only solid ones state the fact
    if (!solid.length) { dropped.push(`"${f.title}": no cited development passed the source check`); continue; }
    const sources = [...new Map(cited.flatMap((d) => d.article_ids).map((id) => articles.get(id)).filter((a): a is Article => !!a)
      .map((a) => [a.url, { title: `${a.title} (${a.source})`, url: a.url, date: a.date }])).values()];
    // A repeat is a finding whose every source already backed one earlier finding; it isn't saved again.
    const repeatOf = sources.length ? x.prior.find((p) => sources.every((s) => (p.sources || []).some((ps: any) => ps.url === s.url))) : undefined;
    if (repeatOf || canon(f.novelty, ["repeat"], "") === "repeat") { ongoing.push({ title: f.title, prior_id: repeatOf?.id ?? "", prior_title: repeatOf?.title ?? f.prior_title }); continue; }

    const outlets = new Set(cited.flatMap((d) => d.outlets));
    let confidence = clampScore(f.confidence);
    if (outlets.size < 2 && !solid.some((d) => PRIMARY_BASIS.has(d.fact_basis))) confidence = Math.min(confidence, 4);
    if (cited.every((d) => d.headline_only)) confidence = Math.min(confidence, 3);
    if (cited.every((d) => !d.grounded || WEAK_BASIS.has(d.fact_basis))) confidence = Math.min(confidence, 2);
    const candidate = x.candidates.find((c) => c.id === candId(f.candidate_id));
    // Two findings naming one candidate would count its money twice in the charts: only the first carries it.
    const carries = !!candidate?.quantified && !counted.has(candidate.id);
    if (carries) counted.add(candidate!.id);
    const band = candidate?.quantified ? candidate.band : 0;
    const materiality = band ? Math.min(band + 1, Math.max(band - 1, clampScore(f.materiality))) : clampScore(f.materiality);
    const newest = cited.map((d) => d.date).filter(Boolean).sort().pop() || "";
    const urgency = newest && days(newest, x.today) > 21 ? Math.min(clampScore(f.urgency), 3) : clampScore(f.urgency);

    // One dashboard topic per finding, then the client's own driver names for linked assumptions, so the
    // Figma sidebar and EbitdaCharts count each finding exactly once and AssumptionGrid's counts work.
    const topic = canon(f.topic, Object.keys(UI_TOPICS), candidate?.topic || "input_costs");
    const devIds = new Set(cited.map((d) => d.id));
    const linked = new Set<number>([...(candidate?.assumption_indexes || []), ...(x.ledger || []).filter((l) =>
      [...(l.challenging_ids || []), ...(l.supporting_ids || [])].some((id: string) => devIds.has(normId(id)))).map((l) => Number(l.assumption_index))]);
    const assumptions = [...linked].map((i) => x.client.assumptions?.[i]).filter(Boolean);
    const otherLabels = Object.values(UI_TOPICS).filter((l) => l !== UI_TOPICS[topic]).map((l) => l.toLowerCase());
    const drivers = [UI_TOPICS[topic], ...assumptions.map((a: any) => a.driver).filter(Boolean)]
      .filter((d, i, all) => all.findIndex((y) => y.toLowerCase() === d.toLowerCase()) === i && (i === 0 || !otherLabels.some((o) => d.toLowerCase().includes(o))));

    records.push({
      client_id: x.client.id, run_id: x.run_id, agent: AGENT_BY_TOPIC[topic] || "risk", title: stripIds(f.title),
      fact: solid.map((d) => d.fact).join(" "), interpretation: solid[0].interpretation, why_it_matters: stripIds(f.why_it_matters),
      drivers_affected: drivers, assumptions_affected: assumptions.map((a: any) => a.text), next_step: stripIds(f.next_step),
      uncertainty: `Evidence: ${outlets.size} independent outlet${outlets.size === 1 ? "" : "s"}${cited.every((d) => d.headline_only) ? ", headline only" : ""}, newest ${newest || "undated"}${
        unverified ? `; ${unverified} claim${unverified > 1 ? "s" : ""} that failed the source check left out of the fact` : ""}. Counter-evidence: ${stripIds(f.counter_summary)} Key unknown: ${stripIds(f.key_unknown)}`,
      materiality, confidence, urgency, priority: materiality * confidence * urgency, is_alert: isAlert(materiality, confidence, urgency),
      sources, ...(carries && candidate!.impact ? { impact: candidate!.impact } : {}), review_status: "pending",
    });
  }
  return { records, ongoing, dropped };
}

const ADVICE_KINDS = ["opportunity", "risk_response", "exit_or_reduce", "investigate", "monitor"] as const;
const ADVICE_HORIZONS = ["now", "this_quarter", "next_12_months"] as const;

// The lead's decision advice, checked by code like the findings: ids must resolve, confidence is
// capped by the evidence behind it, and "exit_or_reduce" needs quantified economics or strong
// evidence - anything weaker comes back to the analyst as "investigate" instead of a call to act.
// Money figures are never model-written; they are attached from the computed candidate.
export function buildAdvice(x: { advice: any[]; developments: CheckedDevelopment[]; mergedInto: Record<string, string>;
  candidates: Quantified[]; articles: Article[] }) {
  const devs = new Map(x.developments.map((d) => [d.id, d]));
  const articles = new Map(x.articles.map((a) => [a.id, a]));
  const normId = (id: unknown) => x.mergedInto[String(id).trim().toUpperCase()] || String(id).trim().toUpperCase();
  return (x.advice || []).slice(0, 4).map((a) => {
    const development_ids: string[] = [...new Set<string>((a.development_ids || []).map(normId).filter((id: string) => devs.has(id)))];
    const cited = development_ids.map((id) => devs.get(id)!);
    const candidate = x.candidates.find((c) => c.id === candId(a.candidate_id));
    let confidence = clampScore(a.confidence);
    if (!cited.length && !candidate) confidence = Math.min(confidence, 2);
    else if (cited.length && cited.every((d) => !d.grounded || WEAK_BASIS.has(d.fact_basis))) confidence = Math.min(confidence, 3);
    let kind = canon(a.kind, ADVICE_KINDS, "monitor");
    if (kind === "exit_or_reduce" && !(candidate?.quantified || confidence >= 4)) kind = "investigate";
    const sources = [...new Map(cited.flatMap((d) => d.article_ids).map((id) => articles.get(id)).filter((a): a is Article => !!a)
      .map((a) => [a.url, { title: `${a.title} (${a.source})`, url: a.url, date: a.date }])).values()];
    return {
      action: stripIds(a.action), kind, rationale: stripIds(a.rationale), check_first: stripIds(a.check_first),
      confidence, horizon: canon(a.horizon, ADVICE_HORIZONS, "this_quarter"), development_ids, sources,
      economics: candidate?.quantified ? { mechanism: stripIds(candidate.mechanism), ebitda_delta: candidate.ebitda_delta,
        ebitda_low: candidate.ebitda_low, ebitda_high: candidate.ebitda_high, ev_delta: candidate.ev_delta, ev_pct: candidate.ev_pct } : null,
    };
  }).filter((a) => a.action && (a.development_ids.length || a.economics));
}

// Assumption statuses follow fixed rules from the thesis tester's evidence links: grounded evidence
// against only -> challenged, for only -> supported, both -> under_review, none -> unchanged. Only
// status and a dated note change; the analyst's text, driver and order are never touched.
export function updateAssumptions(client: Record<string, any>, ledger: any[], developments: CheckedDevelopment[], mergedInto: Record<string, string>, today: string) {
  const devs = new Map(developments.map((d) => [d.id, d]));
  const grounded = (list: string[]) => (list || []).map((id) => String(id).trim().toUpperCase())
    .map((id) => devs.get(mergedInto[id] || id)).filter((d): d is CheckedDevelopment => !!d && d.grounded);
  const label = new Date(`${today}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return (client.assumptions || []).map((a: any, i: number) => {
    const entry = (ledger || []).find((l) => Number(l.assumption_index) === i);
    const against = grounded(entry?.challenging_ids), forIt = grounded(entry?.supporting_ids);
    if (!against.length && !forIt.length) return a;
    const status = against.length && forIt.length ? "under_review" : against.length ? "challenged" : "supported";
    const key = against[0] || forIt[0]; // the evidence behind the status: against it if any, else for it
    const why = stripIds(entry?.note || "") || `${key.outlets[0]}: ${key.title}`; // the note already names its outlet
    return { ...a, status, note: `${label} · ${status.replace("_", " ")} · ${why}`.slice(0, 160) };
  });
}
