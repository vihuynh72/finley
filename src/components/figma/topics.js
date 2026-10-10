import { PenTool, Tag, Users, Truck, Scale } from "lucide-react";

export const TOPIC_ICONS = {
  "Input costs": PenTool,
  "Pricing and competition": Tag,
  "Demand and customers": Users,
  "Logistics and freight": Truck,
  "Regulation": Scale,
};

export const TOPIC_COLORS = {
  "Input costs": "bg-red-700",
  "Pricing and competition": "bg-amber-500",
  "Demand and customers": "bg-emerald-500",
  "Logistics and freight": "bg-blue-600",
  "Regulation": "bg-blue-600",
};

export const TOPIC_STATUS_COLORS = {
  challenged: "bg-red-50 text-red-700",
  under_review: "bg-amber-50 text-amber-700",
  supported: "bg-emerald-50 text-emerald-700",
  monitoring: "bg-blue-50 text-blue-700",
};

export const STATUS_LABELS = {
  monitoring: "Holding",
  supported: "Supported",
  challenged: "Challenged",
  under_review: "Under pressure",
};

export const TOPICS = Object.keys(TOPIC_ICONS);

const AGENT_TOPIC = {
  competition: "Pricing and competition",
  market: "Demand and customers",
};

export function matchesTopic(finding, topic) {
  const drivers = (finding.drivers_affected || []).map((d) => (d || "").toLowerCase());
  if (drivers.some((d) => d.includes(topic.toLowerCase()))) return true;
  return AGENT_TOPIC[finding.agent] === topic;
}

export function findingsForTopic(findings, topic) {
  if (topic === "Overview") return findings;
  return findings.filter((f) => matchesTopic(f, topic));
}

export function pendingCount(findings, topic) {
  return findingsForTopic(findings, topic).filter((f) => f.review_status === "pending").length;
}