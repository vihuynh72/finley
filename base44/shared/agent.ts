import Anthropic from "npm:@anthropic-ai/sdk@0.131.0";
import { secrets } from "base44:runtime";
import type { Schema } from "./schema.ts";

// Every SignalDesk agent calls Claude through runAgent(): schema-constrained JSON answers
// (structured outputs), streamed so long answers never hit HTTP timeouts.
// Haiku 5.5 bills prompts over 100K tokens at 5x the rate, so keep each agent's input under that.
export const MODEL = "claude-haiku-5-5";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface AgentCall {
  name: string; // shows up in logs and run stats, e.g. "research/competition"
  system: string;
  prompt: string;
  schema: Schema; // build with shared/schema.ts so every object is closed
  effort?: Effort; // default "high"; "xhigh" thinks much longer, so use it only when time allows
  maxTokens?: number;
  deadline?: number; // epoch ms; the call is aborted then so the run beats Base44's 5-minute cap
}

// One entry per agent call; saved with the run so cost, speed and thinking depth show per agent.
export type AgentUsage = { agent: string; effort: Effort; ms: number; input_tokens: number; output_tokens: number; thinking_tokens: number };

export async function runAgent<T>(call: AgentCall, usage?: AgentUsage[]): Promise<T> {
  // Created per call: Base44 resolves secrets per request, so the key is read inside the handler.
  const client = new Anthropic({ apiKey: secrets.get("ANTHROPIC_API_KEY") });
  const effort = call.effort ?? "high";
  const signal = call.deadline ? AbortSignal.timeout(Math.max(1000, call.deadline - Date.now())) : undefined;
  const started = Date.now();
  const message = await client.messages.stream({
    model: MODEL,
    max_tokens: call.maxTokens ?? 64000, // room for long thinking plus the JSON answer
    system: call.system,
    messages: [{ role: "user", content: call.prompt }],
    output_config: { effort, format: { type: "json_schema", schema: call.schema } },
  }, { signal }).finalMessage();

  const { input_tokens, output_tokens, output_tokens_details } = message.usage;
  const thinking_tokens = output_tokens_details?.thinking_tokens ?? 0;
  const ms = Date.now() - started;
  usage?.push({ agent: call.name, effort, ms, input_tokens, output_tokens, thinking_tokens });
  console.log(`[agent] ${call.name} effort=${effort} ${ms}ms in=${input_tokens} out=${output_tokens} thinking=${thinking_tokens}`);
  return readAnswer<T>(call.name, message);
}

// Pulls the JSON answer out of a finished message, failing loudly on anything else.
export function readAnswer<T>(name: string, message: Anthropic.Messages.Message): T {
  // Haiku 5.5 has no server-side fallback model, so a declined request stays declined.
  if (message.stop_reason === "refusal") {
    throw new Error(`${name}: declined by safety classifier (${message.stop_details?.category ?? "uncategorized"})`);
  }
  if (message.stop_reason === "max_tokens") throw new Error(`${name}: ran out of tokens before finishing its answer`);
  const text = message.content.map((block) => (block.type === "text" ? block.text : "")).join("").trim();
  if (!text) throw new Error(`${name}: returned an empty answer`); // can happen at xhigh effort
  return JSON.parse(text) as T;
}

// Runs a swarm's agents in parallel. A failed agent is logged and skipped so it can't sink
// the whole swarm; only a swarm where every agent failed throws.
export async function runSwarm<T>(calls: AgentCall[], usage?: AgentUsage[]) {
  const settled = await Promise.allSettled(calls.map((call) => runAgent<T>(call, usage)));
  const ok: { name: string; data: T }[] = [];
  const failed: string[] = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") ok.push({ name: calls[i].name, data: result.value });
    else failed.push(`${calls[i].name}: ${result.reason?.message ?? result.reason}`);
  });
  failed.forEach((failure) => console.error(`[agent] failed ${failure}`));
  if (!ok.length) throw new Error(`Every agent in the swarm failed: ${failed.join(" | ")}`);
  return { ok, failed };
}
