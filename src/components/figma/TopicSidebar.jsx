import { LayoutDashboard, Bookmark, Search } from "lucide-react";
import { TOPIC_ICONS, TOPICS, pendingCount } from "./topics";

export default function TopicSidebar({ findings, activeTopic, onSelectTopic, savedCount }) {
  const overviewCount = findings.filter((f) => f.review_status === "pending").length;

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto">
      <div className="py-4">
        <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-6 mb-2">Topics</h2>
        <nav className="flex flex-col gap-0.5">
          <NavItem icon={LayoutDashboard} label="Overview" count={overviewCount} active={activeTopic === "Overview"} onClick={() => onSelectTopic("Overview")} />
          {TOPICS.map((topic) => {
            const Icon = TOPIC_ICONS[topic];
            const count = pendingCount(findings, topic);
            return (
              <NavItem
                key={topic}
                icon={Icon}
                label={topic}
                count={count}
                active={activeTopic === topic}
                onClick={() => onSelectTopic(topic)}
              />
            );
          })}
          <div className="mt-4" />
          <NavItem icon={Bookmark} label="Saved scenarios" count={savedCount} active={activeTopic === "Saved scenarios"} onClick={() => onSelectTopic("Saved scenarios")} />
        </nav>
      </div>

      <div className="mt-auto p-4">
        <div className="bg-slate-50 rounded-lg p-3 text-[11px] text-slate-500 leading-relaxed border border-slate-100">
          SignalDesk never edits your model. It flags what to look at, and you decide.
        </div>
        <div className="mt-3 relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Ask SignalDesk..."
            className="w-full bg-white border border-slate-200 rounded-md pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
    </aside>
  );
}

function NavItem({ icon: Icon, label, count, active, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between px-6 py-2 cursor-pointer transition-colors ${active ? "bg-blue-50/50 border-r-2 border-blue-600" : "hover:bg-slate-50 border-r-2 border-transparent"}`}
    >
      <div className={`flex items-center gap-3 ${active ? "text-blue-700 font-medium" : "text-slate-600"}`}>
        <Icon className="w-4 h-4" />
        <span className="text-sm">{label}</span>
      </div>
      {count > 0 && (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>
          {count}
        </span>
      )}
    </div>
  );
}