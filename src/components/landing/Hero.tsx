import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { HeroCard } from "@/components/landing/HeroCard";

export function Hero() {
  return (
    <section className="max-w-6xl mx-auto px-6 pt-16 pb-24 grid md:grid-cols-2 gap-12 items-center">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
          Know which forecast assumptions just{" "}
          {/* isolate keeps the -z-10 highlight behind the word but above the page background; the word wears lime-surface ink so it stays legible in dark mode */}
          <span className="relative inline-block isolate text-primary-foreground">
            <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.6, duration: 0.5 }}
              className="absolute inset-0 -mx-2 rounded-full bg-primary origin-left -z-10" />
            broke.
          </span>
        </h1>
        <p className="mt-6 text-muted-foreground max-w-md">
          Finley watches the news that matters to your clients, checks it against your forecast assumptions, and shows you the math before you change a number.
        </p>
        <div className="mt-8 flex gap-3">
          <Link to="/dashboard" search={{ demo: "netflix" } as never} className="px-5 py-2.5 rounded-full border border-border bg-card text-sm hover:bg-secondary transition">Try the demo</Link>
          <a href="#pilot" className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:brightness-95 transition">Join the pilot</a>
        </div>
      </motion.div>
      <HeroCard />
    </section>
  );
}