// Stand-in for Base44's "base44:runtime" module when the backend code runs locally (scripts/backtest/run.ts,
// mapped by scripts/backtest/import_map.json). Secrets come from the process environment, which env.ts
// fills from .env; values are never logged. waitUntil() keeps background work so the runner can wait for it.

const pending = new Set<Promise<unknown>>();

export const secrets = {
  get: (name: string): string | undefined => Deno.env.get(name),
};

export function waitUntil(work: Promise<unknown>): void {
  const tracked: Promise<unknown> = Promise.resolve(work)
    .catch((e) => console.error(`[runtime] background work failed: ${(e as Error)?.message ?? e}`))
    .finally(() => pending.delete(tracked));
  pending.add(tracked);
}

// Resolves once all background work handed to waitUntil() has settled, including work it started.
export async function settleBackground(): Promise<void> {
  while (pending.size) await Promise.allSettled([...pending]);
}
