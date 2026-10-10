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