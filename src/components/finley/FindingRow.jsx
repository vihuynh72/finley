import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import ScorePills from "@/components/finley/ScorePills";
import { topicOf, dateLabel } from "@/lib/finley";

const CONF = (c) => (c >= 4 ? "high" : c >= 3 ? "medium" : "low");

export default function FindingRow({ finding: f, onOpen, action, showTopic, index = 0 }) {
  const date = f.sources?.[0]?.date || f.created_date;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
      onClick={() => onOpen(f)} className="group flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 cursor-pointer hover:border-foreground/20 hover:shadow-sm transition">
      <span className={`text-[10px] px-2 py-0.5 rounded border ${f.is_alert ? "border-destructive/30 text-destructive bg-destructive/5" : "border-border text-muted-foreground"}`}>
        {f.is_alert ? "URGENT" : "INFO"}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{f.title}</p>
        <p className="text-[11px] text-muted-foreground mb-1.5">
          {showTopic && <span className="font-medium text-foreground/70 uppercase mr-2">{topicOf(f)}</span>}
          {dateLabel(date)} · {CONF(f.confidence)} confidence · {f.sources?.length || 0} source{f.sources?.length === 1 ? "" : "s"}
          {f.review_status !== "pending" && ` · ${f.review_status}`}
        </p>
        <ScorePills finding={f} />
      </div>
      {action || <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />}
    </motion.div>
  );
}