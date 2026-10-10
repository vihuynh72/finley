import React from 'react';
import {
  LayoutDashboard,
  PenTool,
  Tag,
  Users,
  Truck,
  Scale,
  Bookmark,
  ChevronDown,
  Moon,
  ArrowRight,
  Search
} from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col font-sans text-slate-800">
      {/* Top Navigation Bar */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-10">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2 text-blue-700 font-bold text-lg tracking-tight">
            <div className="w-6 h-6 bg-blue-700 rounded flex items-center justify-center text-white text-xs">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            SignalDesk
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Client</span>
            <button className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md hover:bg-slate-100 transition-colors font-medium">
              Halvorsen Foods
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-4 text-slate-500">
            <span>Reforecast due <strong className="text-slate-700 font-semibold">Oct 24</strong></span>
            <span>Last scan today, 12:38 PM</span>
          </div>
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md font-medium transition-colors">
            Scan sources now
          </button>
          <button className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors">
            <Moon className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Banner */}
      <div className="bg-[#eef2ff] text-[#4f46e5] text-[11px] py-1 text-center font-medium border-b border-[#e0e7ff]">
        Sample data for testing. All companies and sources are fictional.
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-clip">

        {/* Left Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto">
          <div className="py-4">
            <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-6 mb-2">Topics</h2>
            <nav className="flex flex-col gap-0.5">
              <NavItem icon={<LayoutDashboard className="w-4 h-4" />} label="Overview" count={6} active />
              <NavItem icon={<PenTool className="w-4 h-4" />} label="Input costs" count={1} badgeColor="bg-red-100 text-red-700" />
              <NavItem icon={<Tag className="w-4 h-4" />} label="Pricing and competition" count={2} badgeColor="bg-red-700 text-white" />
              <NavItem icon={<Users className="w-4 h-4" />} label="Demand and customers" count={1} />
              <NavItem icon={<Truck className="w-4 h-4" />} label="Logistics and freight" count={1} />
              <NavItem icon={<Scale className="w-4 h-4" />} label="Regulation" count={1} />
              <div className="mt-4">
                <NavItem icon={<Bookmark className="w-4 h-4" />} label="Saved scenarios" count={2} />
              </div>
            </nav>
          </div>

          <div className="mt-auto p-4">
            <div className="bg-slate-50 rounded-lg p-3 text-[11px] text-slate-500 leading-relaxed border border-slate-100">
              SignalDesk never edits your model. It flags what to look at, and you decide.
            </div>
            <div className="mt-3 relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Ask Lovable..."
                className="w-full bg-white border border-slate-200 rounded-md pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">

            <h1 className="text-2xl font-bold text-slate-900 mb-8 font-serif">Halvorsen Foods</h1>

            {/* Assumptions Section */}
            <section className="mb-8">
              <h2 className="text-base font-bold text-slate-800 mb-4">Assumptions by topic</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <AssumptionCard
                  color="bg-red-700"
                  title="Input costs"
                  desc="Gross margin holds at 34%"
                  status="Challenged"
                  statusColor="bg-red-50 text-red-700"
                  openCount={1}
                />
                <AssumptionCard
                  color="bg-amber-500"
                  title="Pricing and competition"
                  desc="Bar line pricing stays flat on the $14.0M bar line"
                  status="Under pressure"
                  statusColor="bg-amber-50 text-amber-700"
                  openCount={2}
                />
                <AssumptionCard
                  color="bg-emerald-500"
                  title="Demand and customers"
                  desc="Grocery expansion adds $4.2M (35 Greenway stores at ~$120K each)"
                  status="Supported"
                  statusColor="bg-emerald-50 text-emerald-700"
                  openCount={1}
                />
                <AssumptionCard
                  color="bg-blue-600"
                  title="Logistics and freight"
                  desc="Freight cost per case is stable at $1.85 across 2.4M cases ($4.44M)"
                  status="Holding"
                  statusColor="bg-blue-50 text-blue-700"
                  openCount={1}
                />
                <AssumptionCard
                  color="bg-blue-600"
                  title="Regulation"
                  desc="No new regulatory costs in FY27"
                  status="Holding"
                  statusColor="bg-blue-50 text-blue-700"
                  openCount={1}
                />
              </div>
            </section>

            {/* Charts Section */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">

              {/* Bar Chart Card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col">
                <h3 className="text-sm font-bold text-slate-800 mb-6">Combined scenario EBITDA bridge</h3>

                <div className="flex-1 relative min-h-[200px] flex">
                  {/* Y-Axis Labels */}
                  <div className="flex flex-col justify-between text-[10px] text-slate-400 pr-4 pb-6 text-right w-14 shrink-0">
                    <span>$5.32M</span>
                    <span>$5.25M</span>
                    <span>$5.18M</span>
                    <span>$5.11M</span>
                    <span>$5.04M</span>
                  </div>

                  {/* Chart Area */}
                  <div className="flex-1 relative border-b border-slate-100 flex items-end justify-between pb-0 px-2">
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="w-full border-t border-slate-100 border-dashed h-0"></div>
                      ))}
                    </div>

                    {/* Bars */}
                    <div className="relative z-10 flex flex-col items-center w-12">
                      <div className="w-full bg-[#3b5bdb] min-h-[90%] rounded-t-sm"></div>
                      <span className="absolute -bottom-6 text-[9px] text-slate-500 whitespace-nowrap">Base EBITDA</span>
                    </div>
                    <div className="relative z-10 flex flex-col items-center w-12">
                      <span className="absolute -bottom-6 text-[9px] text-slate-500">Input</span>
                    </div>
                    <div className="relative z-10 flex flex-col items-center w-12">
                      <span className="absolute -bottom-6 text-[9px] text-slate-500">Pricing</span>
                    </div>
                    <div className="relative z-10 flex flex-col items-center w-12">
                      <span className="absolute -bottom-6 text-[9px] text-slate-500">Demand</span>
                    </div>
                    <div className="relative z-10 flex flex-col items-center w-12">
                      <span className="absolute -bottom-6 text-[9px] text-slate-500">Logistics</span>
                    </div>
                    <div className="relative z-10 flex flex-col items-center w-12">
                      <span className="absolute -bottom-6 text-[9px] text-slate-500">Regulation</span>
                    </div>
                    <div className="relative z-10 flex flex-col items-center w-12">
                      <div className="w-full bg-[#3b5bdb] min-h-[90%] rounded-t-sm"></div>
                      <span className="absolute -bottom-6 text-[9px] text-slate-500 whitespace-nowrap">Combined EBITDA</span>
                    </div>
                  </div>
                </div>

                <div className="mt-10 pt-4 border-t border-slate-100 text-[10px] text-slate-500 leading-relaxed">
                  How this is calculated: Combined EBITDA = $5.32M + $0K + $0K + $0K + $0K + $0K = $5.32M (each topic at its current slider values)
                </div>
              </div>

              {/* Line Chart Card */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col">
                <h3 className="text-sm font-bold text-slate-800 mb-6">FY27 monthly EBITDA: base vs combined</h3>

                <div className="flex-1 relative min-h-[200px] flex">
                  {/* Y-Axis Labels */}
                  <div className="flex flex-col justify-between text-[10px] text-slate-400 pr-4 pb-6 text-right w-12 shrink-0">
                    <span>$550K</span>
                    <span>$440K</span>
                    <span>$330K</span>
                    <span>$220K</span>
                    <span>$110K</span>
                  </div>

                  {/* Chart Area */}
                  <div className="flex-1 relative border-b border-slate-100 pb-0">
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="w-full border-t border-slate-100 border-dashed h-0"></div>
                      ))}
                    </div>

                    {/* SVG Line Chart */}
                    <div className="absolute inset-0 z-10 pb-6">
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                        {/* Confidence Band (Shaded Area) */}
                        <path
                          d="M0,80 L10,75 L20,75 L30,70 L40,65 L50,65 L60,65 L70,60 L80,60 L90,55 L100,55 L100,20 L90,20 L80,25 L70,25 L60,30 L50,30 L40,35 L30,35 L20,40 L10,40 L0,45 Z"
                          fill="#eff6ff"
                          opacity="0.7"
                        />
                        {/* Main Line */}
                        <path
                          d="M0,45 L10,40 L20,40 L30,35 L40,30 L50,30 L60,30 L70,25 L80,25 L90,20 L100,20"
                          fill="none"
                          stroke="#3b5bdb"
                          strokeWidth="1.5"
                          vectorEffect="non-scaling-stroke"
                        />
                        {/* Data Points */}
                        {[
                          [0,45], [10,40], [20,40], [30,35], [40,30], [50,30],
                          [60,30], [70,25], [80,25], [90,20], [100,20]
                        ].map((point, i) => (
                          <circle
                            key={i}
                            cx={point[0]}
                            cy={point[1]}
                            r="2.5"
                            fill="white"
                            stroke="#3b5bdb"
                            strokeWidth="1.5"
                            vectorEffect="non-scaling-stroke"
                          />
                        ))}
                      </svg>
                    </div>

                    {/* X-Axis Labels */}
                    <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[9px] text-slate-400 translate-y-6">
                      <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
                      <span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex justify-center gap-6 mt-8 text-[10px] text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0 border-t-2 border-slate-300 relative">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full border border-slate-300 bg-white"></div>
                    </div>
                    Base case
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0 border-t-2 border-blue-300 border-dashed relative">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full border border-blue-300 bg-white"></div>
                    </div>
                    Downside to upside
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0 border-t-2 border-[#3b5bdb] relative">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full border border-[#3b5bdb] bg-white"></div>
                    </div>
                    Scenario
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 text-[10px] text-slate-500 leading-relaxed">
                  How this is calculated: Month = annual EBITDA × seasonality weight. Band = all topics at downside ($2.40M) to upside ($6.04M).
                </div>
              </div>

            </section>

            {/* Top Urgent Findings Section */}
            <section>
              <div className="flex justify-between items-end mb-4">
                <h2 className="text-lg font-bold text-slate-800">Top urgent findings</h2>
                <button className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors">
                  Saved scenarios <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <FindingCard
                  title="Prairie Mills raising oat prices 9% from January"
                  category="Input costs"
                  date="Oct 8"
                  confidence="high confidence"
                  source="Primary company, Primary company"
                />
                <FindingCard
                  title="Crestline Snacks reportedly cut bar prices 12%"
                  category="Pricing and competition"
                  date="Oct 6"
                  confidence="medium confidence"
                  source="Trade press"
                />
              </div>
            </section>

          </div>
        </main>
      </div>
    </div>
  );
}

// --- Subcomponents ---

function NavItem({ icon, label, count, active, badgeColor = "bg-slate-100 text-slate-600" }) {
  return (
    <div className={`
      flex items-center justify-between px-6 py-2 cursor-pointer transition-colors
      ${active ? 'bg-blue-50/50 border-r-2 border-blue-600' : 'hover:bg-slate-50 border-r-2 border-transparent'}
    `}>
      <div className={`flex items-center gap-3 ${active ? 'text-blue-700 font-medium' : 'text-slate-600'}`}>
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      {count > 0 && (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${active ? 'bg-blue-600 text-white' : badgeColor}`}>
          {count}
        </span>
      )}
    </div>
  );
}

function AssumptionCard({ color, title, desc, status, statusColor, openCount }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 flex flex-col relative overflow-clip hover:shadow-md transition-shadow cursor-pointer">
      {/* Left Color Accent */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${color}`}></div>

      <h3 className="text-xs font-bold text-slate-800 mb-1.5">{title}</h3>
      <p className="text-[11px] text-slate-600 leading-snug flex-1 mb-4">{desc}</p>

      <div className="flex justify-between items-center mt-auto">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${statusColor}`}>
          {status}
        </span>
        <span className="text-[10px] text-slate-500 font-medium">{openCount} open</span>
      </div>
    </div>
  );
}

function FindingCard({ title, category, date, confidence, source }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 flex gap-4 items-start hover:border-blue-200 transition-colors cursor-pointer group">
      <span className="bg-red-50 text-red-700 text-[10px] font-bold px-2 py-1 rounded shrink-0 mt-0.5">
        Urgent
      </span>
      <div className="flex-1">
        <h3 className="text-sm font-bold text-slate-800 mb-1 group-hover:text-blue-700 transition-colors">{title}</h3>
        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
          <span className="text-blue-600 font-medium">{category}</span>
          <span className="text-slate-300">•</span>
          <span>{date}</span>
          <span className="text-slate-300">•</span>
          <span>{confidence}</span>
          <span className="text-slate-300">•</span>
          <span>{source}</span>
        </div>
      </div>
      <ChevronDown className="w-4 h-4 text-slate-300 -rotate-90 mt-1 group-hover:text-blue-500 transition-colors" />
    </div>
  );
}
