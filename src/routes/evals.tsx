import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Download, Loader2, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Section } from "@/components/bits";
import { Results } from "@/components/evals/Results";
import { SawPanel } from "@/components/evals/SawPanel";
import { dayLabel, runDay, viewFromEvalRun, viewFromPublished, type BacktestView } from "@/components/evals/view";
import { DEFAULT_CASE, downloadJson, exportPublished, runBacktest, STAGE_LABEL, type Progress } from "@/lib/evals";
import { publishedCases, usePublished } from "@/lib/published";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { EVAL_CASES } from "../../base44/shared/eval/cases.ts";

export const Route = createFileRoute("/evals")({
  head: () => ({
    meta: [
      { title: "Evals — Finley" },
      { name: "description", content: "Backtest: Finley frozen at a past date, scored against what the company reported and did over the following year." },
    ],
  }),
  component: Evals,
});

type Rec = Record<string, any>;
const errText = (e: unknown) => (e as Error)?.message || String(e);

// The Evals page shows one finished backtest. A published snapshot (src/evals/published/<case>.json,
// bundled with the build) is shown first and needs nothing from Base44; a finished live EvalRun can be
// shown instead, and is the only thing when no snapshot exists. Live runs start from the Method section.
function Evals() {
  const app = useApp();
  const qc = useQueryClient();
  const nav = useNavigate();
  // Every case can be run live; a case with a published snapshot opens on it.
  const published = publishedCases();
  const cases = Object.keys(EVAL_CASES);
  const [caseKey, setCaseKey] = useState(() => (published.includes(DEFAULT_CASE) || !published.length ? DEFAULT_CASE : published[0]!));
  const c = EVAL_CASES[caseKey] ?? EVAL_CASES[DEFAULT_CASE]!;
  const pub = usePublished(caseKey);
  const runs = useQuery({
    queryKey: ["evalRuns", caseKey],
    queryFn: async () => ((await base44.entities.EvalRun.filter({ case_key: caseKey }, { sort: "-created_date", limit: 10 }))?.items ?? []) as Rec[],
  });
  const [want, setWant] = useState<"published" | "live">("published");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState<{ ok: boolean; text: string } | null>(null);

  const all = runs.data ?? [];
  const done = all.find((r) => r.stage === "done");
  const latest = all[0];
  const unfinished = latest && !["done", "failed"].includes(latest.stage) ? latest : null;
  const failed = latest?.stage === "failed" ? latest : null;
  const snapshot = pub.snapshot;
  const showPublished = !!snapshot && (want === "published" || !done);
  const view = useMemo<BacktestView | null>(
    () => (showPublished ? viewFromPublished(snapshot!) : done ? viewFromEvalRun(done) : null),
    [showPublished, snapshot, done],
  );

  const pickCase = (k: string) => { setCaseKey(k); setWant("published"); setProgress(null); setError(""); setExported(null); };
  const start = async (o: { evalRunId?: string; retry?: boolean }) => {
    if (!app.requireSignIn("run a backtest")) return;
    setRunning(true); setError(""); setProgress(null);
    try {
      const p = await runBacktest({ ...o, caseKey, onProgress: setProgress });
      if (p?.failed) setError(`${STAGE_LABEL[p.stage] ?? p.stage}: ${p.error}`);
    } catch (e) {
      setError(errText(e));
    } finally {
      setRunning(false);
      await Promise.all([qc.invalidateQueries({ queryKey: ["evalRuns"] }), qc.invalidateQueries({ queryKey: ["clients"] })]);
    }
  };
  const exportRun = async () => {
    if (!done) return;
    setExporting(true); setExported(null);
    try {
      const { snapshot: snap, problems } = await exportPublished(done);
      if (problems.length) {
        setExported({ ok: false, text: `Not exported, the app would refuse to show it: ${problems.join("; ")}.` });
        return;
      }
      downloadJson(`${snap.case_key}.json`, snap);
      setExported({ ok: true, text: `Downloaded ${snap.case_key}.json (${snap.findings.length} findings, ${snap.sources.length} news items). Commit it as src/evals/published/${snap.case_key}.json; the next build shows it here and on the landing page.` });
    } catch (e) {
      setExported({ ok: false, text: `Export failed: ${errText(e)}` });
    } finally {
      setExporting(false);
    }
  };
  const openClient = () => { const ev = done ?? latest; if (ev?.client_id) { app.setClientId(ev.client_id); nav({ to: "/dashboard" }); } };

  const corpus: Rec | undefined = view?.corpus;
  const runCard = (
    <div className="card flex items-start justify-between gap-6 p-6">
      <div className="max-w-3xl space-y-2 text-sm">
        <p>
          We freeze {c.company} at <b>{dayLabel(c.cutoff)}</b>: Finley builds its keyword plan as of that day, collects only news dated before it, runs the
          full agent pipeline, then forecasts {c.horizon.label.toLowerCase()} twice, with that news and without it. A judge matches the advice to what {c.company} actually did; every score is computed in code.
        </p>
        {corpus?.fetched != null && (
          <p className="text-xs text-muted-foreground">
            News{view?.kind === "published" ? " in the published run" : ""}: {corpus.kept} of {corpus.fetched} results kept ({corpus.unique_kept} unique stories) from {corpus.searches} searches × {corpus.windows} date windows.
            Left out: {corpus.excluded?.after_cutoff ?? 0} dated after the cutoff, {corpus.excluded?.undated ?? 0} undated, {corpus.excluded?.before_lookback ?? 0} too old.
            {corpus.flagged ? ` ${corpus.flagged} kept but flagged for naming later years.` : ""}
            {corpus.failed_pair_count ? ` ${corpus.failed_pair_count} of ${corpus.searches * corpus.windows} search windows failed at Bright Data and are missing${corpus.failed_searches?.length ? ` (${corpus.failed_searches.length} searches returned nothing in any window)` : ""}.` : ""}
          </p>
        )}
        {view?.kind === "published" && (
          <p className="text-xs text-muted-foreground">A live backtest runs in this Base44 app with your sign-in and writes its own records; the published results above stay as they are.</p>
        )}
        {runs.isLoading && view && <p className="text-xs text-muted-foreground">Checking Base44 for live backtests…</p>}
        {runs.isError && <p className="text-xs text-muted-foreground">Live backtests need Base44, which didn't answer: {errText(runs.error)}</p>}
        {(progress || running) && (
          <p className="flex items-center gap-2 text-xs font-medium">
            {running && <Loader2 size={12} className="animate-spin" />}
            {STAGE_LABEL[progress?.stage ?? "queued"] ?? progress?.stage}
            {progress?.stage === "collect" && progress.total ? ` · ${progress.collected} of ${progress.total} searches` : ""}
            {progress?.busy ? " · another step is still running, waiting…" : ""}
          </p>
        )}
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger-ink">{error}</p>}
        {exported && <p className={cn("rounded-lg px-3 py-2 text-xs", exported.ok ? "bg-tint text-primary-foreground" : "bg-danger-soft text-danger-ink")}>{exported.text}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        {unfinished && !running ? (
          <button className="btn btn-primary" onClick={() => start({ evalRunId: unfinished.id })}>Resume backtest</button>
        ) : failed && !running ? (
          <div className="flex gap-2">
            <button className="btn" onClick={() => start({})}>Start new backtest</button>
            <button className="btn btn-primary" onClick={() => start({ evalRunId: failed.id, retry: true })}>Retry from {failed.failed_stage || "the start"}</button>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={() => start({})} disabled={running}>{running ? <><Loader2 size={12} className="animate-spin" /> Running…</> : done ? "Run again" : "Run backtest"}</button>
        )}
        {done && !running && (
          <button className="btn" onClick={exportRun} disabled={exporting} title={`Download the latest finished live run (${runDay(done.finished_at || done.updated_date)}) as a snapshot to commit`}>
            {exporting ? <><Loader2 size={12} className="animate-spin" /> Exporting…</> : <><Download size={12} /> Export for publishing</>}
          </button>
        )}
        <p className="max-w-xs text-right text-[10px] text-muted-foreground">Takes about 10 to 15 minutes. You can leave this page; come back and resume.</p>
      </div>
    </div>
  );

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-[1.1px] text-muted-foreground">Backtest · {c.company} · as of {dayLabel(c.cutoff)} → {c.horizon.label}</p>
        <h1 className="text-[32px] font-normal leading-[48px]">Evals</h1>
      </div>
      <div className="flex items-center gap-3">
        {cases.length > 1 && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Case
            <select value={caseKey} onChange={(e) => pickCase(e.target.value)} className="rounded-lg border bg-card px-3 py-1.5 text-sm font-semibold text-foreground">
              {cases.map((k) => <option key={k} value={k}>{EVAL_CASES[k]!.company} · as of {dayLabel(EVAL_CASES[k]!.cutoff)}{published.includes(k) ? " · published" : ""}</option>)}
            </select>
          </label>
        )}
        {snapshot && done && (
          <div className="flex rounded-full border bg-card p-0.5 text-xs font-semibold" role="group" aria-label="Which backtest to show">
            {([["published", "Published"], ["live", "Latest live run"]] as const).map(([k, label]) => (
              <button key={k} aria-pressed={showPublished === (k === "published")} onClick={() => setWant(k)}
                className={cn("rounded-full px-3 py-1", showPublished === (k === "published") ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{label}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const refused = pub.problems.length > 0 || !!pub.error;
  const refusedNote = refused && (
    <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
      {pub.error ? `The published backtest didn't load (${pub.error}).` : `A published snapshot for this case exists but isn't shown: ${pub.problems.join("; ")}.`}
    </p>
  );

  if (pub.loading) return <div className="space-y-10">{header}<p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading the published backtest…</p></div>;
  if (!view) {
    if (runs.isLoading) return <div className="space-y-10">{header}{refusedNote}<p className="text-sm text-muted-foreground">Loading backtests…</p></div>;
    return <div className="space-y-10">{header}{refusedNote}<Section title="Run the backtest">{runCard}</Section></div>;
  }

  const p = view.provenance;
  return (
    <div className="space-y-10">
      {header}

      <div className="space-y-4">
        {refusedNote}
        {view.kind === "published" && p && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border bg-card px-4 py-3 text-xs" data-provenance
            title={`Agent pipeline: ${p.pipelineModels.join(", ") || "not recorded"} · ${p.origin === "base44-export" ? "exported from the Base44 app" : "run with the local runner"} · published ${runDay(p.publishedAt)}`}>
            <span className="inline-flex items-center gap-1.5 rounded bg-tint px-2 py-0.5 font-bold text-primary-foreground"><ShieldCheck size={12} /> Published backtest</span>
            <span>Run finished <b>{runDay(p.finishedAt)}</b></span>
            <span className="text-muted-foreground">·</span>
            <span>Forecaster <b className="num">{p.model || "not recorded"}</b>, judge <b className="num">{p.judgeModel || "not recorded"}</b></span>
            <span className="text-muted-foreground">·</span>
            <span><b className="num">{p.calls}</b> model calls</span>
            <span className="text-muted-foreground">·</span>
            <span><b className="num">{p.newsKept}</b> news items kept</span>
            <span className="ml-auto text-muted-foreground">Nothing is re-run while you view this.</span>
          </div>
        )}

        <div className="flex items-start gap-3 rounded-2xl border border-warning-line bg-warning-soft p-4 text-sm text-warning-ink">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p>
              <b>Read with care.</b> {view.caveat} {view.unchecked ? `${view.unchecked} answer-key figures are still marked unchecked against ${view.company}'s filings.` : ""}
              {view.kind === "live" && (
                <>
                  {" "}Run finished {new Date(view.finishedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.{" "}
                  <button className="underline" onClick={openClient}>Open the backtest client's dashboard</button> to see what Finley showed on {dayLabel(view.cutoff)}.
                </>
              )}
            </p>
            {view.kind === "published" && !!p?.errors.length && (
              <details className="text-xs">
                <summary className="cursor-pointer">{p.errors.length} non-fatal problem{p.errors.length === 1 ? " was" : "s were"} recorded during the run</summary>
                <ul className="mt-1 list-disc pl-5">{p.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
              </details>
            )}
          </div>
        </div>

        {view.kind === "published" && view.saw && <SawPanel saw={view.saw} cutoff={view.cutoff} />}
      </div>

      <Results v={view} />

      <Section title="G. Method">{runCard}</Section>
    </div>
  );
}
