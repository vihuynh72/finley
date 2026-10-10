# CLAUDE.md

Follow `AGENTS.md` too: it holds the Base44 platform conventions (CLI workflow, publish flow, `.env.local`). This file adds what is specific to this product.

## What this is

**SignalDesk** (repo name `finley`): an AI strategic-intelligence copilot for financial analysts and FP&A professionals. The analyst is the user; the companies they advise are stored as `Client` records. For each client, the app monitors external news and connects material developments to the client's financial drivers and stated assumptions. It produces two outputs: **urgent alerts** and a **daily intelligence briefing**, each with sources, confidence, and illustrative financial impact.

Stack: **Base44** (React frontend, entity database, auth, Deno backend functions, and eventually scheduling and email); **Bright Data** (SERP API for discovery, Web Unlocker for page extraction); **Claude API** (extraction, specialist analysis, synthesis); and deterministic scenario math in plain JS/TS.

## Product rules the code must keep

- **Fact vs. interpretation.** Findings keep `fact` (observed, from sources) separate from `interpretation` / `why_it_matters`. Every finding carries `sources[]`.
- **Impacts are illustrative, never facts.** Anything numeric about the future is labelled as a scenario in the UI ("Illustrative scenario · not a forecast"). The backend must return a null impact when evidence is thin rather than invent numbers.
- **Analyst in control.** The app flags things and never edits the client's model. Findings start as `review_status: "pending"`; only the analyst sets `validated` / `rejected` / `incorporate`.
- **Low noise.** Alert = materiality ≥ 4 **and** confidence ≥ 3 **and** urgency ≥ 4 (each scored 1–5). `priority = m × c × u` (1–125). These numbers appear in three places that must stay in sync: `base44/functions/runPipeline/entry.ts`, the empty-state text in `src/components/dashboard/FindingsList.jsx`, and the "High" badge (`priority >= 60`) in `src/components/figma/UrgentFindingsList.jsx`.
- **Seek disconfirming evidence.** The analyst prompt explicitly asks for evidence that *challenges* the thesis. Keep that when editing prompts.
- **Sample and demo data must be fictional** (companies, people, sources). The Figma dashboard shows a banner saying so.

## Repo map

```
base44/
  config.jsonc                 # site.serveCommand = npm run dev (base44 dev starts Vite for you)
  entities/*.jsonc             # Client, Finding, Run, Scenario, User schemas
  functions/<name>/entry.ts    # Deno backend functions (export default async function (req))
    runPipeline/               # the whole intelligence pipeline (see below)
    buildScenario/             # what-if question -> lever values -> Scenario record
    structureProfile/          # raw pasted notes -> structured Client profile (not persisted)
  shared/claude.ts             # claudeJSON(system, prompt, maxTokens) + profileText(client)
src/
  App.jsx                      # routes; Base44 page imports go above "// Add page imports here"
  api/base44Client.js          # the one SDK client; reuse it
  pages/Portfolio.jsx          # /                 client list           ┐ original dark, tabbed UI
  pages/ClientForm.jsx         # /clients/new      create-only form      │ (inside AppLayout)
  pages/ClientDashboard.jsx    # /clients/:id      Thesis | Urgent alerts | Daily briefing | Scenarios ┘
  pages/Screenshot20261010At124448Pm12.jsx   # Figma-imported light dashboard, /<name>?client=<id>
  pages/Screenshot20261010At124448Pm1.jsx    # older near-duplicate of the above
  components/dashboard|scenario|client/      # tabbed-UI components
  components/figma/                          # Figma-UI components; topics.js = hard-coded topic list
  components/ui/                             # shadcn/ui primitives (generated)
  hooks/usePipelineRun.js      # create Run + invoke runPipeline + poll (Figma UI)
  lib/scenarioModel.js         # simulate(client, levers): deterministic Revenue/GM/EBITDA/EV math
```

There are currently **two parallel UIs** over the same data. The Figma pages are outside `AppLayout` and nothing in the nav links to them. Creating a client redirects to the old `/clients/:id` dashboard. `RunPanel.jsx` duplicates the run and poll logic in `usePipelineRun.js`.

## Data model (`base44/entities`)

Base44 adds `id`, `created_date`, `updated_date`, and `created_by` automatically. Queries sort on `created_date` and `priority`.

| Entity | Purpose | Key fields |
|---|---|---|
| `Client` | Company profile and thesis | text fields (`business_model`, `revenue_streams`, `cost_structure`, `financial_drivers`, `strategic_objectives`), `competitors[]`, financials in **USD millions** (`annual_revenue`, `opex`) plus `gross_margin_pct` and `ev_ebitda_multiple`, `assumptions[] {text, driver, status: monitoring\|supported\|challenged\|under_review, note}`, `last_run_at` |
| `Finding` | One material development | `client_id`, `run_id`, `agent: competition\|market\|risk`, `title`, `fact`, `interpretation`, `why_it_matters`, `drivers_affected[]`, `assumptions_affected[]` (assumption **text**), `next_step`, `uncertainty`, `materiality/confidence/urgency` (1–5), `priority`, `is_alert`, `sources[] {title,url,date}`, `impact {revenue_pct,cost_pct,margin_pts,cash_flow_pct,rationale}`, `review_status`, `feedback`, `incorporate` |
| `Run` | Pipeline progress | `client_id`, `stage: queued→collecting→research→company→scenario→done\|failed`, `articles_count`, `findings_count`, `error` |
| `Scenario` | What-if analysis | `client_id`, `question`, `narrative`, levers `price_change_pct`, `volume_change_pct`, `cogs_change_pct`, `opex_change_pct`, `multiple_change`, `lever_rationale`, `evidence[]`, `risks[]` |

The Figma UI groups everything by **topic**. The topics are hard-coded in `src/components/figma/topics.js`: Input costs, Pricing and competition, Demand and customers, Logistics and freight, Regulation. A finding matches a topic when one of its `drivers_affected` strings contains the topic name, or through its agent (`competition` → Pricing, `market` → Demand). An assumption matches when its `driver` contains the topic name.

## The pipeline (`runPipeline`)

The frontend creates a `Run` (`stage: "queued"`) and then calls `base44.functions.invoke("runPipeline", { run_id })` **fire-and-forget**. The UI polls `Run.get` every 2.5 s until the stage is `done` or `failed`.

1. **collecting**: Bright Data SERP. `POST https://api.brightdata.com/request` with `{zone, url: <google.com/search?q=…&tbm=nws&brd_json=1>, format: "raw"}`. The queries are: client name, the first 3 competitors, `"<industry> regulation"`, and `"<industry> market outlook"`. It keeps up to 8 results per query and dedupes by URL. Only **title, source, date, and snippet** reach the models; no page bodies are fetched.
2. **research**: Three specialist Claude calls run in parallel (`competition`, `market`, `risk`). Each returns `developments[] {title, fact, interpretation, source_ids}`.
3. **company**: A thesis-aware central analyst dedupes the developments, links them to drivers and assumption **indexes**, scores m/c/u, and keeps at most 8.
4. **scenario**: One call returns an illustrative `impact` per finding, or nulls.
5. **persist**: `Finding.bulkCreate`. Each `Client.assumptions[i].status/note` is overwritten by the effects from this run, so the last write wins. Then `last_run_at` is set and the Run is marked `done`. Any thrown error marks the Run `failed` with `error`.

`shared/claude.ts` calls the Messages API with raw `fetch`, model `claude-sonnet-4-5`, and a "JSON only" instruction appended to the system prompt. It parses the substring between the first `{` and the last `}`. All prompts live inline in the function files.

**Secrets** are read with `secrets.get()` from `base44:runtime` and must never be committed: `ANTHROPIC_API_KEY`, `BRIGHTDATA_API_KEY`, and `BRIGHTDATA_SERP_ZONE` (the zone name; the code also accepts a pasted string like `zone: serp_api1`). Set them with `base44 secrets set KEY=value` or in the dashboard under app settings → environment variables. Every function checks `base44.auth.me()` and returns `Response.json(...)`.

Platform limits to design around:
- **Time limit.** Base44 docs reportedly cap a function at **5 minutes** (unverified here). Code still needed after the response can use `waitUntil()` from `base44:runtime`, but that is best-effort with no retry.
- **Secrets at module load.** Base44 docs reportedly say `secrets.get()` must be called **inside the handler**, because a read at module load returns undefined. `runPipeline` currently reads `BRIGHTDATA_SERP_ZONE` at module top level.
- **No RLS.** No entity defines an `rls` block, and Base44's default is then that **all records are accessible to all users**.
- **No user context.** Scheduled or webhook runs have no user and must use `base44.asServiceRole`, which bypasses RLS. They must check ownership themselves.

## Running it

- **Normal:** `base44 login` → `base44 link` → `base44 dev` (see `README.md`). Never run `npm run dev` on its own: it serves a UI with no backend, and every `/api` call fails. Entity data under `base44 dev` lives in memory and is lost on restart. Running functions locally needs Deno. Automations do not run under `base44 dev`. For non-interactive CLI auth (CI or a headless container), set `BASE44_API_KEY` to a workspace key (`b44k_…`).
- **Headless / cloud sessions without Base44 credentials:** you can still preview the real frontend. Run `VITE_BASE44_APP_ID=preview-app npx vite --port 5173 --strictPort`, then drive Chromium with Playwright (installed globally; browsers in `/opt/pw-browsers`). Seed a token with `localStorage.setItem("base44_access_token", "x")` and answer the API from a `page.route` handler:
  - Match on `new URL(url).pathname.startsWith("/api/")`. A `**/api/**` glob also intercepts the module `/src/api/base44Client.js`, and the app then fails to boot.
  - SDK calls to stub (prefix `/api`):
    - `GET /apps/public/prod/public-settings/by-id/<appId>`
    - `GET /apps/<appId>/entities/User/me`
    - `GET /apps/<appId>/entities/<E>/v2/list?q=<json>&sort=-field&limit=N` → `{items: [...]}` (this is what `filter(query, {sort, limit})` hits)
    - `GET|PUT /apps/<appId>/entities/<E>/<id>`
    - `POST /apps/<appId>/entities/<E>` (create) and `POST …/<E>/bulk`
    - `POST /apps/<appId>/functions/<name>`. `functions.invoke` resolves to the raw axios response, so callers read `res.data`.
- **Publishing:** push to git, then publish from the Base44 dashboard (`base44 dashboard open`). Don't use `base44 deploy` (see README).

## Checks before finishing

- `npm run lint`: currently clean; keep it that way.
- `npm run build`: currently passes. A missing-app-id warning is expected outside `base44 dev`.
- `npm run typecheck`: **currently fails with ~104 pre-existing errors**, mostly shadcn `forwardRef` components under `checkJs`. It is not a usable gate. If you touch typed code, compare the error count before and after.
- Backend functions run on Deno, which is not installed by default. `deno lint base44/` reports only `no-import-prefix` for the inline `npm:@base44/sdk@…` imports; those are intentional. `deno check` needs an import map that stubs `base44:runtime`, and it reports only strict-mode implicit-`any` errors.
- There are no automated tests yet.

## Conventions

- The frontend is JS/JSX with the `@/` alias, Tailwind, shadcn/ui, TanStack Query, `lucide-react`, and `moment`. Reuse `@/api/base44Client`. `Entity.filter(query, {sort, limit})` returns a page; read `.items`. The positional form `filter(query, sort, limit)` returns a plain array.
- The tabbed UI uses theme tokens (`bg-card`, `text-muted-foreground`). The Figma UI uses literal Tailwind slate/blue colors. Match whichever file you are in.
- Backend functions: one directory per function with `entry.ts`. Shared code goes in `base44/shared/`. Validate input sizes, as the existing functions do.
- Keep changes focused. Figma-imported pages are generated by Base44's importer; prefer editing the extracted components in `components/figma/` over the page shells.

## Known gaps vs. the MVP brief (as of 2026-10-10)

Implemented: client profile (create + AI structuring from pasted notes); SERP collection; 3 specialist agents + thesis analyst; m/c/u scoring and alerts; per-finding illustrative impacts; analyst review (validate / reject / feedback / include-in-advice); what-if scenarios with deterministic EBITDA/EV math; run progress UI.

Missing or partial, roughly in priority order:

1. **No page extraction.** Bright Data Web Unlocker is not used; the agents see only search snippets. There is no curated source list and no recency filter on queries. If `industry` is blank, two queries degrade to a bare `"regulation"` / `"market outlook"` (or `"undefined …"` when the field is missing).
2. **No scheduling or notifications.** There are no Base44 Automations for regular monitoring or daily briefings, and no email or in-app push for urgent alerts. Runs only start when someone clicks.
   - Automations are reportedly declared in `base44/functions/<name>/function.jsonc` (cron in UTC) and deploy with the function.
   - A scheduled run has no user, so `runPipeline` would need a service-role path instead of `auth.me()`.
   - For email, use `integrations.Core.SendEmail`; it sends to registered users.
3. **"Daily briefing" is not a briefing.** It shows every finding ever produced, sorted by priority. There is no `Briefing` entity, no synthesized summary, and no per-day scope.
4. **Persistence gaps vs. the brief.** There are no `Source` or `Briefing` entities. Article text and quotes are not stored, so evidence is just title/url/raw date strings like "2 days ago". `Run` keeps no processing history (timestamps, queries, token usage).
5. **No cross-run dedupe or novelty.** Re-running creates duplicate findings for the same articles. Old findings never age out.
6. **Fragile long run.** `runPipeline` is invoked fire-and-forget. If the function dies or times out before its `catch`, the Run stays in a non-terminal stage and the UI polls forever. There is no staleness detection or retry.
   - The worst case is about 45 s of SERP plus three sequential Claude stages with 120 s timeouts each, roughly 6.75 minutes. That exceeds the reported 5-minute function limit.
   - Possible bug to verify first: `BRIGHTDATA_SERP_ZONE` is read at module load (see "Platform limits" above). If that returns undefined, every SERP call goes out with an empty zone.
7. **Scenario math issues.**
   - `runPipeline` drops any impact whose `revenue_pct` is null, even when costs or margin are set (`impact: imp && imp.revenue_pct != null ? imp : undefined`).
   - The Figma EBITDA charts (`EbitdaCharts.jsx`) include **rejected** findings.
   - The same charts treat `revenue_pct` as pure price, with no COGS scaling, and ignore `margin_pts` and `cash_flow_pct`.
   - They double-count findings that match several topics, and hard-code the seasonality weights and "FY27".
   - The bridge chart plots absolute EBITDA per topic rather than deltas.
   - Per-finding impact numbers are LLM-estimated, not computed by deterministic TS as the brief specifies.
8. **Assumptions are weakly linked.** They are referenced by array index and stored on findings as raw text. Their status is overwritten (last write wins) with no history. There is no way to edit a client after creation, including its assumptions and objectives.
9. **Unfinished Figma UI.**
   - Hard-coded "Reforecast due Oct 24", the fictional-data banner, and a CPG-specific topic list (other industries' assumptions won't map).
   - The dark-mode button and "Ask SignalDesk…" box do nothing.
   - Assumption cards look clickable but aren't, and the chart footnote mentions sliders that don't exist.
   - Feedback typed in `FindingDetail` is saved only when you click Validate or Reject.
   - There is no logout, and two duplicate page files exist.
10. **Analyst feedback isn't used.** Review data is never fed back into prompts or ranking. The brief's success metrics (relevance, novelty, actionability) are not computed.
11. **Claude integration.** It uses raw `fetch` instead of the official SDK (`npm:@anthropic-ai/sdk` works in Deno). It uses brittle JSON slicing instead of structured outputs (`output_config.format`). It never checks `stop_reason` (`max_tokens` or `refusal` leads to a parse error). It has no retries and pins an older model.
12. **Multi-user and security.** No entity defines `rls`, so every signed-in user can read and modify every client, finding, and scenario. The fix is something like `"rls": {"read": {"created_by": "{{user.email}}"}, "write": {"created_by": "{{user.email}}"}}`. Functions check only that a user is logged in, not that the user owns the `client_id` / `run_id`. Untrusted article text goes straight into prompts.
13. **Quality.** No tests; `typecheck` is red; `index.html` still has the title "Base44 APP" and links a `/manifest.json` that doesn't exist.
