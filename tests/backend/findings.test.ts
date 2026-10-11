import assert from "node:assert/strict";
import { resolveOutcomes } from "../../base44/functions/runPipeline/findings.ts";

// The lead's outcome verdicts are checked by code before they touch a saved finding: the P-label
// must resolve, the verdict must be held/did_not_hold, a cited development must be grounded, and a
// finding whose outcome the analyst set is never overwritten.
const dev = (id: string, grounded = true) => ({ id, grounded }) as any;
const prior = (id: string, over: Record<string, any> = {}) => ({ id, title: `Flag ${id}`, ...over });

Deno.test("resolveOutcomes: only a grounded verdict on an unjudged prior finding survives", () => {
  const out = resolveOutcomes([
    { finding_id: "p1", verdict: "held", basis: "Hynix confirmed the hike", development_ids: ["d1"] }, // lowercase ids resolve
    { finding_id: "P2", verdict: "did_not_hold", basis: "x", development_ids: ["D1"] }, // analyst-set: never overwritten
    { finding_id: "P9", verdict: "held", basis: "x", development_ids: ["D1"] }, // no such label
    { finding_id: "P1", verdict: "maybe", basis: "x", development_ids: ["D1"] }, // not a verdict (and P1 is taken anyway)
    { finding_id: "P3", verdict: "held", basis: "x", development_ids: [] }, // no citation at all
  ], [prior("f1"), prior("f2", { outcome: "held", outcome_source: "analyst" }), prior("f3")], [dev("D1")], {});
  assert.deepEqual(out, [{ id: "f1", outcome: "held", reason: "Hynix confirmed the hike" }]);
});

Deno.test("resolveOutcomes: merged ids resolve, ungrounded-only citations are dropped", () => {
  const out = resolveOutcomes([
    { finding_id: "P1", verdict: "did_not_hold", basis: "rumour denied", development_ids: ["D9"] }, // D9 merged into grounded D5
    { finding_id: "P2", verdict: "held", basis: "x", development_ids: ["D2"] }, // D2 never passed the source check
  ], [prior("f1"), prior("f2")], [dev("D5"), dev("D2", false)], { D9: "D5" });
  assert.deepEqual(out, [{ id: "f1", outcome: "did_not_hold", reason: "rumour denied" }]);
});

Deno.test("resolveOutcomes: no lead output or no earlier findings -> nothing to write", () => {
  assert.deepEqual(resolveOutcomes(undefined, [prior("f1")], [dev("D1")], {}), []);
  assert.deepEqual(resolveOutcomes([{ finding_id: "P1", verdict: "held", basis: "", development_ids: ["D1"] }], [], [dev("D1")], {}), []);
});
