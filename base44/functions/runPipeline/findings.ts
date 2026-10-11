import { canon, clampScore } from "../../shared/schema.ts";
import { classifySource } from "../../shared/sources.ts";
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
const days = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 86_400_000;
// Only bracketed id references like "(D4)" or "[D4, C2]": product names such as "A400" must survive.
const stripIds = (text: string) => (text || "").replace(/\s*[[(](?:[ACD]\d+(?:,\s*)?)+[\])]/g, "").trim();

interface Inputs {
  findings: LeadFinding[]; developments: CheckedDevelopment[]; mergedInto: Record<string, string>; candidates: Quantified[]; articles: Article[];
  ledger: any[]; client: Record<string, any>; run_id: string; today: string; prior: Record<string, any>[];
}

export function buildFindings(x: Inputs) {
  const devs = new Map(x.developments.map((d) => [d.id, d]));
  const articles = new Map(x.articles.map((a) => [a.id, a]));
  const ids = (list: string[]) => [...new Set((list || []).map((id) => x.mergedInto[id] || id).filter((id) => devs.has(id)))];
  const records: Record<string, any>[] = [], ongoing: Record<string, any>[] = [], dropped: string[] = [];
  const candidate_ids: string[] = []; // which impact candidate backs each record, in step with records
  for (const f of (x.findings || []).slice(0, 8)) {
    const cited = ids(f.development_ids).map((id) => devs.get(id)!);
    if (!cited.some((d) => d.grounded)) { dropped.push(`"${f.title}": no cited development passed the source check`); continue; }
    const citedArticles = cited.flatMap((d) => d.article_ids).map((id) => articles.get(id)).filter((a): a is Article => !!a);
    // Each source also gets its type and reliability tier (shared/sources.ts), for the Sources page and scoring.
    const sources = [...new Map(citedArticles.map((a) => [a.url, { title: `${a.title} (${a.source})`, url: a.url, date: a.date,
      outlet: a.source, ...classifySource(a.source, a.url, x.client.name) }])).values()];
    // A repeat is a finding whose every source already backed one earlier finding; it isn't saved again.
    const repeatOf = sources.length ? x.prior.find((p) => sources.every((s) => (p.sources || []).some((ps: any) => ps.url === s.url))) : undefined;
    if (repeatOf || canon(f.novelty, ["repeat"], "") === "repeat") { ongoing.push({ title: f.title, prior_id: repeatOf?.id ?? "", prior_title: repeatOf?.title ?? f.prior_title }); continue; }

    const outlets = new Set(cited.flatMap((d) => d.outlets));
    let confidence = clampScore(f.confidence);
    if (outlets.size < 2) confidence = Math.min(confidence, 4);
    if (cited.every((d) => d.headline_only)) confidence = Math.min(confidence, 3);
    if (cited.every((d) => !d.grounded || WEAK_BASIS.has(d.fact_basis))) confidence = Math.min(confidence, 2);
    const candidate = x.candidates.find((c) => c.id === (f.candidate_id || "").trim().toUpperCase());
    const band = candidate?.quantified ? candidate.band : 0;
    const materiality = band ? Math.min(band + 1, Math.max(band - 1, clampScore(f.materiality))) : clampScore(f.materiality);
    const newest = cited.map((d) => d.date).filter(Boolean).sort().pop() || "";
    const urgency = newest && days(newest, x.today) > 21 ? Math.min(clampScore(f.urgency), 3) : clampScore(f.urgency);

    // One dashboard topic per finding, then the client's own driver names for linked assumptions, so the
    // Figma sidebar and EbitdaCharts count each finding exactly once and AssumptionGrid's counts work.
    const topic = canon(f.topic, Object.keys(UI_TOPICS), candidate?.topic || "input_costs");
    const devIds = new Set(cited.map((d) => d.id));
    const linked = new Set<number>([...(candidate?.assumption_indexes || []), ...(x.ledger || []).filter((l) =>
      [...(l.challenging_ids || []), ...(l.supporting_ids || [])].some((id: string) => devIds.has(x.mergedInto[id] || id))).map((l) => Number(l.assumption_index))]);
    const assumptions = [...linked].map((i) => x.client.assumptions?.[i]).filter(Boolean);
    // The dashboard tab: the keyword-plan exposure whose searches found most of the cited articles
    // (ties go to the first found); "" when only the company and competitor searches found it.
    const tally = new Map<string, number>();
    for (const a of citedArticles) if (a.exposure) tally.set(a.exposure, (tally.get(a.exposure) ?? 0) + 1);
    const exposure = [...tally.entries()].sort((p, q) => q[1] - p[1])[0]?.[0] ?? "";
    // How it bears on the client's assumptions, for the dashboard's status pills: evidence the thesis
    // tester listed against an assumption wins, then evidence for one, then the impact's direction.
    const touches = (list: string[]) => (list || []).some((id) => devIds.has(x.mergedInto[id] || id));
    const effect = (x.ledger || []).some((l) => touches(l.challenging_ids)) ? "challenged"
      : (x.ledger || []).some((l) => touches(l.supporting_ids)) ? "supported"
      : candidate?.effect === "adverse" ? "under_pressure" : candidate?.effect === "favorable" ? "supported" : "holding";
    const otherLabels = Object.values(UI_TOPICS).filter((l) => l !== UI_TOPICS[topic]).map((l) => l.toLowerCase());
    const drivers = [UI_TOPICS[topic], ...assumptions.map((a: any) => a.driver).filter(Boolean)]
      .filter((d, i, all) => all.findIndex((y) => y.toLowerCase() === d.toLowerCase()) === i && (i === 0 || !otherLabels.some((o) => d.toLowerCase().includes(o))));

    records.push({
      client_id: x.client.id, run_id: x.run_id, agent: AGENT_BY_TOPIC[topic] || "risk", title: stripIds(f.title),
      fact: cited.map((d) => d.fact).join(" "), interpretation: cited[0].interpretation, why_it_matters: stripIds(f.why_it_matters),
      drivers_affected: drivers, assumptions_affected: assumptions.map((a: any) => a.text), next_step: stripIds(f.next_step),
      uncertainty: `Evidence: ${outlets.size} independent outlet${outlets.size === 1 ? "" : "s"}${cited.every((d) => d.headline_only) ? ", headline only" : ""}, newest ${newest || "undated"}. Counter-evidence: ${stripIds(f.counter_summary)} Key unknown: ${stripIds(f.key_unknown)}`,
      materiality, confidence, urgency, priority: materiality * confidence * urgency, is_alert: isAlert(materiality, confidence, urgency),
      sources, ...(candidate?.impact ? { impact: candidate.impact } : {}), review_status: "pending",
      facts: cited.map((d) => d.fact).filter(Boolean), change_view: stripIds(f.key_unknown), effect, exposure, topic_key: topic, event_date: newest,
      // The estimator's inputs, so the dashboard can set a topic's sliders from this finding ("Use in scenario").
      ...(candidate?.quantified ? { impact_inputs: { pnl_line: candidate.pnl_line, shock_pct: candidate.shock_pct, exposure_pct: candidate.exposure_pct,
        pass_through_pct: candidate.pass_through_pct, shock_min_pct: candidate.shock_min_pct, shock_max_pct: candidate.shock_max_pct,
        persistence: candidate.persistence, quarters: candidate.quarters, effect: candidate.effect } } : {}),
    });
    candidate_ids.push(candidate?.quantified ? candidate.id : "");
  }
  return { records, candidate_ids, ongoing, dropped };
}

// Assumption statuses follow fixed rules from the thesis tester's evidence links: grounded evidence
// against only -> challenged, for only -> supported, both -> under_review, none -> unchanged. Only
// status and a dated note change; the analyst's text, driver and order are never touched.
export function updateAssumptions(client: Record<string, any>, ledger: any[], developments: CheckedDevelopment[], mergedInto: Record<string, string>, today: string) {
  const devs = new Map(developments.map((d) => [d.id, d]));
  const grounded = (list: string[]) => (list || []).map((id) => devs.get(mergedInto[id] || id)).filter((d): d is CheckedDevelopment => !!d && d.grounded);
  const label = new Date(`${today}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return (client.assumptions || []).map((a: any, i: number) => {
    const entry = (ledger || []).find((l) => Number(l.assumption_index) === i);
    const against = grounded(entry?.challenging_ids), forIt = grounded(entry?.supporting_ids);
    if (!against.length && !forIt.length) return a;
    const status = against.length && forIt.length ? "under_review" : against.length ? "challenged" : "supported";
    const key = against[0] || forIt[0];
    const why = stripIds(entry?.note || "") || `${key.outlets[0]}: ${stripIds(entry?.strongest_counterpoint || "")}`; // the note already names its outlet
    return { ...a, status, note: `${label} · ${status.replace("_", " ")} · ${why}`.slice(0, 160) };
  });
}
