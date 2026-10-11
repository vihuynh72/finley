import { Link } from "react-router-dom";
import { Loader2, Plus, User } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const lastScan = (d) => d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "never";

export default function TopBar({ clients, clientId, setClientId, client, active, onScan }) {
  return (
    <div className="h-14 border-b border-border flex items-center justify-between px-6 sticky top-0 bg-background/90 backdrop-blur z-30">
      <div className="flex items-center gap-3">
        <span className="text-[10px] tracking-widest text-muted-foreground">CLIENT</span>
        <Select value={clientId || ""} onValueChange={setClientId}>
          <SelectTrigger className="h-8 w-40 bg-card text-sm"><SelectValue placeholder="Choose client" /></SelectTrigger>
          <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Link to="/app/clients/new" className="text-muted-foreground hover:text-foreground" title="Add client"><Plus className="w-4 h-4" /></Link>
      </div>
      <div className="flex items-center gap-4">
        <span className="hidden lg:inline text-[11px] text-muted-foreground">Last scan {lastScan(client?.last_run_at)}</span>
        <button onClick={onScan} disabled={active || !client} className="px-4 py-1.5 rounded-full bg-primary text-xs font-medium flex items-center gap-1.5 disabled:opacity-60 hover:brightness-95 transition">
          {active && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{active ? "Scanning…" : "Scan sources now"}
        </button>
        <Link to="/login" title="Sign in"><User className="w-4 h-4" /></Link>
      </div>
    </div>
  );
}