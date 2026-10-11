import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";
import { AudienceSection } from "@/components/landing/AudienceSection";
import { BacktestSection } from "@/components/landing/BacktestSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { HeadlineDemo } from "@/components/landing/HeadlineDemo";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { LandingNav } from "@/components/landing/LandingNav";
import { PilotForm } from "@/components/landing/PilotForm";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { SkepticsSection } from "@/components/landing/SkepticsSection";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Finley — Know which forecast assumptions just broke" },
      { name: "description", content: "Finley watches the news that matters to your clients, checks it against your forecast assumptions, and shows you the math before you change a number." },
      { property: "og:title", content: "Finley — Know which forecast assumptions just broke" },
      { property: "og:description", content: "Outside signals, scored sources and transparent scenarios for FP&A analysts and fractional CFOs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <Hero />
      <ProblemSection />
      <HowItWorks />
      <HeadlineDemo />
      <SkepticsSection />
      <BacktestSection />
      <AudienceSection />
      <FaqSection />
      <PilotForm />
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-wrap gap-4 items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-3"><Logo /> Prototype built for the Sense AI hackathon</span>
          <span className="flex gap-6 tracking-widest">
            <Link to="/dashboard">DEMO</Link><Link to="/evals">EVALS</Link><a href="#faq">FAQ</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
