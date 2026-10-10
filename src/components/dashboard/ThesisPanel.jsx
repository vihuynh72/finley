import { Badge } from "@/components/ui/badge";

const STATUS = {
  monitoring: "bg-secondary text-muted-foreground",
  supported: "bg-emerald-500/15 text-emerald-400",
  challenged: "bg-red-500/15 text-red-400",
  under_review: "bg-amber-500/15 text-amber-400",
};

export default function ThesisPanel({ client }) {
  const rows = [["Business model", client.business_model], ["Financial drivers", client.financial_drivers], ["Objectives", client.strategic_objectives], ["Competitors", (client.competitors || []).join(", ")]];
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h3 className="font-medium">Company profile</h3>
        {rows.map(([l, v]) => (<div key={l}><div className="text-xs text-muted-foreground">{l}</div><div className="text-sm">{v || "—"}</div></div>))}
        <div className="grid grid-cols-4 gap-2 pt-2 text-sm">
          <div><div className="text-xs text-muted-foreground">Revenue</div>${client.annual_revenue}m</div>
          <div><div className="text-xs text-muted-foreground">Gross margin</div>{client.gross_margin_pct}%</div>
          <div><div className="text-xs text-muted-foreground">Opex</div>${client.opex}m</div>
          <div><div className="text-xs text-muted-foreground">EV/EBITDA</div>{client.ev_ebitda_multiple}x</div>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="font-medium mb-3">Assumptions under monitoring</h3>
        <div className="space-y-3">
          {(client.assumptions || []).map((a, i) => (
            <div key={i} className="border-b border-border pb-3 last:border-0">
              <div className="flex justify-between gap-2">
                <span className="text-sm">{a.text}</span>
                <Badge className={STATUS[a.status || "monitoring"]}>{(a.status || "monitoring").replace("_", " ")}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">Driver: {a.driver}{a.note ? ` · ${a.note}` : ""}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}