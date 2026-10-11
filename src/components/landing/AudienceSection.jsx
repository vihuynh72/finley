import { Briefcase, Users } from "lucide-react";
import Reveal from "@/components/landing/Reveal";

const ITEMS = [
  [Briefcase, "Fractional CFOs", "Watch several clients without reading the news for each one."],
  [Users, "FP&A teams", "Walk into the reforecast knowing which assumptions need a second look."],
];

export default function AudienceSection() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20">
      <Reveal><h2 className="text-2xl font-semibold mb-8">Who it's for</h2></Reveal>
      <div className="grid md:grid-cols-2 gap-4">
        {ITEMS.map(([Icon, t, d], i) => (
          <Reveal key={t} delay={i * 0.1} className="rounded-2xl bg-secondary/60 border border-border p-6">
            <span className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mb-4"><Icon className="w-4 h-4" /></span>
            <h3 className="font-medium mb-1">{t}</h3>
            <p className="text-sm text-muted-foreground">{d}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}