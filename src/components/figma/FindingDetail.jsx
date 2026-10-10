import { useState } from "react";
import { ExternalLink, Check, X, MessageSquare } from "lucide-react";

export default function FindingDetail({ finding, onUpdate }) {
  const [feedback, setFeedback] = useState(finding.feedback || "");
  const [saving, setSaving] = useState(false);

  const review = async (status) => {
    setSaving(true);
    await onUpdate({ review_status: status, feedback });
    setSaving(false);
  };

  const toggleIncorporate = async () => {
    setSaving(true);
    await onUpdate({ incorporate: !finding.incorporate });
    setSaving(false);
  };

  return (
    <div className="bg-slate-50 rounded-lg border border-slate-200 border-t-0 p-4 space-y-3">
      {finding.fact && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Observed fact</p>
          <p className="text-sm text-slate-700">{finding.fact}</p>
        </div>
      )}
      {finding.interpretation && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Interpretation</p>
          <p className="text-sm text-slate-600 italic">{finding.interpretation}</p>
        </div>
      )}
      {finding.why_it_matters && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Why it matters</p>
          <p className="text-sm text-slate-700">{finding.why_it_matters}</p>
        </div>
      )}
      {finding.next_step && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Suggested next step</p>
          <p className="text-sm text-slate-700">{finding.next_step}</p>
        </div>
      )}
      {finding.uncertainty && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Uncertainty</p>
          <p className="text-sm text-slate-600">{finding.uncertainty}</p>
        </div>
      )}
      {finding.impact && (
        <div className="bg-white rounded-md p-3 border border-slate-200">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Illustrative impact</p>
          <div className="flex gap-4 flex-wrap text-xs">
            {finding.impact.revenue_pct != null && (
              <span>Revenue: <strong>{finding.impact.revenue_pct > 0 ? "+" : ""}{finding.impact.revenue_pct}%</strong></span>
            )}
            {finding.impact.cost_pct != null && (
              <span>Costs: <strong>{finding.impact.cost_pct > 0 ? "+" : ""}{finding.impact.cost_pct}%</strong></span>
            )}
            {finding.impact.margin_pts != null && (
              <span>Margin: <strong>{finding.impact.margin_pts > 0 ? "+" : ""}{finding.impact.margin_pts}pts</strong></span>
            )}
            {finding.impact.cash_flow_pct != null && (
              <span>Cash flow: <strong>{finding.impact.cash_flow_pct > 0 ? "+" : ""}{finding.impact.cash_flow_pct}%</strong></span>
            )}
          </div>
          {finding.impact.rationale && <p className="text-[11px] text-slate-500 mt-2">{finding.impact.rationale}</p>}
        </div>
      )}
      {(finding.sources || []).length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Sources</p>
          <div className="flex flex-col gap-1">
            {finding.sources.map((s, i) => (
              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> {s.title} {s.date && `(${s.date})`}
              </a>
            ))}
          </div>
        </div>
      )}
      <div className="pt-3 border-t border-slate-200 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => review("validated")}
            disabled={saving}
            className="flex items-center gap-1 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-md hover:bg-emerald-700 disabled:opacity-50"
          >
            <Check className="w-3 h-3" /> Validate
          </button>
          <button
            onClick={() => review("rejected")}
            disabled={saving}
            className="flex items-center gap-1 text-xs bg-slate-200 text-slate-600 px-3 py-1.5 rounded-md hover:bg-slate-300 disabled:opacity-50"
          >
            <X className="w-3 h-3" /> Reject
          </button>
          <button
            onClick={toggleIncorporate}
            disabled={saving}
            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-md disabled:opacity-50 ${finding.incorporate ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            <MessageSquare className="w-3 h-3" /> {finding.incorporate ? "Included in advice" : "Include in advice"}
          </button>
        </div>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Add feedback or notes..."
          className="w-full text-sm border border-slate-200 rounded-md p-2 focus:outline-none focus:border-blue-500 resize-none"
          rows={2}
        />
      </div>
    </div>
  );
}