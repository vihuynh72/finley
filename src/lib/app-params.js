// App bootstrap parameters. The SDK appends some of these to the URL when it redirects
// (sign-in, MCP authorization); everything falls back to the build-time env vars.
import { getAccessToken } from "@base44/sdk";

const q = new URLSearchParams(window.location.search);
const env = import.meta.env;

export const appParams = {
  appId: q.get("app_id") || env["VITE_BASE44_APP_ID"],
  appBaseUrl: q.get("app_base_url") || env["VITE_BASE44_APP_BASE_URL"],
  functionsVersion: q.get("functions_version") || env["VITE_BASE44_FUNCTIONS_VERSION"],
  fromUrl: q.get("from_url") || "",
  token: q.get("access_token") || getAccessToken() || "",
};