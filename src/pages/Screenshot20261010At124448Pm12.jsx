import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  DollarSign,
  Tag,
  ShoppingCart,
  Truck,
  Scale,
  Bookmark,
  ChevronDown,
  Moon,
  ArrowRight,
  Menu,
  X
} from 'lucide-react';

// --- Mock Data ---

const sidebarItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, count: 6, active: true },
  { id: 'input-costs', label: 'Input costs', icon: DollarSign, count: 1 },
  { id: 'pricing', label: 'Pricing and competition', icon: Tag, count: 2 },
  { id: 'demand', label: 'Demand and customers', icon: ShoppingCart, count: 1 },
  { id: 'logistics', label: 'Logistics and freight', icon: Truck, count: 1 },
  { id: 'regulation', label: 'Regulation', icon: Scale, count: 1 },
  { id: 'saved', label: 'Saved scenarios', icon: Bookmark, count: 2, divider: true },
];

const assumptionCards = [
  {
    id: 1,
    title: 'Input costs',
    description: 'Gross margin holds at 34%',
    status: 'Challenged',
    openCount: 1,
    colorTheme: 'red',
  },
  {
    id: 2,
    title: 'Pricing and competition',
    description: 'Bar line pricing stays flat on the $14.0M bar line',
    status: 'Under pressure',
    openCount: 2,
    colorTheme: 'orange',
  },
  {
    id: 3,
    title: 'Demand and customers',
    description: 'Grocery expansion adds $4.2M (35 Greenway stores at ~$120K each)',
    status: 'Supported',
    openCount: 1,
    colorTheme: 'green',
  },
  {
    id: 4,
    title: 'Logistics and freight',
    description: 'Freight cost per case is stable at $1.85 across 2.4M cases ($4.44M)',
    status: 'Holding',
    openCount: 1,
    colorTheme: 'blue',
  },
  {
    id: 5,
    title: 'Regulation',
    description: 'No new regulatory costs in FY27',
    status: 'Holding',
    openCount: 1,
    colorTheme: 'blue',
  },
];

const urgentFindings = [
  {
    id: 1,
    title: 'Prairie Mills raising oat prices 9% from January',
    category: 'Input costs',
    date: 'Oct 8',
    confidence: 'high confidence',
    source: 'Primary company, Primary company',
    status: 'Urgent',
  },
  {
    id: 2,
    title: 'Crestline Snacks reportedly cut bar prices 12%',
    category: 'Pricing and competition',
    date: 'Oct 6',
    confidence: 'medium confidence',
    source: 'Trade press',
    status: 'Urgent',
  },
];

// --- Helper Functions ---

const getColorClasses = (theme) => {
  const themes = {
    red: {
      borderL: 'border-l-[#dc2626]',
      badgeBg: 'bg-[#fef2f2]',
      badgeText: 'text-[#b91c1c]',
    },
    orange: {
      borderL: 'border-l-[#ea580c]',
      badgeBg: 'bg-[#fff7ed]',
      badgeText: 'text-[#c2410c]',
    },
    green: {
      borderL: 'border-l-[#16a34a]',
      badgeBg: 'bg-[#f0fdf4]',
      badgeText: 'text-[#15803d]',
    },
    blue: {
      borderL: 'border-l-[#2563eb]',
      badgeBg: 'bg-[#eff6ff]',
      badgeText: 'text-[#1d4ed8]',
    },
  };
  return themes[theme] || themes.blue;
};

// --- Components ---

export default function SignalDeskDashboard() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900 flex flex-col overflow-clip">

      {/* --- Header --- */}
      <header className="bg-white border-b border-slate-200 flex-shrink-0 z-20 relative">
        <div className="flex items-center justify-between px-4 md:px-6 py-3">

          {/* Left: Logo & Mobile Toggle */}
          <div className="flex items-center gap-4">
            <button
              className="md:hidden p-1 text-slate-500 hover:bg-slate-100 rounded-md"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-[#2563eb] rounded-md flex items-center justify-center text-white font-bold text-sm shadow-sm">
                S
              </div>
              <span className="font-semibold text-[17px] tracking-tight hidden sm:block">SignalDesk</span>
            </div>
          </div>

          {/* Center: Client Selector (Hidden on very small screens) */}
          <div className="hidden sm:flex items-center gap-3 text-sm">
            <span className="text-slate-500 font-medium">Client</span>
            <button className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-md bg-white hover:bg-slate-50 transition-colors font-medium shadow-sm">
              Halvorsen Foods <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Right: Status & Actions */}
          <div className="flex items-center gap-3 md:gap-5 text-sm">
            <div className="hidden lg:flex items-center gap-4 text-slate-500">
              <span>Reforecast due <strong className="text-slate-900 font-semibold">Oct 24</strong></span>
              <span>Last scan today, 12:38 PM</span>
            </div>
            <button className="bg-[#2563eb] text-white px-4 py-1.5 rounded-md font-medium hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap">
              Scan sources now
            </button>
            <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors hidden sm:block">
              <Moon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-header Banner */}
        <div className="bg-[#f1f5f9] py-1.5 text-center border-t border-slate-200">
          <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">
            Sample data for testing. All companies and sources are fictional.
          </p>
        </div>
      </header>

      {/* --- Main Layout --- */}
      <div className="flex flex-1 overflow-clip relative">

        {/* --- Sidebar --- */}
        <aside className={`
          absolute md:relative z-10 w-64 bg-white border-r border-slate-200 h-full flex flex-col transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="p-4 flex-1 overflow-y-auto">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">Topics</h3>
            <nav className="space-y-0.5">
              {sidebarItems.map((item, idx) => (
                <React.Fragment key={item.id}>
                  {item.divider && <div className="h-px bg-slate-100 my-3 mx-2" />}
                  <a
                    href="#"
                    className={`
                      flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors
                      ${item.active
                        ? 'bg-[#eff6ff] text-[#1d4ed8]'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className={`w-4 h-4 ${item.active ? 'text-[#2563eb]' : 'text-slate-400'}`} />
                      {item.label}
                    </div>
                    {item.count > 0 && (
                      <span className={`
                        text-[11px] px-2 py-0.5 rounded-full font-bold
                        ${item.active ? 'bg-[#bfdbfe] text-[#1e40af]' : 'bg-slate-100 text-slate-500'}
                      `}>
                        {item.count}
                      </span>
                    )}
                  </a>
                </React.Fragment>
              ))}
            </nav>
          </div>

          {/* Sidebar Footer Note */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            <div className="bg-slate-100 rounded-lg p-3 text-xs text-slate-500 leading-relaxed">
              SignalDesk never edits your model. It flags what to look at, and you decide.
            </div>
          </div>
        </aside>

        {/* Mobile Overlay */}
        {isMobileMenuOpen && (
          <div
            className="absolute inset-0 bg-slate-900/20 z-0 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* --- Main Content Area --- */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10">
          <div className="max-w-[1200px] mx-auto space-y-10">

            {/* Page Title */}
            <div>
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 tracking-tight">
                Halvorsen Foods
              </h1>
            </div>

            {/* --- Section: Assumptions by topic --- */}
            <section className="space-y-4">
              <h2 className="text-lg font-bold text-slate-900">Assumptions by topic</h2>

              {/* Horizontal Scrollable Container for Cards */}
              <div className="flex overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory hide-scrollbar">
                <div className="flex gap-4 min-w-max md:min-w-0 md:grid md:grid-cols-3 lg:grid-cols-5 w-full">
                  {assumptionCards.map((card, i) => {
                    const colors = getColorClasses(card.colorTheme);
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.4 }}
                        key={card.id}
                        className={`
                          bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3
                          w-[260px] md:w-auto snap-start shrink-0
                          border-l-[3px] ${colors.borderL}
                        `}
                      >
                        <h4 className="text-[13px] text-slate-500 font-medium leading-tight">{card.title}</h4>
                        <p className="text-[14px] font-semibold text-slate-900 leading-snug flex-1">
                          {card.description}
                        </p>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                          <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold tracking-wide uppercase ${colors.badgeBg} ${colors.badgeText}`}>
                            {card.status}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">{card.openCount} open</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* --- Section: Charts --- */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Chart 1: Bar Chart (Simulated) */}
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6 flex flex-col"
              >
                <h3 className="text-[15px] font-bold text-slate-900 mb-6">Combined scenario EBITDA bridge</h3>

                {/* Chart Area */}
                <div className="flex-1 flex min-h-[240px] relative">
                  {/* Y-Axis */}
                  <div className="flex flex-col justify-between text-[11px] text-slate-400 pr-4 pb-6 font-medium text-right w-14 shrink-0">
                    <span>$5.32M</span>
                    <span>$5.25M</span>
                    <span>$5.18M</span>
                    <span>$5.11M</span>
                    <span>$5.04M</span>
                  </div>

                  {/* Grid Lines & Bars */}
                  <div className="flex-1 relative border-b border-slate-200 flex items-end justify-between px-4 pb-0">
                    {/* Horizontal Grid Lines */}
                    <div className="absolute inset-0 flex flex-col justify-between pb-6 pointer-events-none">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="w-full border-t border-slate-100 border-dashed h-0" />
                      ))}
                    </div>

                    {/* Bars (Simulated data points) */}
                    <div className="relative z-10 w-12 min-h-[90%] bg-[#2563eb] rounded-t-sm" />
                    <div className="relative z-10 w-12 h-0 bg-transparent" /> {/* Input */}
                    <div className="relative z-10 w-12 h-0 bg-transparent" /> {/* Pricing */}
                    <div className="relative z-10 w-12 h-0 bg-transparent" /> {/* Demand */}
                    <div className="relative z-10 w-12 h-0 bg-transparent" /> {/* Logistics */}
                    <div className="relative z-10 w-12 h-0 bg-transparent" /> {/* Regulation */}
                    <div className="relative z-10 w-12 min-h-[90%] bg-[#2563eb] rounded-t-sm" />
                  </div>
                </div>

                {/* X-Axis Labels */}
                <div className="flex justify-between text-[10px] text-slate-400 font-medium pl-14 pt-3">
                  <span className="w-12 text-center">Base EBITDA</span>
                  <span className="w-12 text-center">Input</span>
                  <span className="w-12 text-center">Pricing</span>
                  <span className="w-12 text-center">Demand</span>
                  <span className="w-12 text-center">Logistics</span>
                  <span className="w-12 text-center">Regulation</span>
                  <span className="w-12 text-center">Combined EBITDA</span>
                </div>

                {/* Footer Note */}
                <p className="text-[11px] text-slate-500 mt-6 leading-relaxed">
                  How this is calculated: Combined EBITDA = $5.32M + $0K + $0K + $0K + $0K + $0K = $5.32M (each topic at its current slider values)
                </p>
              </motion.div>

              {/* Chart 2: Line Chart (Simulated with SVG) */}
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6 flex flex-col"
              >
                <h3 className="text-[15px] font-bold text-slate-900 mb-6">FY27 monthly EBITDA: base vs combined</h3>

                {/* Chart Area */}
                <div className="flex-1 flex min-h-[240px] relative">
                  {/* Y-Axis */}
                  <div className="flex flex-col justify-between text-[11px] text-slate-400 pr-4 pb-8 font-medium text-right w-14 shrink-0">
                    <span>$550K</span>
                    <span>$440K</span>
                    <span>$330K</span>
                    <span>$220K</span>
                    <span>$110K</span>
                  </div>

                  {/* SVG Chart */}
                  <div className="flex-1 relative border-b border-slate-200">
                    {/* Horizontal Grid Lines */}
                    <div className="absolute inset-0 flex flex-col justify-between pb-8 pointer-events-none">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="w-full border-t border-slate-100 border-dashed h-0" />
                      ))}
                    </div>

                    <svg className="absolute inset-0 w-full h-[calc(100%-2rem)] overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                      {/* Shaded Area (Downside to upside) */}
                      <path
                        d="M 0,80 L 10,75 L 20,75 L 30,75 L 40,70 L 50,70 L 60,70 L 70,70 L 80,65 L 90,65 L 100,65 L 100,20 L 90,20 L 80,20 L 70,25 L 60,25 L 50,25 L 40,25 L 30,30 L 20,30 L 10,30 L 0,35 Z"
                        fill="#eff6ff"
                        opacity="0.6"
                      />
                      {/* Main Line (Scenario) */}
                      <path
                        d="M 0,45 L 10,40 L 20,40 L 30,40 L 40,35 L 50,35 L 60,35 L 70,35 L 80,30 L 90,30 L 100,30"
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Data Points */}
                      {[
                        [0, 45], [10, 40], [20, 40], [30, 40], [40, 35],
                        [50, 35], [60, 35], [70, 35], [80, 30], [90, 30], [100, 30]
                      ].map((point, i) => (
                        <circle key={i} cx={point[0]} cy={point[1]} r="2" fill="white" stroke="#2563eb" strokeWidth="1.5" />
                      ))}
                    </svg>
                  </div>
                </div>

                {/* X-Axis Labels */}
                <div className="flex justify-between text-[10px] text-slate-400 font-medium pl-14 pt-3">
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(month => (
                    <span key={month} className="text-center">{month}</span>
                  ))}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-6 mt-4 text-[11px] font-medium text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-slate-300 relative"><div className="absolute w-1.5 h-1.5 rounded-full border border-slate-300 bg-white -top-0.5 left-0.5" /></div>
                    Base case
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-[#eff6ff] border border-blue-100 rounded-sm" />
                    Downside to upside
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-[#2563eb] relative"><div className="absolute w-1.5 h-1.5 rounded-full bg-[#2563eb] -top-0.5 left-0.5" /></div>
                    <span className="text-[#2563eb]">Scenario</span>
                  </div>
                </div>

                {/* Footer Note */}
                <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">
                  How this is calculated: Month = annual EBITDA × seasonality weight. Band = all topics at downside ($2.40M) to upside ($6.04M).
                </p>
              </motion.div>

            </section>

            {/* --- Section: Top urgent findings --- */}
            <section className="space-y-4 pb-10">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Top urgent findings</h2>
                <a href="#" className="text-[13px] font-medium text-[#2563eb] hover:text-blue-800 flex items-center gap-1 transition-colors">
                  Saved scenarios <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-clip flex flex-col divide-y divide-slate-100">
                {urgentFindings.map((finding, i) => (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.4 }}
                    key={finding.id}
                    className="p-4 md:p-5 flex flex-col sm:flex-row sm:items-start gap-4 hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    {/* Badge */}
                    <div className="shrink-0 pt-0.5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide bg-[#fef2f2] text-[#b91c1c]">
                        {finding.status}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-1.5">
                      <h4 className="text-[15px] font-bold text-slate-900 group-hover:text-[#2563eb] transition-colors">
                        {finding.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-500">
                        <span className="font-medium text-[#2563eb]">{finding.category}</span>
                        <span className="text-slate-300">•</span>
                        <span>{finding.date}</span>
                        <span className="text-slate-300">•</span>
                        <span>{finding.confidence}</span>
                        <span className="text-slate-300">•</span>
                        <span>{finding.source}</span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="shrink-0 hidden sm:flex items-center justify-center pt-2 text-slate-300 group-hover:text-[#2563eb] transition-colors">
                      <ChevronDown className="w-5 h-5 -rotate-90" />
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

          </div>
        </main>
      </div>
    </div>
  );
}
