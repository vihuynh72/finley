import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtM } from "@/lib/data";

const axis = { fontSize: 9, fontFamily: "Plus Jakarta Sans", fill: "var(--muted-foreground)" };
const grid = <CartesianGrid stroke="var(--border)" vertical={false} />;
const tipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, fontFamily: "Plus Jakarta Sans", boxShadow: "0 14px 30px -20px rgb(0 0 0 / 0.2)" };

function MultiTick(props: any) {
  const { x, y, payload, maxChars = 12, maxLines = 2, fontSize = 10 } = props;
  const words = String(payload?.value ?? "").split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= maxChars) cur += " " + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  const show = lines.slice(0, maxLines);
  if (lines.length > maxLines) show[show.length - 1] = show[show.length - 1] + "…";
  return (
    <g>
      {show.map((ln, i) => (
        <text key={i} x={x} y={y + 14 + i * 12} textAnchor="middle" fontSize={fontSize} fontFamily="Plus Jakarta Sans" fill="var(--muted-foreground)">{ln}</text>
      ))}
    </g>
  );
}

function RotatedTick(props: any) {
  const { x, y, payload, fontSize = 9 } = props;
  const v = String(payload?.value ?? "");
  const label = v.length > 18 ? v.slice(0, 17) + "…" : v;
  return <text x={x} y={y + 10} textAnchor="end" fontSize={fontSize} fontFamily="Plus Jakarta Sans" fill="var(--muted-foreground)" transform={`rotate(-32 ${x} ${y + 10})`}>{label}</text>;
}

const legendFmt = (v: any) => <span style={{ color: "var(--foreground)" }}>{v}</span>;

export function useAnim() {
  return false;
}

type MonthRow = { month: string; base: number; scenario: number; band: [number, number] };

function MonthTip({ active, payload }: { active?: boolean; payload?: { payload: MonthRow }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0]!.payload; const d = r.scenario - r.base;
  return (
    <div style={tipStyle} className="p-2 text-foreground">
      <div className="font-sans font-medium">{r.month}</div>
      <div>Base: {fmtM(r.base)}</div>
      <div className="text-strong">Scenario: {fmtM(r.scenario)}</div>
      <div className={d >= 0 ? "text-success-ink" : "text-danger-ink"}>Difference: {fmtM(d, true)}</div>
      <div className="text-muted-foreground">Range: {fmtM(r.band[0])} – {fmtM(r.band[1])}</div>
    </div>
  );
}

export function MonthlyChart({ data }: { data: MonthRow[] }) {
  const anim = useAnim();
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={(v) => fmtM(v)} width={64} domain={["auto", "auto"]} />
        <Tooltip content={<MonthTip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={legendFmt} />
        <Area dataKey="band" name="Downside to upside" stroke="none" fill="var(--chart)" fillOpacity={0.12} isAnimationActive={anim} />
        <Line dataKey="base" name="Base case" stroke="var(--base-line)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={anim} />
        <Line dataKey="scenario" name="Scenario" stroke="var(--chart)" strokeWidth={4} dot={{ r: 3, fill: "var(--chart)", strokeWidth: 0 }} isAnimationActive={anim} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Bar colours: totals, increases, decreases, and steps too small to see. The overview uses the
// Figma palette (olive increases, ink decreases); the topic pages keep ink and red.
export type BridgePalette = { total: string; up: string; down: string; zero: string };
const BRIDGE: BridgePalette = { total: "var(--chart)", up: "var(--strong)", down: "var(--danger)", zero: "var(--border)" };

export function BridgeChart({ start, steps, startLabel = "Base EBITDA", endLabel = "Scenario EBITDA", palette = BRIDGE, height }: {
  start: number; steps: { name: string; value: number }[]; startLabel?: string; endLabel?: string; palette?: BridgePalette; height?: number;
}) {
  const anim = useAnim();
  let run = start;
  const rows = [{ name: startLabel, inv: 0, val: start, kind: "total", raw: start }];
  for (const s of steps) {
    const lo = Math.min(run, run + s.value);
    rows.push({ name: s.name, inv: lo, val: Math.abs(s.value), kind: s.value >= 0 ? "up" : "down", raw: s.value });
    run += s.value;
  }
  rows.push({ name: endLabel, inv: 0, val: run, kind: "total", raw: run });
  const tiny = Math.max(Math.abs(start), 1) * 0.001;
  const color = (r: { kind: string; raw: number }) => (r.kind === "total" ? palette.total : Math.abs(r.raw) < tiny ? palette.zero : r.kind === "up" ? palette.up : palette.down);
  return (
    <ResponsiveContainer width="100%" height={height ?? (rows.length > 6 ? 282 : 274)}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="name" interval={0} axisLine={false} tickLine={false} height={rows.length > 6 ? 64 : 58}
          tick={rows.length > 6 ? <RotatedTick /> : <MultiTick maxChars={rows.length > 4 ? 12 : 16} maxLines={3} />} />
        <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={(v) => fmtM(v)} width={64} domain={[0, "auto"]} />
        <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tipStyle} itemStyle={{ color: "var(--foreground)" }} labelStyle={{ color: "var(--foreground)" }}
          formatter={(_v, n, p) => (n === "val" ? [p.payload.kind === "total" ? fmtM(p.payload.raw) : fmtM(p.payload.raw, true), "EBITDA"] : [null, null])} />
        <Bar dataKey="inv" stackId="a" fill="transparent" isAnimationActive={anim} />
        <Bar dataKey="val" stackId="a" radius={[3, 3, 0, 0]} isAnimationActive={anim}>
          {rows.map((r, i) => <Cell key={i} fill={color(r)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TornadoChart({ rows }: { rows: { name: string; low: number; high: number }[] }) {
  const anim = useAnim();
  return (
    <ResponsiveContainer width="100%" height={Math.max(120, rows.length * 56 + 40)}>
      <BarChart data={rows} layout="vertical" stackOffset="sign" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tick={axis} tickFormatter={(v) => fmtM(v, true)} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={axis} width={170} axisLine={false} tickLine={false} />
        <ReferenceLine x={0} stroke="var(--base-line)" />
        <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tipStyle} itemStyle={{ color: "var(--foreground)" }} labelStyle={{ color: "var(--foreground)" }} formatter={(v, n) => [fmtM(Number(v), true), n]} />
        <Bar dataKey="low" name="At slider minimum" stackId="t" isAnimationActive={anim}>
          {rows.map((r, i) => <Cell key={i} fill={r.low >= 0 ? "var(--chart)" : "var(--danger)"} />)}
        </Bar>
        <Bar dataKey="high" name="At slider maximum" stackId="t" isAnimationActive={anim}>
          {rows.map((r, i) => <Cell key={i} fill={r.high >= 0 ? "var(--chart)" : "var(--danger)"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SimpleBars({ data, keys }: { data: Record<string, string | number>[]; keys: { key: string; name: string; color: string }[] }) {
  const anim = useAnim();
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="label" tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} tickFormatter={(v) => fmtM(v)} width={64} />
        <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tipStyle} itemStyle={{ color: "var(--foreground)" }} labelStyle={{ color: "var(--foreground)" }} formatter={(v) => fmtM(Number(v))} />
        <Legend wrapperStyle={{ fontSize: 12 }} formatter={legendFmt} />
        {keys.map((k) => <Bar key={k.key} dataKey={k.key} name={k.name} fill={k.color} fillOpacity={0.85} radius={[4, 4, 0, 0]} isAnimationActive={anim} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

// Overview "Financial performance": one plan-year series as a lime area, the plan as a dashed line.
export function PerformanceChart({ data, label }: { data: { month: string; base: number; scenario: number }[]; label: string }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="month" tick={{ ...axis, fontSize: 10 }} axisLine={false} tickLine={false} interval={3} tickFormatter={(v) => String(v).split(" ")[0]} />
        <YAxis tick={{ ...axis, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtM(v)} width={64} domain={["auto", "auto"]} />
        <Tooltip contentStyle={tipStyle} cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "4 4" }}
          formatter={(v, n) => [fmtM(Number(v)), n === "scenario" ? `${label}, current scenario` : `${label}, plan`]} />
        <Area type="linear" dataKey="scenario" stroke="var(--chart)" strokeWidth={2.5} fill="var(--chart)" fillOpacity={0.15} isAnimationActive={false}
          activeDot={{ r: 7, fill: "var(--strong)", stroke: "#fff", strokeWidth: 3 }} dot={false} />
        <Line dataKey="base" stroke="var(--base-line)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Half-donut gauge: the lime arc is the share (0-1), drawn over an ink track.
export function Gauge({ share }: { share: number }) {
  const r = 90, cx = 110, cy = 110, w = 22;
  const pt = (f: number) => [cx - r * Math.cos(Math.PI * f), cy - r * Math.sin(Math.PI * f)];
  const arc = (f: number) => { const [x0, y0] = pt(0), [x1, y1] = pt(Math.min(0.9999, Math.max(0, f))); return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`; };
  return (
    <svg viewBox="0 0 220 124" className="mx-auto h-[150px] w-full" role="img" aria-label={`${Math.round(share * 100)}%`}>
      <path d={arc(1)} stroke="var(--strong)" strokeWidth={w} fill="none" strokeLinecap="round" />
      {share > 0 && <path d={arc(share)} stroke="var(--chart)" strokeWidth={w} fill="none" strokeLinecap="round" />}
    </svg>
  );
}