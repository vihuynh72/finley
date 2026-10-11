import { Link } from "react-router-dom";
import LandingNav from "@/components/landing/LandingNav";
import Hero from "@/components/landing/Hero";
import ProblemSection from "@/components/landing/ProblemSection";
import HowItWorks from "@/components/landing/HowItWorks";
import HeadlineDemo from "@/components/landing/HeadlineDemo";
import SkepticsSection from "@/components/landing/SkepticsSection";
import BacktestSection from "@/components/landing/BacktestSection";
import AudienceSection from "@/components/landing/AudienceSection";
import FaqSection from "@/components/landing/FaqSection";
import PilotForm from "@/components/landing/PilotForm";
import Logo from "@/components/finley/Logo";

export default function Landing() {
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
            <Link to="/app">DEMO</Link><Link to="/app/evals">EVALS</Link><a href="#faq">FAQ</a>
          </span>
        </div>
      </footer>
    </div>
  );
}