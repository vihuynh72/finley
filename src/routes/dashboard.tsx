import { createFileRoute, Link } from "@tanstack/react-router";
import { BellOff, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Download, Lightbulb, Loader2, MoreHorizontal, Siren, type LucideIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { fmtM, topicName } from "@/lib/data";
import { downloadFindingsCsv } from "@/lib/export";
import { combinedDelta, ebitdaDelta, financials, monthly } from "@/lib/model";
import { useApp, useClient } from "@/lib/store";
import { Formula } from "@/components/bits";
import { BridgeChart, Gauge, PerformanceChart } from "@/components/charts";
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
        {badge && <span className="mt-[19px] rounded-full bg-strong px-2 py-0.5 text-xs font-semibold text-[#F5F6EF]">{badge}</span>}
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
  const comb = financials(client, combinedDelta(client, app.values));
  const steps = client.topicOrder.map((t) => ({ name: short(topicName(client, t)), value: ebitdaDelta(client.topics[t].compute(app.values[t] ?? {})) }));
  const months = monthly(base, comb, comb, comb, metric);

  const statuses = findings.map((f) => app.findingStatus(f.id));
  const reviewed = statuses.filter((s) => s !== "open");
  const accepted = reviewed.filter((s) => s === "review" || s === "research").length;
  const dismissed = reviewed.filter((s) => s === "dismissed").length;
  const openFindings = findings.filter((_, i) => statuses[i] === "open");
  const openUrgent = openFindings.filter((f) => f.severity === "urgent");
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");
  const decided = Object.entries(app.recStatus).filter(([, s]) => s === "accepted" || s === "dismissed").length;

  const topicStates = client.topicOrder.map((t) => app.topicStatus(t));
  const healthy = topicStates.filter((s) => s === "Holding" || s === "Supported").length;
  const share = topicStates.length ? healthy / topicStates.length : 0;

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
          <button className="flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_8px_20px_rgba(211,239,99,0.35)] disabled:opacity-60"
            onClick={app.scan} disabled={app.scanning || !!client.evalCase} title={client.evalCase ? "Backtest clients are frozen at their cutoff; run them from Evals" : undefined}>
            {app.scanning ? <><Loader2 size={14} className="animate-spin" /> {app.scanStage || "Scanning"}…</> : "Scan sources now"}
          </button>
        </div>
      </div>

      <div className="flex gap-4 pt-2">
        <Stat icon={CheckCircle2} label="Findings accepted" value={pct(accepted, reviewed.length)} badge={reviewed.length ? `${accepted} of ${reviewed.length}` : ""} foot="Reviewed findings" href="#findings" />
        <Stat icon={BellOff} label="False alarms" value={pct(dismissed, reviewed.length)} badge={dismissed ? `${dismissed} dismissed` : ""} foot="Dismissed as not material" href="#findings" />
        <Stat icon={Siren} label="Open urgent" value={String(openUrgent.length)} badge={`${openFindings.length} open`} foot="Top urgent findings" href="#findings" />
        <Stat icon={Lightbulb} label="Recommendations accepted" value={recSum.acceptedRate === null ? "—" : `${recSum.acceptedRate}%`} badge={decided ? `${decided} decided` : ""} foot="Recommended next steps" href="#recs" />
      </div>

      <div className="grid grid-cols-[322px_minmax(0,1fr)] gap-4">
        <div className={cn(card, "flex flex-col items-center px-6 pb-6 pt-6")}>
          <div className="relative">
            <span className="grid h-24 w-24 place-items-center rounded-full border-[3px] border-primary p-1">
              <span className="grid h-full w-full place-items-center rounded-full bg-tint text-2xl font-semibold">{initials(String(app.user?.["full_name"] || app.user?.["email"] || "?"))}</span>
            </span>
            <span className="absolute right-0 top-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow-[0_0_0_4px_var(--card)]">FP&A</span>
          </div>
          <p className="pt-4 text-xl font-medium">Hello {firstName}</p>
          <p className="text-sm text-muted-foreground">{app.clients.length} client{app.clients.length === 1 ? "" : "s"} under watch</p>
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
            <div className="flex pl-2">
              {others.slice(0, 3).map((c) => (
                <button key={c.id} title={c.name} onClick={() => app.setClientId(c.id)}
                  className="-ml-2 grid h-8 w-8 place-items-center rounded-full border-2 border-popover bg-tint text-[10px] font-bold">{initials(c.name)}</button>
              ))}
              {others.length > 3 && <span className="-ml-2 grid h-8 w-8 place-items-center rounded-full border-2 border-popover bg-primary text-[10px] font-bold text-primary-foreground">+{others.length - 3}</span>}
              {!others.length && <Link to="/clients/new" className="text-xs text-subtle hover:text-foreground">Add a client</Link>}
            </div>
          </div>
        </div>

        <div className={cn(card, "space-y-6 p-6")}>
          <CardHead title="Financial performance" right={
            <label className="relative flex items-center gap-2 rounded-full border bg-popover px-4 py-1.5 text-[11px] font-bold text-subtle">
              {metric === "ebitda" ? "EBITDA" : "Revenue"} <ChevronDown size={8} />
              <select aria-label="Measure" value={metric} onChange={(e) => setMetric(e.target.value as "ebitda" | "rev")} className="absolute inset-0 cursor-pointer opacity-0">
                <option value="ebitda">EBITDA</option><option value="rev">Revenue</option>
              </select>
            </label>
          } />
          <PerformanceChart data={months} label={metric === "ebitda" ? "EBITDA" : "Revenue"} />
          <Formula>Month = plan-year {metric === "ebitda" ? "EBITDA" : "revenue"} × seasonality weight. Lime = every topic at its current sliders ({fmtM(metric === "ebitda" ? comb.ebitda : comb.rev)} a year); dashed = plan ({fmtM(metric === "ebitda" ? base.ebitda : base.rev)}).</Formula>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_384px] gap-4">
        <div className={cn(card, "space-y-6 p-6")}>
          <CardHead title="Combined scenario EBITDA bridge" right={<Link to="/scenarios" aria-label="Prompt scenarios" className="text-muted-foreground hover:text-foreground"><MoreHorizontal size={16} /></Link>} />
          <BridgeChart start={base.ebitda} steps={steps} startLabel="Base" endLabel="Combined" height={300}
            palette={{ total: "var(--chart)", up: "var(--olive)", down: "var(--strong)", zero: "var(--border)" }} />
          <Formula>Combined EBITDA = {fmtM(base.ebitda)} {steps.map((s) => `${s.value >= 0 ? "+" : "−"} ${fmtM(Math.abs(s.value))}`).join(" ")} = {fmtM(comb.ebitda)} (each topic at its current slider values)</Formula>
        </div>
        <div className={cn(card, "flex flex-col gap-4 p-6")}>
          <CardHead title="Assumption health" right={<span title="Topics whose assumptions are holding or supported by the open findings" className="text-muted-foreground"><MoreHorizontal size={16} /></span>} />
          <div className="pt-2"><Gauge share={share} /></div>
          <div className="text-center">
            <p className="num text-[30px] font-light leading-9 tracking-[-0.6px]">{topicStates.length ? `${Math.round(share * 100)}%` : "—"}</p>
            <p className="text-xs font-medium text-muted-foreground">{healthy} of {topicStates.length} topics holding or supported</p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            {(["Challenged", "Under pressure", "Supported", "Holding"] as const).map((s) => <span key={s}>{s} {topicStates.filter((x) => x === s).length}</span>)}
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

      <div id="recs" className="scroll-mt-24"><Recommendations /></div>
    </div>
  );
}
