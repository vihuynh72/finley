import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { claudeJSON, profileText } from "../../shared/claude.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { client_id, question } = await req.json();
    if (!client_id || !question || question.length > 1000) return Response.json({ error: "Invalid input" }, { status: 400 });
    const client = await base44.entities.Client.get(client_id);
    const page = await base44.entities.Finding.filter({ client_id }, { sort: "-priority", limit: 15 });
    const evidence = page.items.map((f) => `- ${f.title}: ${f.fact} (${(f.sources || []).map((s) => s.title).join("; ")})`).join("\n");
    const s = await claudeJSON(
      "You are a scenario agent on an FP&A team. Translate a what-if question into illustrative driver levers grounded in the company profile and collected evidence. Be conservative and explicit.",
      `${profileText(client)}\n\nCollected evidence:\n${evidence || "none"}\n\nScenario question: ${question}\n\nReturn JSON: narrative (2-4 sentences), price_change_pct, volume_change_pct, cogs_change_pct, opex_change_pct (numbers, % change vs baseline), multiple_change (EV/EBITDA turns change), lever_rationale (why these values), evidence (array of strings citing the evidence used), risks (array of what could make this wrong).`
    );
    const scenario = await base44.entities.Scenario.create({ ...s, client_id, question });
    return Response.json({ scenario });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}