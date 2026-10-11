import type { QuarterRow } from "./view";

type Row = Pick<QuarterRow, "id" | "q" | "span" | "actual" | "lo" | "mid" | "hi" | "hit">;

// Predicted range (box), its midpoint (bar) and the reported actual (dot) for each quarter, with a
// tick or cross for whether the actual landed inside the range. Shared by the Evals and landing pages.
export function RangeChart({ rows, label = "Predicted range vs actual revenue by quarter" }: { rows: Row[]; label?: string }) {
  const vals = rows.flatMap((r) => [r.actual, r.lo, r.hi].filter((v) => v != null) as number[]);
  if (!vals.length) return null;
  const min = Math.floor(Math.min(...vals) * 0.97 * 2) / 2, max = Math.ceil(Math.max(...vals) * 1.03 * 2) / 2;
  const W = 760, HH = 280, pad = { l: 52, r: 16, t: 16, b: 40 };
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * (HH - pad.t - pad.b);
  const step = (W - pad.l - pad.r) / rows.length;
  // Gridlines at round values, labelled exactly (quarters of the span put "$8.3B" on 8.25).
  const span = max - min || 1;
  const tickStep = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50].find((s) => span / s <= 6) ?? span / 4;
  const digits = Math.round(tickStep * 100) % 10 ? 2 : 1;
  const ticks: number[] = [];
  for (let t = Math.ceil(min / tickStep - 1e-9) * tickStep; t <= max + 1e-9; t += tickStep) ticks.push(Number(t.toFixed(4)));
  return (
    <svg viewBox={`0 0 ${W} ${HH}`} className="w-full" role="img" aria-label={label}>
      {ticks.map((t) => (
        <g key={t}><line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" /><text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={10} fill="var(--muted-foreground)">${t.toFixed(digits)}B</text></g>
      ))}
      {rows.map((r, i) => {
        const cx = pad.l + step * i + step / 2;
        return (
          <g key={r.id}>
            {r.lo != null && r.hi != null && <rect x={cx - 22} y={y(r.hi)} width={44} height={Math.max(2, y(r.lo) - y(r.hi))} rx={6} fill="var(--chart)" fillOpacity={0.6} stroke="var(--strong)" strokeOpacity={0.3}><title>{`Predicted $${r.lo}B–$${r.hi}B`}</title></rect>}
            {r.mid != null && <line x1={cx - 26} x2={cx + 26} y1={y(r.mid)} y2={y(r.mid)} stroke="var(--strong)" strokeWidth={2.5}><title>{`Midpoint $${r.mid}B`}</title></line>}
            <circle cx={cx} cy={y(r.actual)} r={6} fill="var(--foreground)"><title>{`Actual $${r.actual}B`}</title></circle>
            <g transform={`translate(${cx + 32}, ${y(r.actual) - 9})`}>
              <circle cx={9} cy={9} r={9} fill={r.hit ? "var(--success)" : "var(--danger)"} />
              <text x={9} y={13} textAnchor="middle" fontSize={12} fontWeight={700} fill={r.hit ? "var(--on-bright)" : "#fff"}>{r.hit ? "✓" : "✕"}</text>
            </g>
            <text x={cx} y={HH - 20} textAnchor="middle" fontSize={12} fill="var(--foreground)">{r.q}</text>
            <text x={cx} y={HH - 6} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)">{r.span}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function RangeLegend() {
  return (
    <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5"><span className="h-3 w-4 rounded-sm" style={{ background: "var(--chart)" }} /> Predicted 80% range (with news)</span>
      <span className="flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: "var(--strong)" }} /> Midpoint</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-foreground" /> Actual (reported)</span>
    </div>
  );
}
