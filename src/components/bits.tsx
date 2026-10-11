import type { ReactNode } from "react";
import type { Status } from "@/lib/data";
import { cn } from "@/lib/utils";

export const statusTone: Record<Status, { pill: string; stripe: string }> = {
  Challenged: { pill: "border-danger-line bg-danger-soft text-danger-ink", stripe: "bg-danger" },
  "Under pressure": { pill: "border-warning-line bg-warning-soft text-warning-ink", stripe: "bg-warning" },
  Supported: { pill: "border-primary bg-tint text-primary-foreground", stripe: "bg-primary" },
  Holding: { pill: "border-border bg-muted text-subtle", stripe: "bg-base-line" },
};

export function StatusPill({ status }: { status: Status }) {
  return <span className={cn("shrink-0 rounded border px-3 py-1 text-[10px] font-bold uppercase", statusTone[status].pill)}>{status}</span>;
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="text-sm font-bold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Formula({ children }: { children: ReactNode }) {
  return (
    <p className="num mt-2 text-[10px] font-medium italic leading-relaxed text-muted-foreground">
      <span>How this is calculated: </span>{children}
    </p>
  );
}

export function Delta({ v, fmt, invert }: { v: number; fmt: (n: number) => string; invert?: boolean }) {
  const good = invert ? v < 0 : v > 0;
  if (Math.abs(v) < 1e-9) return <span className="num text-[9px] text-muted-foreground">no change</span>;
  return <span className={cn("num text-[9px] font-bold", good ? "text-success-ink" : "text-danger-ink")}>{fmt(v)}</span>;
}
