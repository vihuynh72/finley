import { useEffect, useState } from "react";
import { Link, Navigate, useOutletContext, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ChevronRight } from "lucide-react";
import AssumptionCard from "@/components/finley/topic/AssumptionCard";
import ScenarioBuilder from "@/components/finley/topic/ScenarioBuilder";
import FindingRow from "@/components/finley/FindingRow";
import { TOPIC_PAGES, assumptionFor, topicBySlug, topicOf, scoresOf } from "@/lib/finley";
import { LEVERS, baseValues } from "@/lib/levers";

export default function TopicPage() {
  const { slug } = useParams();
  const { client, findings, openFinding, refetchScenarios } = useOutletContext();
  const topic = topicBySlug(slug), def = LEVERS[slug];
  const [values, setValues] = useState(() => (def ? baseValues(def) : {}));
  const [preset, setPreset] = useState("base");
  useEffect(() => { if (def) { setValues(baseValues(def)); setPreset("base"); } }, [slug]);
  if (!topic) return <Navigate to="/app" replace />;

  const list = findings.filter((f) => topicOf(f) === topic.label).sort((a, b) => scoresOf(b).priority - scoresOf(a).priority);
  const i = TOPIC_PAGES.indexOf(topic), prev = TOPIC_PAGES[i - 1], next = TOPIC_PAGES[i + 1];
  const useIn = (e) => {
    e.stopPropagation();
    setPreset("downside"); setValues({ ...baseValues(def), ...def.presets.downside });
    document.getElementById("builder")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <motion.div key={slug} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
      <p className="text-[10px] tracking-widest text-muted-foreground uppercase">{client.name} · {client.industry}</p>
      <h1 className="text-3xl font-light mb-8">{topic.label}</h1>
      <h2 className="font-medium mb-3">Assumption under watch</h2>
      <AssumptionCard assumption={assumptionFor(client, topic.label)} />
      <h2 className="font-medium mt-8 mb-3">Findings for this topic</h2>
      <div className="space-y-2">
        {list.map((f, n) => (
          <FindingRow key={f.id} finding={f} index={n} onOpen={openFinding}
            action={<button onClick={useIn} className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-border bg-background flex items-center gap-1">Use in scenario <ChevronRight className="w-3 h-3" /></button>} />
        ))}
        {!list.length && <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border p-5 text-center">No findings on this topic from the latest scans.</p>}
      </div>
      <h2 className="font-medium mt-8 mb-3">Scenario builder</h2>
      <ScenarioBuilder client={client} topic={topic} def={def} values={values} setValues={setValues} preset={preset} setPreset={setPreset} findings={list} onSaved={refetchScenarios} />
      <div className="flex justify-between mt-12 text-xs text-muted-foreground">
        <Link to={prev ? `/app/${prev.slug}` : "/app"} className="flex items-center gap-1 hover:text-foreground"><ArrowLeft className="w-3 h-3" /> {prev?.label || "Overview"}</Link>
        {next && <Link to={`/app/${next.slug}`} className="flex items-center gap-1 hover:text-foreground">{next.label} <ArrowRight className="w-3 h-3" /></Link>}
      </div>
    </motion.div>
  );
}