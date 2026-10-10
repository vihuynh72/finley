import { Badge } from "@/components/ui/badge";
import { ExternalLink, AlertTriangle } from "lucide-react";
import FindingReview from "./FindingReview";

const Score = ({ l, v }) => <span className="text-xs text-muted-foreground">{l} <b className="text-foreground">{v}/5</b></span>;
const pct = (v, u = "%") => (v == null ? "—" : `${v > 0 ? "+" : ""}${v}${u}`);

export default function FindingCard({ f, onChange }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-medium flex items-center gap-2">{f.is_alert && <AlertTriangle className="w-4 h-4 text-red-400" />}{f.title}</h4>
        <Badge variant="outline" className="capitalize shrink-0">{f.agent}</Badge>
      </div>
      <div className="flex gap-4 mt-2"><Score l="Materiality" v={f.materiality} /><Score l="Confidence" v={f.confidence} /><Score l="Urgency" v={f.urgency} /></div>
      <div className="grid md:grid-cols-2 gap-4 mt-4 text-sm">
        <div><div className="text-xs text-muted-foreground mb-1">Observed fact</div>{f.fact}</div>
        <div><div className="text-xs text-muted-foreground mb-1">Interpretation</div>{f.interpretation}</div>
        <div><div className="text-xs text-muted-foreground mb-1">Why it matters</div>{f.why_it_matters}</div>
        <div><div className="text-xs text-muted-foreground mb-1">Suggested next step</div>{f.next_step}</div>
      </div>
      {!!f.drivers_affected?.length && <div className="flex flex-wrap gap-1 mt-3">{f.drivers_affected.map((d) => <Badge key={d} variant="secondary">{d}</Badge>)}</div>}
      {f.impact && (
        <div className="mt-3 rounded-md bg-muted p-3 text-xs">
          <div className="text-muted-foreground mb-1">Illustrative impact (scenario, not fact)</div>
          <div className="flex gap-4 flex-wrap"><span>Revenue {pct(f.impact.revenue_pct)}</span><span>Costs {pct(f.impact.cost_pct)}</span><span>Margin {pct(f.impact.margin_pts, " pts")}</span><span>Cash flow {pct(f.impact.cash_flow_pct)}</span></div>
          <div className="text-muted-foreground mt-1">{f.impact.rationale}</div>
        </div>
      )}
      {f.uncertainty && <p className="text-xs text-muted-foreground mt-3">Uncertainty: {f.uncertainty}</p>}
      <div className="mt-3 space-y-1">
        {(f.sources || []).map((s) => (
          <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="w-3 h-3" />{s.title}</a>
        ))}
      </div>
      <FindingReview finding={f} onChange={onChange} />
    </div>
  );
}