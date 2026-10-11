import { motion } from "framer-motion";
import { AlertTriangle, TrendingDown, CheckCircle2, Eye } from "lucide-react";
import { STATUS } from "@/lib/finley";

const ICONS = { challenged: [AlertTriangle, "text-destructive"], under_review: [TrendingDown, "text-amber-600"], supported: [CheckCircle2, "text-foreground"], monitoring: [Eye, "text-muted-foreground"] };

export default function AssumptionCard({ assumption }) {
  if (!assumption) return <p className="text-sm text-muted-foreground rounded-2xl bg-card border border-border p-5">No assumption is linked to this topic. Add one on the client profile with this topic as its driver.</p>;
  const st = assumption.status || "monitoring", s = STATUS[st] || STATUS.monitoring, [Icon, color] = ICONS[st] || ICONS.monitoring;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-card border border-border p-5 flex items-center gap-4">
      <span className="w-11 h-11 rounded-lg border border-border bg-background flex items-center justify-center"><Icon className={`w-5 h-5 ${color}`} /></span>
      <div className="flex-1">
        <p className="font-medium">{assumption.text}</p>
        {assumption.note && <p className="text-xs text-muted-foreground mt-0.5">{assumption.note}</p>}
      </div>
      <span className={`text-[10px] tracking-wider px-2 py-1 rounded uppercase ${s.cls}`}>{s.label}</span>
    </motion.div>
  );
}