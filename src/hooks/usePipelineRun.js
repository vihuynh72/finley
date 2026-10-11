import { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";

// Runs are capped at 5 minutes server-side; past 8 the record is stale, not in progress.
const STALE_MS = 8 * 60_000;

export function usePipelineRun(clientId, onDone) {
  const [run, setRun] = useState(null);
  const active = run && !["done", "failed"].includes(run.stage);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(async () => {
      try {
        const r = await base44.entities.Run.get(run.id);
        if (!["done", "failed"].includes(r.stage) && Date.now() - Date.parse(r.created_date || "") > STALE_MS) {
          setRun({ ...r, stage: "failed", error: "Timed out waiting for the run to finish." });
          return clearInterval(t);
        }
        setRun(r);
        if (r.stage === "done") {
          clearInterval(t);
          onDone?.();
        }
        if (r.stage === "failed") clearInterval(t);
      } catch {
        /* keep polling */
      }
    }, 2500);
    return () => clearInterval(t);
  }, [active, run?.id]);

  const start = useCallback(async () => {
    if (!clientId || active) return;
    const r = await base44.entities.Run.create({ client_id: clientId, stage: "queued" });
    setRun(r);
    base44.functions.invoke("runPipeline", { run_id: r.id }).catch((e) => {
      const msg = `Could not start the pipeline: ${e?.message || e}`;
      base44.entities.Run.update(r.id, { stage: "failed", error: msg }).catch(() => {});
      setRun({ ...r, stage: "failed", error: msg });
    });
  }, [clientId, active]);

  return { run, active, start };
}
