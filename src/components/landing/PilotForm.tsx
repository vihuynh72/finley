import { useState, type ChangeEvent, type FormEvent } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Reveal } from "@/components/landing/Reveal";

// Mirrors base44/entities/PilotSignup.jsonc: name and email are required, the rest optional.
const ROLES = ["Fractional CFO", "FP&A team", "Finance leader", "Other"] as const;
type Role = (typeof ROLES)[number];
interface PilotSignup { name: string; email: string; role?: Role; client_count?: number; missed_assumption?: string }
interface FormState { name: string; email: string; role: Role | ""; client_count: string; missed_assumption: string }
type TextField = "name" | "email" | "client_count" | "missed_assumption";

const label = "text-[10px] tracking-widest text-muted-foreground";
const input = "w-full mt-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";
const EMPTY: FormState = { name: "", email: "", role: "", client_count: "", missed_assumption: "" };

// Leave optional fields out entirely when they are blank.
function toSignup(f: FormState): PilotSignup {
  const s: PilotSignup = { name: f.name, email: f.email };
  if (f.role) s.role = f.role;
  if (f.client_count !== "" && Number.isFinite(Number(f.client_count))) s.client_count = Number(f.client_count);
  if (f.missed_assumption.trim()) s.missed_assumption = f.missed_assumption;
  return s;
}

const errorMessage = (err: unknown) =>
  (typeof err === "object" && err !== null && "message" in err && typeof err.message === "string" ? err.message : "") || "Could not submit";

export function PilotForm() {
  const [f, setF] = useState<FormState>(EMPTY);
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState("");
  const set = (k: TextField) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setF((prev) => ({ ...prev, [k]: value }));
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState("saving"); setError("");
    try {
      await base44.entities.PilotSignup.create(toSignup(f));
      setState("done");
    } catch (err) {
      setError(errorMessage(err)); setState("idle");
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
              <Select value={f.role} onValueChange={(v) => setF((prev) => ({ ...prev, role: ROLES.find((r) => r === v) ?? "" }))}>
                <SelectTrigger className="mt-1 bg-background" aria-label="Role"><SelectValue placeholder="Choose a role" /></SelectTrigger>
                <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <label><span className={label}>NUMBER OF CLIENTS OR BUSINESS UNITS</span><input type="number" min="0" className={input} placeholder="e.g. 5" value={f.client_count} onChange={set("client_count")} /></label>
            <label className="md:col-span-2"><span className={label}>WHAT'S ONE ASSUMPTION YOU WISH YOU'D CAUGHT EARLIER? (OPTIONAL)</span>
              <textarea rows={3} className={input} placeholder="e.g. A specific supply chain disruption..." value={f.missed_assumption} onChange={set("missed_assumption")} /></label>
            {error && <p className="text-sm text-destructive md:col-span-2">{error}</p>}
            <button type="submit" disabled={state === "saving"} className="w-fit px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 cursor-pointer disabled:cursor-default disabled:opacity-60">
              {state === "saving" && <Loader2 className="w-4 h-4 animate-spin" />} Join the pilot
            </button>
          </form>
        )}
      </Reveal>
    </section>
  );
}
