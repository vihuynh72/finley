import type { AgentUsage } from "../../shared/agent.ts";
import { type Corpus, coverageNote } from "./corpus.ts";
import type { CheckedResearch } from "./evidence.ts";
import type { LeadOutput } from "./lead.ts";

// Assembles the run's Briefing record: everything a dashboard needs, in one place, as of the run.
// Lists are capped so every field stays well under Base44's per-field size limit.

export interface BriefingParts {
  client: Record<string, any>; run_id: string; startedAt: number; asOf?: number; corpus: Corpus; research: CheckedResearch;
  market: { snapshot: any; note: string }; picture: Record<string, any> | null; thesis: { ledger: any[]; profile_checks: any[] };
  lead: LeadOutput | null; assumptions: Record<string, any>[]; saved: Record<string, any>[]; ongoing: Record<string, any>[]; dropped: string[];
  scenarios: Record<string, any> | null; questions: Record<string, any>[]; charts: Record<string, any>; alert_email: Record<string, any>;
  usage: AgentUsage[]; errors: string[];
}

export function buildBriefing(x: BriefingParts) {
  const stories = x.corpus.articles.filter((a) => !a.duplicate_of);
  const byLens = ["company", "competitor", "regulation", "market"].map((lens) => ({ lens, stories: stories.filter((a) => a.lens === lens).length }));
  const ledger = new Map((x.thesis.ledger || []).map((l: any) => [Number(l.assumption_index), l]));
  return {
    client_id: x.client.id, run_id: x.run_id, as_of: new Date(x.asOf ?? x.startedAt).toISOString(),
    status: x.errors.length ? "partial" : "complete",
    headline: x.picture?.headline ?? "", summary: x.lead?.outlook?.summary ?? "",
    market_data: x.market.snapshot ?? { note: x.market.note },
    market: x.picture ? { overview: x.picture.overview, themes: x.picture.themes, conflicts: x.picture.conflicts, players: (x.picture.players || []).slice(0, 12),
      watch: x.picture.watch, timeline: (x.picture.timeline || []).slice(-30) } : {},
    company: {
      outlook: x.lead?.outlook ?? null, watchlist: (x.lead?.watchlist ?? []).slice(0, 5), profile_checks: (x.thesis.profile_checks || []).slice(0, 6),
      assumptions: x.assumptions.map((a, i) => ({ index: i, text: a.text, driver: a.driver, status: a.status || "monitoring", note: a.note || "",
        counterpoint: (ledger.get(i) as any)?.strongest_counterpoint ?? "", signpost: (ledger.get(i) as any)?.signpost ?? "" })),
    },
    findings: x.saved.map((f) => ({ id: f.id ?? "", title: f.title, topic: f.drivers_affected?.[0] ?? "", materiality: f.materiality, confidence: f.confidence,
      urgency: f.urgency, priority: f.priority, is_alert: f.is_alert, badge: f.is_alert ? "urgent" : f.priority >= 60 ? "high" : "monitor" })),
    ongoing: x.ongoing, scenarios: x.scenarios ?? {}, questions: x.questions, charts: x.charts,
    coverage: {
      articles: x.corpus.articles.length, stories: stories.length, by_lens: byLens, headline_only: stories.filter((a) => !a.snippet).length,
      failed_searches: x.corpus.failed_queries, name_collisions: x.research.dispositions.filter((d) => d.status === "name_collision").length,
      blind_spots: x.research.gaps.slice(0, 9), dropped: [...x.research.dropped, ...x.dropped].slice(0, 20), note: coverageNote(x.corpus),
    },
    alert_email: x.alert_email,
    stats: { duration_ms: Date.now() - x.startedAt, input_tokens: x.usage.reduce((s, u) => s + u.input_tokens, 0),
      output_tokens: x.usage.reduce((s, u) => s + u.output_tokens, 0), agents: x.usage },
    errors: x.errors.slice(0, 20),
  };
}
