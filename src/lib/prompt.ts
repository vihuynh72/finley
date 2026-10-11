import { fmtDriver, type Client, type TopicId } from "./data";
import { defaultClientValues, presetValues, type ClientValues } from "./model";

export interface Match { topic: TopicId; driver: string; label: string; value: number; from: string }
export interface ParseResult { values: ClientValues; matches: Match[]; presetsUsed: string[]; unmatched: string[] }

const STOP = new Set(["the", "of", "a", "an", "to", "at", "if", "what", "we", "our", "and", "by", "in", "on", "for", "is", "be", "with", "change", "price", "per", "share", "happens", "would", "how", "does", "do", "much"]);
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
const stem = (w: string) => w.replace(/(ing|es|s|ed)$/, "");

const SYN: Record<string, string> = { fuel: "diesel", gas: "diesel", oats: "oat", wages: "wage", salary: "wage", pay: "wage", hygienist: "wage", reimbursement: "rate", stores: "store", discount: "cut", visits: "visit", patients: "visit", tariff: "fee", packaging: "fee", hedge: "locked", hedged: "locked", lock: "locked" };

export function parsePrompt(client: Client, prompt: string): ParseResult {
  const values = defaultClientValues(client);
  const matches: Match[] = []; const presetsUsed: string[] = []; const unmatched: string[] = [];
  const clauses = prompt.split(/,|;|\band\b|\bplus\b|\bwhile\b|\.\s/i).map((c) => c.trim()).filter(Boolean);

  for (const clause of clauses) {
    const lc = clause.toLowerCase();
    const cw = words(clause).map((w) => stem(SYN[w] ?? w));
    let best: { t: TopicId; id: string; score: number } | null = null;
    for (const t of client.topicOrder) {
      const topic = client.topics[t];
      const topicWords = [...words(topic.subject), ...words(topic.name)].map(stem);
      for (const d of topic.drivers) {
        const dw = [...words(d.label), d.id].map(stem);
        const score = cw.filter((w) => dw.includes(w)).length * 2 + cw.filter((w) => topicWords.includes(w)).length;
        if (score > 0 && (!best || score > best.score)) best = { t, id: d.id, score };
      }
    }
    const num = lc.match(/(-?\$?\d+(?:\.\d+)?)\s*(%|k|m)?/);
    const presetWord = /worst|downside|pessimis|bad case/.test(lc) ? "downside" : /best|upside|optimis/.test(lc) ? "upside" : null;

    if (best && num) {
      const d = client.topics[best.t].drivers.find((x) => x.id === best!.id)!;
      let n = parseFloat(num[1].replace("$", ""));
      if (/\b(fall|drop|down|decreas|lower|cut|less|lose|loss|declin)/.test(lc) && n > 0 && d.min < 0) n = -n;
      if (d.unit === "usdK" && num[2]?.toLowerCase() === "m") n *= 1000;
      const v = Math.min(d.max, Math.max(d.min, n));
      values[best.t] = { ...values[best.t], [d.id]: v };
      matches.push({ topic: best.t, driver: d.id, label: d.label, value: v, from: clause });
    } else if (presetWord) {
      const targets = best ? [best.t] : client.topicOrder;
      targets.forEach((t) => { values[t] = presetValues(client.topics[t], presetWord); });
      presetsUsed.push(`${presetWord} for ${best ? client.topics[best.t].name : "all topics"}`);
    } else unmatched.push(clause);
  }
  return { values, matches, presetsUsed, unmatched };
}

// Example prompts from the client's own tabs: each tab's main driver at its downside preset.
export function examplesFor(client: Client): string[] {
  const out: string[] = [];
  for (const t of client.topicOrder.slice(0, 4)) {
    const topic = client.topics[t];
    const d = topic.drivers[0];
    const v = d ? topic.presets.downside[d.id] : undefined;
    if (d && v !== undefined) out.push(`What if ${d.label.toLowerCase()} is ${fmtDriver(v, d.unit)}?`);
  }
  if (client.topicOrder[0]) out.push(`Worst case on ${client.topics[client.topicOrder[0]].name.toLowerCase()}`);
  return out.slice(0, 4);
}
