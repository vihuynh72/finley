import { motion } from "framer-motion";
import { Reveal } from "@/components/landing/Reveal";

const STEPS = [
  'Enter the assumptions behind your client\'s forecast. Example: "Gross margin holds at 34%."',
  "Finley checks trusted sources and flags what challenges or supports each assumption, ranked by how much it could move EBITDA.",
  "Review the evidence, run a scenario, and decide what goes into your forecast review.",
];

export function HowItWorks() {
  return (
    <section id="how" className="bg-secondary/60 py-20">
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <Reveal><h2 className="text-2xl font-semibold mb-8">How it works</h2></Reveal>
          {STEPS.map((s, i) => (
            <Reveal key={i} delay={i * 0.1} className="flex gap-4 mb-6">
              <span className="w-6 h-6 shrink-0 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">{i + 1}</span>
              <p className="text-sm">{s}</p>
            </Reveal>
          ))}
        </div>
        <div className="space-y-3">
          <Reveal className="rounded-xl bg-card border border-border p-4 flex justify-between text-sm">
            Gross margin holds at 34% <span className="text-[11px] px-2 py-0.5 rounded bg-warning-line text-warning-ink">Under pressure</span>
          </Reveal>
          <Reveal delay={0.1} className="rounded-xl bg-card border border-border p-4 text-sm">
            Oat supplier raises prices 8%
            <div className="flex gap-1.5 mt-2 text-[11px]">
              {["Priority 74", "Mat 56", "Rel 95", "Conf 76"].map((t, i) => (
                <span key={t} className={`px-2 py-0.5 rounded ${i === 0 || i === 2 ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{t}</span>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.2} className="rounded-xl bg-card border border-border p-4 text-sm">
            Oat price change: 8%
            <div className="flex items-end gap-1.5 h-10 mt-2">
              {[60, 90, 40, 75].map((h, i) => (
                <motion.span key={i} initial={{ height: 0 }} whileInView={{ height: `${h}%` }} viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.1 }} className="w-4 rounded-sm bg-primary" />
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
