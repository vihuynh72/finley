import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, MinusCircle, TrendingDown, type LucideIcon } from "lucide-react";
import { topicName, type Status } from "@/lib/data";
import { useApp, useClient } from "@/lib/store";
import { Section, StatusPill } from "@/components/bits";
import { FindingList } from "@/components/FindingList";
import { ScenarioBuilder } from "@/components/ScenarioBuilder";
import { cn } from "@/lib/utils";

// One tab per main exposure from the client's keyword plan (pretraining); see src/lib/live.ts.
export const Route = createFileRoute("/topics/$topicId")({
  head: () => ({
    meta: [
      { title: "Topic — Finley" },
      { name: "description", content: "Findings and scenario builder for one of the client's watched exposures." },
    ],
  }),
  component: TopicPage,
});

const STATUS_ICON: Record<Status, { icon: LucideIcon; cls: string }> = {
  Challenged: { icon: AlertTriangle, cls: "text-danger" },
  "Under pressure": { icon: TrendingDown, cls: "text-warning-ink" },
  Supported: { icon: CheckCircle2, cls: "text-success-ink" },
  Holding: { icon: MinusCircle, cls: "text-muted-foreground" },
};

function TopicPage() {
  const { topicId } = Route.useParams();
  const app = useApp();
  const client = useClient();
  const t = client.topics[topicId];
  if (!t) {
    return (
      <div className="card mx-auto max-w-xl p-6 text-sm">
        <p className="font-semibold">This topic isn't watched for {client.name}.</p>
        <p className="mt-1 text-muted-foreground">Topics come from the client's keyword plan, which changes when the profile changes.</p>
        <Link to="/dashboard" className="btn mt-4">Back to overview</Link>
      </div>
    );
  }
  const status = app.topicStatus(topicId);
  const findings = client.findings.filter((f) => f.topicId === topicId);
  const i = client.topicOrder.indexOf(topicId);
  const prev = client.topicOrder[i - 1], next = client.topicOrder[i + 1];
  const { icon: Icon, cls } = STATUS_ICON[status];
  const navCls = "flex items-center gap-2 text-[11px] font-bold text-muted-foreground hover:text-foreground";

  return (
    <div className="space-y-10">
      <div className="space-y-1">
        <p className="text-[11px] font-bold uppercase tracking-[1.1px] text-muted-foreground">
          <Link to="/dashboard" className="hover:text-foreground">{client.name}</Link>{client.industry ? ` · ${client.industry}` : ""}
        </p>
        <h1 className="text-[32px] font-normal leading-[48px]">{t.name}</h1>
      </div>

      <Section title="Assumption under watch">
        <div className="card flex items-center justify-between gap-6 p-6">
          <div className="flex items-center gap-6">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border bg-popover"><Icon size={20} className={cls} /></span>
            <div className="space-y-0.5">
              <p className="text-base font-semibold">{t.assumption}</p>
              <p className="num text-xs text-muted-foreground">Base value: {t.baseValue}</p>
            </div>
          </div>
          <StatusPill status={status} />
        </div>
        {(t.why || t.keywords?.length) && (
          <p className="text-xs text-muted-foreground">
            {t.why}{t.why && t.keywords?.length ? " " : ""}
            {t.keywords?.length ? <>Watching news for: {t.keywords.map((k) => `“${k}”`).join(", ")}.</> : null}
          </p>
        )}
      </Section>

      <Section title="Findings for this topic"><FindingList findings={findings} /></Section>

      <div id="builder" className="scroll-mt-24">
        <Section title="Scenario builder"><ScenarioBuilder topicId={topicId} /></Section>
      </div>

      <nav className={cn("flex justify-between border-t border-muted pt-8")}>
        {prev ? <Link to="/topics/$topicId" params={{ topicId: prev }} className={navCls}><ArrowLeft size={10} /> {topicName(client, prev)}</Link>
          : <Link to="/dashboard" className={navCls}><ArrowLeft size={10} /> Overview</Link>}
        {next ? <Link to="/topics/$topicId" params={{ topicId: next }} className={navCls}>{topicName(client, next)} <ArrowRight size={10} /></Link>
          : <Link to="/scenarios" className={navCls}>Prompt scenarios <ArrowRight size={10} /></Link>}
      </nav>
    </div>
  );
}
