import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import FindingCard from "./FindingCard";

export default function FindingsList({ clientId, alertsOnly, refreshKey }) {
  const query = alertsOnly ? { client_id: clientId, is_alert: true } : { client_id: clientId };
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["findings", clientId, alertsOnly, refreshKey],
    queryFn: () => base44.entities.Finding.filter(query, { sort: "-priority", limit: 50 }),
  });
  const items = data?.items || [];
  if (isLoading) return <p className="text-muted-foreground">Loading…</p>;
  if (!items.length) return <p className="text-muted-foreground">{alertsOnly ? "No urgent alerts. Alerts require materiality ≥4, confidence ≥3 and urgency ≥4." : "No findings yet. Run an analysis to generate the briefing."}</p>;
  return <div className="space-y-4">{items.map((f) => <FindingCard key={f.id} f={f} onChange={refetch} />)}</div>;
}