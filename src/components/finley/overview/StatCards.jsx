import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Zap, Siren, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";

export default function StatCards({ clientId }) {
  const { data } = useQuery({ queryKey: ["finding-stats", clientId], queryFn: async () => {
    const [agg, alerts] = await Promise.all([
      base44.entities.Finding.aggregate({ query: { client_id: clientId }, groupBy: "review_status" }),
      base44.entities.Finding.count({ client_id: clientId, is_alert: true }),
    ]);
    const by = Object.fromEntries((agg.rows || []).map((r) => [r.review_status || "pending", r.count]));
    return { validated: by.validated || 0, rejected: by.rejected || 0, pending: by.pending || 0, alerts };
  } });
  const s = data || { validated: 0, rejected: 0, pending: 0, alerts: 0 };
  const reviewed = s.validated + s.rejected, total = reviewed + s.pending;
  const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : "—");
  const cards = [
    [CheckCircle2, "Findings accepted", pct(s.validated, reviewed), `${reviewed} reviewed`, "/app/sources"],
    [AlertTriangle, "False alarms", pct(s.rejected, reviewed), `${s.rejected} rejected`, "/app/evals"],
    [Zap, "New to analyst", pct(s.pending, total), `${s.pending} pending`, "/app"],
    [Siren, "Urgent alerts", String(s.alerts), `of ${total} findings`, "/app"],
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map(([Icon, label, value, sub, to], i) => (
        <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
          className="rounded-2xl bg-card border border-border p-4">
          <span className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center mb-3"><Icon className="w-4 h-4" /></span>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-3xl font-light my-1">{value} <span className="text-[10px] align-middle px-1.5 py-0.5 rounded bg-accent text-accent-foreground">{sub}</span></p>
          <Link to={to} className="flex justify-between text-[11px] text-muted-foreground border-t border-border pt-2 mt-2 hover:text-foreground">View details <ArrowRight className="w-3 h-3" /></Link>
        </motion.div>
      ))}
    </div>
  );
}