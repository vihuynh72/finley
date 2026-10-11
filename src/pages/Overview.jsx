import { Link, useOutletContext } from "react-router-dom";
import { ArrowRight, RotateCw } from "lucide-react";
import StatCards from "@/components/finley/overview/StatCards";
import ActivityChart from "@/components/finley/overview/ActivityChart";
import AssumptionHealth from "@/components/finley/overview/AssumptionHealth";
import OverviewCharts from "@/components/finley/overview/OverviewCharts";
import FindingRow from "@/components/finley/FindingRow";
import { scoresOf } from "@/lib/finley";

export default function Overview() {
  const { client, findings, openFinding, refresh, scan, active } = useOutletContext();
  const urgent = findings.filter((f) => f.review_status !== "rejected")
    .sort((a, b) => (b.is_alert - a.is_alert) || scoresOf(b).priority - scoresOf(a).priority).slice(0, 5);
  return (
    <div>
      <div className="flex flex-wrap justify-between items-end gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-light">{client.name}</h1>
          <p className="text-sm text-muted-foreground">{client.industry}{client.ticker ? ` · ${client.ticker}` : ""}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh} className="px-4 py-2 rounded-full bg-card border border-border text-sm flex items-center gap-1.5"><RotateCw className="w-3.5 h-3.5" /> Refresh</button>
          <button onClick={scan} disabled={active} className="px-5 py-2 rounded-full bg-primary text-sm font-medium disabled:opacity-60">Scan sources now</button>
        </div>
      </div>
      <StatCards clientId={client.id} />
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <AssumptionHealth client={client} />
        <div className="lg:col-span-2"><ActivityChart clientId={client.id} /></div>
      </div>
      <OverviewCharts client={client} findings={findings} />
      <div className="rounded-2xl bg-card border border-border p-5">
        <div className="flex justify-between mb-4">
          <h3 className="font-medium">Top urgent findings</h3>
          <Link to="/app/scenarios" className="text-xs flex items-center gap-1">Prompt scenarios <ArrowRight className="w-3 h-3" /></Link>
        </div>
        <div className="space-y-2">
          {urgent.map((f, i) => <FindingRow key={f.id} finding={f} index={i} onOpen={openFinding} showTopic />)}
          {!urgent.length && <p className="text-sm text-muted-foreground py-6 text-center">No findings yet. Run a scan to start.</p>}
        </div>
      </div>
    </div>
  );
}