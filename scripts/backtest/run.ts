// Local backtest runner: runs the REAL backtest stages (base44/functions/runPipeline/eval/stages.ts) on this
// machine, against an in-memory stand-in for Base44 (memory.ts), and writes the finished backtest as a
// static snapshot (base44/shared/eval/published.ts) for the Evals page to present without any service.
//
//   npm run backtest                  real run: Claude and Bright Data, keys from .env
//   npm run backtest:dry              dry run: both services faked (fakes.ts), offline, free
//   npm run backtest -- --resume      continue the saved run (a failed one resumes from its failed stage)
//
// Options: --case <key> (default netflix-2023), --dry-run, --resume, --fresh (discard saved state),
// --new-run (start a new backtest on the saved store, reusing its collected news), --out <path>
// (real run only, from the repo root; default src/evals/published/<case>.json), --max-steps <n> (default 40).
//
// Each step is one simulated Base44 invocation: runEvalStep() gets a fresh startedAt, so the stages'
// time budgets behave as they do on Base44. The store is checkpointed to scripts/backtest/.state/ after
// every step (and every few seconds during one), so a run can be resumed after a crash or Ctrl-C.
// No key value is ever printed: only variable names.

import { EVAL_CASES } from "../../base44/shared/eval/cases.ts";
import { buildPublished, checkPublished } from "../../base44/shared/eval/published.ts";
import { loadEnv, OPTIONAL, REQUIRED, useDryRunEnv } from "./env.ts";
import { installFakes } from "./fakes.ts";
import { MemoryBase44, type MemoryState, sortRows, type WriteOp } from "./memory.ts";
import { settleBackground } from "./runtime_env.ts";
import { loadSchemas, schemaChecker } from "./schema.ts";

type Rec = Record<string, any>;

const ROOT = decodeURIComponent(new URL("../../", import.meta.url).pathname).replace(/\/$/, "");
const STATE_DIR = `${ROOT}/scripts/backtest/.state`;
const PUBLISHED_DIR = `${ROOT}/src/evals/published`;
const CHECKPOINT_EVERY_MS = 5_000;

// ---------- arguments ----------

const USAGE = `Usage: npm run backtest [-- options]   |   npm run backtest:dry [-- options]
  --case <key>      eval case (default netflix-2023; known: ${Object.keys(EVAL_CASES).join(", ")})
  --dry-run         fake Claude and Bright Data (offline); writes only scripts/backtest/.state/<case>.dry.published.json
  --resume          continue the saved run; a failed run resumes from its failed stage
  --fresh           discard the saved state and start over
  --new-run         start a new backtest on the saved store (reuses its collected news when the plan matches)
  --out <path>      real run only: where to write the snapshot, from the repo root (default src/evals/published/<case>.json)
  --max-steps <n>   invocations to simulate before stopping (default 40)`;

function fail(message: string, code = 2): never {
  console.error(message);
  Deno.exit(code);
}

function parseArgs(argv: string[]) {
  const out = { caseKey: "netflix-2023", dry: false, resume: false, fresh: false, newRun: false, out: "", maxSteps: 40 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => (i + 1 < argv.length && !argv[i + 1].startsWith("--") ? argv[++i] : fail(`${a} needs a value\n\n${USAGE}`));
    if (a === "--case") out.caseKey = value();
    else if (a === "--dry-run") out.dry = true;
    else if (a === "--resume") out.resume = true;
    else if (a === "--fresh") out.fresh = true;
    else if (a === "--new-run") out.newRun = true;
    else if (a === "--out") out.out = value();
    else if (a === "--max-steps") out.maxSteps = Math.max(1, Number(value()) || 40);
    else if (a === "--help" || a === "-h") { console.log(USAGE); Deno.exit(0); }
    else fail(`Unknown option ${a}\n\n${USAGE}`);
  }
  if ([out.resume, out.fresh, out.newRun].filter(Boolean).length > 1) fail("Pass at most one of --resume, --fresh and --new-run.");
  return out;
}

// Absolute, with "." and ".." resolved, so "is it under src/evals/published" can't be dodged.
function resolvePath(p: string): string {
  const parts: string[] = [];
  for (const seg of (p.startsWith("/") ? p : `${ROOT}/${p}`).split("/")) {
    if (!seg || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return `/${parts.join("/")}`;
}
const rel = (p: string) => (p.startsWith(`${ROOT}/`) ? p.slice(ROOT.length + 1) : p);
const under = (p: string, dir: string) => p === dir || p.startsWith(`${dir}/`);

// ---------- state ----------

interface Runner { case_key: string; dry_run: boolean; eval_run_id: string | null; created_at: string; steps: number }
interface SavedState { format: 1; runner: Runner; store: MemoryState }

function readState(path: string): SavedState | null {
  try {
    const state = JSON.parse(Deno.readTextFileSync(path));
    if (state?.format !== 1 || !state.store || !state.runner) fail(`${rel(path)} is not a runner state file; remove it or pass --fresh.`);
    return state;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return null;
    throw e;
  }
}

function writeAtomic(path: string, text: string) {
  Deno.mkdirSync(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  Deno.writeTextFileSync(`${path}.tmp`, text);
  Deno.renameSync(`${path}.tmp`, path);
}

// ---------- reading the store ----------

async function allRows(entity: any, query: Rec): Promise<Rec[]> {
  const out: Rec[] = [];
  let cursor: string | null = null;
  do {
    const page: any = await entity.filter(query, { limit: 1000, ...(cursor ? { cursor } : {}) });
    out.push(...(page.items || []));
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor);
  return out;
}

// Every model call of a backtest: the EvalRun's own usage (planner, forecasters, judges) plus the
// analyze stage's agents, which runAgentPipeline records on its Briefing instead.
function usageOf(store: MemoryBase44, evalRunId: string | null) {
  const ev = store.table("EvalRun").find((r) => r.id === evalRunId);
  const runs = new Set(store.table("Run").filter((r) => r.eval_run_id === evalRunId).map((r) => r.id));
  const agents = store.table("Briefing").filter((b) => runs.has(b.run_id)).flatMap((b) => b.stats?.agents || []);
  const usage: Rec[] = [...(ev?.usage || []), ...agents];
  const sum = (k: string) => usage.reduce((s, u) => s + (Number(u[k]) || 0), 0);
  return { calls: usage.length, input: sum("input_tokens"), output: sum("output_tokens"), thinking: sum("thinking_tokens") };
}

const fmt = (n: number) => n.toLocaleString("en-US");
const signed = (n: number | null | undefined, dp = 2) => (n == null ? "n/a" : `${n > 0 ? "+" : ""}${Number(n.toFixed(dp))}`);

function corpusLine(ev: Rec): string {
  const s = ev.corpus_stats || {};
  const pairs = `${s.collected ?? (ev.collected_pairs || []).length}/${s.total ?? "?"} search-windows fetched`;
  if (s.fetched == null) return `corpus: ${pairs}${s.failed_pairs_all?.length ? `, ${s.failed_pairs_all.length} failed so far` : ""}`;
  const x = s.excluded || {};
  return `corpus: ${pairs}; ${s.fetched} results, ${s.kept} kept (${s.unique_kept} unique); excluded ${x.undated ?? 0} undated, ${x.after_cutoff ?? 0} after cutoff, ${x.before_lookback ?? 0} before lookback; ${s.failed_pair_count ?? 0} failed searches`;
}

// ---------- main ----------

function acquireLock(statePath: string) {
  const lockPath = `${statePath}.lock`;
  Deno.mkdirSync(STATE_DIR, { recursive: true });
  try {
    Deno.openSync(lockPath, { write: true, createNew: true }).close();
  } catch (e) {
    if (e instanceof Deno.errors.AlreadyExists) {
      fail(`Another runner is using ${rel(statePath)} (${rel(lockPath)} exists). If none is running (it was killed), delete that file and try again.`, 1);
    }
    throw e;
  }
  const release = () => { try { Deno.removeSync(lockPath); } catch { /* already gone */ } };
  addEventListener("unload", release); // also runs on Deno.exit()
  try {
    Deno.addSignalListener("SIGINT", () => { release(); Deno.exit(130); });
  } catch { /* signals unsupported on this platform */ }
}

async function main() {
  // Base44 runs in UTC, and shared/dates.ts reads Google's "Jan 1, 2023" in the local time zone: east of
  // UTC, a story from the day after the cutoff would land on the cutoff day and leak into the backtest.
  Deno.env.set("TZ", "UTC");
  if ([0, 6].some((m) => new Date(2023, m, 1).getTimezoneOffset() !== 0)) fail("Could not switch this process to UTC; run it with TZ=UTC.");
  const args = parseArgs(Deno.args);
  const c = EVAL_CASES[args.caseKey];
  if (!c) fail(`Unknown case "${args.caseKey}". Known: ${Object.keys(EVAL_CASES).join(", ")}`);
  const statePath = `${STATE_DIR}/${c.key}${args.dry ? ".dry" : ""}.json`;
  const outPath = args.dry ? `${STATE_DIR}/${c.key}.dry.published.json` : resolvePath(args.out || `${PUBLISHED_DIR}/${c.key}.json`);
  const again = `npm run ${args.dry ? "backtest:dry" : "backtest"} -- --resume${c.key !== "netflix-2023" ? ` --case ${c.key}` : ""}`;

  if (args.dry && args.out) {
    fail(under(resolvePath(args.out), PUBLISHED_DIR)
      ? `Refusing --out ${args.out}: a dry run fakes Claude and Bright Data, so it must never land in src/evals/published.`
      : `A dry run writes only ${rel(outPath)}; --out is for real runs.`);
  }

  // One runner per state file: the EvalRun lease lives in this process's memory, so it can't stop a
  // second process from running (and paying for) the same stages and overwriting the checkpoint.
  acquireLock(statePath);

  // Keys first: nothing is created or spent without them.
  let fakes: ReturnType<typeof installFakes> | null = null;
  if (args.dry) {
    const removed = useDryRunEnv();
    fakes = installFakes();
    console.log(`DRY RUN: Claude and Bright Data are faked, nothing leaves this machine, .env is not read.${removed.length ? ` Ignoring ${removed.join(", ")} from the environment.` : ""}`);
  } else {
    const env = loadEnv(`${ROOT}/.env`);
    if (env.missing.length) {
      fail([
        `Missing required ${env.missing.length === 1 ? "key" : "keys"}: ${env.missing.join(", ")}`,
        env.file_found ? `Fill ${env.missing.length === 1 ? "it" : "them"} in ${env.file} (KEY=value, one per line; the file is git-ignored):` : `Create ${env.file} (it is git-ignored) with:`,
        ...REQUIRED.map((k) => `  ${k}=...${k === "BRIGHTDATA_SERP_ZONE" ? "    (the SERP API zone name from the Bright Data control panel)" : ""}`),
        `Optional: ${OPTIONAL.join(", ")} (forecaster and judge models; both default to the pipeline's model).`,
        "Variables already set in the environment are used as they are. Then run: npm run backtest",
        "To check the plumbing without keys: npm run backtest:dry",
      ].join("\n"));
    }
    const set = [...REQUIRED, ...OPTIONAL].map((k) => `${k} (${env.from_env_file.includes(k) ? ".env" : env.from_environment.includes(k) ? "environment" : "not set"})`);
    console.log(`REAL RUN: Claude and Bright Data will be called and billed. Keys: ${set.join(", ")}.`);
    if (env.removed.length) console.log(`Removed ${env.removed.join(", ")} from this process's environment so the SDK talks to api.anthropic.com.`);
    if (env.ignored.length) console.log(`Ignoring ${env.ignored.join(", ")} in .env (not used by the backtest).`);
  }

  // State: a real run never silently discards or reuses earlier work.
  const saved = readState(statePath);
  if (args.resume && !saved) fail(`Nothing to resume: ${rel(statePath)} does not exist.`);
  if (args.newRun && !saved) fail(`--new-run needs a saved store: ${rel(statePath)} does not exist.`);
  if (saved && !args.resume && !args.fresh && !args.newRun) {
    if (!args.dry) {
      fail(`A saved run exists (${rel(statePath)}, EvalRun ${saved.runner.eval_run_id ?? "not created"}, ${saved.runner.steps} steps).\n` +
        "Pass --resume to continue it, --new-run to start a new backtest on the same store (reusing its collected news), or --fresh to discard it.");
    }
    console.log(`Starting over: ${rel(statePath)} is replaced (dry runs start fresh unless --resume is given).`);
  }
  const kept: SavedState | null = saved && (args.resume || args.newRun) ? saved : null;
  if (kept && kept.runner.dry_run !== args.dry) fail(`${rel(statePath)} was made by a ${kept.runner.dry_run ? "dry" : "real"} run.`);

  const schemas = loadSchemas(`${ROOT}/base44/entities`);
  const checker = schemaChecker(schemas);
  let lastSave = Date.now(), dirty = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const runner: Runner = args.resume && kept ? kept.runner
    : { case_key: c.key, dry_run: args.dry, eval_run_id: null, created_at: new Date().toISOString(), steps: 0 };
  let store: MemoryBase44;
  const checkpoint = () => {
    if (timer) { clearTimeout(timer); timer = undefined; }
    writeAtomic(statePath, JSON.stringify({ format: 1, runner, store: store.toJSON() } satisfies SavedState));
    lastSave = Date.now();
    dirty = false;
  };
  const opts = {
    onWrite: (entity: string, op: WriteOp, data: Rec) => {
      checker.check(entity, op, data);
      dirty = true;
      // Base44 keeps every write as it happens; a crash mid-step loses at most a few seconds here. A timer,
      // not a microtask: it fires only after the current chain of store calls, so news rows are never
      // saved without the collected_pairs update that marks their searches done.
      if (!timer) timer = setTimeout(() => { timer = undefined; if (dirty) checkpoint(); }, Math.max(0, CHECKPOINT_EVERY_MS - (Date.now() - lastSave)));
    },
  };
  store = kept ? MemoryBase44.fromJSON(kept.store, opts) : new MemoryBase44(opts);
  if (args.fresh && saved) console.log(`Discarded ${rel(statePath)}.`);
  if (args.newRun) {
    // A new run reuses only a complete collection (collect() looks for corpus_complete). An unfinished
    // one would be fetched again next to its own partial rows and counted twice.
    const evs = store.table("EvalRun").filter((r) => r.case_key === c.key && r.corpus_key);
    const unfinished = evs.find((r) => !r.corpus_complete && !evs.some((d) => d.corpus_key === r.corpus_key && d.corpus_complete));
    if (unfinished) fail(`EvalRun ${unfinished.id} in ${rel(statePath)} never finished collecting news. Use --resume to finish it, or --fresh to start over.`);
  }

  const E = store.entities;
  if (args.resume && !runner.eval_run_id) {
    // Interrupted during its first step: the EvalRun exists in the checkpoint, the runner hadn't noted it yet.
    runner.eval_run_id = sortRows(store.table("EvalRun").filter((r) => r.case_key === c.key), "-created_date")[0]?.id ?? null;
  }
  if (runner.eval_run_id) {
    // This runner is the only worker on its store: a lease left by a killed step is stale.
    const ev = await E.EvalRun.get(runner.eval_run_id);
    if (ev.lease_until && Date.parse(ev.lease_until) > Date.now()) {
      await E.EvalRun.update(ev.id, { lease_until: new Date().toISOString() });
      console.log("Cleared the lease left by an interrupted step.");
    }
  }

  // Loaded only now, so the SDK and the Bright Data client see the environment and the fakes set above.
  const { runEvalStep } = await import("../../base44/functions/runPipeline/eval/stages.ts");
  const user = await store.auth.me();

  let retry = !!runner.eval_run_id && (await E.EvalRun.get(runner.eval_run_id)).stage === "failed";
  if (retry) console.log("The saved run failed; retrying from its failed stage.");
  console.log(`Backtest ${c.key}: ${c.company} as of ${c.cutoff}. State: ${rel(statePath)}`);

  let view: Rec = {};
  for (let step = 1; step <= args.maxSteps; step++) {
    const before = runner.eval_run_id ? store.table("EvalRun").find((r) => r.id === runner.eval_run_id) : null;
    const stageBefore = before?.stage ?? "new";
    if (stageBefore === "done") { view = { done: true, eval_run_id: runner.eval_run_id }; break; }
    const usedBefore = usageOf(store, runner.eval_run_id);
    const startedAt = Date.now();
    const req: Rec = runner.eval_run_id ? { eval_run_id: runner.eval_run_id, ...(retry ? { retry: true } : {}) } : { case_key: c.key };
    retry = false;
    view = await runEvalStep(store, user, req, startedAt);
    await settleBackground();
    runner.eval_run_id = view.eval_run_id;
    runner.steps++;
    checkpoint();
    const ev = await E.EvalRun.get(view.eval_run_id);
    const used = usageOf(store, runner.eval_run_id);
    const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`\n[step ${runner.steps}] ${stageBefore} -> ${ev.stage}${view.busy ? " (busy: another worker holds the lease)" : ""} in ${secs}s`);
    console.log(`  ${corpusLine(ev)}`);
    console.log(`  model: ${used.calls - usedBefore.calls} calls this step, tokens in ${fmt(used.input - usedBefore.input)} / out ${fmt(used.output - usedBefore.output)} / thinking ${fmt(used.thinking - usedBefore.thinking)}; run total ${used.calls} calls`);
    if (view.done || view.failed) break;
    if (view.busy) fail(`EvalRun ${ev.id} is leased by another worker until ${ev.lease_until}. Is another runner using ${rel(statePath)}?`, 1);
  }
  checkpoint();
  if (fakes) console.log(`\nFakes: ${fakes.stats.brightdata_requests} Bright Data searches and ${fakes.stats.claude_requests} Claude calls answered offline; ${fakes.stats.refused.length} other requests refused${fakes.stats.refused.length ? `: ${fakes.stats.refused.slice(0, 5).join(", ")}` : ""}.`);

  if (view.failed) {
    console.error(`\nFAILED at stage "${view.failed_stage}": ${view.error}`);
    console.error(`Fix the cause, then resume (finished work is kept): ${again}`);
    Deno.exit(1);
  }
  if (!view.done) {
    console.error(`\nStopped after ${args.maxSteps} steps at stage "${view.stage}". Continue with: ${again}`);
    Deno.exit(1);
  }

  // ---------- publish ----------
  const ev = await E.EvalRun.get(runner.eval_run_id!);
  const findings = await allRows(E.Finding, { run_id: ev.run_id });
  const briefing = ev.briefing_id ? await E.Briefing.get(ev.briefing_id).catch(() => null) : null;
  const plan = ev.plan_id ? await E.KeywordPlan.get(ev.plan_id).catch(() => null) : null;
  const sources = ev.corpus_key ? await allRows(E.EvalSource, { corpus_key: ev.corpus_key }) : [];
  const published = buildPublished({ ev, findings, briefing, plan, sources, origin: "local-runner", dryRun: args.dry });
  const problems = checkPublished(published, c.key);
  printSummary(published, c, findings.length, checker.warnings);

  const text = `${JSON.stringify(published, null, 2)}\n`;
  if (args.dry) {
    writeAtomic(outPath, text);
    console.log(`\nWrote ${rel(outPath)} (dry run: marked dry_run=true; the app refuses to present it).`);
    console.log(`checkPublished on it: ${problems.join("; ") || "no problems (unexpected for a dry run)"}`);
    return;
  }
  if (problems.length) {
    const rejected = `${STATE_DIR}/${c.key}.published.rejected.json`;
    writeAtomic(rejected, text);
    console.error(`\nNOT PUBLISHED: the snapshot failed checkPublished:\n${problems.map((p) => `  - ${p}`).join("\n")}\nIt was kept for inspection at ${rel(rejected)}.`);
    Deno.exit(1);
  }
  try {
    writeAtomic(outPath, text);
  } catch (e) {
    const where = `${STATE_DIR}/${c.key}.published.json`;
    writeAtomic(where, text);
    fail(`Could not write ${outPath} (${(e as Error).name}): npm run backtest may write only under scripts/backtest/.state and src/evals/published.\nThe snapshot passed checkPublished and was saved to ${rel(where)}; copy it where you need it.`, 1);
  }
  console.log(`\nPublished ${rel(outPath)}. Review it, then commit it; the Evals page shows it without calling any service.`);
}

function printSummary(p: Rec, c: Rec, findingsSaved: number, warnings: string[]) {
  const s = p.summary, n = s.news, b = s.no_news, g = s.gap;
  const decisions = (c.actions as Rec[]).filter((a) => a.kind === "decision").length;
  const col = (x: string, w = 12) => x.padEnd(w);
  const row = (label: string, news: string, base: string) => console.log(`  ${col(label, 26)}${col(news)}${base}`);
  const pct = (x: number | null) => (x == null ? "n/a" : `${x}%`);
  console.log(`\n${"=".repeat(64)}\nBacktest ${p.case_key}: ${s.company} as of ${s.cutoff}, horizon ${s.horizon?.label ?? ""}${p.dry_run ? "\nDRY RUN: fake Claude and Bright Data. These numbers test the plumbing; they are not results." : ""}`);
  row("", "news", "no news");
  row("Quarters inside range", `${n.quarters.hits}/${n.quarters.n}`, `${b.quarters.hits}/${b.quarters.n}`);
  row("Quarterly revenue MAE", pct(n.quarters.mae_pct), pct(b.quarters.mae_pct));
  row(`Brier (${n.questions.n} questions)`, String(n.questions.brier), String(b.questions.brier));
  row("Questions right", `${n.questions.correct}/${n.questions.n}`, `${b.questions.correct}/${b.questions.n}`);
  row("KPI direction right", `${n.kpis.direction_correct}/${n.kpis.n}`, `${b.kpis.direction_correct}/${b.kpis.n}`);
  row("Decisions anticipated", `${n.recommendations.anticipated.length}/${decisions}`, `${b.recommendations.anticipated.length}/${decisions}`);
  row("Recommendation precision", String(n.recommendations.precision_lenient ?? "n/a"), String(b.recommendations.precision_lenient ?? "n/a"));
  console.log(`  News minus no-news (positive = the news helped): quarter hits ${signed(g.quarter_hits, 0)}, MAE ${signed(g.quarter_mae_pct)} pts, KPI direction ${signed(g.kpi_direction, 0)}, Brier ${signed(g.question_brier, 4)}, questions right ${signed(g.question_correct, 0)}, rec precision ${signed(g.rec_precision, 3)}, rec recall ${signed(g.rec_recall, 3)}`);
  const f = s.findings;
  console.log(`  Findings saved: ${findingsSaved}; judged ${f.decided} (${f.held} held${f.directional_pct != null ? `, ${f.directional_pct}% directional` : ""}), ${f.n - f.decided} unclear`);
  const u = p.run.usage;
  console.log(`  Model calls: ${u.calls}; tokens in ${fmt(u.input_tokens)} / out ${fmt(u.output_tokens)} / thinking ${fmt(u.thinking_tokens)}; model time ${(u.ms / 1000).toFixed(1)}s`);
  console.log(`  Models: forecaster ${p.run.model}, judges ${p.run.judge_model}, pipeline ${p.run.pipeline_models.join(", ") || "n/a"}`);
  console.log(`  Sources published: ${p.sources.length} kept news items, all dated on or before ${p.run.cutoff}; ${s.unchecked_answers} answer-key items still marked check`);
  const cp = s.corpus || {};
  if (cp.failed_pair_count) console.log(`  WARNING: ${cp.failed_pair_count} of ${cp.searches * cp.windows} search windows failed at Bright Data; their news is missing (the Evals page says so).`);
  if (p.run.errors.length) console.log(`  Non-fatal problems recorded: ${p.run.errors.length} (first: ${p.run.errors[0]})`);
  if (warnings.length) console.log(`  Schema warnings: ${warnings.length} (see [schema] lines above)`);
  console.log("=".repeat(64));
}

if (import.meta.main) {
  await main().catch((e) => {
    console.error(`\nRunner error: ${(e as Error)?.stack ?? e}`);
    Deno.exit(1);
  });
}
