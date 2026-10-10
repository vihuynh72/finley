import { secrets } from "base44:runtime";

export async function claudeJSON(system, prompt, maxTokens = 4000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": secrets.get("ANTHROPIC_API_KEY"),
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: maxTokens,
      system: system + "\nRespond with a single valid JSON object only. No markdown, no commentary.",
      messages: [{ role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error("Claude API " + res.status + ": " + (await res.text()));
  const data = await res.json();
  const text = data.content.map((c) => c.text || "").join("");
  return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
}

export function profileText(c) {
  return `Company: ${c.name} (${c.industry || ""})
Business model: ${c.business_model || ""}
Revenue streams: ${c.revenue_streams || ""}
Cost structure: ${c.cost_structure || ""}
Financial drivers: ${c.financial_drivers || ""}
Strategic objectives: ${c.strategic_objectives || ""}
Competitors: ${(c.competitors || []).join(", ")}
Financials (USD m): revenue ${c.annual_revenue}, gross margin ${c.gross_margin_pct}%, opex ${c.opex}, EV/EBITDA ${c.ev_ebitda_multiple}x
Key assumptions:
${(c.assumptions || []).map((a, i) => `[${i}] ${a.text} (driver: ${a.driver})`).join("\n")}`;
}