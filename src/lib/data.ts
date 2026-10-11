// The dashboard's view of a client. Topic tabs are not fixed: besides Overview, Evals and Sources,
// each client gets one tab per main exposure found during pretraining (its latest KeywordPlan),
// built by base44/shared/topics.ts, which the backend shares. live.ts maps Base44 records onto
// these types; the pages only ever see these.

import { fmtDriver, fmtM, type Delta, type DriverSpec, type Topic, type Unit } from "../../base44/shared/topics.ts";

export { fmtDriver, fmtM };
export type { Delta, Topic, Unit };

export type TopicId = string; // a topic's slug, unique per client
export type Status = "Challenged" | "Under pressure" | "Supported" | "Holding";
export type Values = Record<string, number>;
export type Driver = DriverSpec;
export type SourceType = "Primary company" | "Trade press" | "Government" | "Blog unverified";

export interface Source { name: string; type: SourceType; tier?: 1 | 2 | 3 | 4; url?: string; title?: string }
export interface Finding {
  id: string; topicId: TopicId; title: string;
  severity: "urgent" | "review" | "info";
  confidence: "high" | "medium" | "low"; confidenceReason: string;
  effect: Status; date: string; isoDate: string;
  facts: string[]; sources: Source[];
  interpretation: string; changeView: string;
  scenario?: Values;
  nextStep: string; assumptions: string[];
  scores: { materiality: number; confidence: number; urgency: number; priority: number }; // the pipeline's 1-5 scores
  runId: string;
}
export interface Client {
  id: string; name: string; industry: string;
  base: Delta; // plan year, USD millions
  topics: Record<TopicId, Topic>; topicOrder: TopicId[];
  findings: Finding[];
  reforecastDue: string; // ISO day or ""
  lastScanAt: string; // ISO time or ""
  evalCase: string; // set on backtest clients
  planned: boolean; // false until planKeywords has built a keyword plan
  record: Record<string, any>;
}

export const SEASONALITY = [0.075, 0.075, 0.08, 0.08, 0.08, 0.085, 0.085, 0.085, 0.085, 0.09, 0.09, 0.09];
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const topicName = (c: Client, t: TopicId) => c.topics[t]?.name ?? t;
export const isTopicOf = (c: Client, t: string) => c.topicOrder.includes(t);
