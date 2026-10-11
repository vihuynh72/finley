import { scoresOf } from "@/lib/finley";

export default function ScorePills({ finding }) {
  const s = scoresOf(finding);
  const pills = [["Priority", s.priority, true], ["Mat", s.materiality], ["Rel", s.relevance], ["Conf", s.confidence]];
  return (
    <div className="flex flex-wrap gap-1.5">
      {pills.filter(([, v]) => v != null).map(([l, v, lead]) => (
        <span key={l} className={`text-[10px] px-2 py-0.5 rounded ${lead || v >= 80 ? "bg-primary" : "bg-secondary"}`}>{l} {Math.round(v)}</span>
      ))}
    </div>
  );
}