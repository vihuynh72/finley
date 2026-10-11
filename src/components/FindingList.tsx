import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { topicName, type Finding } from "@/lib/data";
import { scoreFinding } from "@/lib/scores";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { sevCls } from "./FindingDrawer";
import { ScoreChips } from "./ScoreChips";

const STATUS_LABEL = { open: "", review: "In review", research: "Needs research", dismissed: "Dismissed" };

// "overview" = the Overview page's rows (topic label in olive, a chevron, no slider button).
export function FindingList({ findings, showTopic, variant = "page" }: { findings: Finding[]; showTopic?: boolean; variant?: "page" | "overview" }) {
  const app = useApp();
  const client = app.client;
  if (!client) return null;
  if (!findings.length) return <div className="card p-5 text-sm text-muted-foreground">No findings for this topic. Sources are quiet.</div>;
  const rows = findings.map((f) => ({ f, s: scoreFinding(client, f, app.overrides) })).sort((a, b) => b.s.priority - a.s.priority);
  if (variant === "overview") {
    return (
      <div className="space-y-3">
        {rows.map(({ f, s }) => {
          const st = app.findingStatus(f.id);
          return (
            <button key={f.id} onClick={() => app.openDrawer(f)}
              className={cn("flex w-full items-center gap-4 rounded-2xl border border-muted bg-popover p-4 text-left hover:border-border", st === "dismissed" && "opacity-50")}>
              <span className={cn("w-[63px] shrink-0 rounded-md border px-2.5 py-1 text-center text-[10px] font-bold uppercase", sevCls[f.severity])}>{f.severity}</span>
              <span className="min-w-0 flex-1 space-y-1.5">
                <span className="block text-sm font-medium">{f.title}</span>
                <span className="flex flex-wrap items-center gap-3 text-[10px]">
                  <span className="font-bold uppercase tracking-[0.25px] text-olive">{topicName(client, f.topicId)}</span>
                  <span className="font-medium text-muted-foreground">{f.date} · <span className="capitalize">{f.confidence}</span> confidence · {f.sources.map((x) => x.type).join(", ") || "no sources"}{STATUS_LABEL[st] ? ` · ${STATUS_LABEL[st]}` : ""}</span>
                </span>
                <ScoreChips s={s} />
              </span>
              <ChevronRight size={16} className="shrink-0 text-faint" />
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {rows.map(({ f, s }) => {
        const st = app.findingStatus(f.id);
        return (
          <div key={f.id} className={cn("flex items-center gap-6 rounded-2xl border bg-popover p-4", st === "dismissed" && "opacity-50")}>
            <span className={cn("w-[58px] shrink-0 rounded border px-2 py-0.5 text-center text-[9px] font-bold uppercase", sevCls[f.severity])}>{f.severity}</span>
            <button className="min-w-0 flex-1 space-y-1.5 text-left" onClick={() => app.openDrawer(f)}>
              <span className="block text-sm font-medium hover:underline">{f.title}</span>
              <span className="block text-[10px] font-medium text-muted-foreground">
                {showTopic && <Link to="/topics/$topicId" params={{ topicId: f.topicId }} className="text-foreground hover:underline" onClick={(e) => e.stopPropagation()}>{topicName(client, f.topicId)}</Link>}
                {showTopic && " · "}{f.date} · <span className="capitalize">{f.confidence}</span> confidence · {f.sources.map((x) => x.type).join(", ") || "no sources"}
              </span>
              <ScoreChips s={s} />
            </button>
            {STATUS_LABEL[st] && <span className="shrink-0 text-xs text-muted-foreground">{STATUS_LABEL[st]}</span>}
            {f.scenario && !showTopic ? (
              <button className="btn shrink-0" onClick={() => { app.useFinding(f); document.getElementById("builder")?.scrollIntoView({ behavior: "auto" }); }}>
                Use in scenario <ChevronRight size={12} />
              </button>
            ) : (
              <button aria-label="Open finding" className="shrink-0 text-muted-foreground" onClick={() => app.openDrawer(f)}><ChevronRight size={16} /></button>
            )}
          </div>
        );
      })}
    </div>
  );
}
