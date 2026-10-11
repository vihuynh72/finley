import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { simulate } from "@/lib/scenarioModel";
import { fmtM } from "@/lib/finley";

export default function ScenariosPage() {
  const { client, scenarios, refetchScenarios } = useOutletContext();
  const [q, setQ] = useState(""), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const ask = async () => {
    if (!q.trim()) return;
    setLoading(true); setError("");
    try { await base44.functions.invoke("buildScenario", { client_id: client.id, question: q }); setQ(""); refetchScenarios(); }
    catch (e) { setError(e.message || "Could not build the scenario. Sign in to use the scenario agent."); }
    setLoading(false);
  };
  return (
    <div>
      <h1 className="text-3xl font-light mb-6">Prompt scenarios</h1>
      <div className="rounded-2xl bg-card border border-border p-5 mb-6">
        <p className="text-sm font-medium mb-2">Ask a what-if question</p>
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} placeholder="e.g. What if a 25% tariff hits China-assembled iPhones?"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <button onClick={ask} disabled={loading || !q.trim()} className="px-4 rounded-lg bg-primary text-sm font-medium flex items-center gap-1.5 disabled:opacity-60">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}{loading ? "Modeling…" : "Generate"}
          </button>
        </div>
        {error && <p className="text-xs text-destructive mt-2">{error}</p>}
      </div>
      <div className="space-y-3">
        {scenarios.map((s, i) => {
          const [, , [, e0, e1]] = simulate(client, s);
          return (
            <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="rounded-2xl bg-card border border-border p-5">
              <div className="flex justify-between gap-4">
                <p className="font-medium text-sm">{s.question}</p>
                <span className={`text-sm shrink-0 ${e1 - e0 < 0 ? "text-destructive" : ""}`}>{e1 - e0 >= 0 ? "+" : ""}{fmtM(e1 - e0)} EBITDA</span>
              </div>
              {s.narrative && <p className="text-xs text-muted-foreground mt-2">{s.narrative}</p>}
              <p className="text-[10px] text-muted-foreground mt-2">Illustrative scenario · {new Date(s.created_date).toLocaleDateString()}</p>
            </motion.div>
          );
        })}
        {!scenarios.length && <p className="text-sm text-muted-foreground text-center py-8">No saved scenarios yet.</p>}
      </div>
    </div>
  );
}