import { Link, Outlet } from "react-router-dom";
import { Radar, LogOut } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function AppLayout() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <Radar className="w-5 h-5 text-primary" /> SignalDesk
        </Link>
        <button onClick={() => base44.auth.logout()} className="text-muted-foreground hover:text-foreground">
          <LogOut className="w-4 h-4" />
        </button>
      </header>
      <main className="max-w-6xl mx-auto p-6"><Outlet /></main>
    </div>
  );
}