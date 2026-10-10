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

// 1-5 rubric score. The rubric itself lives in the prompt so every agent scores alike.
export const score = (description: string) => int(`${description} (integer 1-5)`);

// Structured outputs can't enforce the 1-5 range, so clamp whatever comes back.
export const clampScore = (value: unknown) => Math.min(5, Math.max(1, Math.round(Number(value) || 1)));

// Nor do they guarantee enum casing ("Input_Costs"), so map values back onto the allowed list.
export const canon = (value: unknown, allowed: readonly string[], fallback: string) =>
  allowed.find((a) => a === String(value ?? "").trim().toLowerCase()) ?? fallback;
