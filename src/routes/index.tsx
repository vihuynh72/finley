import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import { BellOff, Briefcase, Calculator, ChevronDown, Database, EyeOff, Newspaper, Radar, Scale, Lock, Users } from "lucide-react";
import { fmtM } from "@/lib/data";
import { Formula, StatusPill } from "@/components/bits";
import { ScoreChip } from "@/components/ScoreChips";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Finley — Know which forecast assumptions just broke" },
      { name: "description", content: "Finley checks the news against your client's forecast assumptions and shows the math before you change a number." },
      { property: "og:title", content: "Finley — Know which forecast assumptions just broke" },
      { property: "og:description", content: "Outside signals, scored sources and transparent scenarios for FP&A analysts and fractional CFOs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "auto" });

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Radar size={16} /></span>
      <span className="text-lg font-bold">Finley</span>
    </span>
  );
}

function Ctas() {
  return (
    <div className="flex flex-wrap gap-3">
      <Link to="/app" className="btn">Try the demo</Link>
      <button className="btn btn-primary" onClick={() => scrollTo("pilot")}>Join the pilot</button>
    </div>
  );
}

function Block({ id, title, children, sub }: { id?: string; title: string; sub?: string; children: ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16">
      <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
      {sub && <p className="mt-2 max-w-2xl text-muted-foreground">{sub}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Home() {
  return (
    <div className="min-h-screen text-foreground">
      <header className="sticky top-0 z-30 border-b glass rounded-none">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
          <Logo />
          <nav className="hidden flex-1 justify-center gap-6 text-sm md:flex">
            {[["how", "How it works"], ["scenarios", "Scenarios"], ["trust", "Trust"], ["faq", "FAQ"]].map(([id, l]) => (
              <button key={id} onClick={() => scrollTo(id)} className="text-muted-foreground hover:text-foreground">{l}</button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/login" className="px-2 text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
            <Link to="/app" className="btn">Try the demo</Link>
            <button className="btn btn-primary" onClick={() => scrollTo("pilot")}>Join the pilot</button>
          </div>
        </div>
      </header>

      <Hero />
      <Block title="Why reforecasts miss things">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            [Newspaper, "News moves faster than your forecast.", "Supplier price changes, competitor moves, and new rules land between reforecasts."],
            [BellOff, "Alerts are noise.", "Keyword alerts tell you something happened, not whether it touches your numbers."],
            [EyeOff, "AI you can't check is AI you can't use.", "A confident summary without sources is a liability in finance."],
          ].map(([I, h, p]: any) => (
            <div key={h}>
              <span className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-primary/20 text-foreground"><I size={18} /></span>
              <h3 className="text-lg font-semibold">{h}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p}</p>
            </div>
          ))}
        </div>
      </Block>
      <HowItWorks />
      <ScenarioDemo />
      <Trust />
      <EvalsPreview />
      <Block title="Who it's for">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="glass p-6"><span className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-primary/20 text-foreground"><Briefcase size={18} /></span><h3 className="text-lg font-semibold">Fractional CFOs</h3><p className="mt-2 text-sm text-muted-foreground">Watch several clients without reading the news for each one.</p></div>
          <div className="glass p-6"><span className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-primary/20 text-foreground"><Users size={18} /></span><h3 className="text-lg font-semibold">FP&amp;A teams</h3><p className="mt-2 text-sm text-muted-foreground">Walk into the reforecast knowing which assumptions need a second look.</p></div>
        </div>
      </Block>
      <Faq />
      <Pilot />

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-6 py-8 text-sm">
          <Logo />
          <span className="text-muted-foreground">Prototype built for the Sense AI hackathon</span>
          <span className="ml-auto flex gap-5">
            <Link to="/app" className="hover:underline">Demo</Link>
            <Link to="/evals" className="hover:underline">Evals</Link>
            <button onClick={() => scrollTo("faq")} className="hover:underline">FAQ</button>
          </span>
        </div>
      </footer>
    </div>
  );
}

function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 md:grid-cols-2">
      <div>
        <h1 className="text-5xl font-bold leading-tight tracking-tight">Know which forecast assumptions just broke.</h1>
        <p className="mt-5 max-w-lg text-lg text-muted-foreground">Finley watches the news that matters to your clients, checks it against your forecast assumptions, and shows you the math before you change a number.</p>
        <div className="mt-7"><Ctas /></div>
        <p className="mt-4 text-sm text-muted-foreground">Built for FP&amp;A analysts and fractional CFOs. You stay in control of the forecast.</p>
      </div>
      <div className="glass overflow-hidden p-4" aria-label="Dashboard preview">
        <div className="grid grid-cols-2 gap-2">
          {([["Input costs", "Challenged"], ["Pricing", "Under pressure"], ["Demand", "Supported"], ["Regulation", "Holding"]] as const).map(([t, s]) => (
            <div key={t} className="card p-3"><p className="text-xs text-muted-foreground">{t}</p><div className="mt-2"><StatusPill status={s} /></div></div>
          ))}
        </div>
        <div className="card mt-3 space-y-2 p-4 text-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">What happened</p>
          <p>Supplier announces 8% oat price increase from next quarter.</p>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">AI interpretation</p>
          <p className="text-muted-foreground">Unhedged volume would raise COGS and squeeze gross margin below the 34% assumption.</p>
          <p className="num text-2xl font-semibold text-danger-ink">−{fmtM(31.68 * 0.11 * 0.08 * 0.5)} EBITDA</p>
          <Formula>$31.68M COGS × 11% oats × 8% × (1 − 50% locked) = {fmtM(31.68 * 0.11 * 0.08 * 0.5)}</Formula>
          <p className="text-[11px] text-muted-foreground">Sample data</p>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps: [string, ReactNode][] = [
    ["Enter the assumptions behind your client's forecast. Example: \"Gross margin holds at 34%.\"",
      <div className="card flex items-center justify-between p-3 text-sm"><span>Gross margin holds at 34%</span><StatusPill status="Under pressure" /></div>],
    ["Finley checks trusted sources and flags what challenges or supports each assumption, ranked by how much it could move EBITDA.",
      <div className="card space-y-2 p-3 text-sm"><p>Oat supplier raises prices 8%</p><span className="flex flex-wrap gap-1"><ScoreChip label="Priority" v={74} /><ScoreChip label="Mat" v={56} /><ScoreChip label="Rel" v={95} /><ScoreChip label="Conf" v={76} /></span></div>],
    ["Review the evidence, run a scenario, and decide what goes into your forecast review.",
      <div className="card space-y-2 p-3 text-sm"><p className="text-xs text-muted-foreground">Oat price change · 8%</p><div className="h-1.5 rounded-full bg-muted"><div className="h-1.5 w-1/2 rounded-full bg-primary" /></div><div className="flex h-10 items-end gap-1">{[90, 30, 70].map((h, i) => <div key={i} className={i === 1 ? "w-6 bg-danger" : "w-6 bg-primary"} style={{ height: `${h}%` }} />)}</div></div>],
  ];
  return (
    <Block id="how" title="How it works">
      <ol className="space-y-6">
        {steps.map(([t, ui], i) => (
          <li key={i} className="grid items-center gap-6 md:grid-cols-[auto_1fr_320px]">
            <span className="num grid h-10 w-10 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground">{i + 1}</span>
            <p className="text-base">{t}</p>
            {ui}
          </li>
        ))}
      </ol>
    </Block>
  );
}

function ScenarioDemo() {
  const [pct, setPct] = useState(8);
  // Sample company: $48M revenue, $31.68M COGS (11% oats, half locked at current prices), $11M opex.
  const base = 48 - 31.68 - 11;
  const impact = -(31.68 * 0.11 * (pct / 100) * 0.5);
  const scen = base + impact;
  const max = base;
  const bars = [
    { l: "Base EBITDA", h: base, off: 0, cls: "bg-primary" },
    { l: "Supplier price", h: Math.abs(impact), off: scen, cls: "bg-danger" },
    { l: "Scenario EBITDA", h: scen, off: 0, cls: "bg-primary" },
  ];
  return (
    <Block id="scenarios" title="From headline to EBITDA in one click." sub="Halvorsen Foods · Sample data">
      <div className="glass grid gap-8 p-6 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Supplier price increase: <span className="num">{pct}%</span>
            <input type="range" min={0} max={15} step={0.5} value={pct} onChange={(e) => setPct(+e.target.value)} className="mt-3 w-full accent-[var(--primary)]" />
          </label>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>0%</span><span>15%</span></div>
          <p className="mt-6 text-sm text-muted-foreground">Scenario EBITDA</p>
          <p className="num text-3xl font-semibold">{fmtM(scen)} <span className="text-base text-danger-ink">{impact < 0 ? "−" : ""}{fmtM(Math.abs(impact))}</span></p>
          <p className="mt-2 text-xs text-muted-foreground">50% of oat volume is assumed locked at current prices.</p>
        </div>
        <div>
          <div className="flex h-48 items-end gap-6 border-b">
            {bars.map((b) => (
              <div key={b.l} className="flex h-full flex-1 flex-col justify-end">
                <div className={b.cls} style={{ height: `${(b.h / max) * 100}%`, marginBottom: `${(b.off / max) * 100}%`, minHeight: 2 }} />
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-6 text-center text-xs text-muted-foreground">{bars.map((b) => <span key={b.l} className="flex-1">{b.l}</span>)}</div>
          <Formula>COGS Δ = $31.68M × 11% oats × {pct}% × (1 − 50% locked) = {fmtM(-impact)}</Formula>
        </div>
      </div>
    </Block>
  );
}

function Trust() {
  const cards: [any, string, string][] = [
    [Scale, "Facts and AI opinions, always separate.", "Every finding splits what happened from what it might mean."],
    [Calculator, "Every number shows its math.", "Impacts, scores, and scenarios all show the formula with real inputs."],
    [Database, "Sources are scored, not hidden.", "Company filings and government data rank above blogs, and you can adjust any source."],
    [Lock, "It never touches your model.", "Finley suggests. You decide."],
  ];
  return (
    <Block id="trust" title="Designed for skeptics.">
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map(([I, h, p]) => <div key={h} className="glass p-6"><span className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-primary/20 text-foreground"><I size={18} /></span><h3 className="text-lg font-semibold">{h}</h3><p className="mt-2 text-sm text-muted-foreground">{p}</p></div>)}
      </div>
    </Block>
  );
}

const Q = [
  { q: "Q1", actual: 123.9, lo: 112, hi: 121 },
  { q: "Q2", actual: 97.3, lo: 93, hi: 99 },
  { q: "Q3", actual: 83.0, lo: 79, hi: 86 },
  { q: "Q4", actual: 90.1, lo: 86, hi: 93 },
];

function EvalsPreview() {
  const W = 600, H = 240, y = (v: number) => H - 30 - ((v - 70) / 60) * (H - 50);
  return (
    <Block title="We grade ourselves in public." sub="Apple FY2022 quarterly revenue: predicted range vs actual.">
      <div className="glass p-6">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Predicted range vs actual revenue">
          {Q.map((r, i) => {
            const cx = 90 + i * 140; const hit = r.actual >= r.lo && r.actual <= r.hi;
            return (
              <g key={r.q}>
                <rect x={cx - 22} y={y(r.hi)} width={44} height={y(r.lo) - y(r.hi)} rx={6} fill="var(--chart)" opacity={0.8} />
                <circle cx={cx} cy={y(r.actual)} r={6} fill="var(--foreground)" />
                <text x={cx + 12} y={y(r.actual) + 4} fontSize={12} fill={hit ? "var(--foreground)" : "var(--danger-ink)"}>${r.actual}B{hit ? "" : " · miss"}</text>
                <text x={cx} y={H - 8} fontSize={12} textAnchor="middle" fill="var(--muted-foreground)">{r.q} FY22</text>
              </g>
            );
          })}
        </svg>
        <p className="mt-4 rounded-md bg-warning px-3 py-2 text-sm text-on-bright">Backtest demo. Actual figures are from Apple's public FY2022 reports. Predicted figures are illustrative until a backtest is run.</p>
        <Link to="/evals" className="mt-4 inline-block text-sm font-medium underline">See the full evals</Link>
      </div>
    </Block>
  );
}

function Faq() {
  const items = [
    ["Does Finley change my forecast?", "No. It flags and explains. You decide what goes into the model."],
    ["Where does the data come from?", "Public sources such as company filings, press releases, government data, and trade press, each with a reliability score you can see."],
    ["How accurate is it?", "We're measuring that now through backtests and pilot feedback, and we'll publish results on the Evals page, misses included."],
    ["Is my client data safe?", "In this prototype, all data is fictional sample data. Pilot users will get details on data handling before uploading anything real."],
    ["What does it cost?", "Free during the pilot."],
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Block id="faq" title="FAQ">
      <div className="divide-y rounded-xl border">
        {items.map(([q, a], i) => (
          <div key={q}>
            <button className="flex w-full items-center justify-between px-5 py-4 text-left font-medium" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              {q}<ChevronDown size={16} className={open === i ? "rotate-180" : ""} />
            </button>
            {open === i && <p className="px-5 pb-4 text-sm text-muted-foreground">{a}</p>}
          </div>
        ))}
      </div>
    </Block>
  );
}

function Pilot() {
  const [done, setDone] = useState(false);
  const field = "mt-1.5 w-full rounded-lg border bg-card/40 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const list = JSON.parse(localStorage.getItem("finley-pilot") ?? "[]");
    localStorage.setItem("finley-pilot", JSON.stringify([...list, { ...data, at: new Date().toISOString() }]));
    setDone(true);
  };
  return (
    <Block id="pilot" title="Help shape Finley.">
      {done ? <div className="glass p-8 text-lg font-medium">Thanks. We'll be in touch about the pilot.</div> : (
        <form onSubmit={submit} className="glass grid gap-4 p-8 md:grid-cols-2">
          <label className="text-sm font-medium">Name<input name="name" required className={field} /></label>
          <label className="text-sm font-medium">Work email<input name="email" type="email" required className={field} /></label>
          <label className="text-sm font-medium">Role
            <select name="role" required className={field} defaultValue="">
              <option value="" disabled>Choose a role</option>
              {["FP&A analyst", "FP&A manager", "Fractional CFO", "Advisory firm", "Other"].map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Number of clients or business units<input name="units" type="number" min={1} required className={field} /></label>
          <label className="text-sm font-medium md:col-span-2">What's one assumption you wish you'd caught earlier? <span className="text-muted-foreground">(optional)</span>
            <textarea name="assumption" rows={3} className={field} />
          </label>
          <div className="md:col-span-2"><button type="submit" className="btn btn-primary">Join the pilot</button></div>
        </form>
      )}
    </Block>
  );
}
