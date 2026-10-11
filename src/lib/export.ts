import type { Client } from "./data";
import { topicName } from "./data";
import type { FindingStatus } from "./live";

const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

// The client's findings as CSV, for a reforecast pack or a spreadsheet.
export function downloadFindingsCsv(c: Client, status: (id: string) => FindingStatus, findings = c.findings) {
  const head = ["Date", "Topic", "Severity", "Title", "Effect", "Confidence", "Materiality (1-5)", "Status", "Facts", "What it may mean", "Sources"];
  const rows = findings.map((f) => [
    f.isoDate, topicName(c, f.topicId), f.severity, f.title, f.effect, f.confidence, f.scores.materiality, status(f.id),
    f.facts.join(" "), f.interpretation, f.sources.map((s) => (s.url ? `${s.name} (${s.url})` : s.name)).join("; "),
  ]);
  const csv = [head, ...rows].map((r) => r.map(cell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `${c.name.replace(/\W+/g, "-").toLowerCase()}-findings.csv` });
  a.click();
  URL.revokeObjectURL(url);
}
