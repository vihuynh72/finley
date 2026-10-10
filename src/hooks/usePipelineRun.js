import { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";

export function usePipelineRun(clientId, onDone) {
  const [run, setRun] = useState(null);
  const active = run && !["done", "failed"].includes(run.stage);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(async () => {
      try {
        const r = await base44.entities.Run.get(run.id);
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
    if (!clientId) return;
    const r = await base44.entities.Run.create({ client_id: clientId, stage: "queued" });
    setRun(r);
    base44.functions.invoke("runPipeline", { run_id: r.id }).catch(() => {});
  }, [clientId]);

  return { run, active, start };
}