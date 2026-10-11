// Stand-in for Base44's "base44:runtime" module so backend modules load under plain `deno test`.
export const secrets = { get: (_name: string): string | undefined => undefined };
export const waitUntil = (_p: Promise<unknown>) => {};
