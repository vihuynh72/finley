// Checks the runner's writes against base44/entities/*.jsonc and warns (once each) about fields an
// entity doesn't declare, values of the wrong type, and strings outside a declared enum. The local store
// accepts anything; Base44 might not, so a warning here is worth a look before a real run on Base44.

import type { WriteOp } from "./memory.ts";

type Rec = Record<string, any>;

// JSONC -> JSON: drops // and /* */ comments outside strings, and trailing commas.
export function stripJsonc(text: string): string {
  let out = "", inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      out += ch;
      if (ch === "\\") out += text[++i] ?? "";
      else if (ch === '"') inString = false;
    } else if (ch === '"') { inString = true; out += ch; }
    else if (ch === "/" && text[i + 1] === "/") { while (i < text.length && text[i] !== "\n") i++; out += "\n"; }
    else if (ch === "/" && text[i + 1] === "*") { i = text.indexOf("*/", i + 2); if (i < 0) break; i++; }
    else out += ch;
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

export function loadSchemas(dir: string): Map<string, Rec> {
  const schemas = new Map<string, Rec>();
  try {
    for (const entry of Deno.readDirSync(dir)) {
      if (!entry.isFile || !/\.jsonc?$/.test(entry.name)) continue;
      const schema = JSON.parse(stripJsonc(Deno.readTextFileSync(`${dir}/${entry.name}`)));
      schemas.set(schema.name || entry.name.replace(/\.jsonc?$/, ""), schema);
    }
  } catch (e) {
    console.warn(`[schema] could not read ${dir} (${(e as Error).message}); writes go unchecked`);
  }
  return schemas;
}

export function schemaChecker(schemas: Map<string, Rec>, print: (line: string) => void = (line) => console.warn(line)) {
  const seen = new Set<string>();
  const warnings: string[] = [];
  const warn = (key: string, text: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    warnings.push(text);
    print(`[schema] ${text}`);
  };
  const kind = (v: unknown) => (Array.isArray(v) ? "array" : v === null ? "null" : typeof v);
  const check = (entity: string, op: WriteOp, data: Rec) => {
    if (op === "delete") return;
    const schema = schemas.get(entity);
    if (!schema) return warn(entity, `${entity}: no base44/entities schema; Base44 would have no such entity`);
    const props: Rec = schema.properties ?? {};
    for (const [field, value] of Object.entries(data)) {
      const p = props[field];
      if (!p) { warn(`${entity}.${field}`, `${entity}.${op} writes "${field}", which base44/entities/${entity}.jsonc does not declare`); continue; }
      if (value === null || value === undefined) continue;
      const types: string[] = p.type ? [p.type].flat() : [];
      const have = kind(value);
      const ok = !types.length || types.some((t) => t === have || (t === "integer" && Number.isInteger(value)));
      if (!ok) warn(`${entity}.${field}:type`, `${entity}.${field} is declared ${types.join("|")} but was written as ${have}`);
      if (Array.isArray(p.enum) && have === "string" && !p.enum.includes(value)) warn(`${entity}.${field}=${value}`, `${entity}.${field} = "${value}" is not in its declared enum (${p.enum.join(", ")})`);
    }
  };
  return { check, warnings };
}
