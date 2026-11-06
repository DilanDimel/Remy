// Business-school and economics roads (Nov 5, 2026): research-agent draft, second-agent audit, fixes applied.
// Same shape as roads.ts. Sources were fetched Nov 5, 2026 unless a line says UNVERIFIED.
// In roads.ts, SEASON_SOURCE comes from "./seasons", and SIE, S79, CFAPOL and CAPM are already defined there.
import type { Road } from "./roads";
import { SEASON_SOURCE } from "./seasons";
const SIE = "https://www.finra.org/registration-exams-ce/qualification-exams/securities-industry-essentials-exam";
const S79 = "https://www.finra.org/registration-exams-ce/qualification-exams/series79";
const CFAPOL = "https://www.cfainstitute.org/index.php/programs/cfa-program/policies";
const CAPM = "https://www.pmi.org/certifications/certified-associate-capm";

// New source constants
const ONET = (code: string) => `https://www.onetonline.org/link/summary/${code}`;
const AEA_MATH = "https://www.aeaweb.org/resources/students/grad-prep/math-training";
const AEA_PREP = "https://www.aeaweb.org/resources/students/grad-prep";
const BLS_ECON = "https://www.bls.gov/ooh/life-physical-and-social-science/economists.htm";
const S7 = "https://www.finra.org/registration-exams-ce/qualification-exams/series7";
const CBP_CFR = "https://www.law.cornell.edu/cfr/text/19/111.11";
const SFADMIN = "https://trailhead.salesforce.com/credentials/platformadministrator";
const SBA_REG = "https://www.sba.gov/business-guide/launch-your-business/register-your-business";
// The audit gave sos.state.tx.us/corp/forms_option.shtml; on Nov 5 it was a "This page has moved" stub pointing here:
const TX_SOS_FORMS = "https://www.sos.state.tx.us/corp/forms_boc.shtml";
const TX_SALES_TAX = "https://comptroller.texas.gov/taxes/permit/";
const CBLE = "https://www.cbp.gov/trade/programs-administration/customs-brokers/license-examination-notice-examination/general-cble-information";
const TDI_CAREERS = "https://www.tdi.texas.gov/tips/be-an-agent.html";
const TDI_PC = "https://www.tdi.texas.gov/agent/general-property-apply.html";
const TDI_ADJ = "https://www.tdi.texas.gov/agent/adjuster-all-lines-apply.html";
const CPCU = "https://web.theinstitutes.org/cpcu-matriculation";
const CFP = "https://www.cfp.net/certification-process";
const TSSB_IAR = "https://www.ssb.texas.gov/securities-professionals/dealer-adviser-registration/getting-started-registered-investment-adviser-3";
const NASAA_FAQ = "https://www.nasaa.org/exams/exam-faqs/";
const AAPL = "https://www.landman.org/training-certification/certification/faqs.html";
const TX_ATHLETE = "https://www.sos.state.tx.us/statdoc/athlete-agents.shtml";
const NFLPA = "https://nflpa.com/agents/how-to-become-an-agent";
const TX_CFM = "https://www.dshs.texas.gov/licensing-certified-food-manager-training-programs/frequently-asked-questions-certified-food-manager-cfm-program";
const TABC = "https://www.tabc.texas.gov/faqs/tabc-certification-faqs/";
const CMP = "https://eventscouncil.org/CMP/Future-CMPs/Eligibility-requirements";
const TCU_MINORS = "https://neeley.tcu.edu/degrees-programs/undergraduate/minors.php";
const TCU_CERTS = "https://neeley.tcu.edu/degrees-programs/undergraduate/certificates.php";

// WHERE EACH ONE GOES in ROADS (first match wins):
//   before "finance":       investment-banking, financial-planning
//   right after "finance":  economics, insurance            (so "Financial Economics" and "Financial Risk Management" stay finance)
//   right after "engineering": energy                       (so "Petroleum Engineering" stays engineering)
//   before "marketing" (after "law"): sports-business, hospitality, sales
//   before "management" (after "supply-chain"): entrepreneurship, international-business
//   before "tech" (after "management"): bis
// Drafter's suggested regex additions for EXISTING roads in roads.ts (not applied; roads.ts untouched):
//   supply-chain: add `value chain`
//   finance:      add `fintech`
//   marketing:    add `strategic comm`
export const BUSINESS_ROADS: Road[] = [
  // ---- before finance ----
  { key: "investment-banking", label: "Investment banking", parent: "finance",
    field: /investment bank|mergers (and|&) acquisitions|\bm&a\b/i, credentials: [
    { name: "SIE (Securities Industry Essentials)", need: "optional", who: "Not needed for internships or offers. Banks have you pass it together with the Series 79 after you're hired.", why: "Some students take it early to show interest; it alone doesn't let you do licensed work.", learn: "How securities markets work, who regulates them, and what's not allowed.", when: "Anyone 18+, no sponsor needed", source: SIE },
    { name: "Series 79 + SIE (and usually Series 63)", need: "job", who: "Investment banking analysts who work on deals. The bank sponsors you; you can't take the 79 before you're hired.", why: "FINRA requires the 79 and the SIE for the investment banking registration.", learn: "Deals, valuation, offerings and the rules around them.", when: "After you're hired, usually in your first months", source: S79 },
    { name: "CFA charter", need: "optional", who: "Rarely asked for in banking; more common in investment management and research.", why: "Respected proof of investment knowledge, but it takes years.", learn: "Investment analysis, valuation, portfolio management and ethics.", when: "Level I can be taken within 23 months of graduating", source: CFAPOL },
  ], steps: [
    { year: 1, what: "Join a finance or investment club and learn to read the three financial statements", source: "" },
    { year: 2, what: "Network with bankers and practice Excel valuation models; banks fill junior-summer internships early", source: SEASON_SOURCE },
    { year: 2, what: "Some banks run sophomore programs (insight days, early-ID); many analysts never did one", source: "", optional: true },
    { year: 3, what: "Apply for junior-summer investment banking internships; many full-time analyst offers come from these", source: SEASON_SOURCE },
    { year: 5, what: "Your bank sponsors the Series 79 and SIE (often the 63 too) after you start", source: S79 },
  ], skills: ["Excel financial models", "PowerPoint pitch decks", "Financial statement analysis", "Valuation", "Writing and presenting", "Financial analysis and data tools (like Power BI or SQL), at some banks"],
  skillsSource: ONET("13-2051.00") },

  { key: "financial-planning", label: "Financial planning and wealth management", parent: "finance",
    field: /financial planning|personal financ|wealth manag|financial advis|\bcfp\b/i,
    not: /planning (and|&) analysis|fp&a/i, // FP&A is corporate finance, not personal planning
    credentials: [
    { name: "CFP (Certified Financial Planner)", need: "optional", who: "Not legally required to give advice, but it's the main credential for financial planners, and you need it to call yourself a CFP.", why: "Clients and firms trust it; it shows you can build a whole plan, not just pick investments.", learn: "Retirement, tax, insurance, estate and investment planning, plus ethics.", when: "Finish CFP Board-registered coursework, then the exam; the bachelor's can come up to 5 years after; 6,000 hours of experience (or 4,000 as an apprentice)", source: CFP },
    { name: "Series 65 (or Series 7 + Series 66)", need: "depends", who: "Texas requires it to give investment advice for a fee as an investment adviser representative. Not needed for planning support or operations roles.", why: "It's the state exam for advisers. The 65 needs no sponsor; the 66 also needs the Series 7 (and SIE), and the 7 needs a sponsoring firm. Texas waives the exam for holders of the CFP, CFA, ChFC, PFS or CIC.", learn: "Investment adviser law, ethics and investment basics.", when: "Usually once you're hired into an advisory role", source: NASAA_FAQ }, // Texas waiver: TSSB_IAR FAQ 2.B.3 (checked Nov 5)
    { name: "Series 7 (with the SIE)", need: "job", who: "Advisors at brokerage firms who buy and sell securities for clients. The firm sponsors it.", why: "FINRA requires it for that work; you can't take the 7 without a sponsor.", learn: "Securities products, accounts and trading rules.", when: "After you're hired", source: S7 },
    { name: "Texas life, accident and health agent license", need: "depends", who: "Only if your advisor job includes selling life insurance or annuities.", why: "Texas requires a license to sell them.", learn: "Life and health insurance products, annuities and Texas insurance law.", when: "Pass the state exam, then apply within a year with fingerprints", source: TDI_CAREERS },
  ], steps: [
    { year: 2, what: "Take a personal finance or financial planning course to see if you like working with people's money", source: "" },
    { year: 3, what: "Apply for internships at wealth management or financial planning firms", source: SEASON_SOURCE },
    { year: 4, what: "Start CFP Board-registered coursework if you're sure about planning; it has to come before the CFP exam", source: CFP, optional: true },
    { year: 5, what: "Build your 6,000 hours (or 4,000 as an apprentice) toward the CFP while you work", source: CFP, optional: true },
    { year: 5, what: "Take the Series 65 (or 7 + 66) if your job gives investment advice", source: TSSB_IAR },
  ], skills: ["Listening to clients", "Explaining money clearly", "Math", "Excel", "CRM software", "Financial planning software", "Compliance and record-keeping", "Persuasion"],
  skillsSource: ONET("13-2052.00") },

  // ---- right after finance ----
  { key: "economics", label: "Economics", field: /econom/i, not: /home econom/i, credentials: [
    { name: "No license needed", need: "optional", who: "Economics jobs (analyst, consulting, research, government) don't require a license.", why: "Analysis skills and internships count more.", learn: "", when: "", source: "" },
    { name: "Grad school tests (like the GRE)", need: "depends", who: "Only if you go to grad school. Most economics PhD programs ask for strong math; check each program's test rules.", why: "Some programs use test scores to compare applicants.", learn: "Math, reading and writing.", when: "Junior or senior year, before applying", source: "" },
    { name: "A master's or PhD for \"economist\" jobs", need: "depends", who: "Jobs titled \"economist\" usually need a master's or PhD. Analyst jobs that use economics usually don't.", why: "Economist roles do research and forecasting that grad training prepares you for.", learn: "Advanced economic theory, statistics and research methods.", when: "After your bachelor's, often after a few years of work", source: BLS_ECON },
  ], steps: [
    { year: 1, what: "Take calculus and statistics early; economics builds on both", source: AEA_MATH },
    { year: 2, what: "Learn Excel well and one data tool (Stata, R or Python) through a class or project", source: "" },
    { year: 3, what: "Apply for analyst internships in consulting, banking, government or research", source: SEASON_SOURCE },
    { year: 3, what: "Work as a research assistant for a professor, if you're thinking about grad school", source: AEA_PREP, optional: true },
    { year: 3, what: "For a PhD, add math each semester: calculus, linear algebra, statistics, and ideally real analysis", source: AEA_MATH, optional: true },
  ], skills: ["Critical thinking", "Math and statistics", "Writing", "Excel", "Statistics software (like Stata or R)", "Databases and SQL", "Presenting findings"],
  skillsSource: ONET("19-3011.00") },

  { key: "insurance", label: "Risk management and insurance",
    field: /insurance|risk management|\brmi\b|underwrit|claims adjust/i, not: /cyber|information security/i, credentials: [
    { name: "Texas insurance agent license (general lines: P&C, or life and health)", need: "depends", who: "Required to sell insurance in Texas, as an agent or broker. Underwriting, analyst and corporate risk jobs usually don't need it.", why: "The law requires it to sell. A sponsor can get you a one-time 180-day temporary license ($150) while you study.", learn: "Insurance products, contracts and Texas insurance law.", when: "Pass the state exam, then apply within a year ($50 fee) with IdentoGO fingerprints", source: TDI_PC },
    { name: "Texas all-lines adjuster license", need: "depends", who: "Claims adjusters who handle losses in Texas.", why: "Required for that job. You can skip the exam with a TDI-approved adjuster course taken in the last 12 months, or a CPCU.", learn: "How to investigate and settle claims, and Texas rules.", when: "Exam or approved course, fingerprints, then apply within a year", source: TDI_ADJ },
    { name: "CPCU", need: "optional", who: "Not needed to start. Respected in property and casualty insurance for underwriters, brokers and risk managers.", why: "Shows deep insurance knowledge; it also waives the Texas adjuster exam.", learn: "Risk, insurance operations, law and coverage, plus ethics.", when: "Needs 2 years of insurance or risk experience, which you can earn while taking courses", source: CPCU },
  ], steps: [
    { year: 2, what: "Learn the main jobs: underwriting, claims, brokerage, agency sales and corporate risk management", source: "" },
    { year: 3, what: "Apply for internships at insurers, brokers or a company's risk management team", source: SEASON_SOURCE },
    { year: 4, what: "If you're going into insurance sales, you can take the Texas agent exam before you graduate", source: TDI_PC, optional: true },
    { year: 5, what: "Start CPCU courses once you're working, if you're staying in property and casualty", source: CPCU, optional: true },
  ], skills: ["Judgment and decision making", "Reading policies and contracts closely", "Critical thinking", "Excel", "Writing", "Explaining coverage to clients"],
  skillsSource: ONET("13-2053.00") },

  // ---- right after engineering ----
  { key: "energy", label: "Energy business", field: /\benergy\b|oil (and|&) gas|petroleum|\blandm[ae]n\b/i,
    not: /physics|geolog|geophys|chemi|kinesiolog|exercise/i, credentials: [
    { name: "No license needed", need: "optional", who: "Most energy business jobs (land, finance, commercial, supply) don't require a license.", why: "Internships with energy companies and the industry network count more.", learn: "", when: "", source: "" },
    { name: "AAPL landman certification (RL, RPL, CPL)", need: "optional", who: "For landmen, who negotiate mineral leases and land rights. Students can't apply; it comes after work experience.", why: "The industry's own proof of land experience; the CPL is the top level.", learn: "Land titles, leases, contracts and ethics.", when: "RL as a working active member; RPL and CPL after a year of active AAPL membership; the CPL needs a 4-year degree", source: AAPL },
  ], steps: [
    { year: 2, what: "At TCU, the Energy & Business minor is open to any major", source: TCU_MINORS, optional: true },
    { year: 3, what: "Apply for energy internships: land, finance, commercial or supply chain", source: SEASON_SOURCE },
    { year: 5, what: "Landmen can work toward AAPL certification after years of land work", source: AAPL, optional: true },
  ], skills: ["Excel financial models", "Reading contracts and leases", "Negotiation", "Financial analysis", "Presenting to managers", "Data tools (like Power BI or SQL)"],
  skillsSource: ONET("13-2051.00") },

  // ---- before marketing ----
  { key: "sports-business", label: "Sports business",
    field: /\bsports? (business|management|administration|marketing|sales|analytics)\b|athletic (administration|management)/i, credentials: [
    { name: "No license needed", need: "optional", who: "Team, league, venue and athletic department jobs don't require a license.", why: "Game-day work, internships and people you meet count most.", learn: "", when: "", source: "" },
    { name: "Texas athlete agent registration", need: "depends", who: "Only if you'll recruit or sign college athletes (or former college athletes who haven't signed a pro contract) as an agent.", why: "Texas requires registration with the Secretary of State before you contact or sign those athletes.", learn: "Texas athlete agent law and disclosure rules.", when: "Before you recruit anyone; renews every year", source: TX_ATHLETE },
    { name: "NFLPA agent certification (or other leagues' versions)", need: "depends", who: "Only to represent NFL players. Other leagues' players' associations have their own rules.", why: "Required by the NFL Players Association.", learn: "The league's labor agreement and agent rules, through an exam.", when: "Needs a bachelor's plus a master's or law degree (or 7 years of negotiating experience)", source: NFLPA },
  ], steps: [
    { year: 1, what: "Work or volunteer on game days for your school's athletics or a local team", source: "" },
    { year: 2, what: "Try a ticket sales, events or social media job; many sports careers start in sales", source: "" },
    { year: 3, what: "Apply for internships with teams, leagues, venues or athletic departments", source: SEASON_SOURCE },
    { year: 5, what: "The agent path usually means law school or a master's first", source: NFLPA, optional: true },
  ], skills: ["Speaking and listening", "Writing", "CRM software (like Salesforce)", "Excel", "PowerPoint", "Social media", "Event planning"],
  skillsSource: ONET("13-1011.00") },

  { key: "hospitality", label: "Hospitality and events",
    field: /hospitality|hotel|lodging|restaurant|tourism|event (management|planning)|meeting planning|culinary|food (service |and beverage )?management|resort/i, credentials: [
    { name: "No license needed", need: "optional", who: "Hotel, restaurant and event management jobs don't require a license.", why: "Work experience in the industry counts most.", learn: "", when: "", source: "" },
    { name: "Texas Certified Food Manager", need: "depends", who: "Food businesses that prepare or serve certain foods may be required to employ one. Restaurant and food service managers often hold it.", why: "It may be required where you work, and it shows you know food safety.", learn: "Food safety: storage, temperatures, cleaning and illness prevention.", when: "Anytime: pass a state-approved or ANSI-certified food manager exam", source: TX_CFM },
    { name: "TABC seller-server certification", need: "depends", who: "Not required by Texas law, but many employers require it for anyone who sells or serves alcohol.", why: "It protects the business from some penalties when staff are certified.", learn: "Serving alcohol responsibly and Texas alcohol law.", when: "Anytime; valid for 2 years", source: TABC },
    { name: "CMP (Certified Meeting Professional)", need: "optional", who: "For event and meeting planners, years into the job.", why: "The main credential in meeting and event planning.", learn: "Planning, budgeting and running meetings and events.", when: "After 36 months of full-time event work, or 24 months plus an events-related associate's degree or higher; also 25 hours of continuing education (a 200-hour school internship can count instead)", source: CMP },
  ], steps: [
    { year: 1, what: "Work in a hotel, restaurant or event job to learn how the front line runs", source: "" },
    { year: 3, what: "Apply for hospitality or event internships", source: SEASON_SOURCE },
    { year: 4, what: "The TABC seller-server course, if your job will involve alcohol", source: TABC, optional: true },
  ], skills: ["Customer service", "Speaking and listening", "Managing staff and schedules", "Property management or POS systems", "Excel", "Budgeting", "Writing"],
  skillsSource: ONET("11-9081.00") },

  { key: "sales", label: "Sales", parent: "marketing", field: /\bsales\b|\bselling\b|business development/i, credentials: [
    { name: "No license needed", need: "optional", who: "Most sales jobs (software, medical devices, consumer goods, B2B) don't require a license.", why: "Showing you can talk to strangers and handle rejection counts more.", learn: "", when: "", source: "" },
    { name: "A license for what you sell", need: "depends", who: "Only if you sell insurance, real estate or securities: each has its own license (Texas Department of Insurance, TREC, FINRA).", why: "The law requires it for those products.", learn: "The product and its rules.", when: "Depends on the license; insurance needs a state exam and fingerprints", source: TDI_CAREERS },
    { name: "Salesforce Platform Administrator", need: "optional", who: "For sales operations or CRM admin roles; most sales reps never need it.", why: "Salesforce is a common sales tool; the certification shows you can set it up and run reports.", learn: "Setting up Salesforce: users, data, security, reports and automation.", when: "Anytime; Salesforce's free Trailhead courses prepare you", source: SFADMIN },
  ], steps: [
    { year: 1, what: "Get a customer-facing job (retail, restaurant, campus calling) to practice talking to people", source: "" },
    { year: 2, what: "At TCU, the Certificate in Consultative Sales is open to every major", source: TCU_CERTS, optional: true },
    { year: 3, what: "Apply for sales internships; many companies hire their full-time reps from them", source: SEASON_SOURCE },
    { year: 4, what: "Sales role-play competitions are a way to practice and meet recruiters", source: "", optional: true },
  ], skills: ["Active listening", "Speaking", "Writing follow-ups", "CRM software (like Salesforce)", "Excel", "PowerPoint", "Video calls"],
  skillsSource: ONET("41-4012.00") },

  // ---- before management ----
  { key: "entrepreneurship", label: "Entrepreneurship", parent: "management",
    field: /entrepreneur|start-?ups?\b|small business|new venture/i, credentials: [
    { name: "No license needed to start most businesses", need: "optional", who: "There's no license for being an entrepreneur.", why: "Customers, sales and a working product count most.", learn: "", when: "", source: "" },
    { name: "Business registration and permits", need: "depends", who: "In Texas an LLC or corporation must file with the Secretary of State; a sole proprietor or partnership using a business name files an assumed name certificate.", why: "It's how the business becomes legal, and for an LLC or corporation, separate from you.", learn: "Business structures, taxes and permits.", when: "When you're ready to take money or sign contracts", source: TX_SOS_FORMS },
    { name: "Texas sales tax permit", need: "depends", who: "Only if you sell or lease taxable goods, or sell taxable services, in Texas.", why: "The Texas Comptroller requires it before you collect sales tax.", learn: "Which sales are taxable and how to file.", when: "Before your first taxable sale", source: TX_SALES_TAX },
  ], steps: [
    { year: 1, what: "Take an entrepreneurship class or join the club; talk to 20 possible customers about one problem", source: "" },
    { year: 2, what: "Build a small version of your idea and try to get someone to pay for it", source: "" },
    { year: 3, what: "Intern at a startup or small business to see how one runs day to day", source: SEASON_SOURCE },
    { year: 4, what: "Enter a pitch competition", source: "", optional: true },
    { year: 5, what: "Start right away or work a few years first; both are common, and savings and the idea should decide", source: "" },
  ], skills: ["Selling and persuading", "Budgeting and bookkeeping (like QuickBooks)", "Excel", "Leading a team", "Marketing tools (like Google Ads or HubSpot)", "CRM software", "Presenting and pitching"],
  skillsSource: ONET("11-1021.00") },

  { key: "international-business", label: "International business", parent: "management",
    field: /\b(international|global) (business|management|trade|commerce)\b/i, credentials: [
    { name: "No license needed", need: "optional", who: "Most international business jobs don't require a license.", why: "Language skills, time abroad and internships count more.", learn: "", when: "", source: "" },
    { name: "Licensed customs broker (CBP exam)", need: "depends", who: "Only for customs brokerage, helping companies clear imports through U.S. Customs.", why: "Brokers must be licensed by U.S. Customs and Border Protection.", learn: "Import rules, tariffs and classification, on an 80-question exam (75% to pass).", when: "U.S. citizen; exam at 18+, license at 21+; not a federal employee. Usually after some trade experience", source: CBLE }, // license rules: CBP_CFR (19 CFR 111.11)
  ], steps: [
    { year: 1, what: "Keep taking a language; it matters more the further you get", source: "" },
    { year: 2, what: "Study abroad for a semester or summer", source: "", optional: true },
    { year: 3, what: "Apply for internships at companies with international operations or in trade and logistics", source: SEASON_SOURCE },
  ], skills: ["Speaking and writing clearly", "Critical thinking", "Negotiation", "Coordinating across teams", "Excel", "PowerPoint", "ERP software (like SAP)"],
  skillsSource: ONET("13-1111.00") },

  // ---- before tech ----
  { key: "bis", label: "Business information systems", parent: "tech",
    field: /information systems|\b(mis|bis|cis)\b|business analytics|business technology|biztech/i,
    not: /health|medical|geograph|\bgis\b/i, credentials: [
    { name: "No license needed", need: "optional", who: "Business analyst, IT consulting and systems jobs don't require a license.", why: "Projects you can show (a dashboard, an app, a database) count more.", learn: "", when: "", source: "" },
    { name: "Salesforce Platform Administrator", need: "optional", who: "Useful for CRM and business systems roles; not asked for in most analyst jobs.", why: "Salesforce runs sales and service at many companies; the certification shows you can set it up.", learn: "Setting up Salesforce: users, data, security, reports and automation.", when: "Anytime; Salesforce's free Trailhead courses prepare you", source: SFADMIN },
    { name: "CAPM (project management)", need: "optional", who: "Optional for IT project and consulting roles.", why: "An entry-level project management credential that doesn't need work experience.", learn: "How projects are planned, scheduled and run.", when: "Anytime after 23 hours of project management education; no work experience needed", source: CAPM },
  ], steps: [
    { year: 1, what: "Learn Excel and basic SQL", source: "" },
    { year: 2, what: "Build something you can show: a dashboard, a database or a small app for a club", source: "" },
    { year: 3, what: "Apply for business analyst, IT consulting or systems internships", source: SEASON_SOURCE },
    { year: 4, what: "A Salesforce or CAPM certification, if you're aiming at CRM or project roles", source: SFADMIN, optional: true },
  ], skills: ["SQL and databases", "Excel", "Business intelligence dashboards", "Process mapping", "Requirements gathering", "ERP systems (like SAP)", "CRM systems (like Salesforce)", "Project management", "Explaining tech to non-tech people"],
  skillsSource: ONET("15-1211.00") },
];

/** One business road by key, for placing it in ROADS (first match wins). */
export const bizRoad = (key: string) => { const r = BUSINESS_ROADS.find((x) => x.key === key); if (!r) throw new Error(key); return r; };
