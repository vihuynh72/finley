import { createFileRoute, Link } from "@tanstack/react-router";
import { fmtM, topicName } from "@/lib/data";
import { combinedDelta, combinedPreset, ebitdaDelta, financials, monthly } from "@/lib/model";
import { useApp, useClient } from "@/lib/store";
import { Formula, Section, StatusPill, statusTone } from "@/components/bits";
import { BridgeChart, MonthlyChart } from "@/components/charts";
import { FindingList } from "@/components/FindingList";
import { cn } from "@/lib/utils";
import { Recommendations, useRecSummary } from "@/components/Recommendations";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Overview — Finley" },
      { name: "description", content: "Client overview: assumption status by topic, combined scenario bridge and the top urgent findings." },
      { property: "og:title", content: "Overview — Finley" },
      { property: "og:description", content: "Assumption status, combined scenario and urgent findings for the quarterly reforecast." },
    ],
  }),
  component: Overview,
});

const short = (name: string) => (name.length > 16 ? `${name.slice(0, 15)}…` : name);

function Overview() {
  const app = useApp();
  const client = useClient();
  const base = financials(client);
  const comb = financials(client, combinedDelta(client, app.values));
  const down = financials(client, combinedPreset(client, "downside"));
  const up = financials(client, combinedPreset(client, "upside"));
  const steps = client.topicOrder.map((t) => ({ name: short(topicName(client, t)), value: ebitdaDelta(client.topics[t].compute(app.values[t] ?? {})) }));
  const recSum = useRecSummary();
  const rank = { urgent: 0, review: 1, info: 2 };
  const top = client.findings.filter((f) => app.findingStatus(f.id) === "open")
    .sort((a, b) => rank[a.severity] - rank[b.severity]).filter((f) => f.severity === "urgent").slice(0, 3);
  // Usage metrics from the analyst's own decisions on findings and recommendations.
  const statuses = client.findings.map((f) => app.findingStatus(f.id));
  const reviewed = statuses.filter((s) => s !== "open");
  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">{client.industry || "Client"} · plan-year base case{client.evalCase ? " · backtest client" : ""}</p>
        <h1 className="text-3xl font-semibold">{client.name}</h1>
      </div>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">How Finley is doing for this client</h2>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">From your reviews</span>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {[
            ["Findings accepted", pct(reviewed.filter((s) => s === "review" || s === "research").length, reviewed.length), "Share of reviewed findings the analyst added to forecast review or marked needs research."],
            ["False alarms", pct(reviewed.filter((s) => s === "dismissed").length, reviewed.length), "Share of reviewed findings dismissed as not material."],
            ["Findings reviewed", pct(reviewed.length, statuses.length), "Share of all findings the analyst has acted on."],
            ["Open urgent", String(client.findings.filter((f, i) => f.severity === "urgent" && statuses[i] === "open").length), "Urgent findings still waiting for a decision."],
            ["Recommendations accepted", recSum.acceptedRate === null ? "—" : `${recSum.acceptedRate}%`, "Share of recommendations accepted out of those accepted or dismissed."],
          ].map(([l, v, d]) => (
            <div key={l} title={d} className="card cursor-help px-4 py-3">
              <p className="text-xs text-muted-foreground">{l} ⓘ</p>
              <p className="num text-xl font-semibold">{v}</p>
            </div>
          ))}
        </div>
      </section>

      <Section title="Assumptions by topic">
        <div className="grid grid-cols-4 gap-3">
          {client.topicOrder.map((t) => {
            const st = app.topicStatus(t); const o = app.openCount(t);
            return (
              <Link key={t} to="/topics/$topicId" params={{ topicId: t }} className="card relative overflow-hidden p-4 pl-5 hover:border-strong">
                <span className={cn("absolute inset-y-0 left-0 w-1", statusTone[st].stripe)} />
                <p className="text-xs font-medium text-muted-foreground">{topicName(client, t)}</p>
                <p className="mt-1 min-h-10 text-sm">{client.topics[t].assumption}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <StatusPill status={st} />
                  <span className="num text-xs text-muted-foreground">{o.count} open</span>
                </div>
              </Link>
            );
          })}
        </div>
      </Section>

      <Recommendations />

      <div className="grid grid-cols-2 gap-5">
        <div className="glass p-5">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.6px]">Combined scenario EBITDA bridge</h3>
          <BridgeChart start={base.ebitda} steps={steps} startLabel="Base" endLabel="Combined" />
          <Formula>Combined EBITDA = {fmtM(base.ebitda)} {steps.map((s) => `${s.value >= 0 ? "+" : "−"} ${fmtM(Math.abs(s.value))}`).join(" ")} = {fmtM(comb.ebitda)} (each topic at its current slider values)</Formula>
        </div>
        <div className="glass p-5">
          <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.6px]">Plan-year monthly EBITDA: base vs combined</h3>
          <MonthlyChart data={monthly(base, comb, down, up, "ebitda")} />
          <Formula>Month = annual EBITDA × seasonality weight. Band = all topics at downside ({fmtM(down.ebitda)}) to upside ({fmtM(up.ebitda)}).</Formula>
        </div>
      </div>

      <Section title="Top urgent findings" right={<Link to="/scenarios" className="text-sm text-strong hover:underline">Prompt scenarios →</Link>}>
        {top.length ? <FindingList findings={top} showTopic /> : <div className="card p-5 text-sm text-muted-foreground">No urgent findings open for {client.name}.</div>}
      </Section>
    </div>
  );
}
