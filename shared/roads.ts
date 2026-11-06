// Each field's usual road from college to license or first job, from the NABA research proposal (opened 2026-10-31/11-01).
// Texas rules where licenses are state-run. Every step is "usually": rules change, so each one links to where it came from.
import { SEASON_SOURCE } from "./seasons";

// source "" = general advice with no page behind it yet.
export type RoadStep = { year: 1 | 2 | 3 | 4 | 5; what: string; source: string; /** Many people in the field skip it. */ optional?: boolean };
/** How much a student needs an exam or license (Dilan, Nov 5: never make an optional one look like a normal step).
 *  required = you can't do the job (or use the title) without it; job = your employer sponsors and usually pays for it
 *  after hiring, you can't take it before; depends = needed for some jobs in the field, not others; optional = nice to have. */
export type CredentialNeed = "required" | "job" | "depends" | "optional";
export type Credential = { name: string; need: CredentialNeed; /** who actually needs it */ who: string; /** why people get it anyway, or why it matters */ why: string; learn: string; when: string; source: string };
export type Road = { key: string; label: string; field: RegExp; credentials: Credential[]; steps: RoadStep[]; /** Fields that look similar but take a different road. */ not?: RegExp };
export const NEED_LABEL: Record<CredentialNeed, string> = { required: "Required", job: "Comes with the job", depends: "Depends on the job", optional: "Optional" };

export const YEARS = ["", "First-year", "Sophomore", "Junior", "Senior", "After college"] as const;

const TXCPA = "https://www.tx.cpa/news/todays-cpa-magazine/current-issue/article/september-october-2026/2026/09/03/a-new-era-for-cpa-licensure-in-texas-and-a-look-ahead";
const FINRA = "https://www.finra.org/sie";
const CFA = "https://www.cfainstitute.org/about/universities/student-faq";
const SOA = "https://www.math.ucla.edu/~actuary/meetingsAndWorkshops/2021/Actuarial_Exams_Workshop.pdf";
const FE = "https://unlv.edu/engineering/advising/fe-exam";
const PE = "https://www.engineering.cornell.edu/majors-minors/become-licensed-professional-engineer/";
const TBAE = "https://www.tbae.texas.gov/axpinfo";
const BON = "https://www.bon.texas.gov/licensure_examination.asp.html";
const TEXES = "https://www.uttyler.edu/academics/colleges-schools/school-of-education/texes/";
const BHEC = "https://bhec.texas.gov/texas-state-board-of-social-worker-examiners/applying-for-a-social-work-license/how-to-become-an-lmsw/";
const RD = "https://sph.tulane.edu/sbps/nutrition/be-rd";
const TREC = "https://www.trec.texas.gov/become-licensed/sales-agent";
const ELEC = "https://www.getjobber.com/academy/electrician-license/texas/";
const LSAT = "https://jdadvising.com/find-the-perfect-time-to-take-the-lsat/";
const MCAT = "https://students-residents.aamc.org/prepare-mcat-exam/when-right-time-take-mcat-exam-three-questions-ask-yourself";
const SECPLUS = "https://www.newhorizons.com/resources/blog/comptia-security-prerequisites-requirements";
const SIE = "https://www.finra.org/registration-exams-ce/qualification-exams/securities-industry-essentials-exam";
const S79 = "https://www.finra.org/registration-exams-ce/qualification-exams/series79";
const CFAPOL = "https://www.cfainstitute.org/index.php/programs/cfa-program/policies";
const UTACT = "https://sites.utexas.edu/actuarial-sciences/professional-certification/";
const NSPE = "https://nspe.org/resources/issues-and-advocacy/action-issues/professional-licensing-exemptions";
const ECS = "https://www.ecs.org/wp-content/uploads/State-Information-Request_Teacher-Certification.pdf";
const SHRM = "https://shrm.org/topics-tools/news/hr-students-limited-work-experience-no-bar-to-exam-success";
const HRCERTS = "https://builtin.com/articles/hr-certifications";
const CAPM = "https://www.pmi.org/certifications/certified-associate-capm";
const GA = "https://support.google.com/analytics/answer/15440208";

// Order matters: the first field whose pattern matches wins (accounting before finance, nursing before health).
export const ROADS: Road[] = [
  { key: "accounting", label: "Accounting", field: /accounting|\bcpa\b|audit|\btax\b/i, credentials: [
    { name: "CPA license", need: "depends", who: "Needed to sign audit opinions and to call yourself a CPA; most audit and tax careers expect it within a few years. Many corporate finance and accounting jobs don't require it.", why: "It's the main credential in accounting: it opens audit partner track, public accounting promotions and higher pay.", learn: "Auditing, financial reporting, tax and business law, through a 4-part exam.", when: "Exam after 120 credit hours; license after the hours and experience Texas asks for (often paid for by your firm)", source: TXCPA },
  ], steps: [
    { year: 2, what: "Plan your credit hours with your advisor: Texas now licenses CPAs with 150 hours + 1 year of experience, or a bachelor's + 120 hours + 2 years", source: TXCPA },
    { year: 3, what: "Apply for audit or tax internships; accounting recruits January to June, often a year early", source: SEASON_SOURCE },
    { year: 4, what: "You can sit for the CPA Exam once you have 120 credit hours", source: TXCPA },
    { year: 5, what: "Work in audit or tax while you finish the exam parts and experience for your CPA license", source: TXCPA },
  ] },
  { key: "actuarial", label: "Actuarial science", field: /actuar/i, credentials: [
    { name: "SOA or CAS exams (start with P and FM)", need: "required", who: "Actuarial jobs expect them: most employers want 1 or 2 exams passed before they hire an intern, though it varies by company.", why: "Exams are how actuaries qualify; passing them is also how you get raises and promotions.", learn: "Probability (P) and the math of interest and cash flows (FM), then insurance and risk topics.", when: "Most students pass 1 or 2 before junior-year internships; employers usually pay for later exams", source: UTACT },
  ], steps: [
    { year: 2, what: "Start studying for Exam P or FM; most employers want 1 or 2 passed before an internship", source: UTACT },
    { year: 3, what: "Pass a second exam and apply for actuarial internships", source: SOA },
    { year: 5, what: "Keep taking SOA exams toward ASA, then FSA; employers usually pay for study time", source: SOA },
  ] },
  { key: "finance", label: "Finance", field: /financ|bank|invest|wealth|trading/i, credentials: [
    { name: "SIE (Securities Industry Essentials)", need: "optional", who: "Not needed for internships or most finance jobs. Banks and brokerages that need you licensed have you take it, usually with paid study time, after they hire you.", why: "Some students take it early to show interest, mostly for sales & trading or wealth management. It alone doesn't let you do licensed work.", learn: "How securities markets work: stocks, bonds and funds, who regulates them, and what's not allowed.", when: "Anyone 18+, no sponsor needed, $100, valid 4 years", source: SIE },
    { name: "Series 7, 63 or 79", need: "job", who: "Only for roles that buy, sell or advise on securities: brokers, traders, investment bankers. Corporate finance, FP&A and many analyst jobs never need them.", why: "The law requires them for those roles. The Series 7 and 79 need a firm to sponsor you; the 63 is usually taken alongside the 7 after hiring.", learn: "Rules and products for that job (79 is investment banking: deals, valuations, offerings).", when: "After you're hired, usually within your first few months", source: S79 },
    { name: "CFA charter", need: "optional", who: "Mostly investment management and research (asset managers, equity research). Rarely asked for in banking or corporate finance.", why: "Respected proof of investment knowledge; the full charter takes years and work experience.", learn: "Investment analysis, valuation, portfolio management and ethics, over 3 levels.", when: "Level I can be taken within 23 months of graduating", source: CFAPOL },
  ], steps: [
    { year: 2, what: "Some students take the SIE to show interest (mostly for sales & trading or wealth management); it isn't needed for internships", source: SIE, optional: true },
    { year: 3, what: "Apply for junior-summer internships; big banks often recruit a year early", source: SEASON_SOURCE },
    { year: 4, what: "CFA Level I, if you're aiming for investment management or research", source: CFAPOL, optional: true },
    { year: 5, what: "If your job needs a license (Series 7, 63 or 79), your firm sponsors it after hiring", source: S79 },
  ] },
  { key: "engineering", label: "Engineering", field: /engineer/i, credentials: [
    { name: "FE exam (Engineer in Training)", need: "depends", who: "The first step to a PE. Common in civil, structural and environmental engineering; many mechanical, electrical and software engineers at companies never take it.", why: "It's easiest right after school while the material is fresh, and it keeps the PE option open.", learn: "A review of your whole engineering degree: math, statics, circuits or your discipline's basics.", when: "Last semester or right after graduating", source: FE },
    { name: "PE license", need: "depends", who: "Needed to sign off on public work (buildings, roads, utilities) and to offer engineering services to the public. Engineers employed by companies are often exempt.", why: "Required for those jobs, and a mark of trust and higher pay in civil and consulting work.", learn: "Your discipline in depth, after years of real projects.", when: "About 4 years of experience under a licensed engineer", source: NSPE },
  ], steps: [
    { year: 3, what: "Apply for engineering internships or co-ops (most are filled October to February)", source: SEASON_SOURCE },
    { year: 4, what: "If you might want a PE (common in civil and structural), take the FE exam in your last semester", source: FE, optional: true },
    { year: 5, what: "PE license after about 4 years of experience under a licensed engineer, if your work needs one", source: PE },
  ] },
  { key: "architecture", label: "Architecture", field: /architect/i, credentials: [
    { name: "Architect license (ARE exams + AXP hours)", need: "depends", who: "Needed to call yourself an architect and to stamp drawings. Many people work in architecture firms as designers without a license.", why: "Licensed architects can lead projects and open their own firm.", learn: "Practice, project management, design and construction documents, across 6 exams and supervised experience.", when: "Experience hours can start in school; the license usually comes years after graduating", source: TBAE },
  ], steps: [
    { year: 1, what: "Open your NCARB record; AXP experience hours can start counting while you're in school", source: TBAE },
    { year: 4, what: "Check Texas rules on when you can start the ARE exams; they're changing", source: TBAE },
    { year: 5, what: "Finish AXP hours and the ARE; about 8 to 11 years from your first day of college to license", source: TBAE },
  ] },
  { key: "nursing", label: "Nursing", field: /nurs/i, credentials: [
    { name: "NCLEX-RN", need: "required", who: "Every registered nurse. You can't work as an RN without passing it.", why: "It's the state license exam for nurses.", learn: "Safe patient care: judgment, medications, prioritizing, across all of nursing.", when: "Right after you finish your nursing program", source: BON },
  ], steps: [
    { year: 3, what: "Clinical rotations", source: "" },
    { year: 4, what: "Pass the Texas nursing jurisprudence exam, then register for the NCLEX-RN (your authorization to test lasts 75 days)", source: BON },
    { year: 5, what: "Work under a graduate nurse permit while you wait for NCLEX results", source: BON },
  ] },
  { key: "nutrition", label: "Nutrition", field: /nutrition|dietet/i, credentials: [
    { name: "Registered Dietitian (CDR exam)", need: "depends", who: "Needed for clinical dietitian jobs and to use the RD title. Many nutrition jobs (food industry, wellness, community programs) don't require it.", why: "It's the credential hospitals and clinics hire for, and it often pays more.", learn: "Medical nutrition therapy, food service and community nutrition.", when: "After a master's and supervised practice", source: RD },
  ], steps: [
    { year: 2, what: "Prerequisite courses and volunteering in food or health settings", source: "" },
    { year: 3, what: "Plan for a master's: registered dietitians need a graduate degree since Jan 1, 2024", source: RD },
    { year: 5, what: "Supervised practice, then the CDR exam to become a registered dietitian", source: RD },
  ] },
  { key: "health", label: "Pre-med and health", field: /\bpre-?(med|medical|pharm|pharmacy|pa|pt)\b|\bmedical school\b|\bmedicine\b|physician|pharmac|physical therap/i, not: /veterin|sports medicine|pharmacy tech|pharmaceutical|dent(al|ist)/i, credentials: [
    { name: "MCAT (or the PA, pharmacy or PT program's own test rules)", need: "required", who: "Almost every U.S. medical school requires the MCAT. PA, pharmacy and PT programs set their own rules, so check each one.", why: "Schools use it to compare applicants.", learn: "Biology, chemistry, physics, psychology and reading reasoning.", when: "Usually junior year, if you want to start right after graduating", source: MCAT },
    { name: "Board exams (USMLE, PANCE, NAPLEX, NPTE)", need: "required", who: "Required to practice in each profession.", why: "They're the license exams.", learn: "Everything from your graduate program.", when: "During and after graduate school", source: "https://www.usmle.org/" },
  ], steps: [
    { year: 1, what: "Start shadowing and clinical hours", source: "" },
    { year: 3, what: "To start medical school right after you graduate, take the MCAT and start applying in your junior year", source: MCAT },
    { year: 5, what: "Board exams come after grad school: USMLE (MD), PANCE (PA), NAPLEX (pharmacy), NPTE (PT); doctors then do residency", source: MCAT },
  ] },
  { key: "teaching", label: "Teaching", field: /teach|education/i, credentials: [
    { name: "Texas teaching certificate (TExES exams)", need: "depends", who: "Texas public schools hire certified teachers (some districts use waivers). Private schools set their own rules and many don't require it.", why: "It's what public schools hire for, and it moves with you to other public districts.", learn: "Your subject, plus how to teach and manage a classroom.", when: "During your educator preparation program, around student teaching", source: ECS },
  ], steps: [
    { year: 2, what: "Get into an educator preparation program", source: "" },
    { year: 4, what: "Student teaching, and the TExES exams for your subject", source: TEXES },
    { year: 5, what: "Texas teaching certificate from TEA", source: TEXES },
  ] },
  { key: "social-work", label: "Social work", field: /social work/i, credentials: [
    { name: "Social work license (LBSW, LMSW, LCSW)", need: "depends", who: "Needed to use the social worker title and for clinical or many agency jobs. Some social-service jobs (case aide, nonprofit roles) don't require it.", why: "Licensed social workers can do more and earn more; clinical work and private practice need an LCSW.", learn: "Ethics, assessment, intervention and Texas rules, through the ASWB exam.", when: "After your BSW or MSW", source: BHEC },
  ], steps: [
    { year: 4, what: "BSW field placement", source: "" },
    { year: 5, what: "LBSW (bachelor's) or LMSW (master's) through the ASWB exam and the Texas jurisprudence exam; LCSW needs supervised clinical hours", source: BHEC },
  ] },
  { key: "real-estate", label: "Real estate", field: /real estate|realtor|property/i, credentials: [
    { name: "Texas real estate sales agent license", need: "depends", who: "Needed to help people buy, sell or lease property for a commission. Not needed for real estate finance, development or analyst jobs.", why: "Some students get it in college to earn money and learn the market.", learn: "Property law, contracts, finance and agency rules (180 hours of courses).", when: "From age 18", source: TREC },
  ], steps: [
    { year: 1, what: "You can start at 18: Texas sales agents take 180 hours of courses, then the state exam", source: TREC },
    { year: 5, what: "Work under a sponsoring broker; it pairs well with a business degree", source: TREC },
  ] },
  { key: "law", label: "Pre-law", field: /pre-?law|\blaw\b|legal|paralegal/i, credentials: [
    { name: "LSAT", need: "depends", who: "Most law schools use it; a growing number also accept the GRE, so check each school.", why: "Law schools use it to compare applicants, and scholarships often depend on it.", learn: "Logical reasoning and reading closely.", when: "Usually spring or summer of junior year", source: LSAT },
    { name: "Bar exam", need: "required", who: "Every practicing lawyer.", why: "It's the license to practice law in a state.", learn: "The law you studied in law school, tested by state.", when: "After law school", source: LSAT },
  ], steps: [
    { year: 3, what: "Take the LSAT, usually the spring or summer of junior year, about 2 years before you'd start law school", source: LSAT },
    { year: 4, what: "Apply to law school in the fall of senior year", source: LSAT },
    { year: 5, what: "The bar exam comes after law school", source: LSAT },
  ] },
  { key: "marketing", label: "Marketing", field: /marketing|advertising|public relations/i, credentials: [
    { name: "No license needed", need: "optional", who: "Marketing jobs don't require a license or certification.", why: "A portfolio (campaigns, social accounts you grew, writing samples) usually counts more.", learn: "", when: "", source: "" },
    { name: "Google Analytics or Google Ads certification", need: "optional", who: "Nice to have for digital marketing and analytics roles; rarely required.", why: "Free, and shows you can read website and ad data, which a lot of entry-level marketing work uses.", learn: "How to measure traffic, campaigns and conversions in Google's tools.", when: "Anytime; free online", source: GA },
  ], steps: [
    { year: 1, what: "Start a portfolio: run social for a club, write, design or grow something you can show", source: "" },
    { year: 3, what: "Apply for marketing internships (many post in spring for the summer)", source: SEASON_SOURCE },
    { year: 4, what: "A free Google Analytics or Ads certification if you're going into digital marketing", source: GA, optional: true },
  ] },
  { key: "hr", label: "Human resources", field: /human resources|\bhr\b|people operations|talent acquisition/i, credentials: [
    { name: "No license needed", need: "optional", who: "HR jobs don't require a license.", why: "", learn: "", when: "", source: "" },
    { name: "aPHR or SHRM-CP", need: "optional", who: "Not needed for entry-level HR jobs; some employers like to see one, and more ask for it as you move up.", why: "Shows you know HR basics and employment law before you have much experience. Students can take the SHRM-CP while pursuing an HR career; the aPHR needs no experience.", learn: "Hiring, pay and benefits, employee relations and employment law.", when: "Senior year or after graduating", source: SHRM },
  ], steps: [
    { year: 2, what: "Join your school's SHRM student chapter or a business org to meet HR people", source: "" },
    { year: 3, what: "Apply for HR or recruiting internships", source: SEASON_SOURCE },
    { year: 4, what: "The aPHR or SHRM-CP, if you want a credential early", source: HRCERTS, optional: true },
  ] },
  { key: "supply-chain", label: "Supply chain", field: /supply chain|logistics|procurement|purchasing/i, credentials: [
    { name: "No license needed", need: "optional", who: "Supply chain jobs don't require a license.", why: "", learn: "", when: "", source: "" },
    { name: "CAPM (project management)", need: "optional", who: "Optional for anyone heading into operations or project work.", why: "Students can take it: it needs 23 hours of project management education and no work experience.", learn: "How projects are planned, scheduled and run.", when: "Anytime after the 23 hours", source: CAPM },
  ], steps: [
    { year: 2, what: "Learn Excel well; most supply chain internships use it every day", source: "" },
    { year: 3, what: "Apply for supply chain, operations or purchasing internships", source: SEASON_SOURCE },
  ] },
  { key: "management", label: "Management and consulting", field: /consult|entrepreneur|business administration|general business|^\s*(business |general )?management\s*$/i, credentials: [
    { name: "No license needed", need: "optional", who: "Consulting, management and general business jobs don't require a license.", why: "Internships, case practice and leadership in clubs count more than certifications.", learn: "", when: "", source: "" },
    { name: "CAPM (project management)", need: "optional", who: "Optional; rarely asked for from new graduates.", why: "A way to show you understand how projects run, without work experience.", learn: "How projects are planned, scheduled and run.", when: "Anytime after 23 hours of project management education", source: CAPM },
  ], steps: [
    { year: 2, what: "Lead something: a club project, a team or an event you can talk about in interviews", source: "" },
    { year: 3, what: "Apply for junior-summer internships; consulting firms recruit early, often the summer before", source: SEASON_SOURCE },
  ] },
  { key: "tech", label: "Tech and IT", field: /software|computer|data|information|cyber|\btech\b|technology|^\s*it\s*$/i, not: /technician|pharma|medical|health|lab /i, credentials: [
    { name: "Certifications (CompTIA Security+, AWS, Azure…)", need: "optional", who: "Not needed for most software or data jobs, where projects and skills matter more. Some cybersecurity and government jobs ask for Security+.", why: "A cert can help when you have no experience yet in IT or security, and it shows you studied a topic in depth.", learn: "One area in detail: security basics, or how a cloud platform works.", when: "Anytime; no prerequisites for entry-level ones", source: SECPLUS },
  ], steps: [
    { year: 1, what: "Build projects and put them on GitHub; a portfolio matters more than a license", source: "" },
    { year: 2, what: "Try a hackathon", source: "" },
    { year: 4, what: "A certification like CompTIA Security+ or a cloud cert, mostly useful for IT and security jobs", source: SECPLUS, optional: true },
  ] },
  { key: "trades", label: "Electrician", field: /electrician|electrical (apprentic|technolog|trade|construction|lineworker)|\blinem[ae]n\b|linework/i, credentials: [
    { name: "Texas apprentice registration, then journeyman license", need: "required", who: "Anyone doing electrical work in Texas.", why: "It's the state license; pay rises as you move from apprentice to journeyman to master.", learn: "The electrical code, safety and wiring, on the job and in class.", when: "Register before you start; journeyman after about 8,000 hours", source: ELEC },
  ], steps: [
    { year: 1, what: "Register as an apprentice with TDLR before you start (from age 16)", source: ELEC },
    { year: 5, what: "Journeyman license after about 8,000 supervised hours; master electrician later", source: ELEC },
  ] },
];

/** The road for a student's field. Null when Remy has no road that really fits: a wrong road (the MCAT for
 *  pre-dental, electrician licensing for a welder, the SIE for economics) is worse than none. Trade and
 *  apprenticeship paths only get the electrician road when the field is electrical. */
export function roadFor(field: string, path = ""): Road | null {
  const trade = path === "trade" || path === "apprenticeship";
  if (trade) return /electric/i.test(field) ? ROADS.find((r) => r.key === "trades")! : null;
  // A road whose "not" matches is skipped, and later roads still get a chance (MIS → tech).
  return ROADS.find((r) => r.field.test(field) && !r.not?.test(field)) || null;
}

/** "First-year" … "Senior" as 1–4; graduate students and graduates count as after college. */
export const yearNumber = (classYear: string) => {
  const i = YEARS.findIndex((y) => y && classYear.toLowerCase().startsWith(y.toLowerCase().slice(0, 5)));
  return i > 0 ? i : /fresh/i.test(classYear) ? 1 : /grad|alum/i.test(classYear) ? 5 : 0;
};
