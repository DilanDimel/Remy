// Interview questions with sources (Dilan, Nov 27: "we need massive research behind the questions we ask").
// Every question here is copied (lightly trimmed) from a published list: an employer's own careers page or a
// university career office guide. Nothing is invented, and nothing says a company asks a question unless that
// company's own site lists it. Research notes, with every source read: project files interview-questions-research/.
// What employers publish: almost all describe their FORMAT (behavioral, STAR, case, coding), not their questions.
import type { ProfileId } from "./interviewRubric";

export type Source = { name: string; url: string; year?: string };
// Kept short: the name shows under each question, the link opens the page.
export const SOURCES = {
  ucdavis: { name: "UC Davis Washington Program", url: "https://washingtonprogram.ucdavis.edu/interview-skills/commonly-asked-questions" },
  miami: { name: "Miami University Career Services", url: "https://miamioh.edu/emss/_files/documents/career-services/pdfs/major_specific.pdf" },
  clemson: { name: "Clemson Career and Global Engagement", url: "https://www.clemson.edu/business/students/career-global-engagement/documents/interview-questions.pdf" },
  scranton: { name: "University of Scranton Career Services", url: "https://www.scranton.edu/studentlife/studentaffairs/careers/student-guides/interview-questions-by-industry%201.pdf", year: "2007" },
  wright: { name: "Wright State Engineering and Computer Science", url: "https://engineering-computer-science.wright.edu/sites/engineering-computer-science.wright.edu/files/uploads/2015/Aug/webform/Interview-%20sample.pdf", year: "2015" },
  washu: { name: "WashU McKelvey Engineering", url: "https://mckelveyconnect.washu.edu/blog/2024/10/01/cybersecurity-interview-questions-and-prep-2/", year: "2024" },
  bauer: { name: "University of Houston Bauer Career Services", url: "https://www.bauer.uh.edu/career-center/docs/career-guides-resources/grads/career/Careers_in_Sales.pdf" },
  eku: { name: "Eastern Kentucky University", url: "https://www.eku.edu/oacs/wp-content/uploads/sites/53/2023/09/Sample-Interview-Questions.pdf", year: "2023" },
  penn: { name: "Penn Career Services", url: "https://careerservices.upenn.edu/blog/2019/06/10/25-ux-design-interview-questions-and-answers/", year: "2019" },
  cornell: { name: "Cornell Career Development", url: "https://career.cornell.edu/resources/design-interviews-portfolio-review/", year: "2025" },
  georgetown: { name: "Georgetown Law", url: "https://www.law.georgetown.edu/wp-content/uploads/2024/04/Interviewing-Questions-You-May-Be-Asked.pdf", year: "2024" },
  yale: { name: "Yale Law School Career Development Office", url: "https://law.yale.edu/sites/default/files/area/department/cdo/document/cdo_sample_interview_questions.pdf" },
  uri: { name: "University of Rhode Island Career Services (questions alumni were asked)", url: "https://web.uri.edu/career/wp-content/uploads/sites/1069/Interviewing-Guide-for-Nursing-Majors.pdf" },
  umn: { name: "University of Minnesota School of Nursing", url: "https://nursingcurrentstudents.umn.edu/career-resources/interviewing/sample-interview-questions" },
  toledo: { name: "University of Toledo Career Services", url: "https://www.utoledo.edu/career/students/docs/common-education-interview-questions.pdf" },
  uwgb: { name: "UW-Green Bay Career Services", url: "https://www.uwgb.edu/UWGBCMS/media/career-services/files/pdf/Teacher-Candidate-Interview-Questions.pdf" },
  illinois: { name: "University of Illinois Educational Career Services", url: "https://education.illinois.edu/docs/default-source/default-document-library/frequently-asked-interview-questions.pdf?sfvrsn=0", year: "2000" },
  bu: { name: "Boston University School of Hospitality", url: "https://www.bu.edu/hospitality/files/2026/09/Interview-Prep-for-BU-SHA-Students.pdf", year: "2026" },
  rockefeller: { name: "Rockefeller University HR", url: "https://www.rockefeller.edu/human-resources/uploads/www.rockefeller.edu/sites/91/2025/09/Best-Practices-for-RA-Interviews_092225_Final.pdf", year: "2025" },
  mckinsey: { name: "McKinsey's careers site", url: "https://www.mckinsey.com/careers/interviewing" },
  bain: { name: "Bain's careers site", url: "https://www.bain.com/careers/hiring-process/case-interview/" },
  bcg: { name: "BCG's careers site", url: "https://careers.bcg.com/us/en/case-interview-preparation" },
  amazon: { name: "Amazon's interview guide", url: "https://www.aboutamazon.com/news/workplace/amazon-interview-guide", year: "2025" },
  microsoft: { name: "Microsoft's student interviewing page", url: "https://careers.microsoft.com/us/en/student-interviewing" },
  goldman: { name: "Goldman Sachs careers blog", url: "https://www.goldmansachs.com/careers/blog/posts/goldman-sachs-video-interviewing-facts.html", year: "2020" },
  ey: { name: "EY's interview tips", url: "https://www.ey.com/en_us/careers/interview-tips" },
  deloitte: { name: "Deloitte's recruiting tips", url: "https://www.deloitte.com/us/en/careers/join-deloitte/recruiting-tips.html" },
} satisfies Record<string, Source>;
export type SourceId = keyof typeof SOURCES;

/** "story": answer with a real example (STAR). "know": checks what you know, so say what you know and how you'd find out the rest. */
export type BankQ = { q: string; src: SourceId; kind: "story" | "know" };
const st = (q: string, src: SourceId): BankQ => ({ q, src, kind: "story" });
const kn = (q: string, src: SourceId): BankQ => ({ q, src, kind: "know" });

/** Questions career offices list for each field, most useful for a student first. Fields with no field-specific
 *  published list (public policy) use the general list rather than made-up ones. */
export type Field = ProfileId | "finance";
export const BANK: Record<Field, BankQ[]> = {
  generic: [
    st("Tell me about a time you had to deal with a problem at work and the steps you took to solve it.", "ucdavis"),
    st("Tell me about a time you made a mistake.", "ucdavis"),
    st("Give an example of a time that you went above and beyond the requirements for a project.", "ucdavis"),
    kn("How does this internship fit in with the career path you envision for yourself?", "ucdavis"),
  ],
  accounting: [
    st("What do you usually do when you have an upcoming deadline and several accounting projects to finish?", "clemson"),
    kn("How do you maintain accounting accuracy?", "clemson"),
    st("Give examples of the accounting reports you have prepared for class.", "miami"),
    kn("What do you consider to be the biggest challenge facing the accounting profession today?", "miami"),
    kn("How do you keep up with ethical and legal regulations in the industry?", "clemson"),
  ],
  banking: [
    kn("Why this company in particular? Why banking?", "scranton"),
    st("Describe a situation in which you used quantitative skills to solve a problem.", "scranton"),
    st("Tell me about a situation where you made a mistake and had to live with the consequences.", "scranton"),
    kn("What do you think investment bankers do every day?", "scranton"),
    kn("What is free cash flow?", "miami"),
  ],
  // Corporate finance, commercial banking, financial analyst roles (no scoring guide of their own).
  finance: [
    st("Describe a situation in which you used quantitative skills to solve a problem.", "scranton"),
    kn("How do you explain complex financial topics to colleagues from other departments?", "clemson"),
    kn("Can you explain quarterly forecasting, updating revenue, and expense models?", "miami"),
    kn("What do you want to know about a new customer before opening a deposit account?", "scranton"),
    kn("What are the biggest challenges that finance professionals face today?", "clemson"),
  ],
  investment_research: [
    kn("What, in your opinion, makes a good financial model?", "clemson"),
    kn("Explain PE ratios.", "scranton"),
    kn("Tell me about the CAPM (Capital Asset Pricing Model).", "scranton"),
    st("How do you gather information to solve problems? Give me an example.", "scranton"),
    kn("How do you explain complex financial topics to colleagues from other departments?", "clemson"),
  ],
  quant: [
    st("Describe a situation in which you used quantitative skills to solve a problem.", "scranton"),
    kn("Can you explain the difference between causation and correlation?", "clemson"),
    kn("What is the relationship between the forward and spot interest rate?", "scranton"),
  ],
  consulting: [
    kn("Why consulting?", "scranton"),
    st("Give me an example of a situation in which you analyzed and solved a problem. How did you do it?", "scranton"),
    st("Discuss a time you had a conflict within a group and how it was resolved.", "scranton"),
    st("Tell me about when you were a leader. Would you do anything differently?", "scranton"),
    kn("What do you think management consultants do every day?", "scranton"),
  ],
  marketing: [
    st("Tell me about two marketing accomplishments that were very successful or that you are the most proud of.", "miami"),
    kn("What marketing channels do you have experience with?", "clemson"),
    kn("How would you manage a new product launch?", "clemson"),
    st("Give me an example of how you convinced someone to do something that they were not too keen on doing.", "scranton"),
    kn("Could you talk about an insight or trend that you see happening in our industry?", "clemson"),
  ],
  sales: [
    st("Describe a sales situation that you think you handled well.", "bauer"),
    st("Describe a time when you had to use a different approach because your first approach failed to persuade someone.", "eku"),
    st("What extracurricular activities have you undertaken that enabled you to practice sales skills?", "bauer"),
    st("Tell me about a time you handled multiple responsibilities. How did you get organized?", "bauer"),
    kn("Sell me this. (The interviewer picks up something on the desk.)", "scranton"),
  ],
  software: [
    st("Tell me about a time you used your analytical skills to troubleshoot a problem.", "wright"),
    kn("What are your technical and non-technical skills?", "wright"),
    kn("With what programs and languages are you familiar?", "miami"),
    st("Describe one project you were a part of that you feel truly represents your technical ability.", "miami"),
    st("Tell me about a time when you helped a peer understand a new software package.", "wright"),
  ],
  cybersecurity: [
    st("Have you ever had to handle sensitive information in a previous role? If so, how did you go about it?", "washu"),
    st("How did you handle explaining technical issues to non-tech members of your team?", "washu"),
    kn("Please take us through your understanding of risk, vulnerability, and threat within a network.", "washu"),
    kn("What is the difference between symmetric and asymmetric encryption?", "washu"),
    kn("What is a brute force attack? What steps can you take to prevent it?", "washu"),
  ],
  design: [
    st("Walk me through your portfolio. Which pieces are you most proud of, and why?", "clemson"),
    kn("What's your design process?", "penn"),
    st("Tell me about a time when a project didn't go exactly as planned. How did you fix it?", "penn"),
    st("How do you incorporate feedback into your designs?", "clemson"),
    st("How did you validate your design decisions?", "cornell"),
  ],
  legal: [
    kn("How would you describe your research and writing skills, and when have you had the chance to develop them?", "georgetown"),
    st("Describe a situation where you had to convince someone of your viewpoint.", "yale"),
    st("Discuss a recent experience when you had to work under pressure.", "yale"),
    kn("In what area(s) of practice are you most interested?", "yale"),
  ],
  manufacturing: [
    kn("Do you have any experience in Six Sigma or another similar type of quality management methodology?", "miami"),
    kn("How do you feel design and manufacturing tie together?", "miami"),
    st("Tell me about a time when you took an idea and made it a reality.", "wright"),
    kn("Often a manufacturing facility can be uncomfortable. How do you deal with such an environment?", "wright"),
  ],
  aerospace: [
    st("Tell me about a time when you took an idea and made it a reality.", "wright"),
    kn("What experience do you have with computer aided drawing and design?", "wright"),
    st("Describe one project you were a part of that you feel truly represents your technical ability.", "miami"),
  ],
  research: [
    st("Describe a time when you had to persuade a colleague to see things your way.", "rockefeller"),
    st("How do you gather information to solve problems? Give me an example.", "scranton"),
    kn("Can you explain the difference between causation and correlation?", "clemson"),
  ],
  healthcare: [
    st("Describe a time you advocated for a patient.", "uri"),
    st("Describe a situation in which you had to prioritize your workload when faced with many demands.", "umn"),
    st("Tell me about a clinical mistake you made, and what you learned from the experience.", "umn"),
    kn("What approach would you take in explaining a complex clinical issue to a patient who does not have a clinical background?", "umn"),
    st("Describe a time you succeeded under high pressure.", "uri"),
    kn("What is your interest in this role and this hospital?", "uri"),
  ],
  education: [
    st("Give an example of how you differentiated instruction in a lesson.", "toledo"),
    st("Tell me about a time when you had to deal with a challenging behavior and how you handled the situation.", "toledo"),
    kn("If I walked into your classroom, what would I see?", "illinois"),
    kn("How do you communicate with parents about a student's progress?", "uwgb"),
    kn("Tell me what you do when a large number of students perform poorly on a formal assessment.", "toledo"),
  ],
  hospitality: [
    st("Tell me about a time you delivered exceptional customer service.", "bu"),
    st("Describe a challenging guest or client situation. How did you handle it?", "bu"),
    st("Tell me about a time you had to solve a problem quickly while maintaining excellent service.", "bu"),
    kn("Why did you choose hospitality as your career?", "bu"),
  ],
  public_policy: [],
};

/** What a company says on its own site about how it interviews, only for companies whose page we read. `asks` are
 *  questions the company itself lists. Matched on the employer name exactly enough to skip look-alikes
 *  ("Bain Capital" is not Bain & Company). */
export const COMPANIES: { re: RegExp; src: SourceId; note: string; asks?: string[] }[] = [
  { re: /^(amazon|aws|amazon web services)\b/i, src: "amazon", note: "Amazon's own guide says interviews use behavioral questions tied to its Leadership Principles, answered with the STAR method. Technical roles spend about half the time on coding and problem solving." },
  { re: /^microsoft\b/i, src: "microsoft", note: "Microsoft says student interviews check critical thinking, problem solving and how you learn, with behavioral and technical questions. Some roles ask you to write code or share a portfolio." },
  { re: /^goldman sachs\b/i, src: "goldman", note: "Goldman Sachs has said selected students first do a recorded video interview on core skills, reviewed by people (2020)." },
  { re: /^mckinsey\b/i, src: "mckinsey", note: "McKinsey says it runs a personal experience interview and a problem-solving (case) interview on a real client situation.",
    asks: ["Explain a challenging situation you encountered when working with someone with an opposing opinion to yours.", "Talk about a time when you had to work to achieve something in a limited period of time that was outside your comfort zone.", "Share an example of an instance where you effectively worked with people with different backgrounds."] },
  { re: /^bain(\s*(&|and)\s*company)?$/i, src: "bain", note: "Bain says consulting roles get a case interview, a conversation about a real business problem where how you think matters more than one right answer.",
    asks: ["Case: help a friend determine whether opening a coffee shop is a good idea."] },
  { re: /^(bcg|boston consulting group)\b/i, src: "bcg", note: "BCG says client-facing roles get a case interview: structure the problem, ask questions, work with data and do quick math out loud." },
  { re: /^(ey|ernst\s*(&|and)\s*young)\b/i, src: "ey", note: "EY says it leans heavily on behavioral questions (\"Give an example of...\", \"Describe a situation when...\"), sometimes with a short case." },
  { re: /^deloitte\b/i, src: "deloitte", note: "Deloitte says to expect two to three rounds, mixing behavioral, technical and case questions depending on the role." },
];

const FIELD_LABEL: Partial<Record<Field, string>> = { generic: "most", finance: "finance and banking" };
/** The bank to use for a job: its scoring guide, or finance for finance and banking titles the guides don't cover. */
export function bankField(title: string, profile: ProfileId): Field {
  if (profile !== "generic") return profile;
  return /\b(financ\w*|bank\w*|treasury|credit|lending|wealth|investment|fp&a|underwrit\w*)\b/i.test(title) ? "finance" : "generic";
}
export const fieldLabel = (f: Field, profileLabel: string) => FIELD_LABEL[f] ?? profileLabel.toLowerCase();

export const companyFacts = (company: string) => COMPANIES.find((c) => c.re.test(company.trim()));
