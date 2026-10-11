import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

const LINKS: [string, string][] = [["How it works", "#how"], ["Scenarios", "#scenarios"], ["Trust", "#trust"], ["FAQ", "#faq"]];

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur border-b border-border">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden md:flex gap-6 text-sm text-muted-foreground">
            {LINKS.map(([l, h]) => <a key={h} href={h} className="hover:text-foreground transition-colors">{l}</a>)}
          </nav>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link to="/login" className="px-3 py-1.5 hover:text-muted-foreground">Sign in</Link>
          <Link to="/dashboard" search={{ demo: "netflix" } as never} className="hidden sm:inline px-4 py-1.5 rounded-full border border-border bg-card hover:bg-secondary transition">Try the demo</Link>
          <a href="#pilot" className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground font-medium hover:brightness-95 transition">Join the pilot</a>
        </div>
      </div>
    </header>
  );
}