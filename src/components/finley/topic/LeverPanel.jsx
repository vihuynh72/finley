import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Slider } from "@/components/ui/slider";

const TABS = ["base", "downside", "upside", "custom"];

export default function LeverPanel({ def, values, preset, onPreset, onChange, formula, onSave, onSend, saving }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-5 h-fit">
      <div className="grid grid-cols-4 p-1 rounded-lg border border-border mb-5 text-xs">
        {TABS.map((t) => (
          <button key={t} onClick={() => onPreset(t)} className={`py-1.5 rounded-md capitalize transition-colors ${preset === t ? "bg-primary font-medium" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>
      {def.levers.map((l) => (
        <div key={l.key} className="mb-5">
          <div className="flex justify-between items-center mb-3 gap-2">
            <label className="text-sm font-medium">{l.label}</label>
            <input type="number" value={values[l.key]} min={l.min} max={l.max}
              onChange={(e) => onChange(l.key, Math.min(l.max, Math.max(l.min, Number(e.target.value) || 0)))}
              className="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm text-right" />
          </div>
          <Slider value={[values[l.key]]} min={l.min} max={l.max} step={0.5} onValueChange={([v]) => onChange(l.key, v)} />
          <p className="text-[10px] text-muted-foreground mt-2">base {l.base}{l.unit} · range {l.min}{l.unit} to {l.max}{l.unit}</p>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground border-t border-border pt-3 mb-4">How this is calculated: {formula}</p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <button onClick={onSave} disabled={saving} className="rounded-lg bg-primary py-2 font-medium flex items-center justify-center gap-1">{saving && <Loader2 className="w-3 h-3 animate-spin" />}Save scenario</button>
        <button onClick={() => onPreset("base")} className="rounded-lg border border-border py-2">Reset to base</button>
        <button onClick={onSend} className="rounded-lg border border-border py-2">Send to forecast review</button>
        <Link to="/app/scenarios" className="rounded-lg border border-border py-2 text-center">View saved</Link>
      </div>
    </div>
  );
}