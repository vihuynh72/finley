import { Link } from "react-router-dom";
import Reveal from "@/components/landing/Reveal";
import BacktestChart from "@/components/landing/BacktestChart";

export default function BacktestSection() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20">
      <Reveal><h2 className="text-2xl font-semibold">We grade ourselves in public.</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-8">Apple FY2022 quarterly revenue: predicted range vs actual.</p></Reveal>
      <Reveal className="rounded-2xl bg-card border border-border p-6">
        <BacktestChart />
        <p className="mt-10 text-[11px] rounded-lg bg-amber-50 text-amber-800 px-3 py-2">
          Backtest demo. Actual figures are from Apple's public FY2022 reports. Predicted figures are illustrative until a backtest is run.
        </p>
        <Link to="/app/evals" className="inline-block mt-4 text-[11px] tracking-widest hover:underline">SEE THE FULL EVALS →</Link>
      </Reveal>
    </section>
  );
}