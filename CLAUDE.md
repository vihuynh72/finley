# CLAUDE.md

Follow `AGENTS.md` too: it holds the Base44 platform conventions (CLI workflow, publish flow, `.env.local`). This file adds what is specific to this product.

## What this is

**Finley** (the product formerly called SignalDesk; repo `finley`): an AI strategic-intelligence copilot for FP&A analysts. The analyst's companies are `Client` records. For each client, Finley maps the external forces that move the business (pretraining: the keyword plan), watches the news for them through Bright Data, and has a swarm of Claude agents turn material developments into findings tied to the client's assumptions, with sources, scores and illustrative impact. The dashboard groups everything into **topic tabs, one per exposure in the client's keyword plan**, plus Overview, Prompt scenarios, Sources and Evals. `/` is a public landing page with a pilot sign-up form; the workspace can be browsed signed out, and scanning, saving and backtests ask for sign-in.

The hackathon demo is the **backtest (Evals)**: a company frozen at a cutoff, scored against what it reported and did over the next four quarters. Three cases: Netflix (2022-12-31 → calendar 2023), Warner Bros. Discovery (2024-12-31 → calendar 2025) and Spotify (2025-06-30 → Jul 2025–Jun 2026, in euros). For the demo, each case is run once and **published** as a static snapshot in `src/evals/published/`, so the Evals page shows it without calling Base44, Claude or Bright Data.

Stack: **Base44** (entities, auth, Deno backend functions, hosting of the Vite build); **Bright Data** SERP API (Google News, optionally date-windowed); **Claude** through the official Anthropic SDK with structured outputs (`base44/shared/agent.ts`); deterministic finance and scenario math in TypeScript.

## Product rules the code must keep

- **Fact vs. interpretation.** Findings keep `fact`/`facts` (observed, grounded in sources) separate from `interpretation`/`why_it_matters`. Every finding carries `sources[]` with outlet, type and tier.
- **Impacts are illustrative.** Money comes from code (`shared/finance.ts`, `shared/topics.ts`), never from a model's free text, and the UI shows the formula behind every number ("How this is calculated").
- **Analyst in control.** Finley never edits the client's model. Findings start `review_status: "pending"`; only the analyst moves them.
- **Low noise.** Alert = materiality ≥ 4 **and** confidence ≥ 3 **and** urgency ≥ 4 (1–5 each); `priority = m × c × u`. Kept in sync: `isAlert` in `base44/functions/runPipeline/findings.ts` and the severity mapping in `src/lib/live.ts` (`is_alert` → urgent, priority ≥ 60 or materiality ≥ 4 → review). The pipeline also stores 0–100 display `scores` (priority = 0.35·materiality + 0.25·relevance + 0.2·confidence + 0.2·urgency, relevance = source reliability); the weights are mirrored in `PIPELINE_WEIGHTS` in `src/lib/scores.ts`, which the finding drawer uses to explain the score.
- **Seek disconfirming evidence** in prompts (the thesis tester exists for this).
- **No hindsight in backtests.** Anything a backtest agent sees must be dated on or before the cutoff: dated news only, no earlier findings, no saved questions, no market data (Yahoo history is split-adjusted), and `publicCase()` is the only case data a forecaster gets. Outcomes reach only the judges.
- **Demo data is fictional**, except the backtest cases, whose public figures are cited in `shared/eval/cases.ts` (items marked `check: true` still need confirming against filings).
- **Published backtests are real runs only.** A file in `src/evals/published/` must come from `npm run backtest` or the Evals page's "Export for publishing"; never hand-made, never a dry run (`checkPublished` refuses dry runs, but it cannot tell a hand-made file from a real one).

## Repo map

```
base44/
  config.jsonc                    # build: npm run build -> dist/; base44 dev runs npm run dev
  entities/*.jsonc                # Client, Finding, Run, Briefing, KeywordPlan, Scenario, EvalRun, EvalSource, PilotSignup, User
  functions/
    planKeywords/                 # pretraining: profile -> KeywordPlan (forces + news keywords)
    runPipeline/                  # live scan ({ run_id }) and backtest steps ({ eval: {...} })
      entry.ts                    #   collection, guards, dispatch; PIPELINE_V1=1 rolls back to the old pipeline
      pipeline.ts                 #   agent pipeline: research swarm -> picture + company team -> lead + scenario
      searches.ts corpus.ts research.ts evidence.ts picture.ts company.ts impacts.ts lead.ts scenario.ts
      findings.ts briefing.ts charts.ts alert.ts
      eval/                       #   backtest: stages.ts (state machine), collect.ts, forecast.ts, judge.ts
    buildScenario/ structureProfile/
  shared/
    agent.ts schema.ts            # runAgent (Anthropic SDK, structured outputs, deadlines), schema builders
    keywords.ts                   # planKeywords, normalizePlan, profileFingerprint
    topics.ts                     # topic tabs as data: specs from the keyword plan, safe expression compiler
    sources.ts                    # source type and reliability tier from outlet + URL
    brightdata.ts dates.ts market.ts finance.ts claude.ts
    eval/cases.ts eval/scoring.ts # backtest answer keys (Netflix, WBD, Spotify) and deterministic scoring
    eval/published.ts             # published-snapshot format: buildPublished, checkPublished
src/                              # React + TypeScript SPA (TanStack Router, Tailwind v4, Recharts)
  main.tsx router.tsx routeTree.gen.ts (generated by the router plugin on dev/build; committed)
  api/base44Client.ts             # the one SDK client
  lib/live.ts                     # Base44 records -> dashboard types (Client, Finding, topics)
  lib/store.tsx                   # AppProvider/useApp: react-query loads, persistence, scans
  lib/recs.ts model.ts scores.ts prompt.ts evals.ts data.ts
  routes/                         # index (landing), login, dashboard, topics.$topicId, scenarios, sources, evals, clients.new
  components/                     # AppShell, FindingList/Drawer, ScenarioBuilder, Recommendations, AdvicePanel, charts, ui/ (shadcn)
  components/landing/             # landing sections (framer-motion), PilotForm -> PilotSignup
  components/evals/               # Evals results (one view model for published and live runs), RangeChart, What Finley saw
  evals/published/<case>.json     # published backtest snapshots, bundled as lazy static chunks (see its README)
scripts/backtest/                 # local backtest runner (Deno): real stages, in-memory Base44, keys from .env
tests/backend/                    # Deno tests: topics, scoring, collect, published snapshots, runner store
tests/frontend/                   # Deno tests of src/lib mappers and recommendations
```

## Data model highlights

Base44 adds `id`, `created_date`, `updated_date`, `created_by`. Financials are **USD millions**.

- `Client`: profile text, `competitors[]`, `annual_revenue`, `gross_margin_pct`, `opex`, `ev_ebitda_multiple`, `ticker`, `assumptions[] {text, driver, status, note}`, `reforecast_due`, `last_run_at`; dashboard state `rec_decisions`, `source_overrides`; `eval_case` marks a backtest client.
- `KeywordPlan`: `exposures[] {name, category, driver, why, sensitivity, keywords[]}` (≤ 20 keywords), `profile_fingerprint`, `as_of` (backtests).
- `Finding`: scores, `sources[] {title, url, date, outlet, type, tier}`, `facts[]`, `effect`, `exposure` (the plan exposure whose searches found it = its tab), `topic_key`, `event_date`, `impact`, `impact_inputs` (fills the tab's sliders), `review_status`, `feedback` (analyst note).
- `Run`: `stage`, counts, `error` (also set on partial success), `kind: live|backtest`, `as_of`, `briefing_id`.
- `Finding` also has `topic` (one of five fixed labels, mapped from `topic_key`), `relevance` and `scores` (0–100: priority, materiality, relevance, confidence, urgency). The UI groups by `exposure`, not `topic`; `live.ts` reads `scores` into `pipelineScores`.
- `Briefing`: everything one run produced (picture, outlook, assumption tests, scenarios, coverage, usage) and the company lead's `company.advice[]` (decision advice: `action, kind, horizon, confidence, rationale, economics, check_first, sources`), shown on Overview by `AdvicePanel` and fed to the backtest forecaster.
- `PilotSignup`: landing-page sign-ups (`name`, `email`, `role`, `client_count`, `missed_assumption`); anyone can create, only admins read.
- `Scenario`: dashboard saves `{name, values: {topicId: {driverId: value}}}`; `buildScenario` writes lever records.
- `EvalRun` / `EvalSource`: backtest state and the collected news (kept and excluded, with reasons).

## Topic tabs (frontend ↔ backend contract)

`topicsFromPlan(client, plan)` in `shared/topics.ts` makes one `TopicSpec` per exposure: drivers chosen by category (input costs → shock × exposure × pass-through on COGS; pricing → price + volume; labor → opex wage; regulation → $K cost; macro → revenue × exposure; else volume), sized from the client's financials, using the client's own assumption when its driver matches. Specs are plain JSON with money expressions in a tiny arithmetic language (no `eval`); `compileTopic` turns them into the `Topic` the UI uses. With no plan yet, the client's assumptions stand in (`src/lib/live.ts`). `scenarioFor(spec, impact_inputs)` maps a finding's impact estimate onto a tab's sliders.

## Scans and backtests

- **Live scan:** the UI ensures a keyword plan (`planKeywords`), creates a `Run`, invokes `runPipeline { run_id }` without awaiting, and polls the Run (stops after 7 min). The function refuses backtest clients and a second concurrent scan per client. Searches: client name, up to 3 competitors, then plan keywords (high sensitivity first, ≤ 20).
- **Backtest:** the Evals page creates an `EvalRun` and calls `runPipeline { eval: { eval_run_id } }` until `done` or `failed` (`{ retry: true }` resumes a failed stage). Stages: `plan` (reset the backtest client to the case profile; keyword plan as of the cutoff) → `collect` (every search × 4 quarterly Google News windows before the cutoff, `limit 10`; rows outside [lookback, cutoff] or undated are excluded; reused across runs by `corpus_key`) → `analyze` (the full agent pipeline with `asOf` = cutoff, `backtest: true`, needs its own invocation) → `forecast` (news vs no-news, same prompt otherwise; optional `EVAL_MODEL` secret) → `score` (condition-blind judges, optional `EVAL_JUDGE_MODEL`; numbers from `shared/eval/scoring.ts`). A lease on the EvalRun stops overlapping steps. Each forecast and judgment records its model; a kept one from another model is redone on retry.
- **Cases:** `EVAL_CASES` in `shared/eval/cases.ts`. A case's quarterly revenue is in its reporting currency (`unit: "USD B" | "EUR B"`); the forecaster is asked in it and the Evals page labels $ or €. Client profiles stay in USD millions (Spotify's is converted at the ECB rate on the cutoff day). `publicCase()` is all a forecaster sees.
- **Publishing:** `npm run backtest -- --case <key>` (Deno; keys from the git-ignored `.env`; needs `api.anthropic.com` and `api.brightdata.com` reachable) runs every stage locally against an in-memory Base44 and writes `src/evals/published/<key>.json`; `--resume` continues a failed run, `--dry-run` / `npm run backtest:dry` fakes Claude and Bright Data to test the plumbing and never publishes. Alternatively run the backtest in the live app and use "Export for publishing" on the Evals page. Commit the JSON; `/evals` then shows it first (signed out, and with Base44 down: `__root.tsx` lets `/evals` past the data gate when a snapshot exists).
- **Secrets** (`base44 secrets set`): `ANTHROPIC_API_KEY`, `BRIGHTDATA_API_KEY`, `BRIGHTDATA_SERP_ZONE`; optional `EVAL_MODEL`, `EVAL_JUDGE_MODEL`, `PIPELINE_V1`. Read them inside handlers only.
- **Platform limits:** 5 minutes per function invocation (pipeline stops at 270 s); no RLS on any entity except `PilotSignup`, so every user sees every record.
- **Signed-out browsing:** `useApp()` loads clients without a user; `needsSignIn` is true only when the client list itself answers 401/403, and then the shell sends you to `/login`. Writes call `app.requireSignIn(why)` first.
- **Unverified on live services:** Bright Data's handling of Google's `tbs=cdr` date window, and end-to-end timing of each backtest stage. Run one backtest before the demo and check `EvalRun.corpus_stats` and `errors`.

## Running it

- **Normal:** `base44 login` → `base44 link` → `base44 dev` (see `README.md`). Don't run `npm run dev` alone except as below.
- **Headless preview without Base44 credentials:** `VITE_BASE44_APP_ID=preview-app npx vite --port 5174`, then Playwright with `localStorage.base44_access_token` set and a `page.route` handler answering paths that start with `/api/` (match on `pathname`, not a `**/api/**` glob, which also catches `/src/api/base44Client.ts`):
  - `GET /api/apps/<id>/entities/User/me`
  - `GET …/entities/<E>/v2/list?q=&sort=&limit=` → `{items, next_cursor, has_more}` (the `filter` form)
  - `GET …/entities/<E>?sort=&limit=` → array (the `list` form)
  - `GET|PUT …/entities/<E>/<id>`, `POST …/entities/<E>` and `…/bulk`
  - `POST …/functions/<name>` (`invoke` resolves to `{ data }`)

## Checks before finishing

- `npm run lint` (warnings only, from shadcn files), `npm run typecheck`, `npm run build` (a missing-app-id warning is expected outside `base44 dev`).
- `npm run test:backend` and `npm run test:frontend` (need Deno on PATH).
- `deno check` on backend files needs an import map stubbing `base44:runtime` (`tests/backend/import_map.json`); the older entry files have pre-existing implicit-`any` errors, so compare counts before and after.

## Conventions

- Frontend: TypeScript (strict, `exactOptionalPropertyTypes`), `@/` alias, Tailwind v4 tokens in `src/styles.css` from the Figma design (Plus Jakarta Sans, `#EFEFE8` canvas, `#FAFAF6` cards, lime `#D3EF63` accent, `#1F211C` ink). Pages read data only through `useApp()`/`useClient()`; Base44 calls live in `src/lib`.
- Frontend code may import pure modules from `base44/shared/` (topics, sources, eval cases); never ones that import `npm:` or `base44:runtime`.
- Backend: one directory per function with `entry.ts`; shared code in `base44/shared/`. Agents go through `runAgent` with a `schema.ts` schema and a deadline.

## Known gaps (as of 2026-10-11)

1. **Security:** no entity RLS and no ownership checks in functions.
2. **No page extraction:** agents see titles and snippets only (no Web Unlocker).
3. **No scheduling:** scans run on click; no daily automation (needs a service-role path).
4. **Briefing partly shown:** Overview shows the outlook summary and decision advice; the market picture, assumption tests and coverage are not shown.
5. **Agent pipeline review items for its owner:** a merge can keep an ungrounded development over a grounded duplicate and resolves merge chains one level only (`picture.ts`); the number check in `evidence.ts` rejects facts with "Q3" or bare years; scenario cases in `charts.ts` can put Downside above Central and capitalise transitory shocks; valuation candidates get materiality band 1 (`impacts.ts`); `buildScenario` ignores a backtest client's cutoff.
6. **Backtest answer keys:** most figures in all three cases are snippet-sourced or from memory (`check: true`; sec.gov and the IR sites could not be opened from the build container). Confirm against the 10-K/20-F, the quarterly releases and price histories, then set `check: false`. Spotify's share-price KPI uses approximate June 30 closes.
7. **Unverified on the live app:** that a signed-out visitor can create a `PilotSignup` (`create: {}`) and read clients (push the entities first).
