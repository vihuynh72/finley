import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Reveal from "@/components/landing/Reveal";

const label = "text-[10px] tracking-widest text-muted-foreground";
const input = "w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

export default function PilotForm() {
  const [f, setF] = useState({ name: "", email: "", role: "", client_count: "", missed_assumption: "" });
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setState("saving"); setError("");
    try {
      await base44.entities.PilotSignup.create({ ...f, role: f.role || undefined, client_count: f.client_count ? Number(f.client_count) : undefined });
      setState("done");
    } catch (err) {
      setError(err.message || "Could not submit"); setState("idle");
    }
  };

  return (
    <section id="pilot" className="max-w-4xl mx-auto px-6 py-20">
      <Reveal><h2 className="text-2xl font-semibold mb-6">Help shape Finley.</h2></Reveal>
      <Reveal className="rounded-2xl bg-card border border-border p-6">
        {state === "done" ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 py-8 justify-center">
            <CheckCircle2 className="w-6 h-6" /> Thanks! We'll be in touch about the pilot.
          </motion.div>
        ) : (
          <form onSubmit={submit} className="grid md:grid-cols-2 gap-4">
            <label><span className={label}>NAME</span><input required className={input} placeholder="Your name" value={f.name} onChange={set("name")} /></label>
            <label><span className={label}>WORK EMAIL</span><input required type="email" className={input} placeholder="name@company.com" value={f.email} onChange={set("email")} /></label>
            <div><span className={label}>ROLE</span>
              <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v })}>
                <SelectTrigger className="mt-1 bg-background"><SelectValue placeholder="Choose a role" /></SelectTrigger>
                <SelectContent>{["Fractional CFO", "FP&A team", "Finance leader", "Other"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <label><span className={label}>NUMBER OF CLIENTS OR BUSINESS UNITS</span><input type="number" min="0" className={input} placeholder="e.g. 5" value={f.client_count} onChange={set("client_count")} /></label>
            <label className="md:col-span-2"><span className={label}>WHAT'S ONE ASSUMPTION YOU WISH YOU'D CAUGHT EARLIER? (OPTIONAL)</span>
              <textarea rows={3} className={input} placeholder="e.g. A specific supply chain disruption..." value={f.missed_assumption} onChange={set("missed_assumption")} /></label>
            {error && <p className="text-sm text-destructive md:col-span-2">{error}</p>}
            <button disabled={state === "saving"} className="w-fit px-5 py-2.5 rounded-full bg-primary text-sm font-medium flex items-center gap-2 disabled:opacity-60">
              {state === "saving" && <Loader2 className="w-4 h-4 animate-spin" />} Join the pilot
            </button>
          </form>
        )}
      </Reveal>
    </section>
  );
}