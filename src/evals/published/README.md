# Published backtests

A file here, `<case_key>.json` (today only `netflix-2023.json`), is a finished backtest frozen for
presenting. The build bundles it, and the Evals page (`/evals`) and the landing page show it
straight away, signed in or not, without calling Base44, Claude or Bright Data. Nothing is re-run
while someone views it.

The format is `PublishedBacktest` in `base44/shared/eval/published.ts`. The frontend finds files with
`import.meta.glob` (`src/lib/published.ts`) and refuses to show one that `checkPublished` objects to:
a dry run, a different case or format, no scored quarters, no no-news condition, or any news item
undated or dated after the cutoff. The reasons go to the browser console and a note on the Evals page.

## How a snapshot gets here

Only from a real run with real keys. Two ways, same format:

1. **Local runner.** `scripts/backtest/run.ts` runs the backtest stages on your machine with the keys
   in `.env` (`ANTHROPIC_API_KEY`, `BRIGHTDATA_API_KEY`, `BRIGHTDATA_SERP_ZONE`; optional `EVAL_MODEL`,
   `EVAL_JUDGE_MODEL`) and writes the snapshot with `origin: "local-runner"`. Its `--dry-run` fakes
   Claude and Bright Data to test the plumbing; that output says `dry_run: true` and the app will not
   show it, so never commit it here.
2. **Export from the app.** Run the backtest on the Evals page of the live Base44 app (signed in).
   When it finishes, **Export for publishing** in the Method section downloads `<case_key>.json`
   (`origin: "base44-export"`) built from the EvalRun, its scan's findings, briefing and keyword plan,
   and every news row of its corpus.

Then:

1. Check it: open the file and confirm `dry_run` is `false`, `run.finished_at`, `run.model` and
   `run.judge_model` are what you ran, and `run.errors` holds nothing that invalidates the run.
2. Copy it to `src/evals/published/<case_key>.json` and commit it.
3. `npm run build` (or `base44 dev`): `/evals` opens on the published run, with the toggle to the
   latest live run when one exists, and the landing page shows its quarterly ranges.

Never hand-edit the numbers or add a file made any other way (the test fixture under
`tests/frontend/fixtures/` is synthetic and must not be copied here). To replace a snapshot, run
again and overwrite the file; to withdraw it, delete the file.
