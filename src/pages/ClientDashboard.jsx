import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ThesisPanel from "@/components/dashboard/ThesisPanel";
import RunPanel from "@/components/dashboard/RunPanel";
import FindingsList from "@/components/dashboard/FindingsList";
import ScenarioWorkspace from "@/components/scenario/ScenarioWorkspace";

export default function ClientDashboard() {
  const { id } = useParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: client, isLoading, refetch } = useQuery({ queryKey: ["client", id], queryFn: () => base44.entities.Client.get(id) });
  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!client) return <p>Client not found.</p>;
  return (
    <div>
      <h1 className="text-2xl font-semibold">{client.name}</h1>
      <p className="text-sm text-muted-foreground mb-4">{client.industry}</p>
      <RunPanel clientId={id} onDone={() => { refetch(); setRefreshKey((k) => k + 1); }} />
      <Tabs defaultValue="thesis">
        <TabsList>
          <TabsTrigger value="thesis">Thesis</TabsTrigger>
          <TabsTrigger value="alerts">Urgent alerts</TabsTrigger>
          <TabsTrigger value="briefing">Daily briefing</TabsTrigger>
          <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
        </TabsList>
        <TabsContent value="thesis"><ThesisPanel client={client} /></TabsContent>
        <TabsContent value="alerts"><FindingsList clientId={id} alertsOnly refreshKey={refreshKey} /></TabsContent>
        <TabsContent value="briefing"><FindingsList clientId={id} refreshKey={refreshKey} /></TabsContent>
        <TabsContent value="scenarios"><ScenarioWorkspace client={client} /></TabsContent>
      </Tabs>
    </div>
  );
}