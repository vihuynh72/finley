// Builders for the JSON schemas our agents answer in (Claude structured outputs).
// Structured outputs need every object closed (additionalProperties: false) and don't
// support numeric or length constraints, so ranges live in descriptions and are clamped
// in code. Every property is required; wrap values that may be unknown in nullable().

export type Schema = Record<string, unknown>;

const describe = (schema: Schema, description?: string): Schema =>
  description ? { ...schema, description } : schema;

export const str = (description?: string) => describe({ type: "string" }, description);
export const num = (description?: string) => describe({ type: "number" }, description);
export const int = (description?: string) => describe({ type: "integer" }, description);
export const bool = (description?: string) => describe({ type: "boolean" }, description);
export const choice = (values: readonly string[], description?: string) =>
  describe({ type: "string", enum: values }, description);
export const list = (items: Schema, description?: string) => describe({ type: "array", items }, description);
export const nullable = (schema: Schema, description?: string) =>
  describe({ anyOf: [schema, { type: "null" }] }, description);
export const obj = (properties: Record<string, Schema>, description?: string) =>
  describe({ type: "object", properties, required: Object.keys(properties), additionalProperties: false }, description);

// 1-5 rubric score. An integer enum bounds it (min/max aren't supported); the rubric lives in the prompt.
export const score = (description: string) => describe({ type: "integer", enum: [1, 2, 3, 4, 5] }, description);

// Clamp anyway, as a second line of defence before scores reach Base44 and the alert rule.
export const clampScore = (value: unknown) => Math.min(5, Math.max(1, Math.round(Number(value) || 1)));

// Nor do they guarantee enum casing or separators ("Input_Costs", "input costs"), so map values
// back onto the allowed list after normalizing case and punctuation.
const scrub = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
export const canon = (value: unknown, allowed: readonly string[], fallback: string) =>
  allowed.find((a) => a === scrub(value)) ?? fallback;
