import { cn } from "@/lib/utils";

const STOP = new Set("a an and are as at be before by can could for from has have if in into is it its may might more not of on or our should so than that the their then this to was we were will with without would you your find out whether what how why which when about over under after".split(" "));

// Pulls 2-4 short key phrases out of a sentence: capitalized names and the longest content words.
export function keywords(text: string, max = 4): string[] {
  const words = text.replace(/[^\w\s%$.&-]/g, " ").split(/\s+/).map((w) => w.replace(/^[.-]+|[.-]+$/g, "")).filter(Boolean);
  const picked: string[] = [];
  const add = (w: string) => { if (!picked.some((p) => p.toLowerCase() === w.toLowerCase())) picked.push(w); };
  words.forEach((w, i) => { if (i > 0 && /^[A-Z][A-Za-z&]+$/.test(w) && !STOP.has(w.toLowerCase())) add(w); });
  words.filter((w) => /\d/.test(w)).forEach(add);
  [...words].filter((w) => !STOP.has(w.toLowerCase()) && w.length > 4).sort((a, b) => b.length - a.length).forEach(add);
  return picked.slice(0, max);
}

export function KeywordChips({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn("flex min-w-0 flex-wrap gap-1", className)} title={text} aria-label={text}>
      {keywords(text).map((k) => <span key={k} className="rounded-full border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-subtle">{k}</span>)}
    </span>
  );
}