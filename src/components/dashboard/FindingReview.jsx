import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export default function FindingReview({ finding, onChange }) {
  const [feedback, setFeedback] = useState(finding.feedback || "");
  const save = async (patch) => { await base44.entities.Finding.update(finding.id, patch); onChange(); };
  return (
    <div className="border-t border-border pt-3 mt-3 flex flex-wrap items-center gap-2">
      <Button size="sm" variant={finding.review_status === "validated" ? "default" : "secondary"} onClick={() => save({ review_status: "validated", feedback })}>Validate</Button>
      <Button size="sm" variant={finding.review_status === "rejected" ? "destructive" : "secondary"} onClick={() => save({ review_status: "rejected", feedback })}>Reject</Button>
      <Input className="flex-1 min-w-48 h-8 text-sm" placeholder="Why is this (not) material?" value={feedback} onChange={(e) => setFeedback(e.target.value)} onBlur={() => feedback !== (finding.feedback || "") && save({ feedback })} />
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <Switch checked={!!finding.incorporate} onCheckedChange={(v) => save({ incorporate: v })} />Include in advice
      </label>
    </div>
  );
}