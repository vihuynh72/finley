import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { findingsForTopic } from "./topics";
import FindingDetail from "./FindingDetail";

const CONFIDENCE_LABELS = {
  5: "high confidence",
  4: "high confidence",
  3: "medium confidence",
  2: "low confidence",
  1: "low confidence",
};

export default function UrgentFindingsList({ findings, activeTopic, onUpdateFinding }) {
  const [expanded, setExpanded] = useState(null);
  const filtered = [...findingsForTopic(findings, activeTopic)].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  if (!filtered.length) {
    return (
      <section>
        <h2 className="text-lg font-bold text-slate-800 mb-4">{activeTopic === "Overview" ? "Top urgent findings" : activeTopic}</h2>
        <p className="text-sm text-slate-400">No findings yet. Run a scan to collect intelligence.</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-lg font-bold text-slate-800 mb-4">{activeTopic === "Overview" ? "Top urgent findings" : activeTopic}</h2>
      <div className="flex flex-col gap-3">
        {filtered.map((f) => (
          <div key={f.id}>
            <div
              onClick={() => setExpanded(expanded === f.id ? null : f.id)}
              className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 flex gap-4 items-start hover:border-blue-200 transition-colors cursor-pointer group"
            >
              {f.is_alert ? (
                <span className="bg-red-50 text-red-700 text-[10px] font-bold px-2 py-1 rounded shrink-0 mt-0.5">Urgent</span>
              ) : (f.priority || 0) >= 60 ? (
                <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-1 rounded shrink-0 mt-0.5">High</span>
              ) : (
                <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded shrink-0 mt-0.5">Monitor</span>
              )}
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-800 mb-1 group-hover:text-blue-700 transition-colors">{f.title}</h3>
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                  {(f.drivers_affected || []).length > 0 && (
                    <>
                      <span className="text-blue-600 font-medium">{f.drivers_affected.join(", ")}</span>
                      <span className="text-slate-300">•</span>
                    </>
                  )}
                  <span>{CONFIDENCE_LABELS[f.confidence] || "medium confidence"}</span>
                  <span className="text-slate-300">•</span>
                  <span>{(f.sources || []).length} source(s)</span>
                  {f.review_status === "validated" && (
                    <><span className="text-slate-300">•</span><span className="text-emerald-600 font-medium">Validated</span></>
                  )}
                  {f.review_status === "rejected" && (
                    <><span className="text-slate-300">•</span><span className="text-slate-400 line-through">Rejected</span></>
                  )}
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-300 mt-1 group-hover:text-blue-500 transition-all ${expanded === f.id ? "rotate-180" : "-rotate-90"}`} />
            </div>
            {expanded === f.id && <FindingDetail finding={f} onUpdate={(data) => onUpdateFinding(f.id, data)} />}
          </div>
        ))}
      </div>
    </section>
  );
}