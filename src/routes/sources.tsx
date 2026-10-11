import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { allSources, sourceTier, TIER_DESC, TIER_SCORE, type Tier } from "@/lib/scores";
import { useApp } from "@/lib/store";
import { Section } from "@/components/bits";

export const Route = createFileRoute("/sources")({
  head: () => ({
    meta: [
      { title: "Sources — Finley" },
      { name: "description", content: "Every source Finley reads, with its reliability tier, score, findings contributed and analyst agreement rate." },
      { property: "og:title", content: "Sources — Finley" },
      { property: "og:description", content: "Source reliability tiers and analyst overrides." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Sources,
});

function Sources() {
  const app = useApp();
  const rows = allSources(app.client);
  const [editing, setEditing] = useState<string | null>(null);
  const [tier, setTier] = useState<Tier>(2);
  const [reason, setReason] = useState("");

  const agreement = (ids: string[]) => {
    const reviewed = ids.filter((id) => app.findingStatus(id) !== "open");
    if (!reviewed.length) return null;
    return Math.round((reviewed.filter((id) => ["review", "research"].includes(app.findingStatus(id))).length / reviewed.length) * 100);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <p className="text-sm text-muted-foreground">All clients</p>
        <h1 className="text-3xl font-semibold">Sources</h1>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {([1, 2, 3, 4] as Tier[]).map((t) => (
          <div key={t} className="card p-4">
            <p className="text-xs font-medium text-muted-foreground">Tier {t}</p>
            <p className="num text-2xl font-semibold">{TIER_SCORE[t]}</p>
            <p className="mt-1 text-xs text-muted-foreground">{TIER_DESC[t]}</p>
          </div>
        ))}
      </div>

      <Section title="Source reliability">
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr><th className="px-4 py-2 font-medium">Source</th><th className="font-medium">Type</th><th className="font-medium">Tier</th><th className="font-medium">Reliability</th><th className="font-medium">Findings</th><th className="font-medium">Analyst agreement</th><th /></tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const o = app.overrides[r.name];
                const t = sourceTier(r, app.overrides);
                const ag = agreement(r.findings);
                return (
                  <tr key={r.name} className="align-top">
                    <td className="px-4 py-2.5 font-medium">{r.name}
                      {o && <div className="mt-1 text-xs font-normal text-muted-foreground"><span className="mr-1 rounded bg-tint px-1.5 py-0.5 text-strong">Adjusted by analyst</span>Tier {r.defaultTier} → {o.tier} · “{o.reason}” · {o.at}</div>}
                      {editing === r.name && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 font-normal">
                          <select value={tier} onChange={(e) => setTier(Number(e.target.value) as Tier)} className="rounded-md border bg-card px-2 py-1 text-xs">
                            {([1, 2, 3, 4] as Tier[]).map((x) => <option key={x} value={x}>Tier {x} ({TIER_SCORE[x]})</option>)}
                          </select>
                          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required)" className="w-56 rounded-md border bg-background px-2 py-1 text-xs" />
                          <button className="btn btn-primary text-xs" disabled={!reason.trim()} onClick={() => { app.setOverride(r.name, tier, reason.trim()); setEditing(null); }}>Save</button>
                          <button className="btn text-xs" onClick={() => setEditing(null)}>Cancel</button>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 text-muted-foreground">{r.type}</td>
                    <td className="num py-2.5">Tier {t}</td>
                    <td className="num py-2.5">{TIER_SCORE[t]}</td>
                    <td className="num py-2.5">{r.findings.length}</td>
                    <td className="num py-2.5" title="Share of this source's reviewed findings that analysts added to review or marked needs research">{ag === null ? <span className="text-muted-foreground">Not reviewed yet</span> : `${ag}%`}</td>
                    <td className="py-2.5 pr-4 text-right">
                      {o ? <button className="text-xs text-strong underline" onClick={() => app.setOverride(r.name, null, "")}>Reset</button>
                        : <button className="text-xs text-strong underline" onClick={() => { setEditing(r.name); setTier(r.defaultTier); setReason(""); }}>Override tier</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
