import { createFileRoute, Link } from "@tanstack/react-router";
import { BellOff, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Download, Lightbulb, Loader2, MoreHorizontal, Siren } from "lucide-react";
import { useMemo, useState, type ComponentType, type ReactNode } from "react";
type LucideIcon = ComponentType<{ size?: number }>;
import { fmtM, topicName, type TopicId } from "@/lib/data";
import { downloadFindingsCsv } from "@/lib/export";
import { combinedPreset, ebitdaDelta, financials, findingsDelta, monthly, sumDeltas } from "@/lib/model";
import { useApp, useClient } from "@/lib/store";
import { Formula } from "@/components/bits";
import { BridgeChart, Gauge, PerformanceChart } from "@/components/charts";
import { AdvicePanel } from "@/components/AdvicePanel";
import { FindingList } from "@/components/FindingList";
import { Recommendations, useRecSummary } from "@/components/Recommendations";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Overview — Finley" },
      { name: "description", content: "Client overview: review metrics, plan-year performance, the combined scenario bridge, assumption health and urgent findings." },
    ],
  }),
  component: Overview,
});

const PERIODS = [["all", "All time"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"]] as const;
const H3 = "text-lg font-medium";
const card = "rounded-2xl border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.05)]";
const short = (name: string) => (name.length > 16 ? `${name.slice(0, 15)}…` : name);
const dayMs = 86_400_000;
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
const dueLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function Stat({ icon: I, label, value, badge, foot, href }: { icon: LucideIcon; label: string; value: string; badge: string; foot: string; href: string }) {
  return (
    <div className={cn(card, "flex flex-1 flex-col gap-1 p-4")}>
      <span className="grid h-[52px] w-[52px] place-items-center rounded-xl bg-primary text-primary-foreground"><I size={20} /></span>
      <p className="pt-1 text-sm font-medium text-subtle">{label}</p>
      <div className="flex h-[52px] items-start gap-2">
        <span className="num text-[32px] font-light leading-10 tracking-[-0.64px]">{value}</span>
      </div>
      <a href={href} className="flex items-center justify-between border-t border-muted pt-4 text-xs font-medium text-subtle hover:text-foreground">
        {foot} <ChevronRight size={12} />
      </a>
    </div>
  );
}

function CardHead({ title, right }: { title: string; right?: ReactNode }) {
  return <div className="flex items-center justify-between gap-4"><h3 className={H3}>{title}</h3>{right}</div>;
}

function Overview() {
  const app = useApp();
  const client = useClient();
  const recSum = useRecSummary();
  const [period, setPeriod] = useState<(typeof PERIODS)[number][0]>("all");
  const [metric, setMetric] = useState<"ebitda" | "rev">("ebitda");
  const [showAll, setShowAll] = useState(false);

  // Periods count back from the newest finding, so a backtest client frozen in 2022 still filters sensibly.
  const findings = useMemo(() => {
    if (period === "all") return client.findings;
    const newest = Math.max(...client.findings.map((f) => Date.parse(f.isoDate) || 0), 0);
    return client.findings.filter((f) => (Date.parse(f.isoDate) || 0) >= newest - Number(period) * dayMs);
  }, [client.findings, period]);

  const base = financials(client);
  // A topic's step is its sliders where the analyst set them; otherwise the implied impact of its
  // open findings — the pipeline's own quantified numbers, so the charts read evidence by default.
  const evidence = client.findings.filter((f) => app.findingStatus(f.id) !== "dismissed");
  const topicDeltas = client.topicOrder.map((t) =>
    app.preset[t] ? client.topics[t].compute(app.values[t] ?? {}) : findingsDelta(client, evidence.filter((f) => f.topicId === t)));
  const comb = financials(client, sumDeltas(topicDeltas));
  const steps = client.topicOrder.map((t, i) => ({ name: short(topicName(client, t)), value: ebitdaDelta(topicDeltas[i]) }));
  const months = monthly(base, comb, financials(client, combinedPreset(client, "downside")), financials(client, combinedPreset(client, "upside")), metric);

  const statuses = findings.map((f) => app.findingStatus(f.id));
  const reviewed = statuses.filter((s) => s !== "open");
  const accepted = reviewed.filter((s) => s === "review" || s === "research").length;
  const dismissed = reviewed.filter((s) => s === "dismissed").length;
  const openFindings = findings.filter((_, i) => statuses[i] === "open");
  const openUrgent = openFindings.filter((f) => f.severity === "urgent");
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");
  const decided = Object.entries(app.recStatus).filter(([, s]) => s === "accepted" || s === "dismissed").length;

  // A backtest client is never analyst-reviewed; its review cards report the scored eval instead:
  // findings the judge marked "held", and the news forecast's advice precision against the company actions.
  const evalF = (client.evalCase ? app.evalRun?.["summary"]?.["findings"] : null) as Record<string, any> | null;
  const evalRec = (client.evalCase ? app.evalRun?.["summary"]?.["news"]?.["recommendations"] : null) as Record<string, any> | null;
  const notHeld = (Number(evalF?.["decided"]) || 0) - (Number(evalF?.["held"]) || 0);
  const evalRecRows = (evalRec?.["rows"] as Record<string, any>[] | undefined) ?? [];
  const matched = evalRecRows.filter((r) => r["match"] === "exact" || r["match"] === "partial").length;
  const evalRecPct = evalRec?.["precision_lenient"] == null ? null : Math.round(Number(evalRec["precision_lenient"]) * 100);

  // Assumption health only counts topics that have evidence; a tab with no findings isn't "holding".
  const watched = client.topicOrder.filter((t: TopicId) => evidence.some((f) => f.topicId === t));
  const watchedStates = watched.map((t) => app.topicStatus(t));
  const healthy = watchedStates.filter((s) => s === "Holding" || s === "Supported").length;
  const share = watched.length ? healthy / watched.length : null;

  // Track record: findings whose outcome is judged — by a later scan, the analyst, or the backtest's
  // judge (findingOutcome covers all three). "Held" counts only resolved flags; unclear isn't a win.
  const track = useMemo(() => {
    const rows = client.findings.map((f) => ({ f, o: app.findingOutcome(f.id) }));
    const res = rows.filter((x) => x.o?.outcome === "held" || x.o?.outcome === "did_not_hold");
    const val = res.filter((x) => { const s = app.findingStatus(x.f.id); return s === "review" || s === "research"; });
    const dis = res.filter((x) => app.findingStatus(x.f.id) === "dismissed");
    return {
      resolved: res.length, held: res.filter((x) => x.o!.outcome === "held").length,
      valN: val.length, valHeld: val.filter((x) => x.o!.outcome === "held").length,
      disN: dis.length, disRight: dis.filter((x) => x.o!.outcome === "did_not_hold").length,
    };
  }, [client.findings, app]);

  const rank = { urgent: 0, review: 1, info: 2 };
  const listed = (showAll ? openFindings : openUrgent).slice().sort((a, b) => rank[a.severity] - rank[b.severity]);
  const days = client.reforecastDue ? Math.ceil((Date.parse(`${client.reforecastDue}T12:00:00Z`) - Date.now()) / dayMs) : null;
  const others = app.clients.filter((c) => c.id !== client.id);
  const firstName = String(app.user?.["full_name"] || app.user?.["email"] || "there").split(/[\s@]/)[0];
  const pill = "flex items-center gap-2 rounded-full border bg-popover px-5 py-2.5 text-sm font-medium hover:bg-muted";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-[32px] font-normal leading-10">Overview</h1>
          <p className="text-sm text-subtle">{client.name}{client.industry ? ` · ${client.industry}` : ""} · plan-year base case{client.evalCase ? " · backtest client" : ""}</p>
        </div>
        <div className="flex items-center gap-3">
          <button className={pill} onClick={() => downloadFindingsCsv(client, app.findingStatus, findings)} disabled={!findings.length}>
            <Download size={14} className="text-muted-foreground" /> Export
          </button>
          <label className={cn(pill, "relative cursor-pointer")}>
            <CalendarDays size={14} className="text-muted-foreground" />
            {PERIODS.find(([k]) => k === period)![1]}
            <ChevronDown size={10} />
            <select aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value as typeof period)} className="absolute inset-0 cursor-pointer opacity-0">
              {PERIODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          <button className="flex items-center gap-2 rounded-full bg-[#4CAF50] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(76,175,80,0.35)] hover:bg-[#43A047] disabled:cursor-not-allowed disabled:opacity-100"
            onClick={app.scan} disabled={app.scanning || !!client.evalCase} title={client.evalCase ? "Backtest clients are frozen at their cutoff; run them from Evals" : undefined}>
            {app.scanning ? <><Loader2 size={14} className="animate-spin" /> {app.scanStage || "Scanning"}…</> : "Scan sources now"}
          </button>
        </div>
      </div>

      <div className="flex gap-4 pt-2">
        {evalF ? (
          <>
            <Stat icon={CheckCircle2} label="Findings held up" value={pct(Number(evalF["held"]) || 0, Number(evalF["decided"]) || 0)} badge={evalF["decided"] ? `${evalF["held"]} of ${evalF["decided"]} held` : ""} foot="Judged against the outcome" href="/evals" />
            <Stat icon={BellOff} label="False alarms" value={pct(notHeld, Number(evalF["decided"]) || 0)} badge={notHeld ? `${notHeld} didn't hold` : ""} foot="Findings that did not hold" href="/evals" />
          </>
        ) : (
          <>
            <Stat icon={CheckCircle2} label="Findings accepted" value={pct(accepted, reviewed.length)} badge={reviewed.length ? `${accepted} of ${reviewed.length}` : ""} foot="Reviewed findings" href="#findings" />
            <Stat icon={BellOff} label="False alarms" value={pct(dismissed, reviewed.length)} badge={dismissed ? `${dismissed} dismissed` : ""} foot="Dismissed as not material" href="#findings" />
          </>
        )}
        <Stat icon={Siren} label="Open urgent" value={String(openUrgent.length)} badge={`${openFindings.length} open`} foot="Top urgent findings" href="#findings" />
        {evalRec ? (
          <Stat icon={Lightbulb} label="Advice that matched" value={evalRecPct === null ? "—" : `${evalRecPct}%`} badge={evalRecRows.length ? `${matched} of ${evalRecRows.length} matched` : ""} foot="vs what the company did" href="/evals" />
        ) : (
          <Stat icon={Lightbulb} label="Recommendations accepted" value={recSum.acceptedRate === null ? "—" : `${recSum.acceptedRate}%`} badge={decided ? `${decided} decided` : ""} foot="Recommended next steps" href="#recs" />
        )}
      </div>

      <div className="grid grid-cols-[322px_minmax(0,1fr)] gap-4">
        <div className={cn(card, "flex flex-col items-center px-6 pb-6 pt-6")}>
          <div className="relative">
            <span className="grid h-24 w-24 place-items-center rounded-full bg-primary text-3xl font-semibold text-primary-foreground ring-4 ring-tint ring-offset-2 ring-offset-card">
              {initials(String(app.user?.["full_name"] || app.user?.["email"] || "?"))}
            </span>
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border-2 border-card bg-foreground px-2 py-0.5 text-[10px] font-bold text-background">FP&A</span>
          </div>
          <p className="pt-4 text-xl font-medium">Hello {firstName}</p>
          <p className="text-sm text-muted-foreground">{app.clients.length} client{app.clients.length === 1 ? "" : "s"} under watch</p>
          <div className="mt-4 w-full rounded-2xl border border-muted p-3 text-left">
            <p className="text-[10px] font-bold uppercase tracking-[1px] text-muted-foreground">Track record · {client.name}</p>
            {track.resolved ? (
              <>
                <p className="mt-1 text-sm font-medium"><span className="num">{track.held}</span> of {track.resolved} resolved flags held up</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {track.valN ? `${track.valHeld} of ${track.valN} you validated held` : ""}{track.valN && track.disN ? " · " : ""}
                  {track.disN ? `${track.disRight} of ${track.disN} dismissals were right` : ""}
                  {!track.valN && !track.disN ? "Judged against later news, not opinion" : ""}
                </p>
              </>
            ) : (
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Builds as flags resolve — a later scan marks each one held or didn't hold, and you can mark it yourself in the finding.{" "}
                <Link to="/evals" className="font-medium text-foreground hover:underline">See the backtest</Link>
              </p>
            )}
          </div>
          <div className="mt-6 w-full space-y-1 rounded-2xl bg-muted p-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[1px] text-muted-foreground">Next reforecast</span>
              <a href="#recs" className="rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground">Prepare</a>
            </div>
            <p className="text-base font-medium">{client.reforecastDue ? dueLabel(client.reforecastDue) : "Not scheduled"}</p>
            <div className="flex gap-4 pt-3">
              <div><p className="text-[10px] font-bold uppercase text-muted-foreground">{days !== null && days < 0 ? "Days past" : "Days left"}</p><p className="num text-lg font-medium tracking-[-0.36px]">{days === null ? "—" : Math.abs(days)}</p></div>
              <div><p className="text-[10px] font-bold uppercase text-muted-foreground">Open findings</p><p className="num text-lg font-medium tracking-[-0.36px]">{openFindings.length}</p></div>
            </div>
          </div>
          <div className="mt-6 w-full space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.55px] text-muted-foreground">Other clients</p>
            <div className="flex flex-wrap gap-2">
              {others.slice(0, 3).map((c) => (
                <button key={c.id} title={c.name} onClick={() => app.setClientId(c.id)}
                  className="flex items-center gap-2 rounded-full border bg-popover py-1 pl-1 pr-3 text-xs font-medium hover:border-foreground">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{initials(c.name)}</span>
                  {c.name}
                </button>
              ))}
              {others.length > 3 && <span className="grid h-8 place-items-center rounded-full bg-muted px-3 text-xs font-bold">+{others.length - 3}</span>}
              {!others.length && <Link to="/clients/new" className="text-xs text-subtle hover:text-foreground">Add a client</Link>}
            </div>
          </div>
        </div>

        <div className={cn(card, "space-y-6 p-6")}>
          <CardHead title={`Financial performance · FY${client.evalCase && client.reforecastDue ? client.reforecastDue.slice(0, 4) : new Date().getFullYear()} plan year`} right={
            <label className="relative flex items-center gap-2 rounded-full border bg-popover px-4 py-1.5 text-[11px] font-bold text-subtle">
              {metric === "ebitda" ? "EBITDA" : "Revenue"} <ChevronDown size={8} />
              <select aria-label="Measure" value={metric} onChange={(e) => setMetric(e.target.value as "ebitda" | "rev")} className="absolute inset-0 cursor-pointer opacity-0">
                <option value="ebitda">EBITDA</option><option value="rev">Revenue</option>
              </select>
            </label>
          } />
          <PerformanceChart data={months} label={metric === "ebitda" ? "EBITDA" : "Revenue"} />
          <Formula>Week = plan-year {metric === "ebitda" ? "EBITDA" : "revenue"} × seasonality weight ÷ 4, with illustrative week-to-week swings (±6%). Lime = your slider changes plus the open findings' implied impact ({fmtM(metric === "ebitda" ? comb.ebitda : comb.rev)} a year); dashed = plan ({fmtM(metric === "ebitda" ? base.ebitda : base.rev)}); the band spans every topic's downside-to-upside presets.</Formula>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_384px] gap-4">
        <div className={cn(card, "space-y-6 p-6")}>
          <CardHead title="Combined scenario EBITDA bridge" right={<Link to="/scenarios" aria-label="Prompt scenarios" className="text-muted-foreground hover:text-foreground"><MoreHorizontal size={16} /></Link>} />
          <BridgeChart start={base.ebitda} steps={steps} startLabel="Base" endLabel="Combined" height={300}
            palette={{ total: "var(--chart)", up: "var(--olive)", down: "var(--danger)", zero: "var(--border)" }} />
          <Formula>Combined EBITDA = {fmtM(base.ebitda)} {steps.filter((s) => Math.abs(s.value) > 0.5).map((s) => `${s.value >= 0 ? "+" : "−"} ${fmtM(Math.abs(s.value))}`).join(" ")} = {fmtM(comb.ebitda)}. Each step is the topic's sliders where you set them, else the implied impact of its open findings.</Formula>
        </div>
        <div className={cn(card, "flex flex-col gap-4 p-6")}>
          <CardHead title="Assumption health" right={<span title="Topics whose assumptions are holding or supported by the open findings" className="text-muted-foreground"><MoreHorizontal size={16} /></span>} />
          <div className="pt-2"><Gauge share={share ?? 0} /></div>
          <div className="text-center">
            <p className="num text-[30px] font-light leading-9 tracking-[-0.6px]">{share === null ? "—" : `${Math.round(share * 100)}%`}</p>
            <p className="text-xs font-medium text-muted-foreground">{healthy} of {watched.length} topics with findings holding or supported</p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            {(["Challenged", "Under pressure", "Supported", "Holding"] as const).map((s) => <span key={s}>{s} {watchedStates.filter((x) => x === s).length}</span>)}
            {client.topicOrder.length - watched.length > 0 && <span>No data {client.topicOrder.length - watched.length}</span>}
          </div>
          {/* One click on a challenged assumption opens the topic, where its findings are listed. */}
          <div className="flex flex-wrap justify-center gap-1.5">
            {watched.filter((t) => app.topicStatus(t) === "Challenged" || app.topicStatus(t) === "Under pressure").map((t) => (
              <Link key={t} to="/topics/$topicId" params={{ topicId: t }}
                className="rounded-full border border-muted px-2.5 py-1 text-[10px] font-medium text-subtle hover:border-border hover:text-foreground">
                {topicName(client, t)} · {app.topicStatus(t)}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <section id="findings" className={cn(card, "scroll-mt-24 space-y-6 p-6")}>
        <CardHead title={showAll ? "Open findings" : "Top urgent findings"} right={
          <button className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground" onClick={() => setShowAll((x) => !x)}>
            {showAll ? "Urgent only" : `View all open findings (${openFindings.length})`} <ChevronRight size={12} />
          </button>
        } />
        {listed.length ? <FindingList findings={listed} showTopic variant="overview" />
          : <p className="text-sm text-muted-foreground">{showAll ? "No open findings." : `No urgent findings open for ${client.name}.`}{period !== "all" ? " Try a longer period." : ""}</p>}
      </section>

      <AdvicePanel briefing={app.briefing} />

      <div id="recs" className="scroll-mt-24"><Recommendations /></div>
    </div>
  );
}