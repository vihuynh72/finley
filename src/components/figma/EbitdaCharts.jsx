import { simulate } from "@/lib/scenarioModel";
import { TOPICS, findingsForTopic } from "./topics";

function aggregateLevers(findings, topic) {
  const filtered = topic ? findingsForTopic(findings, topic) : findings;
  return {
    price_change_pct: filtered.reduce((s, f) => s + (f.impact?.revenue_pct || 0), 0),
    volume_change_pct: 0,
    cogs_change_pct: filtered.reduce((s, f) => s + (f.impact?.cost_pct || 0), 0),
    opex_change_pct: 0,
    multiple_change: 0,
  };
}

const CHART_H = 180;

export default function EbitdaCharts({ client, findings }) {
  const baseResults = simulate(client, {});
  const baseEbitda = baseResults[2][1];

  const combinedLevers = aggregateLevers(findings);
  const combinedResults = simulate(client, combinedLevers);
  const combinedEbitda = combinedResults[2][2];

  const topicData = TOPICS.map((topic) => {
    const levers = aggregateLevers(findings, topic);
    const results = simulate(client, levers);
    return { topic, ebitda: results[2][2], delta: results[2][2] - baseEbitda };
  });

  const allEbitdas = [baseEbitda, ...topicData.map((t) => t.ebitda), combinedEbitda];
  const minE = Math.min(...allEbitdas);
  const maxE = Math.max(...allEbitdas);
  const range = maxE - minE || 1;

  const barPx = (v) => Math.max(8, ((v - minE) / range) * (CHART_H - 24) + 16);

  // Monthly data
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const seasonality = [0.08, 0.07, 0.085, 0.08, 0.09, 0.085, 0.08, 0.09, 0.085, 0.09, 0.085, 0.08];
  const sumS = seasonality.reduce((a, b) => a + b, 0);
  const weights = seasonality.map((w) => w / sumS);
  const monthly = months.map((m, i) => ({
    month: m,
    base: baseEbitda * weights[i],
    scenario: combinedEbitda * weights[i],
    bandLow: minE * weights[i],
    bandHigh: maxE * weights[i],
  }));

  const monthlyVals = monthly.flatMap((d) => [d.base, d.scenario, d.bandLow, d.bandHigh]);
  const monthlyMin = Math.min(...monthlyVals);
  const monthlyMax = Math.max(...monthlyVals);
  const monthlyRange = monthlyMax - monthlyMin || 1;
  const toY = (v) => 100 - ((v - monthlyMin) / monthlyRange) * 75 - 12;
  const toX = (i) => (i / 11) * 100;

  const fmtM = (v) => `$${v.toFixed(2)}M`;
  const fmtK = (v) => `$${Math.round(v * 1000)}K`;

  const deltasText = topicData.map((t) => `${t.delta >= 0 ? "+" : ""}${fmtM(t.delta)}`).join(" ");
  const bridgeCalc = `Combined EBITDA = ${fmtM(baseEbitda)} ${deltasText} = ${fmtM(combinedEbitda)}`;

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
      {/* Bar Chart Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col">
        <h3 className="text-sm font-bold text-slate-800 mb-6">Combined scenario EBITDA bridge</h3>
        <div className="flex-1 relative min-h-[200px] flex">
          <div className="flex flex-col justify-between text-[10px] text-slate-400 pr-4 pb-6 text-right w-14 shrink-0">
            <span>{fmtM(maxE)}</span>
            <span>{fmtM((maxE + minE) / 2)}</span>
            <span>{fmtM(minE)}</span>
          </div>
          <div className="flex-1 relative border-b border-slate-100 flex items-end justify-between pb-0 px-2" style={{ height: `${CHART_H}px` }}>
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-full border-t border-slate-100 border-dashed h-0" />
              ))}
            </div>
            <Bar label="Base EBITDA" color="bg-[#3b5bdb]" heightPx={barPx(baseEbitda)} />
            {topicData.map((t) => (
              <Bar key={t.topic} label={t.topic.split(" ")[0]} color={t.delta >= 0 ? "bg-emerald-400" : "bg-red-400"} heightPx={barPx(t.ebitda)} />
            ))}
            <Bar label="Combined EBITDA" color="bg-[#3b5bdb]" heightPx={barPx(combinedEbitda)} />
          </div>
        </div>
        <div className="mt-10 pt-4 border-t border-slate-100 text-[10px] text-slate-500 leading-relaxed">
          How this is calculated: {bridgeCalc} (each topic at its current slider values)
        </div>
      </div>

      {/* Line Chart Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col">
        <h3 className="text-sm font-bold text-slate-800 mb-6">FY27 monthly EBITDA: base vs combined</h3>
        <div className="flex-1 relative min-h-[200px] flex">
          <div className="flex flex-col justify-between text-[10px] text-slate-400 pr-4 pb-6 text-right w-12 shrink-0">
            <span>{fmtK(monthlyMax)}</span>
            <span>{fmtK((monthlyMax + monthlyMin) / 2)}</span>
            <span>{fmtK(monthlyMin)}</span>
          </div>
          <div className="flex-1 relative border-b border-slate-100 pb-0">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-full border-t border-slate-100 border-dashed h-0" />
              ))}
            </div>
            <div className="absolute inset-0 z-10 pb-6">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                <path
                  d={`M${monthly.map((d, i) => `${toX(i)},${toY(d.bandHigh)}`).join(" L")} L${monthly.slice().reverse().map((d, i) => `${toX(11 - i)},${toY(d.bandLow)}`).join(" L")} Z`}
                  fill="#eff6ff"
                  opacity="0.7"
                />
                <path
                  d={`M${monthly.map((d, i) => `${toX(i)},${toY(d.base)}`).join(" L")}`}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray="3,2"
                />
                <path
                  d={`M${monthly.map((d, i) => `${toX(i)},${toY(d.scenario)}`).join(" L")}`}
                  fill="none"
                  stroke="#3b5bdb"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
                {monthly.map((d, i) => (
                  <circle key={i} cx={toX(i)} cy={toY(d.scenario)} r="2.5" fill="white" stroke="#3b5bdb" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                ))}
              </svg>
            </div>
            <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[9px] text-slate-400 translate-y-6">
              {months.map((m) => <span key={m}>{m}</span>)}
            </div>
          </div>
        </div>
        <div className="flex justify-center gap-6 mt-8 text-[10px] text-slate-600">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0 border-t-2 border-slate-300 border-dashed" /> Base case
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 bg-blue-50 rounded-sm" /> Downside to upside
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0 border-t-2 border-[#3b5bdb]" /> Scenario
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 text-[10px] text-slate-500 leading-relaxed">
          How this is calculated: Month = annual EBITDA × seasonality weight. Band = all topics at downside ({fmtM(minE)}) to upside ({fmtM(maxE)}).
        </div>
      </div>
    </section>
  );
}

function Bar({ label, color, heightPx }) {
  return (
    <div className="relative z-10 flex flex-col items-center justify-end w-12" style={{ height: `${CHART_H}px` }}>
      <div className={`w-full ${color} rounded-t-sm`} style={{ height: `${heightPx}px` }} />
      <span className="absolute -bottom-6 text-[9px] text-slate-500 whitespace-nowrap">{label}</span>
    </div>
  );
}