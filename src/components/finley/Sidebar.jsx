import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { Layers, Wand2, BookOpen, CheckSquare } from "lucide-react";
import Logo from "@/components/finley/Logo";
import { TOPIC_PAGES, topicOf } from "@/lib/finley";

export default function Sidebar({ findings, scenarioCount }) {
  const count = (label) => findings.filter((f) => topicOf(f) === label && f.review_status !== "rejected").length;
  const items = [
    { to: "/app", label: "Overview", icon: Layers, n: findings.filter((f) => f.review_status !== "rejected").length, end: true },
    ...TOPIC_PAGES.map((t) => ({ to: `/app/${t.slug}`, label: t.label, icon: t.icon, n: count(t.label) })),
    { to: "/app/scenarios", label: "Prompt scenarios", icon: Wand2, n: scenarioCount },
    { to: "/app/sources", label: "Sources", icon: BookOpen },
    { to: "/app/evals", label: "Evals", icon: CheckSquare },
  ];
  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border px-3 py-5 sticky top-0 h-screen">
      <NavLink to="/" className="px-2 mb-8"><Logo size="lg" /></NavLink>
      <p className="px-3 text-[10px] tracking-widest text-muted-foreground mb-2">TOPICS</p>
      <nav className="space-y-0.5">
        {items.map(({ to, label, icon: Icon, n, end }) => (
          <NavLink key={to} to={to} end={end} className="relative block">
            {({ isActive }) => (
              <span className={`relative flex items-center gap-2.5 px-3 py-2 rounded-full text-[13px] transition-colors ${isActive ? "text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {isActive && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                <Icon className="relative w-4 h-4" />
                <span className="relative flex-1 truncate">{label}</span>
                {!!n && <span className={`relative text-[10px] ${isActive ? "bg-accent-foreground/20 rounded-full px-1.5" : ""}`}>{n}</span>}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}