// Each field's usual road from college to license or first job, from the NABA research proposal (opened 2026-10-31/11-01).
// Texas rules where licenses are state-run. Every step is "usually": rules change, so each one links to where it came from.
import { SEASON_SOURCE } from "./seasons";

// source "" = general advice with no page behind it yet.
export type RoadStep = { year: 1 | 2 | 3 | 4 | 5; what: string; source: string };
export type Road = { key: string; label: string; field: RegExp; exam: string; steps: RoadStep[] };

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

// Order matters: the first field whose pattern matches wins (accounting before finance, nursing before health).
export const ROADS: Road[] = [
  { key: "accounting", label: "Accounting", field: /accounting|\bcpa\b|audit|\btax\b/i, exam: "CPA", steps: [
    { year: 2, what: "Plan your credit hours with your advisor: Texas now licenses CPAs with 150 hours + 1 year of experience, or a bachelor's + 120 hours + 2 years", source: TXCPA },
    { year: 3, what: "Apply for audit or tax internships; accounting recruits January to June, often a year early", source: SEASON_SOURCE },
    { year: 4, what: "You can sit for the CPA Exam once you have 120 credit hours", source: TXCPA },
    { year: 5, what: "Work in audit or tax while you finish the exam parts and experience for your CPA license", source: TXCPA },
  ] },
  { key: "actuarial", label: "Actuarial science", field: /actuar/i, exam: "SOA exams (P, FM)", steps: [
    { year: 2, what: "Start studying for Exam P or FM; most actuarial interns have passed 1 or 2 exams", source: SOA },
    { year: 3, what: "Pass a second exam and apply for actuarial internships", source: SOA },
    { year: 5, what: "Keep taking SOA exams toward ASA, then FSA; employers usually pay for study time", source: SOA },
  ] },
  { key: "finance", label: "Finance", field: /financ|bank|invest|wealth|trading|econom/i, exam: "SIE, Series 7, CFA", steps: [
    { year: 2, what: "Take the SIE exam: anyone 18 or older can, no employer sponsor needed, and it shows recruiters you're serious", source: FINRA },
    { year: 3, what: "Apply for junior-summer internships; big banks often recruit a year early", source: SEASON_SOURCE },
    { year: 4, what: "CFA Level I opens once you're within 23 months of graduating", source: CFA },
    { year: 5, what: "Series 7, 63 or 79 need a sponsoring firm, so they come with the job", source: FINRA },
  ] },
  { key: "engineering", label: "Engineering", field: /engineer/i, exam: "FE, then PE", steps: [
    { year: 3, what: "Apply for engineering internships or co-ops (most are filled October to February)", source: SEASON_SOURCE },
    { year: 4, what: "Take the FE exam in your last semester; passing it makes you an Engineer in Training (EIT)", source: FE },
    { year: 5, what: "PE license after about 4 years of experience under a licensed engineer", source: PE },
  ] },
  { key: "architecture", label: "Architecture", field: /architect/i, exam: "ARE", steps: [
    { year: 1, what: "Open your NCARB record; AXP experience hours can start counting while you're in school", source: TBAE },
    { year: 4, what: "Check Texas rules on when you can start the ARE exams; they're changing", source: TBAE },
    { year: 5, what: "Finish AXP hours and the ARE; about 8 to 11 years from your first day of college to license", source: TBAE },
  ] },
  { key: "nursing", label: "Nursing", field: /nurs/i, exam: "NCLEX-RN", steps: [
    { year: 3, what: "Clinical rotations", source: "" },
    { year: 4, what: "Pass the Texas nursing jurisprudence exam, then register for the NCLEX-RN (your authorization to test lasts 75 days)", source: BON },
    { year: 5, what: "Work under a graduate nurse permit while you wait for NCLEX results", source: BON },
  ] },
  { key: "nutrition", label: "Nutrition", field: /nutrition|dietet/i, exam: "CDR registration exam", steps: [
    { year: 2, what: "Prerequisite courses and volunteering in food or health settings", source: "" },
    { year: 3, what: "Plan for a master's: registered dietitians need a graduate degree since Jan 1, 2024", source: RD },
    { year: 5, what: "Supervised practice, then the CDR exam to become a registered dietitian", source: RD },
  ] },
  { key: "health", label: "Pre-med and health", field: /pre-?med|medic|pharm|physician|physical therap|health|biolog|kinesi/i, exam: "MCAT, then USMLE / PANCE / NAPLEX / NPTE", steps: [
    { year: 1, what: "Start shadowing and clinical hours", source: "" },
    { year: 3, what: "To start medical school right after you graduate, take the MCAT and start applying in your junior year", source: MCAT },
    { year: 5, what: "Board exams come after grad school: USMLE (MD), PANCE (PA), NAPLEX (pharmacy), NPTE (PT); doctors then do residency", source: MCAT },
  ] },
  { key: "teaching", label: "Teaching", field: /teach|education/i, exam: "TExES", steps: [
    { year: 2, what: "Get into an educator preparation program", source: "" },
    { year: 4, what: "Student teaching, and the TExES exams for your subject", source: TEXES },
    { year: 5, what: "Texas teaching certificate from TEA", source: TEXES },
  ] },
  { key: "social-work", label: "Social work", field: /social work/i, exam: "ASWB", steps: [
    { year: 4, what: "BSW field placement", source: "" },
    { year: 5, what: "LBSW (bachelor's) or LMSW (master's) through the ASWB exam and the Texas jurisprudence exam; LCSW needs supervised clinical hours", source: BHEC },
  ] },
  { key: "real-estate", label: "Real estate", field: /real estate|realtor|property/i, exam: "Texas sales agent exam", steps: [
    { year: 1, what: "You can start at 18: Texas sales agents take 180 hours of courses, then the state exam", source: TREC },
    { year: 5, what: "Work under a sponsoring broker; it pairs well with a business degree", source: TREC },
  ] },
  { key: "law", label: "Pre-law", field: /pre-?law|\blaw\b|legal|paralegal/i, exam: "LSAT, then the bar", steps: [
    { year: 3, what: "Take the LSAT, usually the spring or summer of junior year, about 2 years before you'd start law school", source: LSAT },
    { year: 4, what: "Apply to law school in the fall of senior year", source: LSAT },
    { year: 5, what: "The bar exam comes after law school", source: LSAT },
  ] },
  { key: "tech", label: "Tech and IT", field: /software|computer|data|information|cyber|tech/i, exam: "none required", steps: [
    { year: 1, what: "Build projects and put them on GitHub; a portfolio matters more than a license", source: "" },
    { year: 2, what: "Try a hackathon", source: "" },
    { year: 4, what: "Optional: a certification like CompTIA Security+ or a cloud cert (no prerequisites)", source: SECPLUS },
  ] },
  { key: "trades", label: "Electrician and other trades", field: /electric|plumb|hvac|weld|trade|apprentice/i, exam: "Journeyman license", steps: [
    { year: 1, what: "Register as an apprentice with TDLR before you start (from age 16)", source: ELEC },
    { year: 5, what: "Journeyman license after about 8,000 supervised hours; master electrician later", source: ELEC },
  ] },
];

/** The road for a student's field; trade and apprenticeship paths get the trades road. Null when nothing matches. */
export function roadFor(field: string, path = ""): Road | null {
  if (path === "trade" || path === "apprenticeship") return ROADS.find((r) => r.key === "trades")!;
  return ROADS.find((r) => r.field.test(field)) || null;
}

/** "First-year" … "Senior" as 1–4; graduate students and graduates count as after college. */
export const yearNumber = (classYear: string) => {
  const i = YEARS.findIndex((y) => y && classYear.toLowerCase().startsWith(y.toLowerCase().slice(0, 5)));
  return i > 0 ? i : /fresh/i.test(classYear) ? 1 : /grad|alum/i.test(classYear) ? 5 : 0;
};
