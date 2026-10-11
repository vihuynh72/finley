import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Radar, ArrowRight, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Finley" },
      { name: "description", content: "Sign in to Finley to review outside signals and build reforecast scenarios." },
      { property: "og:title", content: "Sign in — Finley" },
      { property: "og:description", content: "Outside signals and transparent scenarios for your client's quarterly reforecast." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const done = async () => { await qc.invalidateQueries(); navigate({ to: "/dashboard" }); };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      await done();
    } catch (err) {
      setError((err as Error).message || "Sign in failed");
    } finally {
      setBusy(false);
    }
  };
  const returnTo = typeof window === "undefined" ? "/dashboard" : `${window.location.origin}/dashboard`;
  const field = "w-full rounded-lg border bg-card/40 px-3 py-2.5 text-sm outline-none backdrop-blur focus:ring-2 focus:ring-ring";

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-6 py-12">
      <div className="relative grid w-full max-w-5xl items-center gap-10 md:grid-cols-2">
        <section>
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground"><Radar size={18} /></span>
            <span className="text-lg font-bold">Finley</span>
          </div>
          <h1 className="mt-8 text-5xl font-bold leading-tight tracking-tight">
            Reforecast with<br />the outside world<br /><span className="rounded-lg bg-primary px-2 text-primary-foreground">in view.</span>
          </h1>
          <p className="mt-5 max-w-md text-muted-foreground">
            See the news that challenges or supports your client's assumptions, then build scenarios with the math shown behind every number.
          </p>
          <ul className="mt-6 space-y-2 text-sm">
            <li>• Findings by topic, ranked by urgency</li>
            <li>• Ask a what-if question, get a scenario</li>
            <li>• Never edits your model — you decide</li>
          </ul>
        </section>

        <form onSubmit={submit} className="glass p-8">
          <h2 className="text-2xl font-bold">Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use your Finley account.</p>
          <label className="mt-6 block text-sm font-medium">Email
            <input className={`${field} mt-1.5`} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="mt-4 block text-sm font-medium">Password
            <input className={`${field} mt-1.5`} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-ink">{error}</p>}
          <button type="submit" disabled={busy} className="btn btn-primary mt-6 w-full justify-center py-2.5">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <>Sign in <ArrowRight size={16} /></>}
          </button>
          <button type="button" className="btn mt-3 w-full justify-center py-2.5" onClick={() => base44.auth.loginWithProvider("google", returnTo)}>
            Continue with Google
          </button>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            No account yet, or forgot your password?{" "}
            <button type="button" className="underline" onClick={() => base44.auth.redirectToLogin(returnTo)}>Use the Base44 sign-in page</button>
          </p>
        </form>
      </div>
    </main>
  );
}
