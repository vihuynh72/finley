import { matchesTopic } from "@/components/figma/topics";
import { Package, LineChart, Users, Truck, Gavel } from "lucide-react";

export const TOPIC_PAGES = [
  { slug: "input-costs", label: "Input costs", short: "Input", icon: Package },
  { slug: "pricing-competition", label: "Pricing and competition", short: "Pricing", icon: LineChart },
  { slug: "demand-customers", label: "Demand and customers", short: "Demand", icon: Users },
  { slug: "logistics-freight", label: "Logistics and freight", short: "Logistics", icon: Truck },
  { slug: "regulation", label: "Regulation", short: "Reg", icon: Gavel },
];

export const topicBySlug = (slug) => TOPIC_PAGES.find((t) => t.slug === slug);
export const topicOf = (f) => f.topic || TOPIC_PAGES.find((t) => matchesTopic(f, t.label))?.label || "Input costs";

// New findings carry 0-100 scores; older ones are converted from the 1-5 rubric.
export const scoresOf = (f) =>
  f.scores?.priority != null
    ? f.scores
    : { priority: Math.round(((f.priority || 0) / 125) * 100), materiality: (f.materiality || 0) * 20, relevance: f.relevance ?? null, confidence: (f.confidence || 0) * 20 };

// Amounts are stored in USD millions.
export function fmtM(m) {
  const a = Math.abs(m || 0), s = m < 0 ? "-" : "";
  if (a >= 1000) return `${s}$${(a / 1000).toFixed(2)}B`;
  if (a >= 1) return `${s}$${a.toFixed(2)}M`;
  return `${s}$${Math.round(a * 1000)}K`;
}
export const fmtDelta = (m) => `${m >= 0 ? "+" : ""}${fmtM(m)}`;

export const STATUS = {
  challenged: { label: "Challenged", cls: "bg-destructive/10 text-destructive" },
  under_review: { label: "Under pressure", cls: "bg-amber-100 text-amber-700" },
  supported: { label: "Supported", cls: "bg-primary/50 text-foreground" },
  monitoring: { label: "Holding", cls: "bg-secondary text-muted-foreground" },
};

export const assumptionFor = (client, label) =>
  (client.assumptions || []).find((a) => (a.driver || "").toLowerCase().includes(label.toLowerCase()));

export function baseOf(c) {
  const rev = c.annual_revenue || 0, gm = (c.gross_margin_pct || 0) / 100, opex = c.opex || 0;
  const cogs = rev * (1 - gm);
  return { rev, gm, cogs, opex, ebitda: rev - cogs - opex };
}

// Fiscal-year seasonality (Oct start): the holiday quarter carries the most.
export const MONTHS = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];
export const WEIGHTS = [0.07, 0.1, 0.13, 0.08, 0.07, 0.08, 0.07, 0.07, 0.08, 0.08, 0.08, 0.09];

// EBITDA effect of a finding's quantified impact.
export function findingDelta(b, f) {
  const i = f.impact;
  if (!i || f.review_status === "rejected") return 0;
  return b.rev * ((i.revenue_pct || 0) / 100) * b.gm - b.cogs * ((i.cost_pct || 0) / 100);
}

export const dateLabel = (d) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");