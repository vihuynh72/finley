import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { fmtDriver, fmtM, topicName } from "@/lib/data";
import { combinedDelta, ebitdaDelta, financials } from "@/lib/model";
import { examplesFor, parsePrompt, type ParseResult } from "@/lib/prompt";
import { useApp, useClient } from "@/lib/store";
import { Delta, Section } from "./bits";
import { BridgeChart, SimpleBars } from "./charts";

export function PromptPanel() {
  const app = useApp();
  const client = useClient();
  const [prompt, setPrompt] = useState("");
  const [res, setRes] = useState<{ q: string; r: ParseResult } | null>(null);
  const run = (q: string) => { if (q.trim()) { setPrompt(q); setRes({ q, r: parsePrompt(client, q) }); } };
  const base = financials(client);
  const scen = res ? financials(client, combinedDelta(client, res.r.values)) : null;
  const steps = res ? client.topicOrder.map((t) => ({ name: topicName(client, t), value: ebitdaDelta(client.topics[t].compute(res.r.values[t])) })).filter((s) => Math.abs(s.value) > 0.0001) : [];
  const found = !!res && (res.r.matches.length > 0 || res.r.presetsUsed.length > 0);

  return (
    <Section title="Ask a what-if question">
      <div className="card space-y-3 p-5">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(prompt); }}>
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="Scenario prompt" placeholder="e.g. What if oat prices rise 12% and diesel falls 5%?" className="flex-1 rounded border bg-background px-3 py-2 text-sm" />
          <button className="btn btn-primary" type="submit">Build scenario</button>
        </form>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="py-1 text-muted-foreground">Try:</span>
          {examplesFor(client).map((q) => <button key={q} onClick={() => run(q)} className="rounded-full border px-2.5 py-1 hover:bg-muted">{q}</button>)}
        </div>
      </div>

      {res && !found && <div className="card p-5 text-sm text-muted-foreground">Couldn't match “{res.q}” to a driver. Mention a driver and a number, like “diesel up 10%”.</div>}

      {res && found && scen && (
        <div className="grid grid-cols-3 gap-5">
          <div className="card col-span-1 space-y-3 self-start p-5 text-sm">
            <p className="text-xs text-muted-foreground">Your question</p>
            <p className="font-medium">“{res.q}”</p>
            <p className="pt-2 text-xs text-muted-foreground">How it was read</p>
            <ul className="space-y-1.5">
              {res.r.matches.map((m) => {
                const d = client.topics[m.topic].drivers.find((x) => x.id === m.driver)!;
                return <li key={m.topic + m.driver}><Link to="/topics/$topicId" params={{ topicId: m.topic }} className="text-strong hover:underline">{topicName(client, m.topic)}</Link> · {m.label}: <span className="num font-semibold">{fmtDriver(m.value, d.unit)}</span></li>;
              })}
              {res.r.presetsUsed.map((p) => <li key={p} className="capitalize">{p}</li>)}
            </ul>
            {res.r.unmatched.length > 0 && <p className="text-xs text-muted-foreground">Not understood: {res.r.unmatched.join("; ")}</p>}
            <button className="btn btn-primary w-full" onClick={() => app.saveScenario(res.q.slice(0, 60), res.r.values)}>Save scenario</button>
          </div>
          <div className="col-span-2 space-y-5">
            <div className="grid grid-cols-3 gap-3">
              {[{ l: "Revenue", s: scen.rev, b: base.rev }, { l: "Gross profit", s: scen.gp, b: base.gp }, { l: "EBITDA", s: scen.ebitda, b: base.ebitda }].map((k) => (
                <div key={k.l} className="card p-4">
                  <p className="text-xs text-muted-foreground">{k.l}</p>
                  <p className="num mt-1 text-xl font-semibold">{fmtM(k.s)}</p>
                  <p className="num text-[11px] text-muted-foreground">base {fmtM(k.b)}</p>
                  <Delta v={k.s - k.b} fmt={(n) => fmtM(n, true)} />
                </div>
              ))}
            </div>
            <div className="glass p-5">
              <h3 className="mb-2 font-sans text-sm font-semibold">EBITDA bridge by topic</h3>
              <BridgeChart start={base.ebitda} steps={steps} />
            </div>
            <div className="glass p-5">
              <h3 className="mb-2 font-sans text-sm font-semibold">Base vs this scenario</h3>
              <SimpleBars
                data={[{ label: "Revenue", base: base.rev, s: scen.rev }, { label: "Gross profit", base: base.gp, s: scen.gp }, { label: "EBITDA", base: base.ebitda, s: scen.ebitda }]}
                keys={[{ key: "base", name: "Base case", color: "var(--base-line)" }, { key: "s", name: "Scenario", color: "var(--chart)" }]}
              />
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}
