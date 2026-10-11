import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Context, type ReactNode } from "react";
import { base44 } from "@/api/base44Client";
import type { Client, Finding, Status, TopicId, Values } from "./data";
import { baseValues, presetValues, topicValues, type ClientValues } from "./model";
import { dbStatus, scanLabel, toClient, toOutcome, uiStatus, type FindingOutcome, type FindingStatus, type Outcome } from "./live";
import type { RecStatus } from "./recs";
import type { Overrides, Tier } from "./scores";

export type { FindingStatus };
export type Preset = "base" | "downside" | "upside" | "custom";
export interface SavedScenario { id: string; clientId: string; name: string; created: string; values: ClientValues }
export interface ClientSummary { id: string; name: string; evalCase: string }

const SEV: Status[] = ["Challenged", "Under pressure", "Supported", "Holding"];
const SCAN_STAGE: Record<string, string> = { queued: "Starting", collecting: "Collecting news", research: "Research agents", company: "Testing assumptions", scenario: "Writing findings" };
const SCAN_TIMEOUT_MS = 7 * 60_000; // runPipeline stops itself inside Base44's 5-minute limit

interface Ctx {
  user: Record<string, any> | null; authChecked: boolean;
  // Pages are readable without signing in (as on main); anything that writes or spends tokens asks first.
  needsSignIn: boolean; requireSignIn: (why: string) => boolean;
  briefing: Record<string, any> | null; // the latest scan's Briefing: market picture, outlook, decision advice
  evalRun: Record<string, any> | null; // a backtest client's latest scored EvalRun (null for live clients)
  clients: ClientSummary[]; clientsLoading: boolean;
  client: Client | null; clientLoading: boolean; loadError: string;
  clientId: string; setClientId: (id: string) => void;
  refresh: () => Promise<void>;
  values: ClientValues; preset: Record<TopicId, Preset>; tags: Record<TopicId, Record<string, string>>;
  setDriver: (t: TopicId, d: string, v: number) => void;
  applyPreset: (t: TopicId, p: Exclude<Preset, "custom">) => void;
  useFinding: (f: Finding) => void;
  findingStatus: (id: string) => FindingStatus; setFindingStatus: (id: string, s: FindingStatus) => void;
  findingOutcome: (id: string) => FindingOutcome | null; setOutcome: (id: string, o: Outcome | "") => void;
  notes: Record<string, string>; setNote: (id: string, n: string) => void;
  openCount: (t: TopicId) => { count: number; urgent: boolean };
  topicStatus: (t: TopicId) => Status;
  saved: SavedScenario[]; saveScenario: (name: string, values?: ClientValues) => void;
  lastScan: string; scanning: boolean; scanStage: string; scan: () => void;
  toast: string | null; notify: (m: string) => void;
  drawer: Finding | null; openDrawer: (f: Finding | null) => void;
  recStatus: Record<string, RecStatus>; setRecStatus: (id: string, s: RecStatus, reviewIds?: string[]) => void;
  overrides: Overrides; setOverride: (name: string, tier: Tier | null, reason: string) => void;
}
// One context object per app run. When the dev server hot-reloads this module, a
// page module loaded after the reload must still see the provider already on screen.
const G = globalThis as typeof globalThis & { __signalDeskAppCtx?: Context<Ctx | null> };
const C = (G.__signalDeskAppCtx ??= createContext<Ctx | null>(null));
export const useApp = () => { const c = useContext(C); if (!c) throw new Error("no ctx"); return c; };
// For pages that only render once a client is loaded (the shell shows a loader until then).
export const useClient = () => { const c = useApp().client; if (!c) throw new Error("no client loaded"); return c; };

const stored = (key: string) => { try { return window.localStorage.getItem(key) || ""; } catch { return ""; } };
const store = (key: string, v: string) => { try { window.localStorage.setItem(key, v); } catch { /* private mode */ } };
const dateLabel = (iso: string) => new Date(iso || Date.now()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const items = (page: any): Record<string, any>[] => (Array.isArray(page) ? page : page?.items ?? []);

async function loadClient(id: string) {
  const E = base44.entities;
  const [rec, plans, findings, scenarios, runs, briefings] = await Promise.all([
    E.Client.get(id),
    E.KeywordPlan.filter({ client_id: id }, { sort: "-created_date", limit: 1 }),
    E.Finding.filter({ client_id: id }, { sort: "-created_date", limit: 150 }),
    E.Scenario.filter({ client_id: id }, { sort: "-created_date", limit: 50 }),
    E.Run.filter({ client_id: id }, { sort: "-created_date", limit: 1 }),
    E.Briefing.filter({ client_id: id }, { sort: "-created_date", limit: 1 }).catch(() => null),
  ]);
  // A backtest client is never analyst-reviewed; its scorecard comes from the judged EvalRun.
  const evalRuns = rec?.["eval_case"]
    ? await E.EvalRun.filter({ client_id: id, stage: "done" }, { sort: "-created_date", limit: 1 }).catch(() => null)
    : null;
  const fs = items(findings);
  return {
    client: toClient(rec, items(plans)[0], fs),
    statuses: Object.fromEntries(fs.map((f) => [f["id"], uiStatus(f["review_status"])])) as Record<string, FindingStatus>,
    outcomes: Object.fromEntries(fs.map((f) => [f["id"], toOutcome(f)] as const).filter(([, o]) => o)) as Record<string, FindingOutcome>,
    notes: Object.fromEntries(fs.filter((f) => f["feedback"]).map((f) => [f["id"], String(f["feedback"])])) as Record<string, string>,
    saved: items(scenarios).filter((s) => s["values"] && typeof s["values"] === "object")
      .map((s): SavedScenario => ({ id: s["id"], clientId: id, name: s["name"] || s["question"] || "Scenario", created: dateLabel(s["created_date"]), values: s["values"] })),
    overrides: (rec["source_overrides"] || {}) as Overrides,
    recStatus: (rec["rec_decisions"] || {}) as Record<string, RecStatus>,
    latestRun: items(runs)[0] ?? null,
    briefing: items(briefings)[0] ?? null,
    evalRun: items(evalRuns)[0] ?? null,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me(), retry: false, staleTime: 5 * 60_000 });
  const user = me.data ?? null;
  const navigate = useNavigate();
  const clientsQ = useQuery({
    queryKey: ["clients"], enabled: !me.isLoading, staleTime: 60_000, retry: false,
    queryFn: async () => items(await base44.entities.Client.list("-created_date", 200))
      .map((c): ClientSummary => ({ id: c["id"], name: c["name"] || "Unnamed client", evalCase: c["eval_case"] || "" })),
  });
  const clients = useMemo(() => clientsQ.data ?? [], [clientsQ.data]);
  const [picked, setPicked] = useState(() => (new URLSearchParams(window.location.search).has("demo") ? "demo" : stored("finley.client")));
  const demoId = clients.find((c) => c.evalCase?.startsWith("netflix"))?.id;
  const clientId = picked === "demo" && demoId ? demoId : clients.some((c) => c.id === picked) ? picked : clients.find((c) => !c.evalCase)?.id ?? clients[0]?.id ?? "";
  const clientQ = useQuery({ queryKey: ["client", clientId], enabled: !!clientId, queryFn: () => loadClient(clientId), staleTime: 30_000 });
  const data = clientQ.data;
  const client = data?.client ?? null;

  // Local edits on top of what was loaded; each is also written to Base44.
  const [vals, setVals] = useState<Record<string, ClientValues>>({});
  const [presets, setPresets] = useState<Record<string, Record<TopicId, Preset>>>({});
  const [tagsAll, setTags] = useState<Record<string, Record<TopicId, Record<string, string>>>>({});
  const [fs, setFs] = useState<Record<string, FindingStatus>>({});
  const [outs, setOuts] = useState<Record<string, FindingOutcome | null>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [recs, setRecs] = useState<Record<string, Record<string, RecStatus>>>({});
  const [overridesAll, setOverridesAll] = useState<Record<string, Overrides>>({});
  const [scanning, setScanning] = useState(false);
  const [scanStage, setScanStage] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<Finding | null>(null);
  const noteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const notify = useCallback((m: string) => { setToast(m || null); if (m) setTimeout(() => setToast((t) => (t === m ? null : t)), 3200); }, []);
  const refresh = useCallback(async () => { await Promise.all([qc.invalidateQueries({ queryKey: ["clients"] }), qc.invalidateQueries({ queryKey: ["client"] })]); }, [qc]);

  // Follows a pipeline run until it ends, then reloads the client's findings.
  const follow = useCallback(async (runId: string, startedAt: number, failedEarly: () => string) => {
    setScanning(true);
    try {
      while (Date.now() - startedAt < SCAN_TIMEOUT_MS) {
        await new Promise((r) => setTimeout(r, 4000));
        const early = failedEarly();
        if (early) { notify(`Scan failed: ${early}`); return; }
        const run = await base44.entities.Run.get(runId).catch(() => null);
        if (!run) continue;
        if (run["stage"] === "done") { notify(run["findings_count"] ? `${run["findings_count"]} new finding${run["findings_count"] === 1 ? "" : "s"}` : "No new findings"); return; }
        if (run["stage"] === "failed") { notify(`Scan failed: ${run["error"] || "unknown error"}`); return; }
        setScanStage(SCAN_STAGE[run["stage"]] ?? "Scanning");
      }
      notify("The scan is taking longer than expected. Findings will appear when it finishes.");
    } finally {
      setScanning(false); setScanStage("");
      await refresh();
    }
  }, [notify, refresh]);

  // Pick up a scan that was still running when the page loaded.
  const resumed = useRef("");
  useEffect(() => {
    const run = data?.latestRun;
    if (!run || scanning || resumed.current === run["id"]) return;
    const started = Date.parse(run["created_date"] || "");
    if (["done", "failed"].includes(run["stage"]) || !(Date.now() - started < SCAN_TIMEOUT_MS)) return;
    resumed.current = run["id"];
    void follow(run["id"], started, () => "");
  }, [data?.latestRun, scanning, follow]);

  const value: Ctx = useMemo(() => {
    const cid = clientId;
    const findingStatus = (id: string) => fs[id] ?? data?.statuses[id] ?? "open";
    const clientVals = (c: Client): ClientValues => Object.fromEntries(c.topicOrder.map((t) => [t, topicValues(c, vals[c.id], t)]));
    const values = client ? clientVals(client) : {};
    const active = (t: TopicId) => (client?.findings ?? []).filter((f) => f.topicId === t && findingStatus(f.id) !== "dismissed");
    const setTopic = (t: TopicId, v: Values, p: Preset, tg: Record<string, string>) => {
      setVals((s) => ({ ...s, [cid]: { ...s[cid], [t]: v } }));
      setPresets((s) => ({ ...s, [cid]: { ...s[cid], [t]: p } }));
      setTags((s) => ({ ...s, [cid]: { ...s[cid], [t]: tg } }));
    };
    const overrides = overridesAll[cid] ?? data?.overrides ?? {};
    const recStatus = recs[cid] ?? data?.recStatus ?? {};
    // Backtest findings carry the judge's verdict in the EvalRun rather than Finding.outcome; the
    // dashboard treats both as "how the flag turned out". An analyst-set outcome always wins.
    const evalVerdicts = new Map<string, Outcome>();
    if (client?.evalCase) for (const r of ((data?.evalRun?.["summary"]?.["findings"]?.["rows"] ?? []) as Record<string, any>[])) {
      if (r?.["id"] && r["held"]) evalVerdicts.set(r["id"], r["held"]);
    }
    const findingOutcome = (id: string): FindingOutcome | null =>
      (id in outs ? outs[id] : (data?.outcomes[id] ?? null)) ??
      (evalVerdicts.has(id) ? { outcome: evalVerdicts.get(id)!, reason: "Judged in the backtest against what happened", source: "backtest", at: "" } : null);
    // Signed-out visitors can browse and try every control, but nothing they do is written to the
    // shared records; the toast says so.
    const unsaved = user ? "" : " · not saved, sign in to keep it";
    const saveRecs = (next: Record<string, RecStatus>) => {
      setRecs((x) => ({ ...x, [cid]: next }));
      if (user) base44.entities.Client.update(cid, { rec_decisions: next }).catch((e) => notify(`Couldn't save the decision: ${e.message}`));
    };
    const saveStatus = (ids: string[], s: FindingStatus) => {
      setFs((x) => ({ ...x, ...Object.fromEntries(ids.map((id) => [id, s])) }));
      if (user) for (const id of ids) base44.entities.Finding.update(id, { review_status: dbStatus(s) }).catch((e) => notify(`Couldn't save the status: ${e.message}`));
    };
    return {
      user, authChecked: !me.isLoading,
      needsSignIn: !user && [401, 403].includes(Number((clientsQ.error as any)?.status ?? (clientsQ.error as any)?.response?.status)),
      requireSignIn: (why) => {
        if (user) return true;
        notify(`Sign in to ${why}`);
        void navigate({ to: "/login" });
        return false;
      },
      briefing: data?.briefing ?? null,
      evalRun: data?.evalRun ?? null,
      clients, clientsLoading: clientsQ.isLoading, client, clientLoading: clientQ.isLoading,
      loadError: String((clientsQ.error as Error)?.message || (clientQ.error as Error)?.message || ""),
      clientId: cid, setClientId: (id) => { setPicked(id); store("finley.client", id); setDrawer(null); },
      refresh,
      values,
      preset: presets[cid] ?? {},
      tags: tagsAll[cid] ?? {},
      setDriver: (t, d, v) => {
        if (!client) return;
        const tg = { ...(tagsAll[cid]?.[t] ?? {}) }; delete tg[d];
        setTopic(t, { ...topicValues(client, vals[cid], t), [d]: v }, "custom", tg);
      },
      applyPreset: (t, p) => { if (client) setTopic(t, presetValues(client.topics[t], p), p, {}); },
      useFinding: (f) => {
        if (!f.scenario || !client?.topics[f.topicId]) return;
        setTopic(f.topicId, { ...baseValues(client.topics[f.topicId]), ...f.scenario }, "custom",
          Object.fromEntries(Object.keys(f.scenario).map((k) => [k, f.id])));
        notify(`Scenario sliders filled from “${f.title}”`);
      },
      findingStatus,
      findingOutcome,
      setOutcome: (id, o) => {
        setOuts((x) => ({ ...x, [id]: o ? { outcome: o, reason: "", source: "analyst", at: new Date().toISOString().slice(0, 10) } : null }));
        if (user) base44.entities.Finding.update(id, o
          ? { outcome: o, outcome_source: "analyst", outcome_at: new Date().toISOString(), outcome_reason: "" }
          : { outcome: null, outcome_source: null, outcome_at: null, outcome_reason: null }).catch((e) => notify(`Couldn't save the outcome: ${e.message}`));
        notify((o === "held" ? "Marked held" : o === "did_not_hold" ? "Marked didn't hold" : o === "unclear" ? "Marked can't tell" : "Outcome cleared") + unsaved);
      },
      setFindingStatus: (id, s) => {
        saveStatus([id], s);
        notify((s === "review" ? "Added to forecast review" : s === "research" ? "Marked as needs research" : s === "dismissed" ? "Dismissed as not material" : "Reopened") + unsaved);
      },
      notes: { ...(data?.notes ?? {}), ...notes },
      setNote: (id, n) => {
        setNotes((x) => ({ ...x, [id]: n }));
        clearTimeout(noteTimers.current[id]);
        noteTimers.current[id] = setTimeout(() => {
          if (!user) { notify("Notes are not saved until you sign in"); return; }
          base44.entities.Finding.update(id, { feedback: n }).catch((e) => notify(`Couldn't save the note: ${e.message}`));
        }, 700);
      },
      openCount: (t) => {
        const open = (client?.findings ?? []).filter((f) => f.topicId === t && findingStatus(f.id) === "open");
        return { count: open.length, urgent: open.some((f) => f.severity === "urgent") };
      },
      topicStatus: (t) => {
        const a = active(t);
        return a.length ? SEV.find((s) => a.some((f) => f.effect === s))! : "Holding";
      },
      saved: data?.saved ?? [],
      saveScenario: (name, v) => {
        if (!client) return;
        if (!user) { notify("Sign in to save scenarios"); return; }
        const values = structuredClone(v ?? clientVals(client));
        base44.entities.Scenario.create({ client_id: cid, question: name, name, values })
          .then(() => { notify(`Saved “${name}”`); return qc.invalidateQueries({ queryKey: ["client", cid] }); })
          .catch((e) => notify(`Couldn't save the scenario: ${e.message}`));
      },
      lastScan: scanLabel(client?.lastScanAt ?? ""), scanning, scanStage,
      scan: () => {
        if (!client || scanning) return;
        if (!user) { notify("Sign in to run a scan"); void navigate({ to: "/login" }); return; }
        setScanning(true); setScanStage("Starting");
        void (async () => {
          try {
            // A client without a keyword plan gets one first, so the scan watches its own exposures.
            if (!client.planned) {
              setScanStage("Planning what to watch");
              await base44.functions.invoke("planKeywords", { client_id: cid }).catch(() => null);
            }
            const run = await base44.entities.Run.create({ client_id: cid, stage: "queued" });
            let early = "";
            // The pipeline answers only when it finishes (up to about 5 minutes), so the Run is polled instead.
            base44.functions.invoke("runPipeline", { run_id: run.id }).catch((e: any) => {
              const status = e?.status ?? e?.response?.status;
              if (status && status < 500 && status !== 408) early = e.message || `error ${status}`;
            });
            resumed.current = run.id;
            await follow(run.id, Date.now(), () => early);
          } catch (e) {
            notify(`Scan failed: ${(e as Error).message}`);
            setScanning(false); setScanStage("");
          }
        })();
      },
      toast, notify, drawer, openDrawer: setDrawer,
      recStatus,
      setRecStatus: (id, s, reviewIds) => {
        saveRecs({ ...recStatus, [id]: s });
        if (reviewIds?.length) saveStatus(reviewIds, "review");
        notify((s === "accepted" ? (reviewIds?.length ? "Accepted · added to forecast review" : "Recommendation accepted") : s === "snoozed" ? "Snoozed" : s === "dismissed" ? "Recommendation dismissed" : "Decision undone") + unsaved);
      },
      overrides,
      setOverride: (name, tier, reason) => {
        const n = { ...overrides };
        if (tier === null) delete n[name];
        else n[name] = { tier, reason, at: new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) };
        setOverridesAll((x) => ({ ...x, [cid]: n }));
        if (user) base44.entities.Client.update(cid, { source_overrides: n }).catch((e) => notify(`Couldn't save the tier: ${e.message}`));
        notify((tier === null ? `Reset tier for ${name}` : `${name} set to Tier ${tier}`) + unsaved);
      },
    };
  }, [clientId, client, data, user, me.isLoading, navigate, clients, clientsQ.isLoading, clientsQ.error, clientQ.isLoading, clientQ.error, vals, presets, tagsAll, fs, outs, notes, recs, overridesAll, scanning, scanStage, toast, drawer, notify, refresh, follow, qc]);

  return <C.Provider value={value}>{children}</C.Provider>;
}