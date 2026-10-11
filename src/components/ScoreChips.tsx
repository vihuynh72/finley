import type { Score } from "@/lib/scores";
import { cn } from "@/lib/utils";

export const chipCls = (v: number) => (v >= 70 ? "bg-tint text-primary-foreground" : v >= 40 ? "bg-tint/60 text-primary-foreground" : "bg-muted text-subtle");

export function ScoreChip({ label, v, title }: { label: string; v: number; title?: string }) {
  return <span title={title} className={cn("num rounded px-2 py-0.5 text-[10px] font-bold", chipCls(v))}>{label} {v}</span>;
}

export function ScoreChips({ s }: { s: Score }) {
  return (
    <span className="flex flex-wrap gap-2 pt-0.5">
      <ScoreChip label="Priority" v={s.priority} title="50% materiality + 30% confidence + 20% urgency. Open the finding for the breakdown." />
      <ScoreChip label="Mat" v={s.materiality} title="Materiality: EBITDA impact ÷ base EBITDA, 10% = 100" />
      <ScoreChip label="Rel" v={s.reliability} title="Source reliability: average of source tier scores" />
      <ScoreChip label="Conf" v={s.confidence} title="Confidence: reliability × corroboration" />
    </span>
  );
}
