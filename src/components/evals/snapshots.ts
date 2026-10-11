// Finds and checks published backtests. src/lib/published.ts hands this the lazy file map from Vite's
// import.meta.glob; the Deno tests hand it a fake one. Pure otherwise: nothing here calls Base44 or
// any API, and a snapshot loads as a static chunk of the build.

import { EVAL_CASES } from "../../../base44/shared/eval/cases.ts";
import { checkPublished, type PublishedBacktest } from "../../../base44/shared/eval/published.ts";

export type SnapshotFiles = Record<string, () => Promise<unknown>>;
export interface Checked { snapshot: PublishedBacktest | null; problems: string[] }

// "../evals/published/netflix-2023.json" -> "netflix-2023"
export const caseKeyOf = (path: string) => (path.split("/").pop() ?? "").replace(/\.json$/i, "");

export function snapshotIndex(files: SnapshotFiles, warn: (msg: string) => void = (m) => console.warn(m)) {
  const byCase = new Map(Object.entries(files).map(([path, load]) => [caseKeyOf(path), load]));
  const memo = new Map<string, Promise<Checked>>();

  // Loads a case's snapshot and lists what makes it unfit to present (a dry run, news dated after the
  // cutoff, a different case...). A snapshot with problems is never shown.
  const check = (caseKey: string): Promise<Checked> => {
    const load = byCase.get(caseKey);
    if (!load) return Promise.resolve({ snapshot: null, problems: [] });
    let p = memo.get(caseKey);
    if (!p) {
      p = load().then((mod) => {
        const data = (mod && typeof mod === "object" && "default" in mod ? (mod as { default: unknown }).default : mod) as PublishedBacktest;
        const problems = checkPublished(data as Record<string, any>, caseKey);
        if (problems.length) {
          warn(`Published backtest ${caseKey} is not shown: ${problems.join("; ")}`);
          return { snapshot: null, problems };
        }
        return { snapshot: data, problems };
      }, (e) => {
        memo.delete(caseKey); // a chunk that failed to load can be tried again
        throw e;
      });
      memo.set(caseKey, p);
    }
    return p;
  };

  return {
    // Case keys with a snapshot file for a case the app knows, before any is loaded or checked.
    cases: (): string[] => [...byCase.keys()].filter((k) => EVAL_CASES[k]).sort(),
    check,
    load: async (caseKey: string): Promise<PublishedBacktest | null> => (await check(caseKey)).snapshot,
  };
}
