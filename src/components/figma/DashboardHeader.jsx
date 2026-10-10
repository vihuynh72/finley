import { ChevronDown, Moon, Loader2, Play } from "lucide-react";
import moment from "moment";

export default function DashboardHeader({ clients, selectedClientId, onSelectClient, client, run, active, onScan }) {
  const lastScan = client?.last_run_at ? moment(client.last_run_at).format("MMM D, h:mm A") : "Never";

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-10">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2 text-blue-700 font-bold text-lg tracking-tight">
          <div className="w-6 h-6 bg-blue-700 rounded flex items-center justify-center text-white text-xs">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          SignalDesk
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Client</span>
          <div className="relative inline-block">
            <select
              value={selectedClientId || ""}
              onChange={(e) => onSelectClient(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 pl-3 pr-8 py-1.5 rounded-md hover:bg-slate-100 transition-colors font-medium text-sm cursor-pointer focus:outline-none"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-4 text-slate-500">
          <span>Reforecast due <strong className="text-slate-700 font-semibold">Oct 24</strong></span>
          <span>Last scan {lastScan}</span>
        </div>
        <button
          onClick={onScan}
          disabled={active}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-1.5 rounded-md font-medium transition-colors flex items-center gap-2"
        >
          {active ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {active ? "Scanning…" : "Scan sources now"}
        </button>
        <button className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors">
          <Moon className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}