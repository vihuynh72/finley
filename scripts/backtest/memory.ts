// In-memory stand-in for the Base44 SDK client, for running the backtest stages outside Base44
// (scripts/backtest/run.ts). It supports what base44/functions/runPipeline and base44/shared call:
//   entities.<AnyName>.filter(query, { sort, limit, cursor })  -> { items, next_cursor, has_more }
//   entities.<AnyName>.filter(query, sort?, limit?, skip?)     -> array (the SDK's older form)
//   entities.<AnyName>.list(sort?, limit?, skip?) -> array;  list({ sort, limit, cursor }) -> page
//   get(id) (throws an Error with status 404), create, bulkCreate, update (shallow merge), delete
//   asServiceRole (the same client), auth.me(), integrations.Core.SendEmail (logs, sends nothing)
// Queries are equality only, as in the code that uses it: { client_id }, { corpus_key, corpus_complete: true }.
// Like the network would, every read and write copies the data through JSON, so callers can't mutate
// stored records. Pure module: no Deno APIs, so tests import it without permissions.

type Rec = Record<string, any>;

export interface MemoryState {
  format: 1;
  seq: number; // ids issued so far
  clock: number; // last timestamp issued (ms), so created_date never repeats and "-created_date" has no ties
  user: Rec;
  tables: Record<string, Rec[]>; // rows in insertion order
}

export interface PageOptions { sort?: string; limit?: number; cursor?: string | null }
export interface Page { items: Rec[]; next_cursor: string | null; has_more: boolean }
export type WriteOp = "create" | "update" | "delete";
export interface MemoryOptions {
  // Sees every write (the payload as sent, before the merge), e.g. to check it against the entity schemas.
  onWrite?: (entity: string, op: WriteOp, data: Rec) => void;
  log?: (line: string) => void;
  now?: () => number;
}

export const DEFAULT_PAGE_LIMIT = 100; // what @base44/sdk sends when a page has no limit
const BUILT_IN = new Set(["id", "created_date", "updated_date", "created_by"]);

const copy = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

export class NotFoundError extends Error {
  status = 404;
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

// Mongo-style order across types (missing and null first), then by value; arrays and objects by JSON.
const RANK = (v: unknown) => (v == null ? 0 : typeof v === "number" ? 1 : typeof v === "string" ? 2 : Array.isArray(v) ? 4 : typeof v === "object" ? 3 : typeof v === "boolean" ? 5 : 6);
function compare(a: unknown, b: unknown): number {
  const ra = RANK(a), rb = RANK(b);
  if (ra !== rb) return ra - rb;
  if (ra === 0) return 0;
  const x = ra >= 3 && ra <= 4 ? JSON.stringify(a) : a, y = ra >= 3 && ra <= 4 ? JSON.stringify(b) : b;
  return (x as any) < (y as any) ? -1 : (x as any) > (y as any) ? 1 : 0;
}

const pathGet = (rec: Rec, path: string) => path.split(".").reduce<any>((v, k) => (v == null ? undefined : v[k]), rec);
const same = (a: unknown, b: unknown) => a === b || (typeof a === "object" && a !== null && JSON.stringify(a) === JSON.stringify(b));

export function matches(rec: Rec, query: Rec | null | undefined): boolean {
  for (const [key, want] of Object.entries(query || {})) {
    if (key.startsWith("$") || (want && typeof want === "object" && !Array.isArray(want) && Object.keys(want).some((k) => k.startsWith("$")))) {
      throw new Error(`memory store: only equality filters are supported, got ${JSON.stringify({ [key]: want })}`);
    }
    const have = pathGet(rec, key);
    if (want === null ? have != null : !(same(have, want) || (Array.isArray(have) && have.some((h) => same(h, want))))) return false;
  }
  return true;
}

// Stable: rows that tie keep insertion order. "-field" sorts descending, "field" ascending.
export function sortRows(rows: Rec[], sort?: string | null): Rec[] {
  const keys = String(sort || "").split(",").map((s) => s.trim()).filter(Boolean)
    .map((s) => (s.startsWith("-") ? { field: s.slice(1), dir: -1 } : { field: s.replace(/^\+/, ""), dir: 1 }));
  if (!keys.length) return [...rows];
  return [...rows].sort((a, b) => {
    for (const k of keys) {
      const c = compare(pathGet(a, k.field), pathGet(b, k.field)) * k.dir;
      if (c) return c;
    }
    return 0;
  });
}

const encodeCursor = (offset: number) => btoa(JSON.stringify({ o: offset }));
function decodeCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0;
  try {
    const o = Number(JSON.parse(atob(cursor)).o);
    if (Number.isInteger(o) && o >= 0) return o;
  } catch { /* fall through */ }
  throw new Error(`memory store: bad cursor "${cursor}"`);
}

const isPageOptions = (value: unknown): value is PageOptions => typeof value === "object" && value !== null;

export class MemoryEntity {
  constructor(private db: MemoryBase44, readonly name: string) {}

  private rows(): Rec[] {
    return this.db.table(this.name);
  }

  // The query goes through JSON as the SDK sends it (?q=...), so a key whose value is undefined is
  // dropped and filters nothing, as on Base44.
  private page(query: Rec | null | undefined, opts: PageOptions): Page {
    const limit = Math.max(1, Math.floor(Number(opts.limit) || DEFAULT_PAGE_LIMIT));
    const q = copy(query);
    const all = sortRows(this.rows().filter((r) => matches(r, q)), opts.sort);
    const from = decodeCursor(opts.cursor);
    const items = all.slice(from, from + limit);
    const has_more = from + limit < all.length;
    return { items: copy(items), next_cursor: has_more ? encodeCursor(from + limit) : null, has_more };
  }

  private array(query: Rec | null | undefined, sort?: string, limit?: number, skip?: number): Rec[] {
    const q = copy(query);
    const all = sortRows(this.rows().filter((r) => matches(r, q)), sort);
    const from = Math.max(0, Number(skip) || 0);
    return copy(limit ? all.slice(from, from + Number(limit)) : all.slice(from));
  }

  // filter(query, { sort, limit, cursor }) returns one page; filter(query, sort, limit, skip) an array.
  filter(query: Rec, options?: PageOptions): Promise<Page>;
  filter(query: Rec, sort?: string, limit?: number, skip?: number): Promise<Rec[]>;
  filter(query: Rec, sortOrOptions?: string | PageOptions, limit?: number, skip?: number): Promise<Page | Rec[]> {
    return this.db.run(() => (isPageOptions(sortOrOptions) ? this.page(query, sortOrOptions) : this.array(query, sortOrOptions, limit, skip)));
  }

  list(options?: PageOptions): Promise<Page>;
  list(sort?: string, limit?: number, skip?: number): Promise<Rec[]>;
  list(sortOrOptions?: string | PageOptions, limit?: number, skip?: number): Promise<Page | Rec[]> {
    return this.db.run(() => (isPageOptions(sortOrOptions) ? this.page({}, sortOrOptions) : this.array({}, sortOrOptions, limit, skip)));
  }

  get(id: string): Promise<Rec> {
    return this.db.run(() => copy(this.find(id)));
  }

  create(data: Rec): Promise<Rec> {
    return this.db.run(() => copy(this.insert(data)));
  }

  bulkCreate(rows: Rec[]): Promise<Rec[]> {
    return this.db.run(() => {
      if (!Array.isArray(rows)) throw new Error(`${this.name}.bulkCreate needs an array`);
      return copy(rows.map((r) => this.insert(r)));
    });
  }

  // Shallow merge, like Base44's PUT: the fields sent replace the stored ones, the rest are kept.
  update(id: string, patch: Rec): Promise<Rec> {
    return this.db.run(() => {
      const rec = this.find(id);
      const clean = copy(patch || {});
      for (const k of BUILT_IN) delete clean[k];
      this.db.wrote(this.name, "update", clean);
      Object.assign(rec, clean, { updated_date: this.db.timestamp() });
      return copy(rec);
    });
  }

  delete(id: string): Promise<{ success: boolean }> {
    return this.db.run(() => {
      const rows = this.rows();
      const i = rows.findIndex((r) => r.id === id);
      if (i < 0) throw new NotFoundError(`${this.name} ${id} not found`);
      this.db.wrote(this.name, "delete", { id });
      rows.splice(i, 1);
      return { success: true };
    });
  }

  private find(id: string): Rec {
    const rec = this.rows().find((r) => r.id === id);
    if (!rec) throw new NotFoundError(`${this.name} ${id} not found`);
    return rec;
  }

  private insert(data: Rec): Rec {
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(`${this.name}.create needs an object`);
    const clean = copy(data);
    for (const k of BUILT_IN) delete clean[k];
    this.db.wrote(this.name, "create", clean);
    const at = this.db.timestamp();
    const rec = { ...clean, id: this.db.newId(), created_date: at, updated_date: at, created_by: this.db.user.email ?? "" };
    this.rows().push(rec);
    return rec;
  }
}

export class MemoryBase44 {
  readonly entities: Record<string, MemoryEntity>;
  readonly auth: { me: () => Promise<Rec> };
  readonly integrations: { Core: { SendEmail: (x: Rec) => Promise<Rec> } };
  user: Rec;
  writes = 0; // every create, update and delete, so a caller can tell the store changed
  private tables: Record<string, Rec[]>;
  private seq: number;
  private clock: number;
  private handlers = new Map<string, MemoryEntity>();

  constructor(private opts: MemoryOptions = {}, state?: MemoryState) {
    if (state && state.format !== 1) throw new Error(`memory store: unknown state format ${state.format}`);
    this.tables = copy(state?.tables ?? {});
    this.seq = state?.seq ?? 0;
    this.clock = state?.clock ?? 0;
    this.user = copy(state?.user ?? { id: "local-runner", email: "backtest-runner@localhost", full_name: "Backtest runner", role: "admin" });
    const handlers = this.handlers;
    this.entities = new Proxy({} as Record<string, MemoryEntity>, {
      get: (_target, name) => {
        // Like the SDK: no handler for symbols, "then" (so the object isn't mistaken for a promise) or _private names.
        if (typeof name !== "string" || name === "then" || name.startsWith("_")) return undefined;
        if (!handlers.has(name)) handlers.set(name, new MemoryEntity(this, name));
        return handlers.get(name);
      },
    });
    this.auth = { me: () => Promise.resolve(copy(this.user)) };
    const log = opts.log ?? ((line: string) => console.log(line));
    this.integrations = {
      Core: {
        SendEmail: (x: Rec) => {
          log(`[memory] SendEmail skipped (local runner sends no email): to=${x?.to ?? ""} subject=${JSON.stringify(String(x?.subject ?? "").slice(0, 80))}`);
          return Promise.resolve({ status: "skipped" });
        },
      },
    };
  }

  // Service-role calls go to the same store: there is no RLS here (nor on Base44 for these entities).
  get asServiceRole(): MemoryBase44 {
    return this;
  }

  table(name: string): Rec[] {
    return (this.tables[name] ??= []);
  }

  // Each call resolves on a later microtask, as a network call would, and errors become rejections.
  run<T>(work: () => T): Promise<T> {
    return Promise.resolve().then(work);
  }

  wrote(entity: string, op: WriteOp, data: Rec) {
    this.writes++;
    this.opts.onWrite?.(entity, op, data);
  }

  timestamp(): string {
    this.clock = Math.max((this.opts.now ?? Date.now)(), this.clock + 1);
    return new Date(this.clock).toISOString();
  }

  // 24 hex characters like Base44's ids: seconds since the epoch, then a counter.
  newId(): string {
    this.seq++;
    return Math.floor(Math.max(this.clock, 0) / 1000).toString(16).padStart(8, "0").slice(-8) + this.seq.toString(16).padStart(16, "0");
  }

  counts(): Record<string, number> {
    return Object.fromEntries(Object.entries(this.tables).map(([k, v]) => [k, v.length]));
  }

  toJSON(): MemoryState {
    return { format: 1, seq: this.seq, clock: this.clock, user: copy(this.user), tables: copy(this.tables) };
  }

  static fromJSON(state: MemoryState, opts: MemoryOptions = {}): MemoryBase44 {
    return new MemoryBase44(opts, state);
  }
}
