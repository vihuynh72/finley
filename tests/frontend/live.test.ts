// Frontend mappers (src/lib) under Deno: run with --unstable-sloppy-imports for the extensionless imports.
import assert from "node:assert/strict";
import { NETFLIX_2023 } from "../../base44/shared/eval/cases.ts";
import { dbStatus, scanLabel, shortDate, toClient, uiStatus } from "../../src/lib/live.ts";
import { recsFor } from "../../src/lib/recs.ts";
import { combinedDelta, defaultClientValues, ebitdaDelta, financials } from "../../src/lib/model.ts";

const plan = { exposures: [
  { name: "Password sharing crackdown", category: "company_specific", driver: "Paid memberships", why: "Paid sharing could add members", sensitivity: "high", keywords: ["Netflix password sharing"] },
  { name: "Streaming price war", category: "pricing_competition", driver: "Pricing", why: "Rivals' prices cap ARM", sensitivity: "medium", keywords: ["streaming price increase"] },
  { name: "Content production costs", category: "input_costs", driver: "Content costs", why: "Amortization", sensitivity: "medium", keywords: ["Hollywood strike"] },
] };
const client = { id: "c1", ...NETFLIX_2023.profile };
const finding = {
  id: "f1", title: "Netflix to charge for password sharing in 2023", exposure: "Password sharing crackdown", topic_key: "company_specific",
  is_alert: true, materiality: 4, confidence: 4, urgency: 4, priority: 64, effect: "supported", event_date: "2022-12-15",
  facts: ["Netflix said it will roll out paid sharing more broadly in early 2023."], why_it_matters: "Could lift paid memberships.",
  sources: [{ title: "Netflix plans paid sharing (Reuters)", url: "https://www.reuters.com/x", outlet: "Reuters", type: "Trade press", tier: 2 }],
  impact_inputs: { pnl_line: "volume", shock_pct: 4, exposure_pct: 100 }, review_status: "validated", run_id: "r1",
};

Deno.test("a client's tabs are its keyword plan's exposures, and findings land on the exposure that found them", () => {
  const c = toClient(client, plan, [finding]);
  assert.deepEqual(c.topicOrder, ["password-sharing-crackdown", "streaming-price-war", "content-production-costs"]);
  assert.equal(c.topics["streaming-price-war"].assumption, "Price increases and the ad plan keep ARM at least flat"); // the client's own assumption for that driver
  const f = c.findings[0];
  assert.equal(f.topicId, "password-sharing-crackdown");
  assert.equal(f.severity, "urgent");
  assert.equal(f.confidence, "high");
  assert.equal(f.effect, "Supported");
  assert.equal(f.date, "Dec 15, 2022");
  assert.deepEqual(f.sources, [{ name: "Reuters", type: "Trade press", tier: 2, url: "https://www.reuters.com/x", title: "Netflix plans paid sharing (Reuters)" }]);
  assert.deepEqual(f.scenario, { vol: 4 });
  assert.ok(c.planned);
});

Deno.test("without a plan, the client's assumptions stand in as tabs", () => {
  const c = toClient(client, null, []);
  assert.equal(c.topicOrder.length, NETFLIX_2023.profile.assumptions.length);
  assert.ok(!c.planned);
  const vals = defaultClientValues(c);
  assert.equal(financials(c, combinedDelta(c, vals)).ebitda, financials(c).ebitda); // base values change nothing
});

Deno.test("review statuses round-trip between the dashboard and Finding.review_status", () => {
  for (const s of ["open", "review", "research", "dismissed"] as const) assert.equal(uiStatus(dbStatus(s)), s);
  assert.equal(uiStatus(undefined), "open");
});

Deno.test("recommendations follow fixed rules from the strongest finding per tab", () => {
  const c = toClient(client, plan, [finding, { ...finding, id: "f2", exposure: "Content production costs", effect: "challenged", confidence: 4,
    impact_inputs: { pnl_line: "cogs", shock_pct: 8, exposure_pct: 30 }, title: "Writers' strike threatens 2023 slate", change_view: "How long the strike lasts" }]);
  const recs = recsFor(c);
  const up = recs.find((r) => r.findings.includes("f1"))!;
  assert.equal(up.label, "Change assumption, upside only");
  assert.ok(up.upside! > 0);
  const down = recs.find((r) => r.findings.includes("f2"))!;
  assert.equal(down.type, "Change assumption");
  const t = c.topics["content-production-costs"];
  assert.equal(down.base, ebitdaDelta(t.compute({ shock: 8, exposure: 30, pass: 0 })));
  assert.ok(down.base! < 0);
});

Deno.test("date labels", () => {
  const now = new Date("2026-10-10T15:00:00Z");
  assert.equal(shortDate("2026-10-08", now), "Oct 8");
  assert.equal(scanLabel("", now), "never");
  assert.match(scanLabel("2026-10-10T09:40:00Z", now), /^today, /);
});

Deno.test("a regulation finding found only by company searches still lands on the regulation tab", async () => {
  const plan2 = { exposures: [...plan.exposures, { name: "Streaming content rules", category: "regulation_policy", driver: "", why: "Local content quotas", sensitivity: "low", keywords: ["EU streaming quota"] }] };
  const c = toClient(client, plan2, [{ ...finding, id: "f3", exposure: "", topic_key: "regulation" }]);
  assert.equal(c.findings[0].topicId, "streaming-content-rules");
});

Deno.test("chips use the pipeline's 0-100 scores; a tier override recomputes reliability and priority", async () => {
  const { scoreFinding } = await import("../../src/lib/scores.ts");
  const scored = { ...finding, scores: { priority: 77, materiality: 80, relevance: 95, confidence: 80, urgency: 60 } };
  const c = toClient(client, plan, [scored]);
  const f = c.findings[0];
  const s = scoreFinding(c, f, {});
  assert.equal(s.basis, "pipeline");
  assert.deepEqual([s.priority, s.materiality, s.reliability, s.confidence, s.urgency], [77, 80, 95, 80, 60]);
  const o = scoreFinding(c, f, { Reuters: { tier: 4, reason: "test", at: "" } });
  assert.ok(o.overridden);
  assert.equal(o.reliability, 25); // Tier 4
  assert.equal(o.priority, Math.round(0.35 * 80 + 0.25 * 25 + 0.2 * 80 + 0.2 * 60));
  const old = scoreFinding(toClient(client, plan, [finding]), toClient(client, plan, [finding]).findings[0], {});
  assert.equal(old.basis, "computed"); // findings saved before the pipeline scored them
});
