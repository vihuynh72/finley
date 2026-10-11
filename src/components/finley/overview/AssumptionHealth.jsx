import { STATUS } from "@/lib/finley";

export default function AssumptionHealth({ client }) {
  const list = client.assumptions || [];
  const challenged = list.filter((a) => a.status === "challenged" || a.status === "under_review").length;
  return (
    <div className="rounded-2xl bg-card border border-border p-5 h-full">
      <p className="text-[10px] tracking-widest text-muted-foreground">ASSUMPTION HEALTH</p>
      <p className="text-3xl font-light mt-1 mb-4">{challenged}<span className="text-sm text-muted-foreground"> / {list.length} need a look</span></p>
      <ul className="space-y-2">
        {list.map((a) => {
          const s = STATUS[a.status] || STATUS.monitoring;
          return (
            <li key={a.text} className="flex items-start justify-between gap-2 text-xs">
              <span className="text-foreground/80">{a.text}</span>
              <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ${s.cls}`}>{s.label}</span>
            </li>
          );
        })}
        {!list.length && <li className="text-xs text-muted-foreground">No assumptions on this client yet.</li>}
      </ul>
    </div>
  );
}