import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import DashboardHeader from "@/components/figma/DashboardHeader";
import TopicSidebar from "@/components/figma/TopicSidebar";
import AssumptionGrid from "@/components/figma/AssumptionGrid";
import AdvicePanel from "@/components/figma/AdvicePanel";
import EbitdaCharts from "@/components/figma/EbitdaCharts";
import UrgentFindingsList from "@/components/figma/UrgentFindingsList";
import SavedScenariosView from "@/components/figma/SavedScenariosView";
import { usePipelineRun } from "@/hooks/usePipelineRun";

const STAGE_LABELS = {
  queued: "Queued",
  collecting: "Collecting sources via Bright Data",
  research: "Research agents analyzing",
  company: "Company thesis analysis",
  scenario: "Modeling scenario impacts",
  done: "Briefing ready",
  failed: "Run failed",
};

export default function Screenshot20261010At124448Pm12() {
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [activeTopic, setActiveTopic] = useState("Overview");
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: clientsPage } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.filter({}, { sort: "-created_date", limit: 50 }),
  });
  const clients = clientsPage?.items || [];

  useEffect(() => {
    if (selectedClientId) return;
    const params = new URLSearchParams(window.location.search);
    const c = params.get("client");
    if (c) setSelectedClientId(c);
    else if (clients.length) setSelectedClientId(clients[0].id);
  }, [clients, selectedClientId]);

  const clientId = selectedClientId;

  const { data: client } = useQuery({
    queryKey: ["client", clientId, refreshKey],
    queryFn: () => base44.entities.Client.get(clientId),
    enabled: !!clientId,
  });

  const { data: findingsPage, refetch: refetchFindings } = useQuery({
    queryKey: ["findings", clientId, refreshKey],
    queryFn: () => base44.entities.Finding.filter({ client_id: clientId }, { sort: "-priority", limit: 50 }),
    enabled: !!clientId,
  });

  const { data: scenariosPage, refetch: refetchScenarios } = useQuery({
    queryKey: ["scenarios", clientId, refreshKey],
    queryFn: () => base44.entities.Scenario.filter({ client_id: clientId }, { sort: "-created_date", limit: 20 }),
    enabled: !!clientId,
  });

  const { data: briefingPage } = useQuery({
    queryKey: ["briefing", clientId, refreshKey],
    queryFn: () => base44.entities.Briefing.filter({ client_id: clientId }, { sort: "-created_date", limit: 1 }),
    enabled: !!clientId,
  });

  const findings = findingsPage?.items || [];
  const scenarios = scenariosPage?.items || [];
  const briefing = briefingPage?.items?.[0] || null;

  const { run, active, start } = usePipelineRun(clientId, () => {
    setRefreshKey((k) => k + 1);
    refetchFindings();
  });

  const updateFinding = async (id, data) => {
    await base44.entities.Finding.update(id, data);
    refetchFindings();
  };

  if (!clientId || !client) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        {clients.length === 0 ? (
          <p className="text-slate-400">No clients yet. Create one first.</p>
        ) : (
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans text-slate-800">
      <DashboardHeader
        clients={clients}
        selectedClientId={clientId}
        onSelectClient={setSelectedClientId}
        client={client}
        run={run}
        active={active}
        onScan={start}
      />

      {(active || run?.stage === "failed") && (
        <div className={`px-4 py-2 text-sm flex items-center gap-2 ${run.stage === "failed" ? "bg-red-50 text-red-700 border-b border-red-100" : "bg-blue-50 text-blue-700 border-b border-blue-100"}`}>
          {active && <Loader2 className="w-4 h-4 animate-spin" />}
          {run.stage === "failed"
            ? `Run failed: ${run.error}`
            : `${STAGE_LABELS[run.stage] || "Working..."}${run.articles_count ? ` — ${run.articles_count} articles collected` : ""}`}
        </div>
      )}

      <div className="bg-[#eef2ff] text-[#4f46e5] text-[11px] py-1 text-center font-medium border-b border-[#e0e7ff]">
        Sample data for testing. All companies and sources are fictional.
      </div>

      <div className="flex flex-1 overflow-clip">
        <TopicSidebar
          findings={findings}
          activeTopic={activeTopic}
          onSelectTopic={setActiveTopic}
          savedCount={scenarios.length}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10">
          <div className="max-w-[1200px] mx-auto space-y-10">
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 tracking-tight">
              {client.name}
            </h1>

            {activeTopic === "Saved scenarios" ? (
              <SavedScenariosView scenarios={scenarios} client={client} onCreated={() => refetchScenarios()} />
            ) : (
              <>
                <AssumptionGrid client={client} findings={findings} activeTopic={activeTopic} />
                <AdvicePanel briefing={briefing} />
                <EbitdaCharts client={client} findings={findings} />
                <UrgentFindingsList findings={findings} activeTopic={activeTopic} onUpdateFinding={updateFinding} />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}