import { useOutletContext } from "react-router-dom";
import StatCards from "@/components/finley/overview/StatCards";
import BacktestChart from "@/components/landing/BacktestChart";

export default function EvalsPage() {
  const { client } = useOutletContext();
  return (
    <div>
      <h1 className="text-3xl font-light mb-1">Evals</h1>
      <p className="text-sm text-muted-foreground mb-6">How {client.name}'s findings are holding up under analyst review.</p>
      <StatCards clientId={client.id} />
      <div className="rounded-2xl bg-card border border-border p-6">
        <h3 className="font-medium">Backtest: Apple FY2022 quarterly revenue</h3>
        <p className="text-xs text-muted-foreground mb-4">Predicted range vs actual.</p>
        <BacktestChart />
        <p className="mt-10 text-[11px] rounded-lg bg-amber-50 text-amber-800 px-3 py-2">Actual figures are from Apple's public FY2022 reports. Predicted ranges are illustrative until a backtest is run.</p>
      </div>
    </div>
  );
}