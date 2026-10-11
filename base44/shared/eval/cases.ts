// Backtest cases: one company, a cutoff date, what was public at the cutoff, and the answer key for the
// horizon. The agents only ever see publicCase(), which strips every outcome; the scorer reads the rest.
//
// SOURCES: figures marked check: true came from search-engine snippets or memory while this file was
// written (sec.gov and the shareholder letters could not be opened from the build environment).
// Confirm each against the 10-K and quarterly letters before the demo, then set check: false.

export interface EvalQuarter { id: string; label: string; span: string; start: string; end: string; actual: number; unit: "USD B"; source: string; check?: boolean }
export interface EvalKpi { id: string; name: string; unit: string; base: number; base_note: string; flat_band: number; actual: number; source: string; check?: boolean }
export interface EvalQuestion { id: string; text: string; outcome: boolean; resolution: string; source: string; check?: boolean }
export interface EvalAction { id: string; date: string; kind: "decision" | "risk_event"; text: string; source: string; check?: boolean }

export interface EvalCase {
  key: string; company: string; ticker: string;
  cutoff: string; horizon: { start: string; end: string; label: string };
  profile: Record<string, any>; // Client fields as of the cutoff
  known_at_cutoff: string[]; // facts public at the cutoff, given to every condition including no-news
  quarters: EvalQuarter[]; kpis: EvalKpi[]; questions: EvalQuestion[]; actions: EvalAction[];
  outcomes: string[]; // what happened in the horizon, for judging whether flagged findings held up
  caveats: string[];
}

const NFLX_LETTERS = "Netflix quarterly shareholder letters (sec.gov 8-K Ex.99.1)";

export const NETFLIX_2023: EvalCase = {
  key: "netflix-2023", company: "Netflix", ticker: "NFLX",
  cutoff: "2022-12-31",
  horizon: { start: "2023-01-01", end: "2023-12-31", label: "Calendar 2023" },
  profile: {
    name: "Netflix", industry: "Streaming entertainment", ticker: "NFLX",
    business_model: "Subscription video streaming in over 190 countries. Members pay a monthly fee for unlimited viewing of licensed and original series and films; an ad-supported plan launched in 12 countries in November 2022 at $6.99 a month in the US. Revenue is roughly paid memberships times average monthly revenue per membership (ARM). Content amortization is the largest cost.",
    revenue_streams: "Streaming memberships in four regions: US and Canada (UCAN), EMEA, Latin America and Asia-Pacific. Early advertising revenue from the Basic with Ads plan. A small DVD-by-mail business in the US.",
    cost_structure: "Cost of revenues (about 58% of revenue in FY2021) is mostly content amortization plus production and streaming delivery. Operating expenses are marketing, technology and development, and general and administrative. More than half of revenue is earned outside the US and Canada, so the dollar moves reported revenue.",
    financial_drivers: "Paid net adds, ARM (prices, plan mix, foreign exchange), churn, content spending and amortization, marketing spend, operating margin.",
    strategic_objectives: "Return to membership growth after the 2022 losses, grow the ad-supported plan, earn revenue from password sharing, widen operating margin over time and keep content spending disciplined.",
    competitors: ["Disney+", "HBO Max", "Amazon Prime Video", "YouTube"],
    // FY2021 10-K, the latest full year public at the cutoff (USD millions). check
    annual_revenue: 29698, gross_margin_pct: 41.6, opex: 6171, ev_ebitda_multiple: 22,
    reforecast_due: "2023-01-15",
    assumptions: [
      { text: "Paid memberships return to steady growth in 2023", driver: "Paid memberships", status: "monitoring" },
      { text: "Price increases and the ad plan keep ARM at least flat", driver: "Pricing", status: "monitoring" },
      { text: "Content amortization grows slower than revenue", driver: "Content costs", status: "monitoring" },
      { text: "Disney+, HBO Max and Prime Video do not raise churn", driver: "Competition", status: "monitoring" },
      { text: "The strong dollar is a headwind but stops worsening", driver: "Foreign exchange", status: "monitoring" },
    ],
  },
  known_at_cutoff: [
    "FY2021 (10-K filed January 2022): revenue $29.7B, operating margin 20.9%, 221.8M paid memberships at year end.",
    "2022 quarterly revenue: Q1 $7.87B, Q2 $7.97B, Q3 $7.93B.",
    "2022 paid net adds: Q1 -0.2M, Q2 -0.97M, Q3 +2.41M; Q4 guidance +4.5M (October 18, 2022).",
    "In October 2022 Netflix said revenue, not membership, would be its primary top-line metric and stopped guiding memberships.",
    "Share price at the December 30, 2022 close: $294.88.",
  ],
  quarters: [
    { id: "2023-Q1", label: "Q1 2023", span: "Jan–Mar 2023", start: "2023-01-01", end: "2023-03-31", actual: 8.16, unit: "USD B", source: NFLX_LETTERS, check: true },
    { id: "2023-Q2", label: "Q2 2023", span: "Apr–Jun 2023", start: "2023-04-01", end: "2023-06-30", actual: 8.19, unit: "USD B", source: "Q2 2023 shareholder letter: revenue $8,187M (snippet)", check: true },
    { id: "2023-Q3", label: "Q3 2023", span: "Jul–Sep 2023", start: "2023-07-01", end: "2023-09-30", actual: 8.54, unit: "USD B", source: NFLX_LETTERS, check: true },
    { id: "2023-Q4", label: "Q4 2023", span: "Oct–Dec 2023", start: "2023-10-01", end: "2023-12-31", actual: 8.83, unit: "USD B", source: NFLX_LETTERS, check: true },
  ],
  kpis: [
    { id: "rev_growth", name: "FY2023 revenue growth vs FY2022", unit: "%", base: 0, base_note: "Up means revenue grew", flat_band: 1, actual: 6.7, source: "FY2022 $31.62B, FY2023 $33.72B (snippets)", check: true },
    { id: "op_margin", name: "FY2023 operating margin", unit: "%", base: 20.9, base_note: "FY2021 operating margin, the latest full year at the cutoff", flat_band: 1, actual: 20.6, source: "FY2023 10-K (Netflix reported 21%)", check: true },
    { id: "net_adds", name: "Paid net adds in 2023", unit: "M", base: 5.74, base_note: "2022 as expected at the cutoff: Q1-Q3 actual 1.24M plus Q4 guidance 4.5M", flat_band: 1, actual: 29.53, source: "Paid memberships 230.75M to 260.28M (snippets)", check: true },
    { id: "excess_return", name: "NFLX 2023 share price change minus the S&P 500's 2023 price change", unit: "pp", base: 0, base_note: "Up means Netflix beat the index", flat_band: 5, actual: 40.9, source: "NFLX +65.1% (snippets); S&P 500 price change about +24.2%", check: true },
  ],
  questions: [
    { id: "q_paid_sharing", text: "Will Netflix start charging for password sharing (paid sharing) in the US during 2023?", outcome: true, resolution: "US paid-sharing emails went out on May 23, 2023.", source: "CNBC, May 23, 2023 (snippet)" },
    { id: "q_price_rise", text: "Will Netflix raise the price of at least one US plan during 2023?", outcome: true, resolution: "Basic rose to $11.99 and Premium to $22.99 on Oct 18, 2023.", source: "Q3 2023 shareholder letter (snippet)" },
    { id: "q_positive_quarters", text: "Will Netflix report positive paid net adds in every quarter of 2023?", outcome: true, resolution: "Q1 +1.75M, Q2 +5.89M, Q3 +8.76M, Q4 +13.1M.", source: NFLX_LETTERS, check: true },
    { id: "q_revenue_up", text: "Will Netflix's FY2023 revenue exceed its FY2022 revenue?", outcome: true, resolution: "$33.72B vs $31.62B.", source: "Snippets of the FY2023 results", check: true },
    { id: "q_margin_20", text: "Will Netflix's FY2023 operating margin be at least 20%?", outcome: true, resolution: "About 20.6% (reported as 21%).", source: "FY2023 10-K", check: true },
    { id: "q_beat_index", text: "Will Netflix stock outperform the S&P 500 in 2023?", outcome: true, resolution: "NFLX +65% vs S&P 500 about +24%.", source: "Price-history snippets", check: true },
    { id: "q_leadership", text: "Will Netflix announce a change to its CEO structure during 2023?", outcome: true, resolution: "Greg Peters named co-CEO and Reed Hastings executive chairman, announced Jan 19, 2023.", source: "Netflix 8-K, January 2023 (snippet)" },
    { id: "q_buyback", text: "Will Netflix authorize additional share buybacks during 2023?", outcome: true, resolution: "An additional $10B authorization in September 2023.", source: "Q3 2023 shareholder letter (snippet)" },
    { id: "q_dvd", text: "Will Netflix announce the shutdown of its DVD-by-mail business during 2023?", outcome: true, resolution: "Announced April 18, 2023; the service ended September 29, 2023.", source: "Netflix announcement, April 2023", check: true },
    { id: "q_big_deal", text: "Will Netflix announce an acquisition worth more than $1B during 2023?", outcome: false, resolution: "No such acquisition was announced.", source: "Netflix 2023 filings", check: true },
    { id: "q_dividend", text: "Will Netflix start paying a cash dividend during 2023?", outcome: false, resolution: "Netflix paid no dividend.", source: "Netflix 2023 filings", check: true },
    { id: "q_layoffs", text: "Will Netflix announce layoffs of 5% or more of its staff during 2023?", outcome: false, resolution: "No company-wide layoff of that size was announced.", source: "2023 news coverage", check: true },
  ],
  actions: [
    { id: "a_coceo", date: "2023-01-19", kind: "decision", text: "Named Greg Peters co-CEO alongside Ted Sarandos; Reed Hastings became executive chairman.", source: "Netflix 8-K and Q4 2022 letter (snippet)" },
    { id: "a_dvd", date: "2023-04-18", kind: "decision", text: "Announced the end of the DVD-by-mail business (closed September 29, 2023).", source: "Netflix announcement", check: true },
    { id: "a_paid_sharing", date: "2023-05-23", kind: "decision", text: "Rolled out paid sharing in the US ($7.99 per extra member) and in 100+ countries covering over 80% of revenue.", source: "CNBC; Q2 2023 shareholder letter (snippets)" },
    { id: "a_basic_phaseout", date: "2023-07-19", kind: "decision", text: "Stopped offering the ad-free Basic plan to new members in the US and UK, steering them to the ad plan.", source: "Q2 2023 shareholder letter", check: true },
    { id: "a_ads_growth", date: "2023-10-18", kind: "decision", text: "Grew the ad-supported plan: ad-plan memberships up almost 70% quarter over quarter in Q3 2023.", source: "Q3 2023 shareholder letter (snippet)" },
    { id: "a_buyback", date: "2023-09-01", kind: "decision", text: "Authorized an additional $10B share repurchase; bought back $2.5B in Q3.", source: "Q3 2023 shareholder letter (snippet); September 2023, exact day unconfirmed", check: true },
    { id: "a_price_rise", date: "2023-10-18", kind: "decision", text: "Raised US Basic and Premium prices (to $11.99 and $22.99) and prices in the UK and France.", source: "Q3 2023 shareholder letter (snippet)" },
    { id: "r_strikes", date: "2023-05-02", kind: "risk_event", text: "The WGA (from May 2) and SAG-AFTRA (from July 14) strikes paused most US scripted production for months.", source: "2023 news coverage", check: true },
  ],
  outcomes: [
    "Paid memberships rose from 230.75M to 260.28M in 2023 (+29.5M), with every quarter positive.",
    "Revenue grew 6.7% to $33.7B; operating margin rose to about 21% from 18% in 2022.",
    "Paid sharing launched in the US and 100+ countries in May 2023 and was credited with stronger membership growth.",
    "Ad-plan memberships grew almost 70% quarter over quarter in Q3 2023.",
    "Netflix raised prices in the US, UK and France in October 2023 and phased out the ad-free Basic plan for new US and UK members.",
    "Free cash flow was about $6.9B in 2023.",
    "Netflix stock rose about 65% in 2023 after falling 51% in 2022, far ahead of the S&P 500.",
    "The 2023 Hollywood writers' and actors' strikes paused much US production, cutting 2023 content cash spending.",
    "Netflix ended DVD-by-mail in September 2023 and named Greg Peters co-CEO in January 2023.",
  ],
  caveats: [
    "One company is a case study, not a benchmark: with about 10 yes/no questions, a single answer moves accuracy by 10 points.",
    "Any current Claude model was trained on data that includes 2023 and may remember what Netflix did. Compare the news run with the no-news run: the gap is what the 2022 news added.",
    "Ground-truth items marked check still need confirming against Netflix's filings.",
  ],
};

export const EVAL_CASES: Record<string, EvalCase> = { [NETFLIX_2023.key]: NETFLIX_2023 };

// What the agents may see: the questions, the KPI definitions and the quarters, never an outcome.
export function publicCase(c: EvalCase) {
  return {
    key: c.key, company: c.company, cutoff: c.cutoff, horizon: c.horizon, known_at_cutoff: c.known_at_cutoff,
    quarters: c.quarters.map(({ id, label, span }) => ({ id, label, span })),
    kpis: c.kpis.map(({ id, name, unit, base, base_note }) => ({ id, name, unit, base, base_note })),
    questions: c.questions.map(({ id, text }) => ({ id, text })),
  };
}
