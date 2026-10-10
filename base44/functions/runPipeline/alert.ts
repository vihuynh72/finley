import { snapshotText } from "../../shared/market.ts";

// The urgent-alert email: only alerts saved by this run (repeats are never saved, so the same story
// doesn't re-alert every day), sent to the analyst who ran the scan. Built from a fixed template; the
// model writes nothing here, and every piece of text is HTML-escaped. Never throws.

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
// Links come from scraped data, so only http(s) URLs become clickable.
const safeUrl = (url: string) => (/^https?:\/\//i.test(url || "") ? esc(url) : "#");

export async function sendAlertEmail(base44: any, to: string, client: Record<string, any>, alerts: Record<string, any>[],
  market: { snapshot: any; note: string }, coverage: string) {
  const finding_ids = alerts.map((f) => f.id);
  if (!alerts.length) return { status: "no_alerts", to, subject: "", sent_at: "", finding_ids, error: "" };
  if (!to) return { status: "no_recipient", to, subject: "", sent_at: "", finding_ids, error: "The analyst who ran the scan has no email address" };
  const subject = `Urgent: ${client.name} - ${alerts[0].title}${alerts.length > 1 ? ` (+${alerts.length - 1} more)` : ""}`.slice(0, 200);
  const sections = alerts.map((f) => [
    `<h3>${esc(f.title)}</h3>`,
    `<p><b>What happened:</b> ${esc(f.fact)}</p>`,
    `<p><b>Why it matters:</b> ${esc(f.why_it_matters)}</p>`,
    f.impact ? `<p><b>Illustrative impact (scenario, not a forecast):</b> ${esc(f.impact.rationale)}</p>` : "",
    `<p><b>Scores:</b> materiality ${f.materiality}/5, confidence ${f.confidence}/5, urgency ${f.urgency}/5. ${esc(f.uncertainty)}</p>`,
    `<p><b>Next step:</b> ${esc(f.next_step)}</p>`,
    `<p><b>Sources:</b> ${(f.sources || []).map((s: any) => `<a href="${safeUrl(s.url)}">${esc(s.title)}</a>`).join(" &middot; ")}</p>`,
  ].join("\n"));
  const body = [`<p>${esc(snapshotText(market))}</p>`, ...sections,
    `<hr><p style="color:#666">Sent because materiality &ge; 4, confidence &ge; 3 and urgency &ge; 4. ${esc(coverage)} Nothing in your model has been changed: review and decide in the dashboard.</p>`].join("\n<hr>\n");
  try {
    await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body });
    return { status: "sent", to, subject, sent_at: new Date().toISOString(), finding_ids, error: "" };
  } catch (error) {
    return { status: "failed", to, subject, sent_at: "", finding_ids, error: String((error as Error).message).slice(0, 300) };
  }
}
