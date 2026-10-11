import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { base44 } from "@/api/base44Client";
import ScorePills from "@/components/finley/ScorePills";
import { topicOf } from "@/lib/finley";

const Block = ({ label, children }) => children ? (
  <div className="mb-4"><p className="text-[10px] tracking-widest text-muted-foreground mb-1">{label}</p><p className="text-sm">{children}</p></div>
) : null;

export default function FindingSheet({ finding: f, onClose, onChanged }) {
  const review = async (review_status) => { await base44.entities.Finding.update(f.id, { review_status }); onChanged(); onClose(); };
  return (
    <Sheet open={!!f} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-background">
        {f && <>
          <SheetHeader><p className="text-[10px] tracking-widest text-muted-foreground uppercase">{topicOf(f)}</p><SheetTitle className="text-left">{f.title}</SheetTitle></SheetHeader>
          <div className="my-4"><ScorePills finding={f} /></div>
          <Block label="WHAT HAPPENED">{f.fact}</Block>
          <Block label="AI INTERPRETATION">{f.interpretation}</Block>
          <Block label="WHY IT MATTERS">{f.why_it_matters}</Block>
          {f.impact?.rationale && <Block label="ILLUSTRATIVE IMPACT (NOT A FORECAST)">{f.impact.rationale}</Block>}
          <Block label="NEXT STEP">{f.next_step}</Block>
          <Block label="UNCERTAINTY">{f.uncertainty}</Block>
          <p className="text-[10px] tracking-widest text-muted-foreground mb-1">SOURCES</p>
          <ul className="space-y-1 mb-6">{(f.sources || []).map((s) => (
            <li key={s.url} className="text-sm"><a href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">{s.title}</a> <span className="text-muted-foreground text-xs">{s.date}</span></li>
          ))}</ul>
          <div className="flex gap-2">
            <button onClick={() => review("validated")} className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium">Accept</button>
            <button onClick={() => review("rejected")} className="flex-1 rounded-lg border border-border bg-card py-2 text-sm">False alarm</button>
          </div>
        </>}
      </SheetContent>
    </Sheet>
  );
}