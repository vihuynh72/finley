import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { runAgent } from "../../shared/agent.ts";
import { profileText } from "../../shared/claude.ts";
import { clampLevers, effectOf, hasFinancials, impliedPrice, type Levers } from "../../shared/finance.ts";
import { companyMarket, snapshotText } from "../../shared/market.ts";
import { list, num, obj, str } from "../../shared/schema.ts";

// What-if questions from the dashboard: an agent sets the five model levers, code computes the result
// with the same maths as the dashboard, and the Scenario record keeps its existing shape.

const SCENARIO_SCHEMA = obj({
  narrative: str("2 to 4 sentences: the story behind the levers, without computed totals"),
  price_change_pct: num("Change in average selling price vs plan, %"), volume_change_pct: num("Change in volume vs plan, %"),
  cogs_change_pct: num("Change in unit cost of goods vs plan, %"), opex_change_pct: num("Change in operating expenses vs plan, %"),
  multiple_change: num("Change in the EV/EBITDA multiple, in turns; 0 unless the question is about valuation"),
  lever_rationale: str("Why these values, citing the evidence"),
  evidence: list(str(), "The evidence used, each with its source"),
  risks: list(str(), "What could make this wrong"),
});

const RULES = `You are the scenario analyst on Finley's FP&A team. Translate a what-if question into the five model levers (price, volume, cost of goods, operating expenses, multiple), grounded in the company profile and the evidence collected. Be conservative and explicit about every assumption. Code computes EBITDA, enterprise value and any share price from your levers, so set the levers only and never write computed totals. Findings the analyst validated are the strongest evidence.`;

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { client_id, question } = await req.json();
    if (!client_id || !question || question.length > 1000) return Response.json({ error: "Invalid input" }, { status: 400 });
    const client = await base44.entities.Client.get(client_id);
    const [page, market] = await Promise.all([base44.entities.Finding.filter({ client_id }, { sort: "-priority", limit: 30 }), companyMarket(client)]);
    // Rejected findings are left out; validated or incorporated ones come first.
    const rank = (f) => (f.incorporate || f.review_status === "validated" ? 0 : 1);
    const usable = page.items.filter((f) => f.review_status !== "rejected").sort((a, b) => rank(a) - rank(b)).slice(0, 15);
    const evidence = usable.map((f) => `- ${f.title} (${f.review_status}): ${f.fact} [${(f.sources || []).map((s) => s.title).join("; ")}]`).join("\n");
    const raw = await runAgent<Levers & { narrative: string; lever_rationale: string; evidence: string[]; risks: string[] }>({
      name: "scenario/what-if", system: RULES, schema: SCENARIO_SCHEMA, effort: "medium",
      prompt: `Today is ${new Date().toISOString().slice(0, 10)}.\n\n<client_profile>\n${profileText(client)}\n</client_profile>\n\n<market_data>\n${snapshotText(market)}\n</market_data>\n\n<evidence>\n${evidence || "none"}\n</evidence>\n\nWhat-if question: ${question}`,
    });
    const s = { ...raw, ...clampLevers(raw) }; // the model's levers get the same bounds as the pipeline's
    // The computed result, so a share-price or value question gets a number with its basis spelled out.
    // It names the levers it used: the analyst can edit the levers later, and the text must stay true.
    if (hasFinancials(client)) {
      const e = effectOf(client, s);
      const sign = (n: number) => `${n >= 0 ? "+" : ""}${n}`;
      const valued = client.ev_ebitda_multiple > 0; // no multiple entered: no enterprise value or share price to give
      const ev = valued ? `, enterprise value ${sign(e.ev_persistent_pct)}%` : "";
      const price = valued && market.snapshot?.close > 0 ? `; implied share price ${impliedPrice(market.snapshot.close, e.ev_persistent_pct)} from the ${market.snapshot.close_date} close of ${market.snapshot.close}, assuming net debt is small` : "";
      s.narrative = `${s.narrative} Illustrative, not a forecast, at the levers first proposed (price ${sign(s.price_change_pct)}%, volume ${sign(s.volume_change_pct)}%, COGS ${sign(s.cogs_change_pct)}%, opex ${sign(s.opex_change_pct)}%, multiple ${sign(s.multiple_change)}x): EBITDA $${e.scenario.ebitda.toFixed(1)}m (${sign(e.ebitda_delta)}m)${ev}${price}.`;
    }
    const scenario = await base44.entities.Scenario.create({ ...s, client_id, question });
    return Response.json({ scenario });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
