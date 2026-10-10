import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { planKeywords, profileFingerprint } from "../../shared/keywords.ts";

// Builds a client's keyword plan (risk indicators plus Bright Data search keywords) when the analyst
// enters or changes the client's info. Calling it again with no profile change does nothing, so it is
// safe to call on every save. Body: { client_id, force? }. Only signed-in users, under their own access
// rules: no service-role fallback, so an anonymous caller can't spend tokens on any client.
export default async function (req) {
  try {
    const db = createClientFromRequest(req);
    const user = await db.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const client_id = body.client_id;
    if (!client_id) return Response.json({ error: "client_id required" }, { status: 400 });

    const client = await db.entities.Client.get(client_id);
    const profile_fingerprint = await profileFingerprint(client);
    const page = await db.entities.KeywordPlan.filter({ client_id }, { sort: "-created_date", limit: 1 });
    const latest = page.items[0];
    if (latest?.profile_fingerprint === profile_fingerprint && !body.force) {
      return Response.json({ status: "unchanged", plan_id: latest.id, keyword_count: latest.keyword_count });
    }

    // Abort before Base44's 5-minute cap so the error is returned instead of the function being killed.
    const plan = await planKeywords(client, { deadline: Date.now() + 240_000 });
    if (!plan.keyword_count) throw new Error("Keyword planner returned no usable keywords");
    const saved = await db.entities.KeywordPlan.create({ client_id, profile_fingerprint, ...plan });
    return Response.json({ status: "created", plan_id: saved.id, keyword_count: plan.keyword_count });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
