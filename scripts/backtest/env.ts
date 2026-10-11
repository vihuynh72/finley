// Loads the backtest's keys from the repo's .env into the process environment for the local runner.
// Values are never printed: callers get variable names and where each came from, nothing else.
//   - KEY=VALUE lines; "export KEY=VALUE" works too; blank lines and # comments are skipped;
//     values may be wrapped in single or double quotes; an unquoted value ends at " #".
//   - A variable already set in the environment wins over .env (so a one-off `KEY=... npm run backtest` works).
//   - An empty value counts as not set.
//   - The Anthropic SDK reads ANTHROPIC_BASE_URL (and ANTHROPIC_AUTH_TOKEN, ANTHROPIC_CUSTOM_HEADERS) from
//     the environment. A shell or container may set them for its own tooling, which would send the
//     backtest's requests elsewhere, so they are removed unless .env sets them.

export const REQUIRED = ["ANTHROPIC_API_KEY", "BRIGHTDATA_API_KEY", "BRIGHTDATA_SERP_ZONE"] as const;
export const OPTIONAL = ["EVAL_MODEL", "EVAL_JUDGE_MODEL"] as const;
export const SDK_OVERRIDES = ["ANTHROPIC_BASE_URL", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_CUSTOM_HEADERS"] as const;

export function parseEnvFile(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2];
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.indexOf(quote, 1) > 0) value = value.slice(1, value.indexOf(quote, 1));
    else value = value.replace(/\s+#.*$/, "").trim();
    out.set(m[1], value);
  }
  return out;
}

export interface EnvReport {
  file: string;
  file_found: boolean;
  from_env_file: string[]; // names set from .env
  from_environment: string[]; // names already set in the environment, which .env did not override
  missing: string[]; // required names with no value anywhere
  removed: string[]; // SDK overrides removed from the environment
  ignored: string[]; // names in .env the runner does not use, e.g. BASE44_API_KEY (left untouched)
}

export function loadEnv(file: string): EnvReport {
  let text = "";
  let found = true;
  try {
    text = Deno.readTextFileSync(file);
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw new Error(`Could not read ${file}: ${(e as Error).name}`);
    found = false;
  }
  const values = parseEnvFile(text);
  const report: EnvReport = { file, file_found: found, from_env_file: [], from_environment: [], missing: [], removed: [], ignored: [] };
  const sdk = new Set<string>(SDK_OVERRIDES);
  // Only the runner's own names are read or set: the npm scripts grant env access to those alone,
  // so touching any other name (BASE44_API_KEY, a typo) would stop the run with a permission error.
  const known = new Set<string>([...REQUIRED, ...OPTIONAL]);
  for (const [name, value] of values) {
    if (!value || sdk.has(name)) continue;
    if (!known.has(name)) { report.ignored.push(name); continue; }
    if ((Deno.env.get(name) ?? "").trim()) report.from_environment.push(name);
    else {
      Deno.env.set(name, value);
      report.from_env_file.push(name);
    }
  }
  for (const name of SDK_OVERRIDES) {
    const value = values.get(name);
    if (value) {
      Deno.env.set(name, value);
      report.from_env_file.push(name);
    } else if (Deno.env.get(name) !== undefined) {
      Deno.env.delete(name);
      report.removed.push(name);
    }
  }
  for (const name of [...REQUIRED, ...OPTIONAL]) {
    if (!report.from_env_file.includes(name) && !report.from_environment.includes(name) && (Deno.env.get(name) ?? "").trim()) report.from_environment.push(name);
  }
  report.missing = REQUIRED.filter((name) => !(Deno.env.get(name) ?? "").trim());
  return report;
}

// For the dry run: placeholders so the SDK and the Bright Data client build their requests (the fakes
// answer them), and none of the real keys or SDK overrides in this process.
export function useDryRunEnv(): string[] {
  const removed: string[] = [];
  for (const name of [...SDK_OVERRIDES, ...OPTIONAL]) {
    if (Deno.env.get(name) !== undefined) {
      Deno.env.delete(name);
      removed.push(name);
    }
  }
  Deno.env.set("ANTHROPIC_API_KEY", "dry-run-placeholder");
  Deno.env.set("BRIGHTDATA_API_KEY", "dry-run-placeholder");
  Deno.env.set("BRIGHTDATA_SERP_ZONE", "dry_run_zone");
  return removed;
}
