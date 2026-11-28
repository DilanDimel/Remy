// Explore mode (Dilan, Nov 27: "I love entrepreneurship, finance, accounting and BIS, but I don't know what I want to
// do"): one lane per field the student picked, each in plain words with one 20-minute thing to try this week.
// Nothing here picks a career for them.
export type Lane = { key: string; label: string; plain: string; try: string };
const LANES: [RegExp, Omit<Lane, "key">][] = [
  [/entrepreneur|startup|small business/i, { label: "Entrepreneurship", plain: "Starting and running your own business: finding a problem people pay to solve, then building the thing that solves it.", try: "Write down three problems you or your friends complain about, then pick one and ask two people what they'd pay to fix it." }],
  [/account|audit|\btax\b|\bcpa\b/i, { label: "Accounting", plain: "Keeping a company's money records right and explaining them: what came in, what went out and what's left. Auditors check other companies' books.", try: "Open the annual report of a company you like (search \"<company> 10-K\") and find its revenue and profit for last year." }],
  [/information systems|\bbis\b|\bmis\b|business information|\bit\b/i, { label: "Information systems", plain: "The bridge between business and tech: choosing and running the systems a company uses, and turning its data into decisions.", try: "Pick a free Power BI or Tableau tutorial and make one chart from any spreadsheet you have." }],
  [/data|analytic/i, { label: "Data and analytics", plain: "Finding answers in numbers: cleaning data, spotting patterns and showing them so people can decide.", try: "Do the first 20-minute lesson of a free SQL course and write one query." }],
  [/investment banking|\bib\b/i, { label: "Investment banking", plain: "Helping companies raise money or buy other companies. Long hours, high pay, lots of Excel and slides.", try: "Read one deal announcement on a bank's news page and write two sentences on why the buyer wanted the company." }],
  [/financ|bank|invest|wealth|fintech/i, { label: "Finance", plain: "Deciding where money should go: in a company (corporate finance), for clients (wealth management) or in markets (investing).", try: "Pick one stock you know, look up its price chart for the last year, and write one sentence on why it moved." }],
  [/marketing|brand|advertis|social media/i, { label: "Marketing", plain: "Getting the right people to notice, want and buy something: research, messages, ads and the numbers behind them.", try: "Pick a brand you love and list who it's trying to reach and the one message every ad repeats." }],
  [/consult/i, { label: "Consulting", plain: "Companies hire you to solve one problem fast: you dig into the facts, find the answer and present it.", try: "Watch one free \"case interview\" example and try to solve it before the answer." }],
  [/supply chain|operations|logistic/i, { label: "Supply chain and operations", plain: "Getting products made and delivered on time and on budget, from the factory to your door.", try: "Pick something you own and trace where its parts probably came from and how it reached you." }],
  [/real estate/i, { label: "Real estate", plain: "Buying, selling, financing and managing buildings and land.", try: "Find one listing near campus and work out the rent you'd need to cover the price over 20 years." }],
  [/human resources|\bhr\b|people/i, { label: "Human resources", plain: "Hiring, paying, training and looking after a company's people.", try: "Read three job postings for one role and list what they all ask for." }],
];

/** One lane per picked field (and the major's fields), at most four, in the order the student gave them. */
export function exploreLanes(picked: string[]): Lane[] {
  const out: Lane[] = [];
  for (const p of picked) {
    const hit = LANES.find(([re]) => re.test(p));
    if (!hit) continue;
    const key = hit[1].label.toLowerCase();
    if (!out.some((l) => l.key === key)) out.push({ key, ...hit[1] });
  }
  return out.slice(0, 4);
}
