// Published backtests: finished runs frozen as JSON in src/evals/published/<case_key>.json (see the
// README there). The build bundles each file as a static chunk that loads only on the pages that ask
// for it, so showing a published backtest makes no call to Base44, Claude or Bright Data.
import { useQuery } from "@tanstack/react-query";
import { snapshotIndex } from "@/components/evals/snapshots";
import type { PublishedBacktest } from "../../base44/shared/eval/published.ts";

const index = snapshotIndex(import.meta.glob("../evals/published/*.json", { import: "default" }));

// Cases with a snapshot file (known before any is loaded); a file can still be refused when loaded.
export const publishedCases = (): string[] => index.cases();

// The case's snapshot, or null when there is none or it is unfit to present (a dry run, news dated
// after the cutoff...; the reasons go to console.warn).
export const loadPublished = (caseKey: string): Promise<PublishedBacktest | null> => index.load(caseKey);

export function usePublished(caseKey: string) {
  const has = index.cases().includes(caseKey);
  const q = useQuery({
    queryKey: ["published", caseKey], queryFn: () => index.check(caseKey), enabled: has,
    staleTime: Infinity, gcTime: Infinity, retry: false, networkMode: "always", // a chunk of this build, not an API call
  });
  return {
    has, loading: has && q.isPending, snapshot: q.data?.snapshot ?? null, problems: q.data?.problems ?? [],
    error: q.error ? (q.error as Error).message || String(q.error) : "",
  };
}
