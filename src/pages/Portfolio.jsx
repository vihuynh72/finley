import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Building2 } from "lucide-react";
import moment from "moment";

export default function Portfolio() {
  const { data, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.filter({}, { sort: "-created_date", limit: 50 }),
  });
  const clients = data?.items || [];
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Client portfolio</h1>
          <p className="text-sm text-muted-foreground">Companies under continuous intelligence monitoring</p>
        </div>
        <Button asChild><Link to="/clients/new"><Plus className="w-4 h-4 mr-1" />Add client</Link></Button>
      </div>
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {!isLoading && !clients.length && <p className="text-muted-foreground">No clients yet. Add your first one.</p>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((c) => (
          <Link key={c.id} to={`/clients/${c.id}`} className="rounded-lg border border-border bg-card p-5 hover:border-primary transition-colors">
            <div className="flex items-center gap-2 font-medium"><Building2 className="w-4 h-4 text-primary" />{c.name}</div>
            <p className="text-sm text-muted-foreground mt-1">{c.industry}</p>
            <div className="text-xs text-muted-foreground mt-4 flex justify-between">
              <span>{(c.assumptions || []).length} assumptions</span>
              <span>{c.last_run_at ? `Run ${moment(c.last_run_at).fromNow()}` : "Never run"}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}