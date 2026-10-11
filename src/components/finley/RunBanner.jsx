import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";

const LABELS = {
  queued: "Queued", collecting: "Collecting sources via Bright Data", research: "Research agents analyzing",
  company: "Testing assumptions", scenario: "Modeling scenario impacts", done: "Briefing ready", failed: "Run failed",
};

export default function RunBanner({ run, active }) {
  const show = active || run?.stage === "failed";
  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
          className={`px-6 py-2 text-xs flex items-center gap-2 ${run.stage === "failed" ? "bg-destructive/10 text-destructive" : "bg-primary/40"}`}>
          {active && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {run.stage === "failed" ? `Run failed: ${run.error}` : `${LABELS[run.stage] || "Working"}${run.articles_count ? ` · ${run.articles_count} articles collected` : ""}`}
        </motion.div>
      )}
    </AnimatePresence>
  );
}