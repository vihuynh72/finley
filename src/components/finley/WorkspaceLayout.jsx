import { useState } from "react";
import { Outlet, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { usePipelineRun } from "@/hooks/usePipelineRun";
import Sidebar from "@/components/finley/Sidebar";
import TopBar from "@/components/finley/TopBar";
import RunBanner from "@/components/finley/RunBanner";
import FindingSheet from "@/components/finley/FindingSheet";

export default function WorkspaceLayout() {
  const ws = useWorkspace();
  const { toast } = useToast();
  const [open, setOpen] = useState(null);
  const { run, active, start } = usePipelineRun(ws.client?.id, ws.refresh);

  const scan = async () => {
    if (!(await base44.auth.isAuthenticated())) {
      toast({ title: "Sign in to run scans", description: "Scans use live sources and need an account." });
      return;
    }
    start();
  };

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar findings={ws.findings} scenarioCount={ws.scenarios.length} />
      <div className="flex-1 min-w-0">
        <TopBar {...ws} active={active} onScan={scan} />
        <RunBanner run={run} active={active} />
        <main className="max-w-6xl mx-auto px-6 py-8">
          {ws.loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto mt-20 text-muted-foreground" />
            : !ws.client ? (
              <div className="text-center mt-20 text-muted-foreground text-sm">
                {ws.error ? "Sign in to see your clients." : "No clients yet."}{" "}
                <Link to={ws.error ? "/login" : "/app/clients/new"} className="underline">{ws.error ? "Sign in" : "Add one"}</Link>
              </div>
            ) : <Outlet context={{ ...ws, openFinding: setOpen, scan, active }} />}
        </main>
      </div>
      <FindingSheet finding={open} onClose={() => setOpen(null)} onChanged={ws.refetchFindings} />
    </div>
  );
}