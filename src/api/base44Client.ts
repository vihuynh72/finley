import { createClient, getAccessToken } from "@base44/sdk";

// The Base44 app this frontend talks to. The Base44 CLI (`base44 dev`, `base44 build`) sets these
// VITE_ variables; ?clear_access_token=true drops a stale stored token.
if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("clear_access_token") === "true") {
  window.localStorage.removeItem("base44_access_token");
  window.localStorage.removeItem("token");
}

const env = import.meta.env;
const token = getAccessToken();
export const base44 = createClient({
  appId: env["VITE_BASE44_APP_ID"],
  ...(token ? { token } : {}),
  functionsVersion: env["VITE_BASE44_FUNCTIONS_VERSION"],
  serverUrl: "",
  appBaseUrl: env["VITE_BASE44_APP_BASE_URL"],
});
