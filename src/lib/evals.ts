// Backtests from the Evals page. runPipeline advances an EvalRun one stage at a time
// (base44/functions/runPipeline/eval/stages.ts); this keeps calling it until the run is done.
import { base44 } from "@/api/base44Client";
import { EVAL_CASES } from "../../base44/shared/eval/cases.ts";
import { buildPublished, checkPublished, type PublishedBacktest } from "../../base44/shared/eval/published.ts";

export const DEFAULT_CASE = "netflix-2023";
export const STAGE_LABEL: Record<string, string> = {
  queued: "Starting", plan: "Planning keywords as of the cutoff", collect: "Collecting dated news", analyze: "Running the agents as of the cutoff",
  forecast: "Forecasting the year, with and without the news", score: "Scoring against what happened", done: "Done", failed: "Failed",
};

export interface Progress { eval_run_id: string; stage: string; done: boolean; failed: boolean; error: string; collected?: number; total?: number | null; busy?: boolean }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Starts a backtest (or resumes one) and steps it until it finishes. Each step can take up to five
// minutes; if the request drops before the function ends, the run's lease says when it is safe to call again.
export async function runBacktest(opts: { evalRunId?: string; caseKey?: string; retry?: boolean; onProgress: (p: Progress) => void; signal?: { stop: boolean } }) {
  let id = opts.evalRunId;
  if (!id) {
    const c = EVAL_CASES[opts.caseKey || DEFAULT_CASE];
    if (!c) throw new Error(`Unknown eval case ${opts.caseKey}`);
    id = (await base44.entities.EvalRun.create({ case_key: c.key, cutoff: c.cutoff, stage: "queued", errors: [], usage: [] })).id as string;
  }
  let retry = !!opts.retry;
  for (let step = 0; step < 40 && !opts.signal?.stop; step++) {
    let p: Progress;
    try {
      p = (await base44.functions.invoke("runPipeline", { eval: { eval_run_id: id, ...(retry ? { retry: true } : {}) } })).data as Progress;
      retry = false;
    } catch (e: any) {
      // A real answer from the server (expired sign-in, a bug) is shown as is. Only a dropped or
      // timed-out request means the step may still be running, so wait for its lease.
      const status = e?.status ?? e?.response?.status;
      if (status && status !== 408 && status !== 502 && status !== 504) throw new Error(e?.response?.data?.error ?? e?.data?.error ?? e?.message ?? `error ${status}`);
      p = await waitForLease(id);
    }
    opts.onProgress(p);
    if (p.done || p.failed) return p;
    if (p.busy) await sleep(15_000);
  }
  return null;
}

type Rec = Record<string, any>;

// Every record matching an equality query, a cursor page at a time.
async function allRows(entity: any, query: Rec): Promise<Rec[]> {
  const out: Rec[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 200; page++) {
    const res: any = await entity.filter(query, { limit: 1000, ...(cursor ? { cursor } : {}) });
    out.push(...(Array.isArray(res) ? res : res?.items ?? []));
    cursor = res?.has_more && res?.next_cursor ? res.next_cursor : null;
    if (!cursor) return out;
  }
  throw new Error("Too many pages while reading the backtest's records");
}

// Freezes a finished live backtest as a published snapshot (base44/shared/eval/published.ts): the
// EvalRun, its scan's findings, briefing and keyword plan, and every news row of its corpus. The
// problems list is what would stop the app from presenting it.
export async function exportPublished(ev: Rec): Promise<{ snapshot: PublishedBacktest; problems: string[] }> {
  if (ev?.stage !== "done") throw new Error("Only a finished backtest can be exported");
  const E = base44.entities;
  const [findings, briefing, plan, sources] = await Promise.all([
    ev.run_id ? allRows(E.Finding, { run_id: ev.run_id }) : Promise.resolve([]),
    ev.briefing_id ? E.Briefing.get(ev.briefing_id) : Promise.resolve(null),
    ev.plan_id ? E.KeywordPlan.get(ev.plan_id) : Promise.resolve(null),
    ev.corpus_key ? allRows(E.EvalSource, { corpus_key: ev.corpus_key }) : Promise.resolve([]),
  ]);
  const snapshot = buildPublished({ ev, findings, briefing, plan, sources, origin: "base44-export" });
  return { snapshot, problems: checkPublished(snapshot, ev.case_key) };
}

export function downloadJson(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function waitForLease(id: string): Promise<Progress> {
  for (let i = 0; i < 40; i++) {
    const ev = await base44.entities.EvalRun.get(id).catch(() => null);
    if (ev && !(ev.lease_until && Date.parse(ev.lease_until) > Date.now())) {
      return { eval_run_id: id, stage: ev.stage, done: ev.stage === "done", failed: ev.stage === "failed", error: ev.error || "" };
    }
    await sleep(10_000);
  }
  throw new Error("The backtest step did not finish in time");
}
