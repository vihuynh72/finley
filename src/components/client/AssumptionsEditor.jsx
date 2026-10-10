import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

export default function AssumptionsEditor({ value, onChange }) {
  const set = (i, k, v) => onChange(value.map((a, j) => (j === i ? { ...a, [k]: v } : a)));
  return (
    <div className="space-y-2">
      {value.map((a, i) => (
        <div key={i} className="flex gap-2">
          <Input className="flex-[3]" placeholder="Assumption, e.g. CAC stays below $400" value={a.text} onChange={(e) => set(i, "text", e.target.value)} />
          <Input className="flex-1" placeholder="Driver, e.g. CAC" value={a.driver} onChange={(e) => set(i, "driver", e.target.value)} />
          <Button type="button" size="icon" variant="ghost" onClick={() => onChange(value.filter((_, j) => j !== i))}><X className="w-4 h-4" /></Button>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...value, { text: "", driver: "", status: "monitoring" }])}>
        <Plus className="w-4 h-4 mr-1" />Add assumption
      </Button>
    </div>
  );
}