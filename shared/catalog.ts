import type { Contact, InboxMessage, Job } from "./types";

// Public openings verified from official firm pages or the firm's own posting
// text mirrored on university career boards, checked October 17, 2026.
// Every card keeps its source link and a "Re-check link" action so the
// status can be re-verified on demonstration day.
const CHECKED = "2026-10-17";

export const CATALOG: Job[] = [
  {
    id: "evercore-ma-2028",
    kind: "internship",
    title: "2028 Strategic Advisory: M&A Summer Analyst Program",
    company: "Evercore",
    location: "Nationwide (offices include New York, Houston, Dallas)",
    format: "10-week summer internship, summer 2028",
    dates: "Summer 2028",
    deadline: "2026-11-15",
    deadlineText: "Applications open Sept 9 and close Nov 15, 2026 (not reviewed on a rolling basis; max two applications)",
    eligibility: [
      "Pursuing an undergraduate degree with a graduation date between December 2028 and June 2029",
      "All majors encouraged to apply",
    ],
    requirements: [
      { id: "r1", keyword: "Strong academic record", quote: "Strong academic record coupled with diverse interests" },
      { id: "r2", keyword: "Strategic thinking", quote: "Ability to think critically about a range of strategic issues impacting our clients" },
      { id: "r3", keyword: "Investment banking knowledge", quote: "Demonstrated knowledge in investment banking and global markets" },
      { id: "r4", keyword: "Quantitative + communication", quote: "Quantitative and analytical talents combined with effective communication skills" },
      { id: "r5", keyword: "Work ethic", quote: "Enthusiastic, outgoing, and achievement-oriented character with a great work ethic" },
    ],
    summary:
      "A 10-week program designed to give undergraduates a representative experience in strategic advisory and mergers and acquisitions. A cover letter is required.",
    applyUrl: "https://evercore.tal.net/candidate/jobboard/vacancy/2/adv/",
    sourceUrl: "https://careerservices.fas.harvard.edu/jobs/evercore-partners-2028-strategic-advisory-ma-summer-analyst-program/",
    sourceName: "Evercore posting (via Harvard FAS career board) + evercore.tal.net",
    label: "Live",
    checkedAt: CHECKED,
    checks: [],
    origin: "verified-catalog",
  },
  {
    id: "citi-early-id-banking",
    kind: "program",
    title: "Early ID Program – Banking track (Fall 2026)",
    company: "Citi",
    location: "Virtual (U.S.)",
    format: "Three-week virtual mentorship program, 2–3 hours/day",
    dates: "Fall 2026",
    deadline: "2026-10-23",
    deadlineText: "Posting said applications close Oct 23 at 11:59 PM ET, but the posting page returned 404 on Oct 18 (it listed an anticipated close of Oct 15). It may be closed. Confirm on Citi's events page before applying.",
    eligibility: [
      "Currently a sophomore enrolled in a four-year bachelor's degree program",
      "Cumulative GPA of 3.3 or above preferred",
      "Maximum of two Early ID applications",
    ],
    requirements: [
      { id: "r1", keyword: "Sophomore", quote: "You are currently a sophomore enrolled in a four-year bachelor's degree program from an accredited institution." },
      { id: "r2", keyword: "GPA 3.3+", quote: "A cumulative GPA of 3.3 or above is preferred." },
      { id: "r3", keyword: "Financial services interest", quote: "interested in exploring careers within financial services" },
      { id: "r4", keyword: "Motivated + curious", quote: "We encourage applications from students who are motivated, curious, and interested in exploring careers within financial services." },
    ],
    summary:
      "Mentorship, training webinars, networking and personalized interview preparation for future Summer Analyst recruiting. Students pick a Banking or Markets track.",
    applyUrl: "https://jobs.citi.com/events-preinternships",
    sourceUrl: "https://jobs.citi.com/job/new-york/early-id-program-corporate-banking-fall-2026-new-york/287/101706874784",
    sourceName: "jobs.citi.com",
    label: "Needs verification",
    checkedAt: CHECKED,
    checks: [{ at: "2026-10-18T03:00:00.000Z", httpStatus: 404, result: "unreachable", note: "Posting page returned HTTP 404 — may have closed after its anticipated Oct 15 close date" }],
    origin: "verified-catalog",
  },
  {
    id: "db-develop-ib",
    kind: "program",
    title: "Develop with Deutsche Bank – Investment Bank (U.S.)",
    company: "Deutsche Bank",
    location: "New York, NY / virtual session in November",
    format: "Insight program for sophomores",
    dates: "November 2026",
    deadline: "2026-11-04",
    deadlineText: "Application window Oct 5 – Nov 4, 2026",
    eligibility: [
      "IB track: students in the fall of sophomore year, Class of 2029",
      "Sophomore students who are diverse and/or can show a commitment to diversity",
    ],
    requirements: [
      { id: "r1", keyword: "Class of 2029 sophomore", quote: "IB: Students in the fall of sophomore year, Class of 2029" },
      { id: "r2", keyword: "Commitment to diversity", quote: "Sophomore students who are diverse (for example, students who identify as women, Black, Hispanic/Latinx, LGBTQI, veterans, people with disabilities, and those who may be diverse in other ways) and/or students who can show a commitment to diversity." },
      { id: "r3", keyword: "Short application + CV", quote: "You will be asked to submit a short application form and to attach your CV." },
    ],
    summary:
      "Introduction to Deutsche Bank, divisional deep dives, panels with senior colleagues and recent graduates, and resume, interview and networking preparation.",
    applyUrl: "https://careers.db.com/students-graduates/insight-programmes/us/develop",
    sourceUrl: "https://careers.db.com/students-graduates/your-application/",
    sourceName: "careers.db.com",
    label: "Live",
    checkedAt: CHECKED,
    checks: [],
    origin: "verified-catalog",
  },
  {
    id: "bain-capital-iot",
    kind: "event",
    title: "Investors of Tomorrow – November/December 2026",
    company: "Bain Capital",
    location: "Boston, MA (in person, Nov 19) + virtual panel (Dec 2)",
    format: "Half-day office program with dinner; virtual panel open to all applicants",
    dates: "Nov 19, 2026 (Boston) · Dec 2, 2026 (virtual)",
    deadline: "2026-10-25",
    deadlineText: "Workday registration by Sunday, Oct 25, 11:59 PM EST, plus Predictive Index assessments",
    eligibility: ["Undergraduate students currently in their sophomore year"],
    requirements: [
      { id: "r1", keyword: "Sophomore", quote: "Investors of Tomorrow offers a unique learning opportunity for undergraduate students currently in their sophomore year." },
      { id: "r2", keyword: "Predictive Index assessment", quote: "We will not be able to consider your application until both the Workday registration and Predictive Index assessments are complete." },
    ],
    summary:
      "Selected students visit the Boston office for programming led by investment professionals; domestic travel is sponsored. Later applicants are still invited to the Dec 2 virtual panel.",
    applyUrl: "https://builtin.com/job/bain-capital-investors-tomorrow-november-december-2026/11394613",
    sourceUrl: "https://builtin.com/job/bain-capital-investors-tomorrow-november-december-2026/11394613",
    sourceName: "Bain Capital posting (via Built In)",
    label: "Live",
    checkedAt: CHECKED,
    checks: [],
    origin: "verified-catalog",
  },
  {
    id: "insight-inclusion-2027",
    kind: "event",
    title: "2027 Inclusion by Insight Virtual 2-Day Summit",
    company: "Insight Partners",
    location: "Virtual",
    format: "Two-day virtual summit; select attendees invited to a first-round superday for the 2028 Investment Summer Analyst Program",
    dates: "Jan 14–15, 2027",
    deadline: "2026-11-06",
    deadlineText: "Applications close Friday, Nov 6 at 5:00 PM ET (reviewed on a rolling basis)",
    eligibility: ["Undergraduates graduating December 2028 – June 2029", "Open to all students"],
    requirements: [
      { id: "r1", keyword: "Resume + transcript + HireVue", quote: "A completed application entails submitting a copy of your resume, transcript and completing a HireVue Video" },
      { id: "r2", keyword: "Tech investing interest", quote: "explore the Venture Capital, Private Equity, and tech investing space" },
    ],
    summary:
      "Explore venture capital, private equity and tech investing, learn Insight's business and culture, and network with Insight professionals.",
    applyUrl: "https://info.insightpartners.com/Summer-Analyst-Program.html",
    sourceUrl: "https://careerservices.fas.harvard.edu/jobs/insight-partners-2027-inclusion-by-insight-virtual-2-day-summit-january-14t/",
    sourceName: "Insight Partners posting (via Harvard FAS career board) + insightpartners.com",
    label: "Live",
    checkedAt: CHECKED,
    checks: [],
    origin: "verified-catalog",
  },
];

// Clearly synthetic people. No real alumni data is used.
export const SAMPLE_CONTACTS: Contact[] = [
  {
    id: "c-sample-1",
    name: "Jordan Ellis (sample)",
    title: "Investment Banking Analyst",
    org: "Example Advisory Group",
    email: "jordan.ellis@example.com",
    why: "Sample contact: works in M&A advisory, a match for students exploring Evercore-style roles.",
    tags: ["Investment banking", "TCU alum (sample)"],
    label: "Demo data",
  },
  {
    id: "c-sample-2",
    name: "Priya Raman (sample)",
    title: "Fintech Product Analyst",
    org: "Example Payments Co.",
    email: "priya.raman@example.com",
    why: "Sample contact: bridges finance and information systems, relevant to Finance + BIS students.",
    tags: ["Fintech", "BIS"],
    label: "Demo data",
  },
  {
    id: "c-sample-3",
    name: "Marcus Bell (sample)",
    title: "Campus Recruiter",
    org: "Example Capital Partners",
    email: "marcus.bell@example.com",
    why: "Sample contact: recruiters can explain sophomore insight programs and timelines.",
    tags: ["Recruiting", "Sophomore programs"],
    label: "Demo data",
  },
];

// Synthetic emails for the status-suggestion workflow. Not from real employers.
export const SAMPLE_INBOX: InboxMessage[] = [
  {
    id: "m-sample-receipt",
    from: "no-reply@careers.example-bank.com",
    subject: "We received your application – Early Insight Program",
    date: "2026-10-12",
    body:
      "Hi there,\n\nThank you for applying to the Example Bank Early Insight Program. This email confirms we have received your application. Our team reviews applications on a rolling basis and will contact you if you are selected to move forward.\n\nBest,\nCampus Recruiting",
    label: "Sample email",
  },
  {
    id: "m-sample-interview",
    from: "recruiting@example-advisory.com",
    subject: "Next steps: first-round interview",
    date: "2026-10-15",
    body:
      "Hello,\n\nWe enjoyed reviewing your application for the Example Advisory Summer Analyst Program and would like to invite you to a 30-minute first-round interview. Please use the link below to choose a time between October 22 and October 24.\n\nRegards,\nExample Advisory Recruiting",
    label: "Sample email",
  },
  {
    id: "m-sample-ambiguous",
    from: "talent@example-capital.com",
    subject: "Update on your candidacy",
    date: "2026-10-16",
    body:
      "Hi,\n\nThanks for your continued interest in Example Capital. We wanted to share an update: our team is still reviewing candidates and we expect to share decisions about interviews and offers in the coming weeks.\n\nThank you,\nExample Capital Talent Team",
    label: "Sample email",
  },
];
