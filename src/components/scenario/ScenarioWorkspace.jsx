import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, FlaskConical } from "lucide-react";
import ScenarioResult from "./ScenarioResult";

export default function ScenarioWorkspace({ client }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { data, refetch } = useQuery({
    queryKey: ["scenarios", client.id],
    queryFn: () => base44.entities.Scenario.filter({ client_id: client.id }, { sort: "-created_date", limit: 20 }),
  });
  const ask = async (e) => {
    e.preventDefault(); setLoading(true); setError("");
    const res = await base44.functions.invoke("buildScenario", { client_id: client.id, question: q }).catch((err) => ({ data: { error: err.message } }));
    setLoading(false);
    if (res.data.error) return setError(res.data.error);
    setQ(""); refetch();
  };
  return (
    <div className="space-y-4">
      <form onSubmit={ask} className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="What if our largest competitor cuts prices 10%?" />
        <Button disabled={!q || loading}>{loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FlaskConical className="w-4 h-4 mr-1" />}Build scenario</Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {(data?.items || []).map((s) => <ScenarioResult key={s.id} client={client} scenario={s} />)}
    </div>
  );
}