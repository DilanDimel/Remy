// Remy explains a skill himself, in plain words (Dilan, Nov 27: "Remy is supposed to be the career coach... the user
// shouldn't have to go out to find the information"). Static and free; "What's that?" (AI) still covers the rest.
const PLAIN: [RegExp, string][] = [
  [/\bexcel financial model|financial model/i, "building a spreadsheet that predicts a company's money: sales, costs and profit, year by year"],
  [/\bvaluation\b/i, "working out what a company is worth, the core of banking and investing jobs"],
  [/\bexcel\b/i, "the spreadsheet program almost every business job uses for numbers, lists and charts"],
  [/\bpower ?bi\b/i, "Microsoft's tool for turning spreadsheets and databases into charts and dashboards people can click through"],
  [/\btableau\b/i, "a tool for turning data into charts and dashboards"],
  [/\bsql\b/i, "the language for pulling numbers out of a company's database, like asking it a precise question"],
  [/\bpython\b/i, "a beginner-friendly programming language analysts use to clean data and automate boring work"],
  [/^r$|\bstatistics software|\bstata\b/i, "software for statistics: testing whether a pattern in data is real"],
  [/\bsap\b|\berp\b/i, "the system big companies use to run purchasing, inventory and accounting in one place"],
  [/\bcrm\b|salesforce/i, "the system sales teams use to track every customer and deal"],
  [/\bpowerpoint\b/i, "making slides that explain an idea clearly, which interns do a lot"],
  [/\bquickbooks\b/i, "accounting software small businesses use for invoices, bills and their books"],
  [/\bgaap\b/i, "the rulebook U.S. companies follow when they report their numbers"],
  [/\breconcil/i, "checking that two sets of records match, like a bank statement and the company's books"],
  [/\bcritical thinking\b/i, "asking why, checking the facts and weighing options before you decide"],
  [/\bactive listening\b/i, "really hearing what someone means and asking good follow-up questions"],
  [/\bnegotiat/i, "reaching a deal where both sides get something they need"],
  [/\bwriting\b/i, "clear, short writing: emails, notes and reports people actually read"],
  [/\battention to detail\b/i, "catching small mistakes before they turn into big ones"],
];
export function plainSkill(name: string): string {
  return PLAIN.find(([re]) => re.test(name.trim()))?.[1] || "";
}
