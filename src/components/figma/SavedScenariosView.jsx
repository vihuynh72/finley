import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Sparkles } from "lucide-react";
import moment from "moment";

export default function SavedScenariosView({ scenarios, client, onCreated }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setError("");
    try {
      await base44.functions.invoke("buildScenario", { client_id: client.id, question });
      setQuestion("");
      onCreated();
    } catch (e) {
      setError(e.message || "Failed to generate scenario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-800 mb-4">Saved scenarios</h2>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
        <h3 className="text-sm font-bold text-slate-800 mb-2">Ask a what-if question</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="e.g., What if a competitor cuts prices 15%?"
            className="flex-1 border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={submit}
            disabled={loading || !question.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>

      {scenarios.length === 0 ? (
        <p className="text-sm text-slate-400">No saved scenarios yet. Ask a question above to generate one.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {scenarios.map((s) => (
            <div key={s.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-sm font-bold text-slate-800">{s.question}</h3>
                <span className="text-[10px] text-slate-400 shrink-0 ml-4">{moment(s.created_date).format("MMM D, h:mm A")}</span>
              </div>
              <p className="text-sm text-slate-600 mb-4">{s.narrative}</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                <Lever label="Price" value={s.price_change_pct} suffix="%" />
                <Lever label="Volume" value={s.volume_change_pct} suffix="%" />
                <Lever label="COGS" value={s.cogs_change_pct} suffix="%" />
                <Lever label="Opex" value={s.opex_change_pct} suffix="%" />
                <Lever label="EV/EBITDA" value={s.multiple_change} suffix="x" />
              </div>
              {s.lever_rationale && <p className="text-xs text-slate-500 mb-3">{s.lever_rationale}</p>}
              {s.evidence?.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Evidence</p>
                  <ul className="text-xs text-slate-600 list-disc list-inside space-y-0.5">
                    {s.evidence.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              {s.risks?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Risks</p>
                  <ul className="text-xs text-slate-600 list-disc list-inside space-y-0.5">
                    {s.risks.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Lever({ label, value, suffix }) {
  const v = value || 0;
  const isNeg = v < 0;
  return (
    <div className="bg-slate-50 rounded-md p-2 text-center">
      <p className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-bold ${isNeg ? "text-red-600" : "text-emerald-600"}`}>
        {isNeg ? "" : "+"}{v}{suffix}
      </p>
    </div>
  );
}