import { BellOff, Newspaper, ShieldQuestion, type LucideIcon } from "lucide-react";
import { Reveal } from "@/components/landing/Reveal";

const ITEMS: [LucideIcon, string, string][] = [
  [Newspaper, "News moves faster than your forecast.", "Supplier price changes, competitor moves, and new rules land between reforecasts."],
  [BellOff, "Alerts are noise.", "Keyword alerts tell you something happened, not whether it touches your numbers."],
  [ShieldQuestion, "AI you can't check is AI you can't use.", "A confident summary without sources is a liability in finance."],
];

export function ProblemSection() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20">
      <Reveal><h2 className="text-2xl font-semibold mb-10">Why reforecasts miss things</h2></Reveal>
      <div className="grid md:grid-cols-3 gap-8">
        {ITEMS.map(([Icon, t, d], i) => (
          <Reveal key={t} delay={i * 0.1}>
            <span className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center mb-4"><Icon className="w-4 h-4" /></span>
            <h3 className="font-medium mb-2">{t}</h3>
            <p className="text-sm text-muted-foreground">{d}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
