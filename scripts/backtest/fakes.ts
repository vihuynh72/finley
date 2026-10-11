// DRY RUN ONLY. Replaces globalThis.fetch so the real backtest stages run end to end with no network:
//   POST https://api.brightdata.com/request  -> a Bright Data-shaped body of synthetic articles, dated
//       inside the search's tbs=cdr window and labelled "(dry run)", from fictional outlets on a .invalid host
//   POST https://api.anthropic.com/v1/messages -> an SSE stream (or JSON) that @anthropic-ai/sdk accepts,
//       whose text is JSON generated from the request's output_config.format.schema
//   anything else -> throws, so a dry run can never reach a real service
// Nothing here is random: every value is seeded from the request, so runs repeat exactly. The generated
// answers reuse ids, quotes and numbers found in the prompt, so the pipeline's code checks pass and the
// run saves findings and reaches the judges. Results of a dry run are plumbing checks, never results.

type Rec = Record<string, any>;

export interface FakeStats { brightdata_requests: number; claude_requests: number; refused: string[] }

// ---------- deterministic helpers ----------

export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
const frac = (...parts: unknown[]) => hash(parts.join("|")) / 4294967296; // [0, 1)
const round = (n: number, dp = 0) => Math.round(n * 10 ** dp) / 10 ** dp;
const GREEK = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet", "kilo", "lima",
  "mike", "november", "oscar", "papa", "quebec", "romeo", "sierra", "tango", "uniform", "victor", "whiskey", "yankee"];
const ORDINAL = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const words = (text: string, n: number) => text.split(/\s+/).filter(Boolean).slice(0, n).join(" ");
const human = (name: string) => name.replace(/_/g, " ");

// ---------- Bright Data ----------

const OUTLETS = ["Dry Run Wire", "Synthetic Trade Daily", "Placeholder Business Journal", "Sample Markets Review", "Mock Industry Weekly"];
const METRICS = [
  { what: "subscriber estimate", unit: "million" }, { what: "average price index", unit: "points" },
  { what: "content spending estimate", unit: "billion dollars" }, { what: "advertising demand gauge", unit: "points" },
  { what: "household reach survey", unit: "million homes" }, { what: "cost index", unit: "points" },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86_400_000;
const isoOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const usToIso = (us: string) => {
  const [m, d, y] = us.split("/").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};
const googleDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
};
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "q";

export function fakeNews(searchUrl: string, perSearch = 3): Rec[] {
  const target = new URL(searchUrl);
  const q = (target.searchParams.get("q") || "").trim();
  const m = (target.searchParams.get("tbs") || "").match(/cd_min:(\d+\/\d+\/\d+),cd_max:(\d+\/\d+\/\d+)/);
  const to = m ? usToIso(m[2]) : isoOf(Date.now());
  const from = m ? usToIso(m[1]) : isoOf(Date.now() - 30 * DAY_MS);
  const start = Date.parse(`${from}T00:00:00Z`), span = Math.max(0, Math.round((Date.parse(`${to}T00:00:00Z`) - start) / DAY_MS));
  return Array.from({ length: perSearch }, (_, i) => {
    const date = isoOf(start + Math.floor(frac(q, from, i, "day") * (span + 1)) * DAY_MS);
    const [y, mo] = date.split("-").map(Number);
    const metric = METRICS[(hash(q) + i) % METRICS.length];
    const pct = round(1 + frac(q, from, i, "pct") * 14, 1);
    const level = Math.round(20 + frac(q, from, i, "level") * 280);
    const up = frac(q, from, i, "dir") < 0.6;
    return {
      title: `${q}: ${metric.what} ${up ? "climbs" : "slips"} in ${MONTHS[mo - 1]} ${y} (dry run)`,
      link: `https://news.dry-run.invalid/${slug(q)}/${from}/${i + 1}`,
      source: OUTLETS[(hash(q) + i * 2) % OUTLETS.length],
      date: googleDate(date),
      description: `${q} ${metric.what} ${up ? "rose" : "fell"} ${pct}% to ${level} ${metric.unit} in ${MONTHS[mo - 1]} ${y}, according to a synthetic dry-run report that is not real news.`,
    };
  });
}

// ---------- Claude: what the prompt offers to cite ----------

interface Article { id: string; yours: boolean; date: string; outlet: string; title: string; snippet: string }
interface Dev { id: string; fact: string }
interface Cand { id: string; developments: string[] }
export interface PromptInfo {
  company: string;
  own: Article[]; // articles marked yours="true", the ones a research agent may cite
  devs: Dev[]; cands: Cand[];
  assumptions: { index: number; text: string; driver: string }[];
  blocks: Record<string, string[]>; // ids listed in <quarters>, <kpis> and <questions>
  kpiBase: Record<string, number>;
  recs: string[]; actions: string[]; findings: string[];
}

const all = (re: RegExp, text: string) => [...text.matchAll(re)];

export function readPrompt(prompt: string): PromptInfo {
  const articles = all(/<article id="(A\d+)" yours="(true|false)" lens="[^"]*" date="([^"]*)" outlet="([^"]*)"[^>]*>\n([\s\S]*?)\n<\/article>/g, prompt)
    .map((m) => {
      const [title, ...rest] = m[5].split("\n");
      const snippet = rest.join(" ").trim();
      return { id: m[1], yours: m[2] === "true", date: m[3], outlet: m[4], title, snippet: snippet.startsWith("(headline only") ? "" : snippet };
    });
  const blocks: Record<string, string[]> = {}, kpiBase: Record<string, number> = {};
  for (const m of all(/<(quarters|kpis|questions)\b[^>]*>\n([\s\S]*?)\n<\/\1>/g, prompt)) {
    blocks[m[1]] = all(/^- ([^:\s]+):/gm, m[2]).map((x) => x[1]);
    if (m[1] === "kpis") for (const line of all(/^- ([^:\s]+):.*?base value (-?[\d.]+)/gm, m[2])) kpiBase[line[1]] = Number(line[2]);
  }
  const own = articles.filter((a) => a.yours);
  return {
    company: (prompt.match(/(?:Company|Client): ([^(.\n]+)/)?.[1] || "the company").trim(),
    // Articles with a snippet and numbers first: their facts and quotes can pass the source check.
    own: [...own.filter((a) => /\d/.test(a.snippet)), ...own.filter((a) => !/\d/.test(a.snippet))],
    devs: all(/<development id="(D\d+)"[^>]*>\n([^\n]*)/g, prompt).map((m) => ({ id: m[1], fact: m[2] })),
    cands: all(/<candidate id="(C\d+)"[^>]*developments="([^"]*)"/g, prompt).map((m) => ({ id: m[1], developments: m[2].split(",").filter(Boolean) })),
    assumptions: all(/^\[(\d+)\] (.*) \(driver: ([^)]*)\)$/gm, prompt).map((m) => ({ index: Number(m[1]), text: m[2], driver: m[3] })),
    blocks, kpiBase,
    recs: all(/^- (R\d+) \[/gm, prompt).map((m) => m[1]),
    actions: all(/^- (\w+) \((?:decision|risk event),/gm, prompt).map((m) => m[1]),
    findings: all(/^- (F\d+) \(/gm, prompt).map((m) => m[1]),
  };
}

// ---------- Claude: JSON from the answer schema ----------

interface Scope { list: string; index: number; seed: number; article?: Article; dev?: Dev; cand?: Cand; parent?: Rec }
interface Gen { info: PromptInfo; seed: number; keywords: number }

const NONE_LISTS = new Set(["merges", "conflicts", "name_collision_ids", "duplicate_ids"]);
const PHRASES = ["placeholder text from the dry run", "synthetic wording, not analysis", "generated to test the plumbing", "fake answer for the offline run"];

// Each item of a top-level list (developments, findings, candidates...) gets its own article or
// development to cite; a list nested inside an item (a development's quantities) keeps the item's.
function itemScope(list: string, index: number, g: Gen, parent: Scope): Scope {
  if (parent.list) return { ...parent, list, index, seed: hash(`${parent.seed}|${list}|${index}`) };
  const { own, devs, cands } = g.info;
  const dev = devs.length ? devs[index % devs.length] : undefined;
  return {
    list, index, seed: hash(`${g.seed}|${list}|${index}`), article: own.length ? own[index % own.length] : undefined, dev,
    cand: dev ? cands.find((c) => c.developments.includes(dev.id)) : undefined, parent: parent.parent,
  };
}

function lengthFor(name: string, schema: Rec, scope: Scope, g: Gen): number {
  const { info } = g;
  const item = schema.items ?? {};
  const props: Rec = item.properties ?? {};
  let n: number;
  if (NONE_LISTS.has(name)) n = 0;
  else if (name === "article_ids") n = scope.article ? 1 : 0;
  else if (name === "development_ids") n = scope.dev ? 1 : 0;
  else if (name === "challenging_ids") n = scope.dev && scope.index % 2 === 0 ? 1 : 0;
  else if (name === "supporting_ids") n = scope.dev && scope.index % 2 === 1 ? 1 : 0;
  else if (name === "assumption_indexes") n = info.assumptions.length ? 1 : 0;
  else if ("id" in props && info.blocks[name]) n = info.blocks[name].length;
  else if (name === "matches") n = info.recs.length;
  else if (name === "verdicts") n = info.findings.length;
  else if (name === "ledger") n = info.assumptions.length;
  else {
    const desc = String(schema.description || "");
    const range = desc.match(/(\d+) to (\d+)/), most = desc.match(/at most (\d+)/i), exactly = desc.match(/exactly (\d+)/i);
    n = range ? (Number(range[1]) > 0 ? Math.min(Number(range[2]), Number(range[1]) + 1) : Math.min(Number(range[2]), 3))
      : exactly ? Number(exactly[1]) : most ? Math.min(Number(most[1]), 3) : scope.list ? 1 : 2;
    if ("article_ids" in props) n = Math.min(n, info.own.length);
    if ("development_ids" in props || "keep_id" in props) n = Math.min(n, info.devs.length);
  }
  if (Number.isFinite(schema.minItems)) n = Math.max(n, schema.minItems);
  if (Number.isFinite(schema.maxItems)) n = Math.min(n, schema.maxItems);
  return n;
}

// A KPI forecast's numbers and direction, worked out once per item so the fields agree.
function kpi(scope: Scope, g: Gen) {
  const id = g.info.blocks.kpis?.[scope.index] ?? "";
  const base = g.info.kpiBase[id] ?? 0;
  const delta = round((frac(scope.seed, "kpi") * 2 - 0.6) * (Math.abs(base) * 0.25 + 4), 2);
  const spread = round(Math.abs(delta) / 2 + 2, 2);
  return { point: round(base + delta, 2), low: round(base + delta - spread, 2), high: round(base + delta + spread, 2), direction: Math.abs(delta) < 1 ? "flat" : delta > 0 ? "up" : "down" };
}
// An impact candidate's shock, signed and never zero, with its plausible range around it.
function shock(scope: Scope) {
  const s = round((2 + frac(scope.seed, "shock") * 13) * (frac(scope.seed, "sign") < 0.5 ? -1 : 1), 1);
  const ends = [round(s * 1.5, 1), round(s * 0.5, 1)].sort((a, b) => a - b);
  return { shock_pct: s, shock_min_pct: ends[0], shock_max_pct: ends[1] };
}

function pickEnum(name: string, values: unknown[], scope: Scope, g: Gen): unknown {
  const has = (v: unknown) => values.includes(v);
  const byIndex = (list: unknown[]) => list.filter(has)[scope.index % Math.max(1, list.filter(has).length)];
  const preferred: Record<string, unknown> = {
    estimate: "quantified", shock_basis: "article", exposure_basis: "profile", novelty: "new",
    fact_basis: byIndex(["confirmed_event", "company_statement", "official_data"]),
    held: byIndex(["held", "did_not_hold", "held", "unclear"]), label: byIndex(["exact", "partial", "none"]),
    type: scope.list === "recommendations" ? byIndex(["expand", "defend", "cut", "risk"]) : undefined,
    direction: scope.list === "kpis" ? kpi(scope, g).direction : undefined,
    // The first finding scores as an alert (code may still cap it); the rest are ordinary.
    materiality: scope.index === 0 ? 5 : byIndex([3, 4, 2]), confidence: scope.index === 0 ? 4 : byIndex([3, 4, 2]),
    urgency: scope.index === 0 ? 5 : byIndex([3, 2, 4]), likelihood: byIndex([4, 3, 5]),
  };
  const want = preferred[name];
  return want !== undefined && has(want) ? want : values[Math.floor(frac(scope.seed, name) * values.length)];
}

function numberFor(name: string, schema: Rec, scope: Scope, g: Gen): number {
  const r = (lo: number, hi: number, dp = 1) => round(lo + frac(scope.seed, name) * (hi - lo), dp);
  let v: number;
  if (scope.list === "quarters" && ["low", "mid", "high"].includes(name)) {
    const mid = 7.9 + 0.2 * scope.index + (frac(scope.seed, "q") - 0.5) * 0.3;
    v = round(name === "low" ? mid - 0.3 : name === "high" ? mid + 0.3 : mid, 2);
  } else if (scope.list === "kpis" && ["point", "low", "high"].includes(name)) v = (kpi(scope, g) as Rec)[name];
  else if (name === "shock_pct" || name === "shock_min_pct" || name === "shock_max_pct") v = (shock(scope) as Rec)[name];
  else if (name === "probability") v = r(0.2, 0.9, 2);
  else if (name === "exposure_pct") v = r(10, 60, 0);
  else if (name === "pass_through_pct") v = r(0, 50, 0);
  else if (name === "assumption_index") v = scope.index;
  else if (name === "assumption_indexes") v = g.info.assumptions.length ? scope.index % g.info.assumptions.length : 0;
  else {
    const range = String(schema.description || "").match(/(-?\d+(?:\.\d+)?) to (-?\d+(?:\.\d+)?)/);
    v = range ? r(Number(range[1]), Number(range[2]), schema.type === "integer" ? 0 : 2) : r(1, 10);
  }
  if (Number.isFinite(schema.minimum)) v = Math.max(v, schema.minimum);
  if (Number.isFinite(schema.maximum)) v = Math.min(v, schema.maximum);
  return schema.type === "integer" ? Math.round(v) : v;
}

function stringFor(name: string, schema: Rec, scope: Scope, g: Gen): string {
  const { info } = g;
  const a = scope.article, d = scope.dev;
  const generic = () => `Dry-run ${human(name)}${scope.list ? ` (${human(scope.list)} ${ORDINAL[scope.index % ORDINAL.length]})` : ""}: ${PHRASES[Math.floor(frac(scope.seed, name) * PHRASES.length)]}.`;
  switch (name) {
    case "quote": return a ? words(a.snippet || a.title, 12) : generic();
    case "fact": return a ? `${a.outlet} reported on ${a.date} that ${(a.snippet || a.title).replace(/\.$/, "")}.` : generic();
    case "title": return a && scope.list === "developments" ? `Dry run: ${words(a.title, 10)}`
      : d ? `Dry-run finding: ${words(d.fact.replace(/^.*? that /, ""), 8)}` : generic();
    case "article_ids": return a?.id ?? "";
    case "development_ids": case "challenging_ids": case "supporting_ids": case "keep_id": return d?.id ?? "";
    case "candidate_id": return scope.cand?.id ?? "";
    case "id": return info.blocks[scope.list]?.[scope.index] ?? (scope.list === "recommendations" ? `R${scope.index + 1}` : `X${scope.index + 1}`);
    case "rec_id": return info.recs[scope.index] ?? `R${scope.index + 1}`;
    case "action_id": return scope.index % 3 === 2 || !info.actions.length ? "" : info.actions[scope.index % info.actions.length];
    case "finding_id": return info.findings[scope.index] ?? `F${scope.index + 1}`;
    case "value_text": {
      const n = (a?.snippet || "").match(/\d+(?:\.\d+)?%?/);
      return n ? n[0] : "";
    }
    case "as_of": case "prior_title": return "";
    case "driver": return info.assumptions.length ? info.assumptions[scope.index % info.assumptions.length].driver : generic();
    case "name": return `Dry-run ${human(scope.list.replace(/s$/, ""))} ${GREEK[scope.index % GREEK.length]}`;
    case "keywords": {
      const k = g.keywords++;
      return `${scope.parent?.driver || info.company} dry run ${GREEK[k % GREEK.length]}${k >= GREEK.length ? ` ${GREEK[Math.floor(k / GREEK.length) % GREEK.length]}` : ""}`;
    }
    case "expected_by": return `2023-${String(1 + ((scope.index * 2) % 12)).padStart(2, "0")}`;
    default: return generic();
  }
}

function generate(schema: Rec, name: string, scope: Scope, g: Gen): unknown {
  if (Array.isArray(schema.anyOf)) return generate(schema.anyOf.find((s: Rec) => s.type !== "null") ?? schema.anyOf[0], name, scope, g);
  if (Array.isArray(schema.enum)) return pickEnum(name, schema.enum, scope, g);
  switch (schema.type) {
    case "object": {
      const out: Rec = {};
      const inner = { ...scope, parent: out };
      for (const [key, sub] of Object.entries<Rec>(schema.properties ?? {})) out[key] = generate(sub, key, inner, g);
      return out;
    }
    case "array": {
      const item = schema.items ?? { type: "string" };
      return Array.from({ length: lengthFor(name, schema, scope, g) }, (_, i) =>
        generate(item, name, item.type === "object" ? itemScope(name, i, g, scope) : { ...scope, seed: hash(`${scope.seed}|${name}|${i}`) }, g));
    }
    case "string": return stringFor(name, schema, scope, g);
    case "number": case "integer": return numberFor(name, schema, scope, g);
    case "boolean": return frac(scope.seed, name) < 0.5;
    default: return null;
  }
}

export function fakeAnswer(schema: Rec, system: string, prompt: string): unknown {
  const seed = hash(`${system}\n${prompt}`);
  return generate(schema, "", { list: "", index: 0, seed }, { info: readPrompt(prompt), seed, keywords: 0 });
}

// ---------- Claude: the HTTP response ----------

function claudeResponse(body: Rec): Response {
  const system = typeof body.system === "string" ? body.system : (body.system || []).map((b: Rec) => b.text || "").join("\n");
  const prompt = (body.messages || []).map((m: Rec) => (typeof m.content === "string" ? m.content : (m.content || []).map((c: Rec) => c.text || "").join(""))).join("\n");
  const schema = body.output_config?.format?.schema;
  if (!schema) throw new Error("dry run: the fake Claude only answers requests with output_config.format.schema");
  const text = JSON.stringify(fakeAnswer(schema, system, prompt));
  const id = `msg_dryrun_${hash(system + prompt).toString(16)}`;
  const usage = { input_tokens: Math.ceil((system.length + prompt.length) / 4), output_tokens: Math.ceil(text.length / 4) };
  const message = { id, type: "message", role: "assistant", model: body.model, content: [] as Rec[], stop_reason: null, stop_sequence: null, usage: { input_tokens: usage.input_tokens, output_tokens: 1 } };
  const headers = { "request-id": `req_dryrun_${hash(prompt).toString(16)}` };
  if (!body.stream) {
    return Response.json({ ...message, content: [{ type: "text", text }], stop_reason: "end_turn", usage }, { headers });
  }
  const third = Math.ceil(text.length / 3);
  const events: [string, Rec][] = [
    ["message_start", { type: "message_start", message }],
    ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }],
    ...[0, 1, 2].map((i): [string, Rec] => ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: text.slice(i * third, (i + 1) * third) } }]),
    ["content_block_stop", { type: "content_block_stop", index: 0 }],
    ["message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: usage.output_tokens, output_tokens_details: { thinking_tokens: 0 } } }],
    ["message_stop", { type: "message_stop" }],
  ];
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const [event, data] of events) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { ...headers, "content-type": "text/event-stream; charset=utf-8" } });
}

// ---------- install ----------

export function installFakes(opts: { perSearch?: number } = {}) {
  const real = globalThis.fetch;
  const stats: FakeStats = { brightdata_requests: 0, claude_requests: 0, refused: [] };
  const fake = async (input: Request | URL | string, init?: RequestInit): Promise<Response> => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    if (req.signal?.aborted) throw req.signal.reason ?? new DOMException("The operation was aborted.", "AbortError");
    if (req.method === "POST" && url.origin === "https://api.brightdata.com" && url.pathname === "/request") {
      stats.brightdata_requests++;
      const body = await req.json();
      return Response.json({ news: fakeNews(String(body.url), opts.perSearch ?? 3) });
    }
    if (req.method === "POST" && url.origin === "https://api.anthropic.com" && url.pathname === "/v1/messages") {
      stats.claude_requests++;
      return claudeResponse(await req.json());
    }
    stats.refused.push(`${req.method} ${url.origin}${url.pathname}`);
    throw new TypeError(`dry run: network access refused (${req.method} ${url.origin}${url.pathname})`);
  };
  globalThis.fetch = fake as typeof fetch;
  return { stats, restore: () => { globalThis.fetch = real; } };
}
