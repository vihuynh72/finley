import { Columns2, Calculator, Star, Lock } from "lucide-react";
import Reveal from "@/components/landing/Reveal";

const ITEMS = [
  [Columns2, "Facts and AI opinions, always separate.", "Every finding splits what happened from what it might mean."],
  [Calculator, "Every number shows its math.", "Impacts, scores, and scenarios all show the formula with real inputs."],
  [Star, "Sources are scored, not hidden.", "Company filings and government data rank above blogs, and you can adjust any source."],
  [Lock, "It never touches your model.", "Finley suggests. You decide."],
];

export default function SkepticsSection() {
  return (
    <section id="trust" className="max-w-6xl mx-auto px-6 py-20">
      <Reveal><h2 className="text-2xl font-semibold mb-8">Designed for skeptics.</h2></Reveal>
      <div className="grid md:grid-cols-2 gap-4">
        {ITEMS.map(([Icon, t, d], i) => (
          <Reveal key={t} delay={i * 0.08} className="rounded-2xl bg-secondary/60 border border-border p-6 hover:-translate-y-0.5 transition-transform">
            <span className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mb-4"><Icon className="w-4 h-4" /></span>
            <h3 className="font-medium mb-1">{t}</h3>
            <p className="text-sm text-muted-foreground">{d}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}