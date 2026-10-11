// A finished backtest frozen for presenting: everything the Evals page needs, so showing it makes no
// call to Base44 or to the model and search APIs. Two ways to make one, same format:
//   - scripts/backtest/run.ts runs the real stages locally (keys from .env) and writes it;
//   - the Evals page exports a finished EvalRun from the live app.
// Commit it as src/evals/published/<case_key>.json; the build bundles it and the Evals page shows it.
// Pure module: the frontend imports it, so no npm: or base44:runtime imports here.

export const PUBLISHED_FORMAT = 1;

type Rec = Record<string, any>;

export interface PublishedSource { title: string; outlet: string; date: string; url: string; query: string; window: string; flag?: string }
export interface PublishedUsage { calls: number; input_tokens: number; output_tokens: number; thinking_tokens: number; ms: number }

export interface PublishedBacktest {
  format: typeof PUBLISHED_FORMAT;
  case_key: string;
  // True only for the runner's --dry-run, which fakes Claude and Bright Data to test the plumbing.
  // The app refuses to present a dry run as results.
  dry_run: boolean;
  published_at: string; // ISO time the snapshot was written
  origin: "local-runner" | "base44-export";
  run: {
    eval_run_id: string; cutoff: string; finished_at: string;
    model: string; // forecaster
    judge_model: string;
    pipeline_models: string[]; // models the agent pipeline used, from usage
    usage: PublishedUsage;
    errors: string[]; // non-fatal problems recorded during the run
  };
  summary: Rec; // EvalRun.summary as stages.ts score() writes it
  forecasts: { news: Rec; no_news: Rec };
  judgments: Rec;
  keyword_plan: { exposures: Rec[]; keyword_count: number } | null;
  briefing: { headline: string; summary: string; outlook: Rec | null; advice: Rec[] } | null;
  findings: Rec[]; // the backtest scan's findings, as saved
  sources: PublishedSource[]; // the kept news only, every item dated on or before the cutoff
}

const totals = (usage: Rec[]): PublishedUsage => usage.reduce<PublishedUsage>((t, u) => ({
  calls: t.calls + 1, input_tokens: t.input_tokens + (Number(u.input_tokens) || 0), output_tokens: t.output_tokens + (Number(u.output_tokens) || 0),
  thinking_tokens: t.thinking_tokens + (Number(u.thinking_tokens) || 0), ms: t.ms + (Number(u.ms) || 0),
}), { calls: 0, input_tokens: 0, output_tokens: 0, thinking_tokens: 0, ms: 0 });

// Fields of a Finding worth keeping in a snapshot (drops ids of other records and analyst state).
const FINDING_KEYS = ["title", "fact", "facts", "interpretation", "why_it_matters", "change_view", "next_step", "uncertainty", "exposure", "topic", "topic_key",
  "effect", "event_date", "materiality", "confidence", "urgency", "priority", "is_alert", "relevance", "scores", "drivers_affected", "assumptions_affected",
  "sources", "impact", "impact_inputs"];

// Builds the snapshot from a finished EvalRun and the records it points to. `sources` are EvalSource rows.
export function buildPublished(x: {
  ev: Rec; findings: Rec[]; briefing: Rec | null; plan: Rec | null; sources: Rec[];
  origin: PublishedBacktest["origin"]; dryRun?: boolean; now?: string;
}): PublishedBacktest {
  const { ev } = x;
  if (ev.stage !== "done" || !ev.summary) throw new Error(`EvalRun ${ev.id} is not finished (stage ${ev.stage})`);
  // The analyze stage's agents record their usage on the scan's Briefing (stats.agents), not on the
  // EvalRun (runAgentPipeline keeps its own list), so both are counted.
  const usage: Rec[] = [...(ev.usage || []), ...(x.briefing?.stats?.agents || [])];
  const cutoff = ev.cutoff || ev.summary.cutoff;
  const kept = x.sources.filter((s) => s.included && s.date && s.date <= cutoff);
  const seen = new Set<string>();
  return {
    format: PUBLISHED_FORMAT, case_key: ev.case_key, dry_run: !!x.dryRun, published_at: x.now ?? new Date().toISOString(), origin: x.origin,
    run: {
      eval_run_id: String(ev.id), cutoff, finished_at: ev.finished_at || ev.updated_date || "",
      // Runs from before judge_model was recorded: the judges' own usage says which model they ran on
      // (never ev.model, which is the forecaster's).
      model: ev.model || "", judge_model: ev.judge_model || [...new Set(usage.filter((u) => /^eval\/judge/.test(String(u.agent))).map((u) => String(u.model || "")).filter(Boolean))].join(", ") || "",
      pipeline_models: [...new Set(usage.filter((u) => !/^eval\//.test(String(u.agent))).map((u) => String(u.model || "")).filter(Boolean))],
      usage: totals(usage), errors: (ev.errors || []).map(String),
    },
    summary: ev.summary,
    forecasts: { news: ev.forecasts?.news ?? {}, no_news: ev.forecasts?.no_news ?? {} },
    judgments: ev.judgments ?? {},
    keyword_plan: x.plan ? { exposures: x.plan.exposures ?? [], keyword_count: Number(x.plan.keyword_count) || 0 } : null,
    briefing: x.briefing ? {
      headline: x.briefing.headline ?? "", summary: x.briefing.summary ?? "",
      outlook: x.briefing.company?.outlook ?? null, advice: x.briefing.company?.advice ?? [],
    } : null,
    findings: [...x.findings].sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0))
      .map((f) => Object.fromEntries(FINDING_KEYS.filter((k) => f[k] !== undefined).map((k) => [k, f[k]]))),
    sources: kept.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .map((s) => ({ title: s.title || "", outlet: s.source || "", date: s.date, url: s.url || "", query: s.query || "",
        window: s.window_from && s.window_to ? `${s.window_from}..${s.window_to}` : "", ...(s.flag ? { flag: s.flag } : {}) })),
  };
}

// Problems that make a snapshot unfit to present; empty when it is fine.
export function checkPublished(p: Rec, caseKey?: string): string[] {
  const out: string[] = [];
  if (!p || typeof p !== "object") return ["not an object"];
  if (p.format !== PUBLISHED_FORMAT) out.push(`format ${p.format}, expected ${PUBLISHED_FORMAT}`);
  if (caseKey && p.case_key !== caseKey) out.push(`case ${p.case_key}, expected ${caseKey}`);
  if (p.dry_run) out.push("dry run: fake services, not results");
  if (!p.summary?.news?.quarters?.rows?.length) out.push("no scored quarters");
  if (!p.summary?.no_news) out.push("no no-news condition");
  const fm = [p.forecasts?.news?.model, p.forecasts?.no_news?.model];
  if (fm[0] && fm[1] && fm[0] !== fm[1]) out.push(`the news and no-news forecasts used different models (${fm[0]} vs ${fm[1]})`);
  const cutoff = p.run?.cutoff || p.summary?.cutoff;
  // Without a cutoff, the date check below compares against undefined and passes every dated source.
  if (!cutoff) out.push("no cutoff date");
  const late =(p.sources || []).filter((s: Rec) => !s.date || s.date > cutoff);
  if (late.length) out.push(`${late.length} sources undated or after the cutoff`);
  return out;
}
