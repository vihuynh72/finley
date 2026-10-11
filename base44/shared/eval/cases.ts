// Backtest cases: one company, a cutoff date, what was public at the cutoff, and the answer key for the
// horizon. The agents only ever see publicCase(), which strips every outcome; the scorer reads the rest.
//
// SOURCES: figures marked check: true came from search-engine snippets or memory while this file was
// written (sec.gov and the shareholder letters could not be opened from the build environment).
// Confirm each against the 10-K and quarterly letters before the demo, then set check: false.

// Quarterly revenue in billions of the company's reporting currency (Netflix: USD; Spotify: EUR).
export type Currency = "USD" | "EUR";
export interface EvalQuarter { id: string; label: string; span: string; start: string; end: string; actual: number; unit: `${Currency} B`; source: string; check?: boolean }
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

// Warner Bros. Discovery, frozen at 2024-12-31, scored on calendar 2025: a calendar-year USD reporter like
// Netflix, and the company Netflix agreed to buy part of in December 2025. Every item is check: true: the 8-K
// releases, the IR site and sec.gov could not be opened while this case was written, so figures come from search
// results quoting those releases, or from memory where the source says so.
const WBD_Q4_2025 = "Q4 2025 earnings release, Feb 26, 2026 (s201.q4cdn.com/336605034/files/doc_earnings/2025/q4/earnings-result/WBD-4Q25-Earnings-Release.pdf)";

export const WBD_2025: EvalCase = {
  key: "wbd-2025", company: "Warner Bros. Discovery", ticker: "WBD",
  cutoff: "2024-12-31",
  horizon: { start: "2025-01-01", end: "2025-12-31", label: "Calendar 2025" },
  profile: {
    name: "Warner Bros. Discovery", industry: "Media and entertainment", ticker: "WBD",
    business_model: "Global media company formed in April 2022 from WarnerMedia and Discovery. Three segments: Studios (Warner Bros. film, television and games), Networks (cable and free-to-air channels such as TNT, TBS, CNN, Discovery, HGTV and Food Network, paid by distributors' affiliate fees and by advertisers) and Direct-to-consumer (Max, discovery+ and HBO subscriptions, with and without ads). Max launched in Latin America in February 2024 and in much of Europe from May 2024. In December 2024 WBD said it would reorganize into two divisions, Global Linear Networks and Streaming & Studios, by mid-2025.",
    revenue_streams: "Distribution (affiliate fees from pay-TV providers plus streaming subscriptions, about half of revenue), advertising on the networks and the Max ad tier (about a fifth), content (theatrical, TV licensing, home entertainment and games, over a quarter) and other (studio tours).",
    cost_structure: "Costs of revenues (about 59% of revenue in FY2023, excluding depreciation and amortization) are mostly content amortization, sports rights and production. SG&A was about 23.5% of revenue. Amortization of intangibles from the 2022 merger (about $8.0B of depreciation and amortization in FY2023) and restructuring keep GAAP operating income near or below zero, so the company reports adjusted EBITDA. About $40B of gross debt makes interest a large fixed cost.",
    financial_drivers: "Streaming subscribers and revenue per subscriber (international launches, price rises, the ad tier, password-sharing enforcement), US pay-TV subscriber declines and affiliate renewals, linear advertising (audience declines, the NBA leaving TNT after the 2024-25 season), box office and TV licensing, content and sports-rights spending, free cash flow and debt paydown.",
    strategic_objectives: "Grow Max internationally and make streaming solidly profitable (management targeted about $1B of streaming adjusted EBITDA in 2025), run the cable networks for cash as they decline, make the studio consistently profitable, cut debt toward its leverage target of 2.5x to 3.0x, and keep the 'strategic flexibility' of the new two-division structure.",
    competitors: ["Netflix", "Disney", "Comcast NBCUniversal", "Paramount Global", "Amazon Prime Video"],
    // FY2023 10-K, the latest full year public at the cutoff (USD millions): revenue $41,321M, costs of revenues
    // $24,526M (excl. D&A), SG&A $9,696M as opex. EV/EBITDA: about $26B market cap plus about $37B net debt over
    // about $9.5B trailing adjusted EBITDA. check
    annual_revenue: 41321, gross_margin_pct: 40.6, opex: 9696, ev_ebitda_multiple: 7,
    reforecast_due: "2025-01-15",
    assumptions: [
      { text: "Max keeps adding subscribers in 2025 through new markets and password-sharing enforcement", driver: "Streaming subscribers", status: "monitoring" },
      { text: "Streaming profit keeps rising toward the $1B adjusted EBITDA target", driver: "Streaming profitability", status: "monitoring" },
      { text: "Network revenue keeps falling as pay-TV homes shrink and the NBA leaves TNT", driver: "Linear networks", status: "monitoring" },
      { text: "The 2025 film slate does better than 2024's", driver: "Studios", status: "monitoring" },
      { text: "Free cash flow keeps cutting debt toward the 2.5x to 3.0x leverage target", driver: "Debt and leverage", status: "monitoring" },
    ],
  },
  known_at_cutoff: [
    "FY2023 (10-K filed February 2024): revenue $41.3B, adjusted EBITDA $10.4B, operating loss $1.4B after $8.0B of depreciation and amortization, free cash flow $6.2B, 97.7M streaming subscribers at year end.",
    "2024 quarterly revenue: Q1 $9.96B, Q2 $9.71B, Q3 $9.62B. Q2 included a $9.1B goodwill impairment of the networks business.",
    "Streaming subscribers: 99.6M (Q1 2024), 103.3M (Q2), 110.5M (Q3), helped by Max launches in Latin America (February 2024) and Europe (from May 2024). WBD said in March 2024 it would start limiting password sharing late in 2024 and widen it in 2025.",
    "In July 2024 the NBA turned down TNT's matching offer and gave its games to Amazon, NBC and ESPN from the 2025-26 season. WBD sued, then settled in November 2024 (highlight and international rights; Inside the NBA licensed to ESPN). TNT keeps the NBA through the 2024-25 season.",
    "On December 12, 2024 WBD said it would reorganize into two divisions, Global Linear Networks and Streaming & Studios, by mid-2025, to give it 'strategic flexibility'.",
    "Share price at the December 31, 2024 close: $10.57.",
  ],
  quarters: [
    { id: "2025-Q1", label: "Q1 2025", span: "Jan–Mar 2025", start: "2025-01-01", end: "2025-03-31", actual: 8.98, unit: "USD B", source: "Q1 2025 earnings release, May 8, 2025 (sec.gov 8-K 0001437107-25-000093 Ex.99.1): $8,979M (snippet)", check: true },
    { id: "2025-Q2", label: "Q2 2025", span: "Apr–Jun 2025", start: "2025-04-01", end: "2025-06-30", actual: 9.81, unit: "USD B", source: "Q2 2025 earnings release, Aug 7, 2025 (sec.gov 8-K 0001437107-25-000189 Ex.99.1): $9,812M (snippet)", check: true },
    { id: "2025-Q3", label: "Q3 2025", span: "Jul–Sep 2025", start: "2025-07-01", end: "2025-09-30", actual: 9.05, unit: "USD B", source: "Q3 2025 earnings release, Nov 6, 2025 (sec.gov 8-K 0001437107-25-000213 Ex.99.1): $9,045M (snippet)", check: true },
    { id: "2025-Q4", label: "Q4 2025", span: "Oct–Dec 2025", start: "2025-10-01", end: "2025-12-31", actual: 9.46, unit: "USD B", source: `${WBD_Q4_2025}: $9,460M (snippet)`, check: true },
  ],
  kpis: [
    { id: "rev_growth", name: "FY2025 revenue growth vs FY2024", unit: "%", base: 0, base_note: "Up means revenue grew", flat_band: 1, actual: -5.1, source: "FY2025 $37,296M (the four 2025 quarters) vs FY2024 $39,321M (Q4 2024 release, sec.gov 8-K 0001437107-25-000028) (snippets)", check: true },
    { id: "ebitda_margin", name: "FY2025 adjusted EBITDA margin", unit: "%", base: 25.2, base_note: "FY2023 adjusted EBITDA ($10.4B) over revenue ($41.3B), the latest full year at the cutoff; WBD's GAAP operating income is dominated by merger amortization", flat_band: 1, actual: 23.4, source: "Adjusted EBITDA about $2.10B (Q1, backed out of the Q1 2026 release's +5% to $2,203M), $1,953M (Q2), $2.47B (Q3), $2,216M (Q4) = about $8.74B on $37.30B (snippets); replace with the full-year figure in the Q4 2025 release. FY2023 $10.4B from memory (a checker recalled $10.2B, which would make the base 24.6)", check: true },
    { id: "streaming_net_adds", name: "Streaming subscriber net adds in 2025", unit: "M", base: 17.1, base_note: "2024 at the Q1-Q3 pace: 97.7M to 110.5M is 12.8M in three quarters, times 4/3; WBD gives no subscriber guidance", flat_band: 1, actual: 14.7, source: `Streaming subscribers 116.9M at December 31, 2024 (Q4 2024 release, sec.gov 8-K 0001437107-25-000028; memory) to 131.6M at December 31, 2025 (${WBD_Q4_2025}; snippet)`, check: true },
    { id: "excess_return", name: "WBD 2025 share price change minus the S&P 500's 2025 price change", unit: "pp", base: 0, base_note: "Up means WBD beat the index", flat_band: 5, actual: 156.3, source: "WBD +172.6% in 2025: the FY2025 10-K performance graph puts $100 invested in April 2022 at $42.66 (Dec 31, 2024) and $116.30 (Dec 31, 2025); from the $10.57 close, about $28.8. S&P 500 5,881.63 to 6,845.50 (+16.4%, AP year-end report)", check: true },
  ],
  questions: [
    { id: "q_split_plan", text: "Will WBD announce a plan to separate its cable networks from its studios and streaming business as two public companies during 2025?", outcome: true, resolution: "Announced June 9, 2025: Streaming & Studios and Global Networks to separate by mid-2026.", source: "WBD announcement, June 9, 2025 (TheWrap, C21Media snippets)", check: true },
    { id: "q_split_done", text: "Will WBD complete a spin-off, split-off or sale of its cable networks business by December 31, 2025?", outcome: false, resolution: "No. The separation of the networks (as Discovery Global) was targeted for mid-2026, and under the December 5 Netflix agreement it was to come before that sale closed; nothing had closed at year end.", source: "WBD announcements, June 9 and December 5, 2025 (snippets)", check: true },
    { id: "q_sale_agreement", text: "Will WBD sign a definitive agreement by December 31, 2025 to sell the whole company or its studios and streaming business?", outcome: true, resolution: "Dec 5, 2025: agreement for Netflix to buy Warner Bros. (studios, HBO, HBO Max) for $27.75 a share.", source: "WBD and Netflix announcement, Dec 5, 2025 (PBS, Deseret snippets)", check: true },
    { id: "q_revenue_up", text: "Will WBD's FY2025 revenue exceed its FY2024 revenue?", outcome: false, resolution: "$37.30B vs $39.32B (-5%).", source: `Quarterly earnings releases; ${WBD_Q4_2025} (snippets)`, check: true },
    { id: "q_subs_130", text: "Will WBD report at least 130 million global streaming subscribers at December 31, 2025?", outcome: true, resolution: "131.6M at December 31, 2025.", source: `${WBD_Q4_2025} (snippet)`, check: true },
    { id: "q_subs_every_quarter", text: "Will WBD's streaming subscriber count rise in every quarter of 2025?", outcome: true, resolution: "Q1 +5.3M (122.3M), Q2 +3.4M (125.7M), Q3 +2.3M (128.0M), Q4 +3.5M (131.6M); the reported increments do not sum exactly because of rounding.", source: "2025 quarterly earnings releases (snippets)", check: true },
    { id: "q_rename", text: "Will WBD rename its Max streaming service during 2025?", outcome: true, resolution: "Announced May 14, 2025 at the Upfront; Max became HBO Max again on July 9, 2025.", source: "Newscaststudio and TechCrunch, May 14, 2025 (snippets); relaunch date from memory", check: true },
    { id: "q_price_rise", text: "Will WBD raise the price of at least one US plan of its Max streaming service during 2025?", outcome: true, resolution: "Yes. On October 21, 2025 US prices of HBO Max (Max's name from July) rose: Basic with Ads to $10.99, Standard to $18.49, Premium to $22.99.", source: "October 2025 news coverage (memory)", check: true },
    { id: "q_uk_launch", text: "Will WBD launch its Max streaming service as a stand-alone service in the UK during 2025?", outcome: false, resolution: "No. HBO content stayed with Sky in the UK through 2025; in February 2025 WBD set the UK launch for 2026.", source: "Q4 2024 results, Feb 27, 2025 (memory)", check: true },
    { id: "q_dividend", text: "Will WBD start paying a cash dividend during 2025?", outcome: false, resolution: "WBD paid no dividend.", source: "WBD 2025 filings (memory)", check: true },
    { id: "q_ceo", text: "Will David Zaslav stop being WBD's CEO during 2025?", outcome: false, resolution: "Zaslav stayed CEO through 2025 and was named to lead Warner Bros. after the planned split.", source: "WBD announcement, June 9, 2025 (snippets)", check: true },
    { id: "q_beat_index", text: "Will WBD stock outperform the S&P 500 in 2025?", outcome: true, resolution: "WBD about +173% vs S&P 500 about +16%.", source: "Price history (memory)", check: true },
  ],
  actions: [
    { id: "a_venu", date: "2025-01-10", kind: "decision", text: "With Disney and Fox, dropped the planned Venu Sports streaming joint venture, after the three agreed on January 6 to pay Fubo $220M to settle its lawsuit.", source: "Disney and Fubo announcement, Jan 6, 2025 (NBC News snippet); Venu decision date from memory", check: true },
    { id: "a_intl", date: "2025-02-27", kind: "decision", text: "Said Max would launch in the UK, Ireland, Germany and Italy in 2026 and set a goal of passing 150M streaming subscribers by the end of 2026.", source: "Q4 2024 results, Feb 27, 2025 (sec.gov 8-K 0001437107-25-000028; launch markets from memory); the Q1 2025 shareholder letter (sec.gov 8-K 0001437107-25-000093) repeats the 150M goal (snippet)", check: true },
    { id: "a_rename", date: "2025-05-14", kind: "decision", text: "Announced at its Upfront that Max would be renamed HBO Max (relaunched July 9, 2025).", source: "Newscaststudio and TechCrunch, May 14, 2025 (snippets)", check: true },
    { id: "a_debt", date: "2025-06-02", kind: "decision", text: "Arranged a $17.5B bridge loan and launched tender offers for its bonds to reorganize debt ahead of a split; buying bonds below par produced a $3.0B pre-tax gain in Q2.", source: "Q2 2025 earnings release (sec.gov 8-K 0001437107-25-000189) for the $3.0B gain (snippet); bridge size and tender date from memory", check: true },
    { id: "a_split", date: "2025-06-09", kind: "decision", text: "Announced a plan to separate into two public companies by mid-2026: Streaming & Studios (Warner Bros. film and TV, DC, HBO, HBO Max), led by David Zaslav, and Global Networks (CNN, TNT Sports US, Discovery, discovery+), led by CFO Gunnar Wiedenfels.", source: "WBD announcement, June 9, 2025 (TheWrap, C21Media snippets)", check: true },
    { id: "a_password", date: "2025-08-07", kind: "decision", text: "Said HBO Max would enforce its password-sharing rules much more aggressively from the fall of 2025, after soft messaging that began in 2024.", source: "Q2 2025 earnings call coverage (snippet without a date; day approximate)", check: true },
    { id: "a_review", date: "2025-10-21", kind: "decision", text: "Opened a review of strategic alternatives after unsolicited interest from several parties, including a sale of the whole company or of Warner Bros., alongside the planned split; it had reportedly rejected Paramount Skydance proposals of about $20 and $24 a share.", source: "WBD announcement, Oct 21, 2025; Reuters (Mediaweek snippet)", check: true },
    { id: "a_price", date: "2025-10-21", kind: "decision", text: "Raised US HBO Max prices: Basic with Ads to $10.99, Standard to $18.49 and Premium to $22.99 a month.", source: "October 2025 news coverage (memory)", check: true },
    { id: "a_netflix", date: "2025-12-05", kind: "decision", text: "Agreed to sell Warner Bros. (studios, HBO, HBO Max) to Netflix for $27.75 a share ($23.25 cash plus $4.50 in Netflix stock; about $82.7B enterprise value), to close after the cable networks are spun off as Discovery Global.", source: "WBD and Netflix announcement, Dec 5, 2025 (PBS, Deseret snippets)", check: true },
    { id: "r_paramount_approach", date: "2025-09-11", kind: "risk_event", text: "Reports that Paramount Skydance was preparing a bid for WBD sent the shares up about 29% in a day, putting the company in play.", source: "Wall Street Journal report, Sep 11, 2025 (memory)", check: true },
    { id: "r_nba", date: "2025-10-21", kind: "risk_event", text: "The NBA left TNT from the 2025-26 season; WBD said the NBA's absence took about 4 points off Q4 2025 advertising growth.", source: `${WBD_Q4_2025} (snippet); season start date from memory`, check: true },
    { id: "r_hostile", date: "2025-12-08", kind: "risk_event", text: "Paramount Skydance launched a hostile all-cash tender offer of $30 a share for all of WBD (about $108.4B including debt); the board recommended rejecting it on December 17.", source: "Deseret, PBS and Nasdaq coverage, December 2025 (snippets)", check: true },
  ],
  outcomes: [
    "Revenue fell 5% to $37.3B in 2025 from $39.3B; only Q2 grew year over year, as linear advertising and pay-TV distribution declined.",
    "Streaming subscribers rose from 116.9M to 131.6M during 2025 (+14.7M), up every quarter, helped by international launches; WBD aimed to pass 150M by the end of 2026.",
    "The studio had a strong box-office year (A Minecraft Movie, Sinners, Superman, Weapons): Studios revenue rose 55% in Q2 and 24% in Q3.",
    "Adjusted EBITDA was about $8.7B, about 23% of revenue (25% in FY2023); the NBA left TNT from the 2025-26 season, cutting advertising.",
    "Max was renamed HBO Max in July 2025, US HBO Max prices rose in October 2025, and password-sharing enforcement was stepped up.",
    "In June 2025 WBD announced a split into two public companies by mid-2026 and reorganized its debt with a bridge loan and bond tenders (a $3.0B gain in Q2).",
    "After takeover approaches from Paramount Skydance, WBD opened a strategic review on October 21 and on December 5 agreed to sell Warner Bros. (studios, HBO, HBO Max) to Netflix for $27.75 a share, with the networks to be spun off as Discovery Global.",
    "Paramount Skydance answered with a hostile $30-a-share cash tender for the whole company on December 8, which the board rejected; the contest carried into 2026 and neither the split nor any sale closed in 2025.",
    "WBD stock rose about 173% in 2025, far ahead of the S&P 500 (about +16%), driven by the takeover interest; WBD paid no dividend.",
  ],
  caveats: [
    "One company is a case study, not a benchmark: with 12 yes/no questions, a single answer moves accuracy by about 8 points.",
    "Any current Claude model was trained on data that includes 2025 and may remember the split plan and the Netflix and Paramount bidding war. Compare the news run with the no-news run: the gap is what the 2024 news added. No one could name the buyer or price from 2024 news, so advice to separate or sell the networks or the studios and streaming business is the most a forecaster could anticipate.",
    "Every ground-truth item is marked check: the earnings releases and filings could not be opened while this case was written or fact-checked. Confirm each against WBD's 8-K earnings releases, the FY2023 10-K (its adjusted EBITDA sets the margin base) and the FY2025 10-K, and the 2025 closes against a price history.",
  ],
};

// Spotify, frozen at 2025-06-30, scored on July 2025 to June 2026. Spotify reports in euros: the quarterly revenue
// (the answer key) is in EUR billions as reported. The profile's financials are converted to USD millions, the unit
// every client profile uses, at the ECB reference rate on the cutoff day (1.1720), never at a later rate.
// SOURCES: sec.gov, investors.spotify.com (and its q4cdn file host) and newsroom.spotify.com could not be opened from
// the build environment, so every item is marked check: true. Figures come from search results that quoted the 6-K
// exhibits, from press coverage of them, or, where the source says so, from memory. Confirm each against the 6-K
// Ex.99.1 releases, the interim 6-K reports and the 2024 and 2025 Forms 20-F.
const SPOT_6K = "https://www.sec.gov/Archives/edgar/data/1639920";
const SPOT_Q4_2024 = `${SPOT_6K}/000114036125002936/ef20042791_ex99-1.htm`; // Q4 2024 results, Feb 4, 2025
const SPOT_Q2_2025 = `${SPOT_6K}/000114036125027654/ef20052398_ex99-1.htm`; // Q2 2025 results, Jul 29, 2025
const SPOT_H1_2025 = `${SPOT_6K}/000163992025000012/spot-20250630x6xk.htm`; // interim report to June 30, 2025 (6-K)
const SPOT_Q3_2025 = `${SPOT_6K}/000114036125040271/ef20057592_ex99-1.htm`; // Q3 2025 results, Nov 4, 2025
const SPOT_Q4_2025 = `${SPOT_6K}/000114036126004482/ef20065075_ex99-1.htm`; // Q4 2025 results, Feb 10, 2026
const SPOT_Q1_2026 = `${SPOT_6K}/000114036126017211/ef20071303_ex99-1.htm`; // Q1 2026 results, Apr 28, 2026
const SPOT_Q2_2026 = `${SPOT_6K}/000114036126031044/ef20078867_ex99-1.htm`; // Q2 2026 results, Aug 4, 2026
const SPOT_20F_2025 = `${SPOT_6K}/000162828026006874/ck0001639920-20251231.htm`; // FY2025 Form 20-F

export const SPOTIFY_2025_26: EvalCase = {
  key: "spotify-2025-26", company: "Spotify", ticker: "SPOT",
  cutoff: "2025-06-30",
  horizon: { start: "2025-07-01", end: "2026-06-30", label: "Jul 2025–Jun 2026 (Q3 2025 to Q2 2026)" },
  profile: {
    name: "Spotify", industry: "Audio streaming", ticker: "SPOT",
    business_model: "Freemium audio streaming in more than 180 markets, reporting in euros. A free ad-supported tier brings in listeners and a paid Premium tier (Individual, Duo, Family, Student) earns most of the money. Revenue is roughly Premium subscribers times average revenue per user (ARPU), plus advertising sold against free listeners and podcasts. Royalties to record labels, music publishers and other rights holders are the largest cost.",
    revenue_streams: "Premium subscriptions (about 88% of FY2024 revenue), which in a growing number of markets include 15 hours of audiobooks a month. Ad-supported revenue (about 12%): audio and video ads on the free tier, podcast ads and sponsorships, sold directly and programmatically, including the Spotify Ad Exchange launched in April 2025.",
    cost_structure: "Cost of revenue (about 70% of revenue in FY2024, a 30.1% gross margin) is mostly royalties to labels, publishers and other rights holders, plus podcast and audiobook content and delivery. Operating expenses are research and development, sales and marketing, and general and administrative; they include social charges (payroll taxes on employee share awards, mainly in Sweden) that rise and fall with the share price. Spotify reports in euros but earns much of its revenue in US dollars and other currencies, so exchange rates move reported revenue.",
    financial_drivers: "Premium subscriber net adds, Premium ARPU (price rises, plan and market mix, foreign exchange), monthly active user growth, advertising revenue, royalty terms and the mix of podcasts, audiobooks and marketplace programs in gross margin, social charges tied to the share price, operating expense discipline.",
    strategic_objectives: "Keep growing users toward the 1 billion goal set at its 2022 investor day and keep adding Premium subscribers, raise prices market by market, widen gross margin and operating margin after its first full year of net profit in 2024, reaccelerate advertising growth with programmatic sales and video podcasts, and add higher-priced options for superfans.",
    competitors: ["YouTube Music", "Apple Music", "Amazon Music", "Audible"],
    // FY2024 (Form 20-F; Q4 2024 6-K at SPOT_Q4_2024), the latest full year public at the cutoff: revenue €15,673M
    // and opex €3,349M (gross profit minus operating income), converted to USD millions at the ECB rate of 1.1720 on
    // June 30, 2025 (EUR-Lex notice C/2025/3118). EV/EBITDA is approximate: EV about €127B over trailing EBITDA
    // about €1.8B. check
    annual_revenue: 18369, gross_margin_pct: 30.1, opex: 3925, ev_ebitda_multiple: 70,
    reforecast_due: "2025-07-15",
    assumptions: [
      { text: "Premium subscribers keep growing about 10% a year", driver: "Premium subscribers", status: "monitoring" },
      { text: "Price rises outside the US lift ARPU without raising churn", driver: "Pricing", status: "monitoring" },
      { text: "Gross margin keeps widening as royalty mix, podcasts and audiobooks improve", driver: "Gross margin", status: "monitoring" },
      { text: "Advertising growth reaccelerates with programmatic sales and video podcasts", driver: "Advertising", status: "monitoring" },
      { text: "The strong euro is a headwind to reported growth but stops worsening", driver: "Foreign exchange", status: "monitoring" },
    ],
  },
  known_at_cutoff: [
    "FY2024 (results February 4, 2025; Form 20-F): revenue €15.67B (Premium €13.82B, ad-supported €1.86B), gross margin 30.1%, operating income €1.37B (8.7% margin) and net income €1.14B, Spotify's first full year of net profit; 675M monthly active users (MAU) and 263M Premium subscribers at year end.",
    "Q1 2025 (April 29, 2025): revenue €4.19B (+15% year over year), gross margin 31.6%, operating income €509M (below the €548M guidance because of social charges); 678M MAU and 268M Premium subscribers.",
    "Q2 2025 guidance (April 29, 2025): 689M MAU, 273M Premium subscribers, revenue about €4.3B, gross margin 31.5%, operating income €539M.",
    "In late April 2025 the Financial Times reported that Spotify planned to raise Premium prices by about €1 a month across Europe and Latin America, possibly from June, with the US excluded; prices had already risen in the Benelux countries. The US Premium Individual plan was $11.99 after a 2024 increase.",
    "The euro rose from about $1.04 at the start of 2025 to about $1.18 at June 30, 2025. Spotify reports in euros but earns much of its revenue in US dollars and other currencies, so a stronger euro lowers reported revenue growth relative to constant-currency growth.",
    "Share price at the June 30, 2025 close: about $767, just below the record close of $775.90 on June 26 and more than double its level a year earlier.",
    "The profile's financials are FY2024 euros converted to US dollars at the ECB rate on June 30, 2025 ($1.1720 per euro). The quarterly revenue to forecast is in euros, as Spotify reports it.",
  ],
  quarters: [
    { id: "2025-Q3", label: "Q3 2025", span: "Jul–Sep 2025", start: "2025-07-01", end: "2025-09-30", actual: 4.27, unit: "EUR B", source: `Q3 2025 results, 6-K Ex.99.1 (${SPOT_Q3_2025}): revenue €4,272M (+7% reported, +12% constant currency)`, check: true },
    { id: "2025-Q4", label: "Q4 2025", span: "Oct–Dec 2025", start: "2025-10-01", end: "2025-12-31", actual: 4.53, unit: "EUR B", source: `Q4 2025 results, 6-K Ex.99.1 (${SPOT_Q4_2025}): revenue €4.53B (+7% reported, +13% constant currency); Premium €4,013M plus ad-supported €518M per press coverage`, check: true },
    { id: "2026-Q1", label: "Q1 2026", span: "Jan–Mar 2026", start: "2026-01-01", end: "2026-03-31", actual: 4.53, unit: "EUR B", source: `Q1 2026 results, 6-K Ex.99.1 (${SPOT_Q1_2026}): revenue €4.53B (+8% reported, +14% constant currency); €4,533M (Premium €4,148M plus ad-supported €385M) per Music Business Worldwide`, check: true },
    { id: "2026-Q2", label: "Q2 2026", span: "Apr–Jun 2026", start: "2026-04-01", end: "2026-06-30", actual: 4.78, unit: "EUR B", source: `Q2 2026 results, August 4, 2026, 6-K Ex.99.1 (${SPOT_Q2_2026}): revenue €4,777M (+14% reported, +15% constant currency)`, check: true },
  ],
  kpis: [
    { id: "rev_growth", name: "Revenue growth, Jul 2025–Jun 2026 vs Jul 2024–Jun 2025 (reported, in euros)", unit: "%", base: 0, base_note: "Up means revenue grew", flat_band: 1, actual: 9.0,
      source: `€18,113M (4,272 + 4,531 + 4,533 + 4,777) vs €16,613M (Q3 2024 3,988 + Q4 2024 4,242 + Q1 2025 4,190 + Q2 2025 4,193); prior-year quarters from memory and press coverage (Q4 2024: ${SPOT_Q4_2024}), consistent with the reported growth of +7%, +7%, +8% and +14%`, check: true },
    { id: "op_margin", name: "Operating margin, Jul 2025–Jun 2026", unit: "%", base: 8.7, base_note: "FY2024 operating margin, the latest full year at the cutoff", flat_band: 1, actual: 14.6,
      source: "Operating income €582M + €701M + €715M + €655M = €2,653M on revenue €18,113M (6-K releases via press coverage)", check: true },
    { id: "sub_net_adds", name: "Premium subscriber net adds, Jul 2025–Jun 2026", unit: "M", base: 27, base_note: "Jul 2024–Jun 2025 as expected at the cutoff: 246M at June 30, 2024 to the 273M Q2 2025 guidance", flat_band: 1, actual: 24,
      source: "Premium subscribers 276M (June 30, 2025) to 300M (June 30, 2026), per the Q2 2025 and Q2 2026 releases via press coverage", check: true },
    { id: "excess_return", name: "SPOT share price change minus the S&P 500's price change, June 30, 2025 to June 30, 2026", unit: "pp", base: 0, base_note: "Up means Spotify beat the index", flat_band: 5, actual: -61,
      source: "SPOT about $767 (June 30, 2025) to about $459 (June 2026 month end, Digrin; $468 on June 21, TIKR): about -40%. S&P 500 6,204.95 (June 30, 2025, memory) to about 7,499 (2025 close 6,845.50 plus the +9.55% first-half 2026 price return; 7,440.43 on June 29): about +21%. Confirm both June 30 closes", check: true },
  ],
  questions: [
    { id: "q_price_intl", text: "Will Spotify announce a Premium price increase covering several markets outside the US between July 1 and December 31, 2025?", outcome: true,
      resolution: "Announced August 4, 2025: Premium Individual from €10.99 to €11.99 from September in markets across South Asia, the Middle East, Africa, Europe, Latin America and Asia-Pacific; the US was excluded.", source: "TechCrunch, August 4, 2025 (https://techcrunch.com/2025/08/04/spotify-raises-subscription-prices)", check: true },
    { id: "q_us_price", text: "Will Spotify raise the price of its US Premium Individual plan by June 30, 2026?", outcome: true,
      resolution: "Announced January 15, 2026: $11.99 to $12.99 a month from February billing dates; Duo, Family and Student also rose.", source: "Android Authority, January 15, 2026 (https://www.androidauthority.com/spotify-premium-us-price-hike-3632761)", check: true },
    { id: "q_ceo", text: "Will Spotify announce a change to its CEO structure by June 30, 2026?", outcome: true,
      resolution: "Announced September 30, 2025: Daniel Ek to become executive chairman and co-presidents Gustav Söderström and Alex Norström co-CEOs from January 1, 2026.", source: "Spotify press release, September 30, 2025 (https://newsroom.spotify.com/2025-09-30/spotify-announcement-daniel-ek-executive-chairman/)", check: true },
    { id: "q_lossless", text: "Will Spotify make lossless audio available to Premium subscribers at no extra charge by December 31, 2025?", outcome: true,
      resolution: "Rolled out from September 10, 2025 inside existing Premium plans at no extra cost, starting in about a dozen markets and reaching more than 50 by the end of October.", source: "SoundGuys and PCWorld, September 2025 (https://www.soundguys.com/spotify-rolls-out-lossless-audio-for-premium-users-144173/; https://www.pcworld.com/article/2905194/spotify-brings-ultra-quality-lossless-audio-to-all-premium-subscribers.html)", check: true },
    { id: "q_buyback", text: "Will Spotify increase its share repurchase authorization by June 30, 2026?", outcome: true,
      resolution: "On July 29, 2025 the board approved an additional $1.0B for the repurchase program.", source: `Interim report to June 30, 2025, 6-K (${SPOT_H1_2025}), and FY2025 Form 20-F (${SPOT_20F_2025}), as quoted in search results`, check: true },
    { id: "q_mau_750", text: "Will Spotify report at least 750 million monthly active users for Q4 2025?", outcome: true,
      resolution: "751M MAU at December 31, 2025, after a record 38M added in the quarter.", source: `Q4 2025 results (${SPOT_Q4_2025}); Music Week, February 10, 2026`, check: true },
    { id: "q_gm_33", text: "Will Spotify report a gross margin of 33% or higher in any quarter from Q3 2025 to Q2 2026?", outcome: true,
      resolution: "33.1% in Q4 2025, 33.0% in Q1 2026 and 33.4% in Q2 2026 (31.6% in Q3 2025).", source: "Quarterly 6-K releases via press coverage", check: true },
    { id: "q_oi_2_3b", text: "Will Spotify's full-year 2025 operating income be at least €2.3 billion?", outcome: false,
      resolution: "No: about €2.2B (€509M + €406M + €582M + €701M = €2,198M); Q2 2025 fell short of guidance after €116M of social charges.", source: "Quarterly 6-K releases via press coverage; Music Business Worldwide, February 10, 2026", check: true },
    { id: "q_ads_q4", text: "Will Spotify's ad-supported revenue in Q4 2025 be higher than in Q4 2024, in reported euros?", outcome: false,
      resolution: "€518M as first reported on February 10, 2026, down 4% reported (up 4% at constant currency). Some ad-supported activities moved to Premium from January 1, 2026, and later releases recast earlier periods.", source: `Q4 2025 results (${SPOT_Q4_2025}) via TheWrap and Music Business Worldwide`, check: true },
    { id: "q_beat_index", text: "Will Spotify stock outperform the S&P 500 from June 30, 2025 to June 30, 2026?", outcome: false,
      resolution: "SPOT fell about 40% (about $767 to about $459) while the S&P 500 rose about 21%.", source: "Digrin and TIKR price history; S&P 500 2025 close (AP) and first-half 2026 return (Motley Fool); closes to be confirmed", check: true },
    { id: "q_dividend", text: "Will Spotify declare a cash dividend by June 30, 2026?", outcome: false,
      resolution: "No dividend was declared; capital went to buybacks.", source: "FY2025 Form 20-F and 2026 releases", check: true },
    { id: "q_big_deal", text: "Will Spotify announce an acquisition worth more than $1B by June 30, 2026?", outcome: false,
      resolution: "No such acquisition was announced.", source: "FY2025 Form 20-F and 2026 releases", check: true },
  ],
  actions: [
    { id: "a_buyback", date: "2025-07-29", kind: "decision", text: "Board approved an additional $1.0B for the share repurchase program.", source: `Interim report to June 30, 2025, 6-K (${SPOT_H1_2025}), and FY2025 Form 20-F (${SPOT_20F_2025}), as quoted in search results`, check: true },
    { id: "a_price_intl", date: "2025-08-04", kind: "decision", text: "Raised Premium prices from September in markets across South Asia, the Middle East, Africa, Europe, Latin America and Asia-Pacific (Individual €10.99 to €11.99); the US was excluded.", source: "TechCrunch, August 4, 2025", check: true },
    { id: "a_lossless", date: "2025-09-10", kind: "decision", text: "Began rolling out lossless audio to Premium subscribers at no extra cost, rather than as a separately priced tier, starting in about a dozen markets (including the US, UK, Germany, Japan and Australia) and reaching more than 50 by the end of October.", source: "SoundGuys; PCWorld, September 2025", check: true },
    { id: "a_coceo", date: "2025-09-30", kind: "decision", text: "Announced that Daniel Ek would become executive chairman and Gustav Söderström and Alex Norström co-CEOs from January 1, 2026.", source: "Spotify press release, September 30, 2025", check: true },
    { id: "a_netflix", date: "2025-10-14", kind: "decision", text: "Agreed with Netflix to put a selection of Spotify Studios and The Ringer video podcasts on Netflix, in the US from early 2026.", source: "Spotify newsroom, October 14, 2025 (https://newsroom.spotify.com/2025-10-14/netflix-partnership-the-ringer-spotify-studios-video-podcasts/)", check: true },
    { id: "a_ai_labels", date: "2025-10-16", kind: "decision", text: "Announced work with Sony Music, Universal Music, Warner Music, Merlin and Believe on licensed, artist-first AI music products.", source: "Spotify newsroom, October 16, 2025 (from memory; not retrieved)", check: true },
    { id: "a_us_price", date: "2026-01-15", kind: "decision", text: "Raised US Premium prices from February 2026: Individual $11.99 to $12.99, Duo $18.99, Family $21.99, Student $6.99.", source: "Android Authority; GSMArena, January 15, 2026", check: true },
    { id: "r_q2_miss", date: "2025-07-29", kind: "risk_event", text: "Q2 2025 results missed guidance: revenue €4.19B vs about €4.3B as the strong euro cut about €104M, and operating income €406M vs €539M after €116M of social charges; the shares fell.", source: `Q2 2025 results (${SPOT_Q2_2025}) via Hypebot and GSMArena`, check: true },
    { id: "r_boycott", date: "2025-07-25", kind: "risk_event", text: "King Gizzard & the Lizard Wizard pulled its music on July 25, 2025 over Daniel Ek's investment in defense company Helsing, joining Deerhoof and Xiu Xiu; Massive Attack followed in September 2025.", source: "The Fader, July 29, 2025 (https://www.thefader.com/2025/07/29/all-artists-bands-boycotting-spotify); DroneXL, August 4, 2025; Complete Music Update, September 19, 2025", check: true },
    { id: "r_ads_q1", date: "2026-04-28", kind: "risk_event", text: "Q1 2026 results: ad-supported revenue fell 5% year over year in euros to €385M (up 3% at constant currency; prior year recast after some ad-supported activities moved to Premium on January 1, 2026), and Q2 operating income guidance (€630M) was below the Q1 level; the shares fell about 13%.", source: `Q1 2026 results (${SPOT_Q1_2026}) via Music in Africa (https://www.musicinafrica.net/magazine/spotify-reports-subscriber-growth-ad-revenue-declines-q1-2026-results) and Music Business Worldwide`, check: true },
  ],
  outcomes: [
    "Revenue grew about 9% in reported euros from July 2025 to June 2026 (€18.1B vs €16.6B a year earlier). Constant-currency growth was 12-15% a quarter; the strong euro cut reported growth by 5-6 points a quarter from Q3 2025 to Q1 2026 and by about 1 point in Q2 2026.",
    "Premium subscribers rose from 276M to 300M (+24M) and monthly active users from 696M to 777M, including a record 38M MAU added in Q4 2025.",
    "Gross margin rose from 31.5% in Q2 2025 to 33% or more from Q4 2025 (33.1%, 33.0% and 33.4%); operating income was €582M, €701M, €715M and €655M, about 14.6% of revenue over the period vs 8.7% in FY2024, and about €2.2B for calendar 2025.",
    "Spotify raised Premium prices in many markets outside the US from September 2025 and in the US (Individual $11.99 to $12.99) from February 2026, and subscriber growth continued.",
    "Advertising stayed weak: ad-supported revenue fell in reported euros (down 6% in Q3 2025, 4% in Q4 2025 and 5% in Q1 2026, the last against a prior year recast after some ad-supported activities moved to Premium on January 1, 2026) and was flat to up 4% at constant currency.",
    "Daniel Ek became executive chairman on January 1, 2026, with Gustav Söderström and Alex Norström as co-CEOs.",
    "Spotify began rolling out lossless audio inside Premium at no extra cost in September 2025 (more than 50 markets by the end of October) and agreed in October 2025 to put Spotify Studios and The Ringer video podcasts on Netflix from early 2026.",
    "Spotify stock fell about 40% over the period (about $767 to about $459, with a low near $428 after the Q1 2026 results on April 28, 2026) while the S&P 500 rose about 21%.",
    "Free cash flow stayed strong (€797M in Q2 2026, €3.3B over the last twelve months), and the board added $1.0B to the buyback in July 2025.",
  ],
  caveats: [
    "One company is a case study, not a benchmark: with 12 yes/no questions, a single answer moves accuracy by about 8 points.",
    "Claude models trained on data from late 2025 or 2026 may remember part of this horizon, such as the August 2025 price rises or Ek's move to executive chairman. Compare the news run with the no-news run: the gap is what the news up to June 2025 added.",
    "Figures are in euros, as Spotify reports them. Every item is marked check because sec.gov, Spotify's investor-relations site and its newsroom could not be opened, so figures come from search results quoting the 6-K releases, press coverage and in places memory. Confirm each against the 6-K releases and the 2024 and 2025 Forms 20-F, and the share-price KPI against the June 30, 2025 and June 30, 2026 closes of SPOT and the S&P 500.",
  ],
};

export const EVAL_CASES: Record<string, EvalCase> = { [NETFLIX_2023.key]: NETFLIX_2023, [WBD_2025.key]: WBD_2025, [SPOTIFY_2025_26.key]: SPOTIFY_2025_26 };

export const caseCurrency = (c: Pick<EvalCase, "quarters">): Currency => (c.quarters[0]?.unit === "EUR B" ? "EUR" : "USD");
export const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", EUR: "€" };

// What the agents may see: the questions, the KPI definitions and the quarters, never an outcome.
export function publicCase(c: EvalCase) {
  return {
    key: c.key, company: c.company, cutoff: c.cutoff, horizon: c.horizon, known_at_cutoff: c.known_at_cutoff, currency: caseCurrency(c),
    quarters: c.quarters.map(({ id, label, span }) => ({ id, label, span })),
    kpis: c.kpis.map(({ id, name, unit, base, base_note }) => ({ id, name, unit, base, base_note })),
    questions: c.questions.map(({ id, text }) => ({ id, text })),
  };
}
