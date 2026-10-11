import { Link } from "@tanstack/react-router";
import {
  BarChart3, Building2, ChevronDown, Cpu, Database, FlaskConical, Gavel, Globe, Landmark, LayoutDashboard, Loader2, LogIn, LogOut, Moon, Plus,
  Radar, ShoppingCart, Sun, Tag, Truck, Users, Wheat, X,
} from "lucide-react";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
type LucideIcon = ComponentType<{ size?: number; className?: string }>;
import { base44 } from "@/api/base44Client";
import { topicName } from "@/lib/data";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { FindingDrawer } from "./FindingDrawer";

// Topic tabs come from the client's keyword plan, so their icon follows the exposure's category.
const ICONS: Record<string, LucideIcon> = {
  company_specific: Building2, pricing_competition: Tag, demand_customers: ShoppingCart, input_costs: Wheat, supply_chain: Truck,
  regulation_policy: Gavel, geopolitics_trade: Globe, labor_talent: Users, macro_financial: Landmark, technology_shifts: Cpu,
};
const dueLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function NavItem({ to, params, icon: I, label, count, urgent, exact }: {
  to: string; params?: Record<string, string>; icon: LucideIcon; label: string; count?: number; urgent?: boolean; exact?: boolean;
}) {
  return (
    <Link to={to} params={params as never} activeOptions={{ exact: !!exact }}
      className="group flex items-center justify-between gap-3 rounded-full px-3 py-2 text-sm font-medium text-subtle hover:bg-sidebar-hover"
      activeProps={{ className: "nav-active" }}>
      <span className="flex min-w-0 items-center gap-3">
        <I size={14} className="shrink-0 text-sidebar-muted group-[.nav-active]:text-primary" />
        <span className="truncate">{label}</span>
      </span>
      {!!count && (
        <span className={cn("num shrink-0 rounded-full px-2 text-[11px]",
          urgent ? "bg-danger text-on-danger" : "text-sidebar-muted group-[.nav-active]:bg-white/20 group-[.nav-active]:text-white")}>{count}</span>
      )}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const app = useApp();
  const client = app.client;
  const [dark, setDark] = useState(false);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  const order = client?.topicOrder ?? [];
  const totalOpen = order.reduce((n, t) => n + app.openCount(t).count, 0);
  const anyUrgent = order.some((t) => app.openCount(t).urgent);

  return (
    <div className="flex min-h-screen text-foreground">
      <aside className="sidebar sticky top-0 flex h-screen w-[280px] shrink-0 flex-col gap-[39px] overflow-y-auto border-r p-6">
        <Link to="/dashboard" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Radar size={18} /></span>
          <span className="text-xl font-bold tracking-[-0.5px] text-foreground">Finley</span>
        </Link>
        <div className="space-y-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.88px] text-sidebar-muted">Topics</p>
          <nav className="space-y-1">
            <NavItem to="/dashboard" exact icon={LayoutDashboard} label="Overview" count={totalOpen} urgent={anyUrgent} />
            {client && order.map((t) => {
              const o = app.openCount(t);
              return <NavItem key={t} to="/topics/$topicId" params={{ topicId: t }} icon={ICONS[client.topics[t]?.category ?? ""] ?? Building2}
                label={topicName(client, t)} count={o.count} urgent={o.urgent} />;
            })}
            <NavItem to="/scenarios" icon={BarChart3} label="Prompt scenarios" count={app.saved.length} />
            <NavItem to="/sources" icon={Database} label="Sources" />
            <NavItem to="/evals" icon={FlaskConical} label="Evals" />
          </nav>
        </div>
        <div className="mt-auto space-y-3">
          <Link to="/clients/new" className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-subtle hover:bg-sidebar-hover">
            <Plus size={14} className="text-sidebar-muted" /> New client
          </Link>
          <p className="rounded-xl bg-sidebar-hover p-3 text-xs leading-relaxed text-sidebar-muted">
            Finley never edits your model. It flags what to look at, and you decide what goes into the forecast.
          </p>
          {app.user ? (
            <button className="flex items-center gap-2 px-3 text-xs text-sidebar-muted hover:text-foreground" onClick={() => base44.auth.logout("/")}>
              <LogOut size={12} /> Sign out{app.user["email"] ? ` · ${app.user["email"]}` : ""}
            </button>
          ) : (
            <Link to="/login" className="flex items-center gap-2 px-3 text-xs text-sidebar-muted hover:text-foreground">
              <LogIn size={12} /> Sign in to scan, save and run backtests
            </Link>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-6 border-b bg-background px-8">
          <label className="flex items-center gap-4">
            <span className="text-xs font-medium uppercase tracking-[0.6px] text-muted-foreground">Client</span>
            <span className="relative inline-flex items-center">
              <select value={app.clientId} onChange={(e) => app.setClientId(e.target.value)}
                className="appearance-none rounded-lg border bg-card py-1.5 pl-3 pr-8 text-sm font-semibold text-foreground">
                {app.clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.evalCase ? " (backtest)" : ""}</option>)}
              </select>
              <ChevronDown size={14} className="pointer-events-none -ml-6 block shrink-0 self-center text-muted-foreground" />
            </span>
          </label>
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-medium text-muted-foreground">
              {client?.reforecastDue ? <>Reforecast due {dueLabel(client.reforecastDue)} · </> : null}
              {app.scanning ? `${app.scanStage || "Scanning"}…` : `Last scan ${app.lastScan}`}
            </span>
            <button className="grid h-8 w-8 place-items-center rounded-full border border-border bg-muted text-subtle" aria-label="Toggle dark mode" onClick={() => setDark(!dark)}>
              {dark ? <Sun size={12} /> : <Moon size={12} />}
            </button>
          </div>
        </header>
        {client?.evalCase && (
          <div className="border-b bg-banner px-8 py-1.5 text-xs text-muted-foreground">
            Backtest client: this profile and its findings are frozen as of the case's cutoff date. See Evals for how they held up.
          </div>
        )}
        <main className="mx-auto w-full min-w-0 max-w-[1400px] px-8 pb-8 pt-[31px]">{children}</main>
      </div>

      <FindingDrawer />
      {app.toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border bg-popover px-4 py-3 text-sm shadow-lg">
          {app.toast}<button aria-label="Close" onClick={() => app.notify("")}><X size={14} /></button>
        </div>
      )}
    </div>
  );
}