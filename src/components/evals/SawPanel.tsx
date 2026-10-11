import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AdvicePanel } from "@/components/AdvicePanel";
import { StatusPill } from "@/components/bits";
import { ScoreChip } from "@/components/ScoreChips";
import type { Status } from "@/lib/data";
import { cn } from "@/lib/utils";
import { dayLabel, type Saw } from "./view";

type Rec = Record<string, any>;
const EFFECT: Record<string, Status> = { challenged: "Challenged", under_pressure: "Under pressure", supported: "Supported", holding: "Holding" };
const H = "text-xs font-bold uppercase tracking-[0.6px] text-muted-foreground";
const human = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : "");
const safeUrl = (u: unknown) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : "");
const FIRST = 50;

function ExtLink({ url, children, className }: { url: string; children: ReactNode; className?: string }) {
  const href = safeUrl(url);
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" className={cn("hover:underline", className)}>{children}</a> : <span className={className}>{children}</span>;
}

function Finding({ f }: { f: Rec }) {
  const facts: string[] = f.facts?.length ? f.facts : f.fact ? [f.fact] : [];
  return (
    <div className="space-y-2 rounded-2xl border bg-popover p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-muted-foreground">{dayLabel(f.event_date)}{f.exposure ? ` · ${f.exposure}` : ""}{f.is_alert ? " · alert" : ""}</p>
          <p className="text-sm font-semibold">{f.title}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {EFFECT[f.effect] && <StatusPill status={EFFECT[f.effect]!} />}
          {f.materiality != null && <ScoreChip label="Mat" v={Number(f.materiality) * 20} title={`Materiality ${f.materiality} of 5`} />}
          {f.confidence != null && <ScoreChip label="Conf" v={Number(f.confidence) * 20} title={`Confidence ${f.confidence} of 5`} />}
          {f.urgency != null && <ScoreChip label="Urg" v={Number(f.urgency) * 20} title={`Urgency ${f.urgency} of 5`} />}
        </div>
      </div>
      {facts.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-sm">{facts.map((x, i) => <li key={i}>{x}</li>)}</ul>
      )}
      {(f.why_it_matters || f.interpretation) && <p className="text-xs text-subtle"><span className="text-muted-foreground">Why it matters: </span>{f.why_it_matters || f.interpretation}</p>}
      {!!f.sources?.length && (
        <p className="text-[10px] text-muted-foreground">
          {(f.sources as Rec[]).map((s, i) => (
            <span key={i}>{i > 0 && " · "}<ExtLink url={s.url}>{s.outlet || s.title}{s.tier ? ` (tier ${s.tier})` : ""}{s.date ? `, ${dayLabel(s.date)}` : ""}</ExtLink></span>
          ))}
        </p>
      )}
    </div>
  );
}

// Everything the backtest scan produced on the cutoff date, from the published snapshot alone: the
// briefing and its decision advice, the findings, the keyword plan and the news it searched.
export function SawPanel({ saw, cutoff }: { saw: Saw; cutoff: string }) {
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(false);
  const b = saw.briefing;
  const outlook = b?.outlook ?? null;
  const shown = all ? saw.sources : saw.sources.slice(0, FIRST);
  const counts = [
    b ? "the briefing" : "", `${saw.findings.length} finding${saw.findings.length === 1 ? "" : "s"}`,
    `${saw.exposures.length} exposures`, `${saw.sources.length} news items`,
  ].filter(Boolean).join(", ");

  return (
    <section className="rounded-2xl border bg-card" data-panel="saw">
      <button className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="flex items-center gap-2 text-sm font-bold">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />} What Finley saw on {dayLabel(cutoff)}
        </span>
        <span className="text-xs text-muted-foreground">{counts}</span>
      </button>
      {open && (
        <div className="space-y-8 border-t px-5 pb-6 pt-5">
          {b && (b.headline || b.summary || outlook) && (
            <div className="space-y-2">
              <p className={H}>Briefing</p>
              {b.headline && <h3 className="text-lg font-semibold">{b.headline}</h3>}
              {b.summary && <p className="max-w-3xl text-sm leading-relaxed text-subtle">{b.summary}</p>}
              {outlook?.verdict && <p className="text-sm"><span className="text-muted-foreground">Outlook: </span>{outlook.verdict}</p>}
              {outlook?.summary && outlook.summary !== b.summary && <p className="max-w-3xl text-sm text-subtle">{outlook.summary}</p>}
              {!!outlook?.conditions?.length && (
                <ul className="space-y-1 text-sm">
                  {(outlook.conditions as Rec[]).map((x, i) => (
                    <li key={i} className="rounded-lg bg-muted px-3 py-2"><b>If</b> {x.if_condition} <b>then</b> {x.then_effect}{x.signpost ? <span className="text-xs text-muted-foreground"> · Signpost: {x.signpost}</span> : null}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {!!b?.advice?.length && <AdvicePanel briefing={{ as_of: `${cutoff}T12:00:00Z`, company: { advice: b.advice, outlook: null } }} />}

          <div className="space-y-3">
            <p className={H}>Findings from the scan ({saw.findings.length})</p>
            {saw.findings.length ? saw.findings.map((f, i) => <Finding key={i} f={f} />) : <p className="text-sm text-muted-foreground">The scan saved no findings.</p>}
          </div>

          <div className="space-y-3">
            <p className={H}>Keyword plan as of {dayLabel(cutoff)} ({saw.exposures.length} exposures, {saw.keywordCount} keywords)</p>
            <div className="grid grid-cols-2 gap-3">
              {saw.exposures.map((e, i) => (
                <div key={i} className="space-y-1 rounded-2xl border bg-popover p-4">
                  <p className="text-[10px] font-medium text-muted-foreground">{human(e.category)}{e.driver ? ` · ${e.driver}` : ""}{e.sensitivity ? ` · ${e.sensitivity} sensitivity` : ""}</p>
                  <p className="text-sm font-semibold">{e.name}</p>
                  {e.why && <p className="text-xs text-subtle">{e.why}</p>}
                  {!!e.keywords?.length && (
                    <p className="flex flex-wrap gap-1 pt-1">{(e.keywords as string[]).map((k) => <span key={k} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{k}</span>)}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className={H}>News the backtest used ({saw.sources.length})</p>
            <p className="text-xs text-muted-foreground">
              {saw.sources.length} items (one per link) from {saw.outlets} outlets, dated {dayLabel(saw.firstDate)} to {dayLabel(saw.lastDate)}, every one on or before {dayLabel(cutoff)}.
              {saw.flagged ? ` ${saw.flagged} kept but flagged for naming a later year.` : ""}
            </p>
            <div className="overflow-hidden rounded-2xl border bg-popover">
              <table className="w-full text-sm" data-table="news">
                <thead className="bg-muted/60 text-left text-[10px] uppercase text-muted-foreground"><tr><th className="px-4 py-2 font-bold">Date</th><th className="font-bold">Outlet</th><th className="px-4 font-bold">Title</th></tr></thead>
                <tbody className="divide-y">
                  {shown.map((s, i) => (
                    <tr key={`${s.url}-${i}`} className="align-top">
                      <td className="num whitespace-nowrap px-4 py-2 text-xs">{dayLabel(s.date)}</td>
                      <td className="py-2 text-xs text-muted-foreground">{s.outlet || "—"}</td>
                      <td className="px-4 py-2">
                        <ExtLink url={s.url} className="inline-flex items-start gap-1">{s.title || s.url}{safeUrl(s.url) && <ExternalLink size={11} className="mt-1 shrink-0 text-muted-foreground" />}</ExtLink>
                        {s.flag && <span className="ml-2 rounded bg-warning-soft px-1.5 py-0.5 text-[10px] text-warning-ink">{s.flag}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {saw.sources.length > FIRST && (
              <button className="btn" onClick={() => setAll(!all)}>{all ? `Show the first ${FIRST}` : `Show all ${saw.sources.length}`}</button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
