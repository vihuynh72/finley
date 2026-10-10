import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { claudeJSON } from "../../shared/claude.ts";

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { notes } = await req.json();
    if (!notes || notes.length > 20000) return Response.json({ error: "Notes required (max 20k chars)" }, { status: 400 });
    const profile = await claudeJSON(
      "You are an FP&A analyst structuring a company intelligence profile from raw notes.",
      `Structure these notes into JSON with keys: name, industry, business_model, revenue_streams, cost_structure, financial_drivers, strategic_objectives (strings), competitors (array of strings), annual_revenue, gross_margin_pct, opex, ev_ebitda_multiple (numbers, USD millions; estimate reasonably if missing), assumptions (array of {text, driver}). Notes:\n${notes}`
    );
    return Response.json({ profile });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}