import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2 } from "lucide-react";

export default function PasteNotes({ onStructured }) {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const run = async () => {
    setLoading(true); setError("");
    const res = await base44.functions.invoke("structureProfile", { notes }).catch((e) => ({ data: { error: e.message } }));
    setLoading(false);
    if (res.data.error) return setError(res.data.error);
    onStructured(res.data.profile);
  };
  return (
    <div className="rounded-lg border border-border bg-card p-4 mb-6">
      <div className="text-sm font-medium mb-2">Shortcut: paste raw company notes and let Claude structure the profile</div>
      <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Paste pitch deck notes, 10-K excerpts, meeting notes…" />
      {error && <p className="text-sm text-destructive mt-2">{error}</p>}
      <Button className="mt-3" variant="secondary" disabled={!notes || loading} onClick={run}>
        {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}Structure with AI
      </Button>
    </div>
  );
}