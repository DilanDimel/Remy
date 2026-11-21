// What each page and tab shows, so Remy's chat can answer "what is this?" / "what am I looking at?" about the exact
// screen the student is on, with their own data (owner feedback #59, Nov 19: explain the page for me, not the tour again).
// Keep each line true to the screen: when a page changes, change its line here (server/pageGuide.test.ts checks every
// page and tab has one).

export const PAGE_GUIDE: Record<string, { page: string; tabs?: Record<string, string> }> = {
  "/": {
    page: "Home. The dark card's \"Your next step\" is the one thing worth doing now. Beside it, until all are done, \"Getting started\" lists five first steps (save an opening, confirm your base resume, tailor one application, build one interview story, add one person you know) that tick themselves off; after that, the same spot shows what changed since their last visit and this week. Below: to-dos, events and new openings, plus a note on when hiring season opens for their field.",
    tabs: {
      "To-Dos": "Their open to-dos, soonest first. Some come from Remy (checks, follow-ups), some they added.",
      Events: "Career fairs and events coming up.",
      Opportunities: "The newest openings that fit them; the full list is on Opportunities.",
    },
  },
  "/path": {
    page: "My Path: where their field can take them.",
    tabs: {
      "Career exploration": "Career directions suggested from their resume, each a short row with how many openings Remy shows for that kind of job right now and, once picked, how many of its steps are done. The selected one opens beside the list: what the job is, why it fits (from their resume), what's missing, and first steps (on their to-dos or done). \"Search for these jobs + add steps\" makes Remy search openings for it and adds its first steps to their to-dos; then \"See N openings\" opens exactly those on Opportunities. The last row, \"None of these, or not sure yet?\", opens the jobs their major leads to most (U.S. Bureau of Labor Statistics), any other area, and \"What is it?\" for any job title.",
      "Your field's road": "The usual steps and timeline for their field (exams, licenses, applications), mostly Texas rules. Rules change: check the linked source and their advisor before planning around a step.",
      "Future of your field": "How jobs in their field are projected to change from 2025 to 2035, with pay and openings a year (all U.S. Bureau of Labor Statistics numbers, linked to the government's job guides). The top 3 growing and shrinking jobs come first. Each job also says what share of its tasks AI tools can speed up (research by Eloundou, Manning, Mishkin and Rock, 2023). \"What's the job?\" under a job opens up to 3 of its tasks in the U.S. Department of Labor's own words (O*NET): the ones it rates most important, or labeled as examples when it hasn't rated them. For many growing jobs it also shows one quoted sentence from the government's outlook, with a link to the full outlook; shrinking jobs show no quote, since one sentence can't explain a decline. Quoted as published, no AI.",
      "Skills & certifications": "Skills and certifications that matter for their direction. Remy doesn't invent official certifications; costs and eligibility are confirmed with the provider.",
    },
  },
  "/resume": {
    page: "Resume/CV: their base resume, versions tailored to openings, their LinkedIn, and approved files.",
    tabs: {
      "Base resume": "The resume everything else is built from, in three steps: check what Remy read and confirm it, make it stronger, your file.",
      "Check what Remy read": "Step 1 of 3. Their resume line by line as Remy read it, to edit; lines Remy wasn't sure about are marked. \"Save & confirm\" says every line is accurate; Remy only uses a confirmed resume as evidence. Edits are their own words and count as evidence.",
      "Make it stronger": "Step 2 of 3. Remy's suggestions on the base resume (lines without a number, lines that don't start with what they did, very short or long lines, too few words or bullets, missing dates or contact details), each fixable right there. ATS X-Ray shows what an applicant tracking system reads from their file (name, email, phone, sections, dates). Evidence passport shows which listed skills have a bullet proving them. Nothing saves until they press Save.",
      "Your file": "Step 3 of 3. Their resume as a file and its downloads. If they uploaded a file, \"Show your resume\" opens a preview of that original file.",
      "Tailor for an opening": "One version of their resume and a cover letter per opening, in three steps: review Remy's changes, read the cover letter, approve & download. Every change shows the posting requirement behind it and their own evidence; they decide each one.",
      "Review Remy's changes": "Step 1 of 3. Remy's proposed changes to their resume lines, one at a time (\"Change 2 of 3\"): their original, Remy's wording, the posting requirement behind it and why. \"Use Remy's\", \"Keep mine\" or \"Edit\". Decided ones fold into one line each; tapping one opens it again. A kept change that says something their resume doesn't show is marked \"Needs a look\" until they fix it or confirm it's true.",
      "Read your cover letter": "Step 2 of 3. The cover letter draft for this opening, built only from their resume and approved facts; they edit anything that doesn't sound like them.",
      "Approve & download": "Step 3 of 3. What blocks approval comes first (undecided changes, flagged claims, letter issues). Then every check: the skills this posting names (on their resume vs worth adding if true), the unsupported-claim check (rule-based, blocks export), an optional AI second opinion (advisory) and the file format check. Then a preview of the tailored resume and letter, and \"Approve this version\", which unlocks Word, PDF and text downloads.",
      LinkedIn: "The LinkedIn coach reads their LinkedIn PDF: headline (and a specific one from their resume if it's generic), web address, top 3 skills, how the About section opens, and whether the headline matches their resume.",
      "Approved & exports": "Every version they approved, with downloads.",
    },
  },
  "/opportunities": {
    page: "Opportunities: openings ranked for them. Openings in the places they chose come first; \"Worth relocating for\" ones (elsewhere, allowed by their relocation answer) come after. Each card's line says why it's there (in their area, title in their field, how many of the posting's skills they show, dream employer). Save keeps one; Details shows why they qualify, the requirements and eligibility quoted from the posting, and gaps; Tailor resume starts a version for it. Openings they can't apply to or that don't fit their choices are hidden and counted (\"Show anyway\"). Their dream employers show how many openings each has. They can import any public posting by link or text. Remy searches again about once a day.",
    tabs: {
      All: "The \"All\" filter is on: every kind of opening is listed.",
      "Jobs & internships": "The \"Jobs & internships\" filter is on: only jobs and internships are listed right now; don't name other kinds.",
      "Campus jobs": "The \"Campus jobs\" filter is on: only on-campus and part-time jobs are listed right now (or none, if Remy hasn't found any); don't name other openings as if they were on screen.",
      Events: "The \"Events\" filter is on: only career fairs and recruiting events are listed right now; don't name job openings as if they were on screen.",
    },
  },
  "/interview": {
    page: "Interview: Remy asks one short question at a time and turns their real experiences into interview stories (\"Tell me about a time when…\"). Each story shows how far along it is; they can open it to edit or practice out loud. Their pitch (tell me about yourself) is here too.",
  },
  "/community": {
    page: "Community: people who can help their career (a recruiter from a fair, a professor, a classmate, a manager). They add where and when they met; Remy adds a reminder to say thanks and drafts outreach in their own words at the length they ask. Alumni matches from their school are coming.",
  },
  "/calendar": {
    page: "Calendar: deadlines, interviews, events and prep in one place, plus their weekly career time. Items can be added to Google or Apple Calendar. They can paste an interview invite and Remy puts it on the calendar with a prep to-do.",
  },
  "/progress": {
    page: "Progress: following through on applications.",
    tabs: {
      Applications: "Every application and where it stands (Saved, Applied, Received, Heard back, Interview, Offer, Rejected, No reply, Withdrawn). For \"heard back\", an automatic \"we received your application\" email doesn't count; a rejection does.",
      "Email updates": "Paste an employer email (interview invite, offer, rejection). Remy shows what it would update; nothing changes until they confirm.",
      "To-dos": "All their to-dos.",
      Hours: "Log volunteering, shadowing, clinical, research or shift hours; many programs ask for totals.",
    },
  },
  "/accounts": {
    page: "Accounts: their profile, sources and what Remy remembers.",
    tabs: {
      Profile: "Their profile: name, school, major, graduation, places, target roles, dream employers, relocation and more. Remy's suggestions and searches use it.",
      "Connected sources": "Where Remy's facts come from (resume, LinkedIn and other imports).",
      "AI memory": "Facts Remy uses about them. Suggested facts wait for their approval; only approved ones are used as evidence.",
      "Appearance & alerts": "Theme and reminder emails.",
      "Account & data": "Their account, data download and deletion.",
    },
  },
};

const clean = (t: string) => t.replace(/\s*\(\d+\)\s*$/, "").trim(); // "Changes (3)" → "Changes"

/** The guide lines for the screen the student is on: the page, then each selected tab Remy knows. */
export function pageGuide(where: string, tabs: string[]): string {
  const path = (where || "/").split("?")[0].replace(/\/+$/, "") || "/";
  const g = PAGE_GUIDE[path];
  if (!g) return "";
  const lines = [g.page];
  for (const t of tabs.map(clean)) if (g.tabs?.[t]) lines.push(`${t} tab: ${g.tabs[t]}`);
  return lines.join("\n");
}
