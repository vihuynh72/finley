import assert from "node:assert/strict";
import { buildPublished, checkPublished, PUBLISHED_FORMAT } from "../../base44/shared/eval/published.ts";
import { choice, list, num, obj, str } from "../../base44/shared/schema.ts";
import { parseEnvFile } from "../../scripts/backtest/env.ts";
import { fakeAnswer, fakeNews, readPrompt } from "../../scripts/backtest/fakes.ts";
import { MemoryBase44, type MemoryState } from "../../scripts/backtest/memory.ts";
import { schemaChecker, stripJsonc } from "../../scripts/backtest/schema.ts";

type Rec = Record<string, any>;

// ---------- buildPublished / checkPublished ----------

const usage = (agent: string, model: string, n: number) => ({ agent, model, effort: "high", input_tokens: n, output_tokens: n / 10, thinking_tokens: n / 100, ms: n * 10 });
const finished = (over: Rec = {}): Rec => ({
  id: "ev1", case_key: "netflix-2023", cutoff: "2022-12-31", stage: "done", finished_at: "2026-10-11T00:00:00.000Z", model: "m-forecast",
  summary: { company: "Netflix", cutoff: "2022-12-31", news: { quarters: { rows: [{ id: "2023-Q1" }] } }, no_news: { quarters: { rows: [{ id: "2023-Q1" }] } } },
  forecasts: { news: { outlook: "news" }, no_news: { outlook: "no news" } }, judgments: { findings: [] },
  usage: [usage("keywords/planner", "m-plan", 100), usage("eval/forecast-news", "m-forecast", 200), usage("eval/judge-findings", "m-judge", 300)],
  errors: ["analyze: one agent failed"], plan_id: "plan1", corpus_key: "k", ...over,
});
const briefing: Rec = {
  headline: "Headline", summary: "Summary", company: { outlook: { verdict: "mixed" }, advice: [{ action: "Weigh it" }] },
  stats: { agents: [usage("research/company", "m-pipe", 1000), usage("company/lead", "m-plan", 2000)] },
};
const plan: Rec = { exposures: [{ name: "Pricing" }], keyword_count: "3" };
const src = (url: string, date: string, included = true, extra: Rec = {}): Rec => ({
  corpus_key: "k", url, title: `Title ${url}`, source: "Outlet", date, included, query: "q", window_from: "2022-10-02", window_to: "2022-12-31", flag: "", ...extra,
});
const build = (over: Rec = {}) => buildPublished({ ev: finished(), findings: [], briefing, plan, sources: [], origin: "local-runner", now: "2026-10-11T12:00:00.000Z", ...over });

Deno.test("buildPublished refuses a run that has not finished", () => {
  assert.throws(() => build({ ev: finished({ stage: "forecast" }) }), /not finished \(stage forecast\)/);
  assert.throws(() => build({ ev: finished({ summary: undefined }) }), /not finished/);
});

Deno.test("buildPublished keeps kept news dated on or before the cutoff, once per link, oldest first", () => {
  const p = build({
    sources: [
      src("u1", "2022-12-01"), src("u1", "2022-12-01"), // the same story from two windows
      src("u2", "2023-01-02"), // after the cutoff (a row the collector would exclude anyway)
      src("u3", ""), // undated
      src("u4", "2022-03-01", false, { exclusion: "before_lookback" }), // excluded by the collector
      src("u5", "2022-02-01", true, { flag: "mentions 2025" }),
      src("u6", "2022-12-31"), // on the cutoff day itself
    ],
  });
  assert.deepEqual(p.sources.map((s) => s.url), ["u5", "u1", "u6"]);
  assert.deepEqual(p.sources[0], { title: "Title u5", outlet: "Outlet", date: "2022-02-01", url: "u5", query: "q", window: "2022-10-02..2022-12-31", flag: "mentions 2025" });
  assert.equal("flag" in p.sources[1], false);
});

Deno.test("buildPublished counts every model call, the analyze stage's included, and lists models once", () => {
  const p = build();
  assert.deepEqual(p.run.usage, { calls: 5, input_tokens: 3600, output_tokens: 360, thinking_tokens: 36, ms: 36000 });
  assert.deepEqual(p.run.pipeline_models, ["m-plan", "m-pipe"]); // eval/ agents are the forecaster and judges, not the pipeline
  assert.equal(p.run.model, "m-forecast");
  assert.equal(p.run.judge_model, "m-judge"); // older runs recorded no judge model: taken from the judges' own usage, never the forecaster's
  assert.equal(build({ ev: finished({ judge_model: "m-judge-recorded" }) }).run.judge_model, "m-judge-recorded");
  assert.equal(build({ ev: finished({ usage: [] }), briefing: null }).run.judge_model, ""); // unknown: shown as not recorded
  assert.deepEqual(p.run.errors, ["analyze: one agent failed"]);
  assert.equal(build({ briefing: null }).run.usage.calls, 3);
});

Deno.test("buildPublished keeps the presentable parts: findings by priority without record ids, plan and briefing", () => {
  const p = build({
    findings: [
      { id: "f1", client_id: "c", run_id: "r", review_status: "pending", feedback: "", title: "Low", priority: 8, sources: [] },
      { id: "f2", client_id: "c", run_id: "r", review_status: "pending", title: "High", priority: 60, impact: { revenue_pct: 1 } },
    ],
  });
  assert.deepEqual(p.findings.map((f) => f.title), ["High", "Low"]);
  for (const f of p.findings) for (const k of ["id", "client_id", "run_id", "review_status", "feedback"]) assert.equal(k in f, false, k);
  assert.deepEqual(p.keyword_plan, { exposures: [{ name: "Pricing" }], keyword_count: 3 });
  assert.deepEqual(p.briefing, { headline: "Headline", summary: "Summary", outlook: { verdict: "mixed" }, advice: [{ action: "Weigh it" }] });
  assert.equal(build({ plan: null, briefing: null }).keyword_plan, null);
  assert.equal(p.format, PUBLISHED_FORMAT);
  assert.equal(p.published_at, "2026-10-11T12:00:00.000Z");
  assert.equal(p.origin, "local-runner");
});

Deno.test("a dry run is marked as one and checkPublished refuses it", () => {
  const real = build({ sources: [src("u1", "2022-12-01")] });
  assert.equal(real.dry_run, false);
  assert.deepEqual(checkPublished(real, "netflix-2023"), []);
  const dry = build({ dryRun: true });
  assert.equal(dry.dry_run, true);
  assert.deepEqual(checkPublished(dry, "netflix-2023"), ["dry run: fake services, not results"]);
});

Deno.test("checkPublished refuses news and no-news forecasts made by different models", () => {
  const p = build({ sources: [src("u1", "2022-12-01")] });
  const mixed = { ...p, forecasts: { news: { ...p.forecasts.news, model: "m-b" }, no_news: { ...p.forecasts.no_news, model: "m-a" } } };
  assert.deepEqual(checkPublished(mixed, "netflix-2023"), ["the news and no-news forecasts used different models (m-b vs m-a)"]);
  const same = { ...p, forecasts: { news: { ...p.forecasts.news, model: "m-a" }, no_news: { ...p.forecasts.no_news, model: "m-a" } } };
  assert.deepEqual(checkPublished(same, "netflix-2023"), []);
});

Deno.test("checkPublished refuses a wrong case, missing results, a missing cutoff and late or undated news", () => {
  const p: Rec = build();
  assert.match(checkPublished(p, "other").join(), /case netflix-2023, expected other/);
  assert.match(checkPublished({ ...p, summary: { ...p.summary, news: { quarters: { rows: [] } } } }).join(), /no scored quarters/);
  assert.match(checkPublished({ ...p, summary: { ...p.summary, no_news: null } }).join(), /no no-news condition/);
  const noCutoff = { ...p, run: { ...p.run, cutoff: "" }, summary: { ...p.summary, cutoff: undefined }, sources: [{ date: "2024-05-01", url: "x" }] };
  assert.match(checkPublished(noCutoff).join(), /no cutoff date/);
  assert.match(checkPublished({ ...p, sources: [{ date: "2023-01-01" }, { date: "" }, { date: "2022-06-01" }] }).join(), /2 sources undated or after the cutoff/);
  assert.deepEqual(checkPublished(null as any), ["not an object"]);
});

// ---------- the runner's in-memory Base44 ----------

Deno.test("memory store: create, get, shallow update, delete, and 404s", async () => {
  const db = new MemoryBase44({ now: () => 1_700_000_000_000 });
  const E = db.entities;
  const a = await E.Client.create({ name: "Acme", assumptions: [{ text: "x" }], id: "ignored" });
  assert.match(a.id, /^[0-9a-f]{24}$/);
  assert.notEqual(a.id, "ignored");
  assert.equal(a.created_by, db.user.email);
  assert.ok(a.created_date && a.updated_date);
  const copy = await E.Client.get(a.id);
  copy.name = "mutated";
  assert.equal((await E.Client.get(a.id)).name, "Acme", "reads are copies");
  const updated = await E.Client.update(a.id, { industry: "Tools", assumptions: [] });
  assert.deepEqual([updated.name, updated.industry, updated.assumptions], ["Acme", "Tools", []]);
  assert.ok(updated.updated_date > a.updated_date);
  await assert.rejects(E.Client.get("missing"), (e: any) => e.status === 404);
  await assert.rejects(E.Client.update("missing", {}), (e: any) => e.status === 404);
  await E.Client.delete(a.id);
  await assert.rejects(E.Client.get(a.id), (e: any) => e.status === 404);
  assert.equal(db.asServiceRole, db);
  assert.equal((await db.auth.me()).email, db.user.email);
  assert.equal((E as any).then, undefined, "the entities proxy is not a thenable");
  const lines: string[] = [];
  await new MemoryBase44({ log: (l) => lines.push(l) }).integrations.Core.SendEmail({ to: "a@b.c", subject: "Hi", body: "" });
  assert.match(lines[0], /SendEmail skipped/);
});

Deno.test("memory store: equality filters, Base44 sort order and cursor paging", async () => {
  const db = new MemoryBase44({ now: () => 1_700_000_000_000 }); // a frozen clock: created_date must still never tie
  const E = db.entities;
  const rows = await E.EvalSource.bulkCreate([3, 1, 2, 1, 5, 4, 1].map((n, i) => ({ n, i, kept: i % 2 === 0, tags: i < 2 ? ["a"] : ["b"] })));
  assert.equal(rows.length, 7);
  assert.equal(new Set(rows.map((r: Rec) => r.created_date)).size, 7);

  // Every page of { kept: true } sorted by -n: ties keep insertion order.
  const seen: Rec[] = [];
  let cursor: string | null = null, pages = 0;
  do {
    const page: any = await E.EvalSource.filter({ kept: true }, { sort: "-n", limit: 2, ...(cursor ? { cursor } : {}) });
    seen.push(...page.items);
    cursor = page.has_more ? page.next_cursor : null;
    if (!page.has_more) assert.equal(page.next_cursor, null);
    pages++;
  } while (cursor);
  assert.equal(pages, 2);
  assert.deepEqual(seen.map((r) => r.i), [4, 0, 2, 6]); // n 5, 3, 2, 1

  const asc = await E.EvalSource.filter({}, { sort: "n" });
  assert.deepEqual(asc.items.map((r: Rec) => r.i), [1, 3, 6, 2, 0, 5, 4]); // the three 1s in insertion order
  assert.equal((await E.EvalSource.filter({ tags: "a" }, { limit: 10 })).items.length, 2, "a scalar matches inside an array field");
  assert.equal((await E.EvalSource.filter({ n: 1, kept: false }, { limit: 10 })).items[0].i, 1);
  assert.equal((await E.EvalSource.filter({ missing: null }, { limit: 10 })).items.length, 7);
  assert.equal((await E.EvalSource.filter({ n: undefined }, { limit: 10 })).items.length, 7, "undefined is dropped on the wire, as with the SDK");
  const newest = await E.EvalSource.filter({}, { sort: "-created_date", limit: 1 });
  assert.equal(newest.items[0].i, 6);
  assert.deepEqual((await E.EvalSource.list("-created_date", 3)).map((r: Rec) => r.i), [6, 5, 4]);
  assert.deepEqual((await E.EvalSource.filter({ kept: true }, "n", 2)).map((r: Rec) => r.i), [6, 2], "the array form");
  await assert.rejects(E.EvalSource.filter({ n: { $gt: 2 } }, { limit: 5 }), /only equality filters/);
  await assert.rejects(E.EvalSource.filter({}, { cursor: "not-a-cursor" }), /bad cursor/);
});

Deno.test("memory store: a checkpoint round-trips through JSON and ids keep counting", async () => {
  const db = new MemoryBase44();
  const a = await db.entities.EvalRun.create({ stage: "queued", usage: [] });
  const state = JSON.parse(JSON.stringify(db.toJSON())) as MemoryState;
  const back = MemoryBase44.fromJSON(state);
  assert.deepEqual(await back.entities.EvalRun.get(a.id), a);
  const b = await back.entities.EvalRun.create({ stage: "queued" });
  assert.notEqual(b.id, a.id);
  assert.ok(b.created_date > a.created_date);
  assert.deepEqual(back.counts(), { EvalRun: 2 });
  assert.equal(db.counts().EvalRun, 1, "the copy does not share rows with the original");
});

Deno.test("schema checks warn once per undeclared field, wrong type or value outside an enum", async () => {
  const jsonc = `{ // the entity\n "name": "Run", "properties": { "stage": { "type": "string", "enum": ["done", "failed"] }, /* note */ "url": { "type": "string", "description": "http://x" }, "n": { "type": "integer" }, }, }`;
  const schemas = new Map([["Run", JSON.parse(stripJsonc(jsonc))]]);
  const lines: string[] = [];
  const checker = schemaChecker(schemas, (l) => lines.push(l));
  const db = new MemoryBase44({ onWrite: checker.check });
  const run = await db.entities.Run.create({ stage: "done", url: "http://x//y", n: 2 });
  assert.deepEqual(checker.warnings, []);
  await db.entities.Run.update(run.id, { stage: "running", extra: 1, n: 1.5 });
  await db.entities.Run.update(run.id, { extra: 2 });
  await db.entities.Ghost.create({});
  assert.deepEqual(checker.warnings, [
    'Run.stage = "running" is not in its declared enum (done, failed)',
    'Run.update writes "extra", which base44/entities/Run.jsonc does not declare',
    "Run.n is declared integer but was written as number",
    "Ghost: no base44/entities schema; Base44 would have no such entity",
  ]);
  assert.equal(lines.length, 4);
});

// ---------- the runner's .env parser and dry-run fakes ----------

Deno.test(".env parsing: comments, export, quotes, inline comments, empty values", () => {
  const env = parseEnvFile("# keys\nA=1\nexport B='two words'\nC=\"x # y\"\nD=val # note\nE=\n  F = spaced  \nnot a line\n");
  assert.deepEqual(Object.fromEntries(env), { A: "1", B: "two words", C: "x # y", D: "val", E: "", F: "spaced" });
});

Deno.test("dry-run news stays inside the requested window and is labelled", () => {
  const url = "https://www.google.com/search?q=Netflix&tbm=nws&hl=en&gl=us&tbs=" + encodeURIComponent("cdr:1,cd_min:7/2/2022,cd_max:9/30/2022") + "&brd_json=1";
  const news = fakeNews(url);
  assert.equal(news.length, 3);
  for (const n of news) {
    const day = new Date(Date.parse(`${n.date} UTC`)).toISOString().slice(0, 10); // "Jul 15, 2022", read as UTC like Base44 does
    assert.ok(day >= "2022-07-02" && day <= "2022-09-30", day);
    assert.match(n.title, /\(dry run\)$/);
    assert.match(n.link, /^https:\/\/news\.dry-run\.invalid\//);
    assert.match(n.description, /\d+(\.\d+)?%/);
  }
  assert.deepEqual(fakeNews(url), news, "deterministic");
});

Deno.test("dry-run answers follow the schema and cite what the prompt offers", () => {
  const schema = obj({
    items: list(obj({ article_ids: list(str()), quote: str(), kind: choice(["a", "b"]), size: num("1 to 8") }), "At most 6"),
    gaps: list(str()),
  });
  const prompt = `<article id="A0" yours="true" lens="company" date="2022-12-01" outlet="Dry Run Wire">\nHeadline one\nNetflix subscriber estimate rose 4.5% to 231 million in Dec 2022.\n</article>\n<article id="A1" yours="false" lens="market" date="2022-11-01" outlet="Other">\nHeadline two\n</article>`;
  assert.deepEqual(readPrompt(prompt).own.map((a) => a.id), ["A0"]);
  const out = fakeAnswer(schema, "system", prompt) as Rec;
  assert.deepEqual(Object.keys(out), ["items", "gaps"]);
  assert.equal(out.items.length, 1, "capped by the articles it can cite");
  const [item] = out.items;
  assert.deepEqual(Object.keys(item), ["article_ids", "quote", "kind", "size"]);
  assert.deepEqual(item.article_ids, ["A0"]);
  assert.ok("Netflix subscriber estimate rose 4.5% to 231 million in Dec 2022.".startsWith(item.quote));
  assert.ok(["a", "b"].includes(item.kind));
  assert.ok(item.size >= 1 && item.size <= 8);
  assert.deepEqual(fakeAnswer(schema, "system", prompt), out, "deterministic");
});
