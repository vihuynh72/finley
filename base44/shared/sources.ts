// Source types and reliability tiers for the dashboard's Sources page and scoring, decided by code from
// the outlet name and URL: never by a model. Tiers follow the frontend's scale:
//   1 company filings and press releases, government and regulator data
//   2 major financial and trade press
//   3 industry blogs, analyst newsletters, outlets we don't recognise
//   4 unverified blogs and social media
// An analyst can override a tier per source name (SourceOverride entity); this is only the default.

export type SourceType = "Primary company" | "Trade press" | "Government" | "Blog unverified";
export type Tier = 1 | 2 | 3 | 4;

const host = (url: string) => {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
};
const onDomain = (h: string, domains: string[]) => domains.some((d) => h === d || h.endsWith(`.${d}`));

const WIRES = ["businesswire.com", "prnewswire.com", "globenewswire.com", "accesswire.com", "newswire.ca", "newsfilecorp.com", "einpresswire.com"];
const GOV_TLDS = /\.(gov|mil)$|\.gov\.[a-z]{2}$|\.gc\.ca$|\.gouv\.fr$|\.europa\.eu$|\.admin\.ch$|\.bund\.de$/;
const MAJOR = ["reuters.com", "bloomberg.com", "wsj.com", "ft.com", "cnbc.com", "nytimes.com", "washingtonpost.com", "apnews.com",
  "theguardian.com", "bbc.com", "bbc.co.uk", "economist.com", "barrons.com", "marketwatch.com", "forbes.com", "fortune.com",
  "businessinsider.com", "axios.com", "theverge.com", "techcrunch.com", "variety.com", "hollywoodreporter.com", "deadline.com",
  "latimes.com", "cnn.com", "nbcnews.com", "cbsnews.com", "abcnews.go.com", "npr.org", "politico.com", "theinformation.com",
  "nikkei.com", "asia.nikkei.com", "scmp.com", "finance.yahoo.com", "investors.com", "foxbusiness.com", "usatoday.com", "wired.com"];
const MAJOR_NAMES = /^(reuters|bloomberg|the wall street journal|wall street journal|wsj|financial times|cnbc|the new york times|new york times|associated press|ap news|the guardian|bbc|the economist|barron's|marketwatch|forbes|fortune|business insider|axios|the verge|techcrunch|variety|the hollywood reporter|hollywood reporter|deadline|los angeles times|cnn|nbc news|cbs news|abc news|npr|politico|the information|nikkei|yahoo finance|investor's business daily|fox business|usa today|wired)$/i;
const SOCIAL = ["medium.com", "substack.com", "blogspot.com", "wordpress.com", "reddit.com", "twitter.com", "x.com", "youtube.com",
  "tiktok.com", "facebook.com", "linkedin.com", "quora.com", "tumblr.com"];
const GOV_NAMES = /\b(department of|ministry of|commission|agency|bureau of|federal reserve|central bank|securities and exchange|regulator|parliament|senate|congress)\b/i;

export function classifySource(outlet: string, url: string, clientName = ""): { type: SourceType; tier: Tier } {
  const h = host(url);
  const name = String(outlet || "").trim();
  const client = String(clientName || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (GOV_TLDS.test(h) || h === "sec.gov" || GOV_NAMES.test(name)) return { type: "Government", tier: 1 };
  // The company's own site or investor pages, or a press-release wire.
  if (onDomain(h, WIRES) || (client.length >= 3 && h.replace(/[^a-z0-9]/g, "").includes(client) && !onDomain(h, MAJOR))) return { type: "Primary company", tier: 1 };
  if (/^(ir|investors?)\./.test(h)) return { type: "Primary company", tier: 1 };
  if (onDomain(h, SOCIAL) || /\b(blog|forum)\b/i.test(name)) return { type: "Blog unverified", tier: 4 };
  if (onDomain(h, MAJOR) || MAJOR_NAMES.test(name)) return { type: "Trade press", tier: 2 };
  return { type: "Trade press", tier: 3 }; // a trade or industry outlet we don't recognise
}
