import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const KEY = "finley_client";

export function useWorkspace() {
  const [clientId, setClientIdState] = useState(() => localStorage.getItem(KEY));
  const setClientId = (id) => { localStorage.setItem(KEY, id); setClientIdState(id); };

  const clientsQ = useQuery({ queryKey: ["clients"], queryFn: () => base44.entities.Client.filter({}, { sort: "-created_date", limit: 50 }) });
  const clients = clientsQ.data?.items || [];

  useEffect(() => {
    if (!clients.length || clients.some((c) => c.id === clientId)) return;
    setClientId((clients.find((c) => c.name === "Apple") || clients[0]).id);
  }, [clients, clientId]);

  const ready = !!clientId && clients.some((c) => c.id === clientId);
  const clientQ = useQuery({ queryKey: ["client", clientId], queryFn: () => base44.entities.Client.get(clientId), enabled: ready });
  const findingsQ = useQuery({ queryKey: ["findings", clientId], enabled: ready,
    queryFn: () => base44.entities.Finding.filter({ client_id: clientId }, { sort: "-created_date", limit: 50 }) });
  const scenariosQ = useQuery({ queryKey: ["scenarios", clientId], enabled: ready,
    queryFn: () => base44.entities.Scenario.filter({ client_id: clientId }, { sort: "-created_date", limit: 50 }) });

  const refresh = () => { clientQ.refetch(); findingsQ.refetch(); scenariosQ.refetch(); clientsQ.refetch(); };

  return {
    clients, clientId, setClientId, client: clientQ.data, refresh,
    loading: clientsQ.isLoading || (ready && clientQ.isLoading), error: clientsQ.error,
    findings: findingsQ.data?.items || [], scenarios: scenariosQ.data?.items || [], refetchScenarios: scenariosQ.refetch, refetchFindings: findingsQ.refetch,
  };
}