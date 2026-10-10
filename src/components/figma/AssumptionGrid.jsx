import { TOPIC_COLORS, TOPIC_STATUS_COLORS, STATUS_LABELS, findingsForTopic } from "./topics";

export default function AssumptionGrid({ client, findings, activeTopic }) {
  const assumptions = client.assumptions || [];

  if (!assumptions.length) {
    return (
      <section className="mb-8">
        <h2 className="text-base font-bold text-slate-800 mb-4">Assumptions by topic</h2>
        <p className="text-sm text-slate-400">No assumptions defined for this client yet.</p>
      </section>
    );
  }

  const filtered = activeTopic === "Overview"
    ? assumptions
    : assumptions.filter((a) => (a.driver || "").toLowerCase().includes(activeTopic.toLowerCase()));

  return (
    <section className="mb-8">
      <h2 className="text-base font-bold text-slate-800 mb-4">Assumptions by topic</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {filtered.map((a, i) => {
          const topic = a.driver || "General";
          const color = TOPIC_COLORS[topic] || "bg-slate-400";
          const statusColor = TOPIC_STATUS_COLORS[a.status] || "bg-slate-100 text-slate-600";
          const openCount = findingsForTopic(findings, topic).filter((f) => f.review_status === "pending").length;
          return (
            <div key={i} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 flex flex-col relative overflow-clip hover:shadow-md transition-shadow cursor-pointer">
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${color}`} />
              <h3 className="text-xs font-bold text-slate-800 mb-1.5">{topic}</h3>
              <p className="text-[11px] text-slate-600 leading-snug flex-1 mb-4">{a.text}</p>
              <div className="flex justify-between items-center mt-auto">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${statusColor}`}>
                  {STATUS_LABELS[a.status] || a.status || "Monitoring"}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">{openCount} open</span>
              </div>
              {a.note && <p className="text-[10px] text-slate-400 mt-2 italic">{a.note}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}