import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Play, Loader2, Check } from "lucide-react";

const STAGES = [["collecting", "Bright Data collection"], ["research", "Research agents"], ["company", "Company agents"], ["scenario", "Scenario agents"], ["done", "Briefing ready"]];

export default function RunPanel({ clientId, onDone }) {
  const [run, setRun] = useState(null);
  const active = run && !["done", "failed"].includes(run.stage);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(async () => {
      try {
        const r = await base44.entities.Run.get(run.id);
        if (!["done", "failed"].includes(r.stage) && Date.now() - Date.parse(r.created_date || "") > 8 * 60_000) {
          setRun({ ...r, stage: "failed", error: "Timed out waiting for the run to finish." });
          return clearInterval(t);
        }
        setRun(r);
        if (r.stage === "done") onDone();
        if (r.stage === "failed") clearInterval(t);
      } catch {
        /* keep polling */
      }
    }, 2500);
    return () => clearInterval(t);
  }, [active, run?.id]);

  const start = async () => {
    if (active) return;
    const r = await base44.entities.Run.create({ client_id: clientId, stage: "queued" });
    setRun(r);
    base44.functions.invoke("runPipeline", { run_id: r.id }).catch((e) => {
      const msg = `Could not start the pipeline: ${e?.message || e}`;
      base44.entities.Run.update(r.id, { stage: "failed", error: msg }).catch(() => {});
      setRun({ ...r, stage: "failed", error: msg });
    });
  };
  const idx = run ? STAGES.findIndex(([s]) => s === run.stage) : -1;

  return (
    <div className="rounded-lg border border-border bg-card p-5 my-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-medium">Live intelligence run</h3>
          <p className="text-xs text-muted-foreground">{run?.articles_count ? `${run.articles_count} articles collected` : "Collect latest news and run the agent pipeline"}</p>
        </div>
        <Button onClick={start} disabled={active}>{active ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}Run analysis</Button>
      </div>
      {run && (
        <div className="flex gap-2 mt-4 flex-wrap">
          {STAGES.map(([s, l], i) => {
            const done = idx > i || run.stage === "done";
            const cur = idx === i && run.stage !== "done";
            return (
              <div key={s} className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border ${done ? "border-emerald-500/40 text-emerald-400" : cur ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
                {done ? <Check className="w-3 h-3" /> : cur ? <Loader2 className="w-3 h-3 animate-spin" /> : null}{l}
              </div>
            );
          })}
        </div>
      )}
      {run?.stage === "failed" && <p className="text-sm text-destructive mt-3">Run failed: {run.error}</p>}
    </div>
  );
}