import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { topicOf } from "@/lib/finley";

export default function SourcesPage() {
  const { findings } = useOutletContext();
  const map = new Map();
  findings.forEach((f) => (f.sources || []).forEach((s) => {
    const e = map.get(s.url) || { ...s, findings: [], rel: 0 };
    e.findings.push(f.title); e.topic = topicOf(f); e.rel = Math.max(e.rel, f.relevance ?? (f.confidence || 0) * 20);
    map.set(s.url, e);
  }));
  const sources = [...map.values()].sort((a, b) => b.rel - a.rel);
  return (
    <div>
      <h1 className="text-3xl font-light mb-1">Sources</h1>
      <p className="text-sm text-muted-foreground mb-6">Every article behind the latest findings, ranked by reliability.</p>
      <div className="space-y-2">
        {sources.map((s, i) => (
          <motion.a key={s.url} href={s.url} target="_blank" rel="noreferrer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
            className="flex items-center gap-4 rounded-xl bg-card border border-border px-4 py-3 hover:border-foreground/20">
            <span className={`text-[10px] px-2 py-0.5 rounded ${s.rel >= 80 ? "bg-primary" : "bg-secondary"}`}>Rel {Math.round(s.rel)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{s.title}</p>
              <p className="text-[11px] text-muted-foreground truncate">{s.topic} · {s.date} · cited by {s.findings.length} finding{s.findings.length > 1 ? "s" : ""}</p>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
          </motion.a>
        ))}
        {!sources.length && <p className="text-sm text-muted-foreground text-center py-8">No sources yet. Run a scan to collect them.</p>}
      </div>
    </div>
  );
}