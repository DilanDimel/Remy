// Remy v2 shared data model. Everything a student owns lives in one
// per-account Workspace document stored on the server (SQLite).

export type Label = "Live" | "Demo data" | "Needs setup" | "Needs verification" | "Student provided";

export interface Bullet {
  id: string;
  text: string;
  /** false when the parser could not find this text in the uploaded file */
  verified?: boolean;
}
export interface Entry {
  id: string;
  org: string;
  role: string;
  location: string;
  dates: string;
  bullets: Bullet[];
  /** Fields the AI reader filled in with words that aren't in the uploaded file. */
  unverified?: ("org" | "role")[];
}
export interface Section {
  id: string;
  heading: string;
  entries: Entry[];
}
export interface SkillLine {
  id: string;
  label: string;
  items: string;
}
export interface ResumeDoc {
  contact: { name: string; email: string; phone: string; location: string; links: string };
  sections: Section[];
  skills: SkillLine[];
  /** Where the Skills block sat in the original: after this many sections (end when unset). */
  skillsIndex?: number;
}
/** The look of the student's uploaded PDF, so downloads match it. */
export interface ResumeStyle {
  serif: boolean; size: number; margin: number; pages: number;
  /** The file's main font as named there ("Garamond", "Courier", "LiberationSans"), monospace, and whether it uses italics at all. */
  font?: string; mono?: boolean; italic?: boolean;
  /** Word layout features some applicant tracking systems read out of order (unset for PDFs and older uploads). */
  layout?: { tables: boolean; textBoxes: boolean; columns: boolean };
}
/** How completely the structured resume reflects the uploaded file. */
export interface ResumeQuality {
  /** Share of the file's words that made it into the structured resume (0–1). */
  coverage: number;
  /** Lines from the file that didn't land anywhere in the structured resume. */
  missingLines: string[];
  /** Plain-language notes for the student about how the file was read. */
  warnings: string[];
}
export interface BaseResume {
  fileName: string;
  uploadedAt: string;
  rawText: string;
  parsedBy: "ai" | "rules" | "builder";
  /** Set when the LinkedIn PDF stands in for a resume the student hasn't uploaded yet. */
  from?: "LinkedIn";
  doc: ResumeDoc;
  confirmedAt?: string;
  /** Last time the student (or Remy, with their OK) changed the resume after upload; the preview then shows the rebuilt
   *  file instead of the original. */
  editedAt?: string;
  /** Skills and tools found on the resume, matched against posting requirements. */
  skills?: string[];
  /** The uploaded file itself is kept server-side for preview and download. */
  original?: { name: string; mime: string; size: number };
  style?: ResumeStyle;
  quality?: ResumeQuality;
  /** Lines the student deleted in Remy, so the Word download can take them out of their own file too. */
  removed?: string[];
  /** Each bullet's text as first read from the uploaded file, by bullet id, so the Word download can find the file line
   *  a reworded bullet came from. Lines added in Remy aren't here, so they never overwrite a file line. */
  fileLines?: Record<string, string>;
}

/** "Build my resume with Remy": everything the student told the builder, kept so they can come back and add to it. */
export interface BuilderItem {
  id: string;
  /** Which button they tapped: job, internship, care, family, hustle, project, research, award, club, sports, faith, volunteer, arts, greek, language, certificate. */
  kind: string;
  stage: "high school" | "college";
  org: string;
  role: string;
  start: string;
  end: string;
  city: string;
  about: string;
  followups: { q: string; a: string }[];
}
export interface BuilderBullet {
  id: string;
  /** The wording the student picked or wrote. Blanks look like "[how many customers?]" until filled or removed. */
  text: string;
  /** Other wordings of the same facts. */
  options: string[];
  /** The student's own words this bullet came from. */
  source: string;
}
export interface ResumeBuilder {
  step: number;
  basics: {
    name: string; email: string; phone: string; city: string; school: string; major: string; graduation: string;
    classYear: string; gpa: string; highSchool: string; highSchoolYear: string;
  };
  items: BuilderItem[];
  /** Keep high school entries for juniors and up (left out by default). */
  keepHighSchool?: boolean;
  skills: string[];
  skillSuggestions?: string[];
  /** Bullets per item id, once drafted. */
  draft?: Record<string, BuilderBullet[]>;
  draftedBy?: "ai" | "rules";
}

export interface Profile {
  /** "What are you working toward?", in the student's own words or a tapped chip (first question of setup). */
  goal?: string;
  /** Practical limits from setup ("Needs to be paid, Up to 15 hours a week, No car"). */
  constraints?: string;
  /** What they've already tried ("Applied to a few, Went to a career fair"). */
  tried?: string;
  /** What worries them most; the plan's first step addresses it. */
  worries?: string;
  name: string;
  preferredName: string;
  email: string;
  applicationEmail: string;
  school: string;
  major: string;
  classYear: string;
  graduation: string;
  location: string;
  targetRoles: string;
  goals: string;
  interests: string;
  workAuth: string;
  relocation: string;
  /** Where the student wants opportunities, comma-separated ("Fort Worth, Dallas, Remote"). */
  regions: string;
  /** Kinds of opportunities they want, comma-separated ("Internships, Events"). */
  opportunityTypes: string;
  /** On a 4-point scale, only as written on the resume. Postings often require a minimum. */
  gpa?: string;
  minors?: string;
  /** When they want to start, e.g. "Summer 2027, Fall 2026". Postings naming another summer are left out. */
  timeline?: string;
  /** Industries, companies or kinds of work they don't want, comma-separated. */
  avoid?: string;
  /** Employers they'd love to work for, comma-separated. Searched first. */
  dreamEmployers?: string;
  /** Where they are right now (a PATHS key); "" = not asked yet. Remy doesn't assume a four-year degree. */
  path?: string;
}

/** Paths into a career, not only the bachelor's degree. */
export const PATHS: [string, string][] = [
  ["four-year", "Four-year college"], ["community-college", "Community college"], ["trade", "Trade or technical school"],
  ["apprenticeship", "Apprenticeship"], ["military", "Military or veteran"], ["working", "Working, not in school"], ["high-school", "High school"],
];

export interface MemoryFact {
  id: string;
  text: string;
  category: "background" | "goal" | "preference" | "skill" | "experience" | "constraint" | "other";
  source: string; // e.g. "Resume upload", "LinkedIn PDF", "Assistant chat", "Onboarding answer"
  status: "approved" | "suggested";
  /** How an imported fact disagrees with the resume or profile, e.g. a different major. */
  conflict?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Requirement {
  id: string;
  keyword: string;
  quote: string; // exact wording from the posting
}
export interface JobCheck {
  at: string;
  httpStatus: number | null;
  result: "reachable" | "closed-signal" | "unreachable";
  note: string;
}
export interface Job {
  id: string;
  kind: "job" | "internship" | "program" | "campus" | "event";
  title: string;
  company: string;
  location: string;
  format: string;
  dates: string;
  deadline: string; // ISO date or ""
  deadlineText: string;
  eligibility: string[];
  requirements: Requirement[];
  summary: string;
  applyUrl: string;
  sourceUrl: string;
  sourceName: string;
  label: Label;
  checkedAt: string;
  /** When Remy first found it for this student ("new since your last visit"). */
  foundAt?: string;
  checks: JobCheck[];
  origin: "imported" | "manual";
  postingText?: string;
}

export interface JobFit {
  at: string;
  by: "rules" | "ai";
  /** Version of the fit rules this verdict came from (server/jobs/fit.ts FIT_RULES_VERSION). */
  v?: number;
  eligibility: "likely" | "check" | "unlikely" | "unknown";
  eligibilityNote: string;
  /** The posting states a rule (class year, graduation, Class of) that Remy checked and the student meets. Only then "You qualify". */
  checked?: boolean;
  /** Hidden because of the student's own choices (field, kind of opportunity, avoid list, which summer), not eligibility. */
  hidden?: string;
  matched: string[];
  gaps: string[];
  why: string;
  /** The posting definitely rules this student out (e.g. "must be a current sophomore"). Hidden by default. */
  excluded?: boolean;
  /** Why the opening can't be applied to anymore (deadline passed, link gone, page says closed). Also hidden by default. */
  closed?: string;
  /** Ranking: eligibility, requirement overlap, region and type preferences. */
  score?: number;
  regionMatch?: boolean | null;
  /** Outside the student's places but shown because of their relocation answer: why ("the title is in your field"). */
  relocate?: string;
  typeMatch?: boolean | null;
}

export type ChangeStatus = "pending" | "accepted" | "edited" | "rejected";
export interface ClaimFlag {
  type: "number" | "skill" | "title" | "name" | "placeholder" | "scope" | "ai-audit";
  term: string;
  message: string;
}
export interface BulletChange {
  id: string;
  bulletId: string;
  entryLabel: string;
  original: string;
  revised: string;
  edited?: string;
  requirementId: string;
  requirementQuote: string;
  reason: string;
  evidence: string;
  status: ChangeStatus;
  flags: ClaimFlag[];
  confirmedTrue?: boolean;
}
export interface PersonalizeItem {
  id: string;
  text: string;
  done: boolean;
}
export interface AtsCheck {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}
export interface AppVersion {
  v: number;
  at: string;
  resume: ResumeDoc;
  letter: string;
  note: string;
}
export interface AtsScore {
  score: number; // internal only: orders suggestions, never shown to students
  categories: { name: string; max: number; score: number; items: { ok: boolean; earned: number; max: number; text: string }[] }[];
  fixes: { category: string; text: string; gain: number; examples?: string[] }[];
  keywords: { matched: string[]; missing: string[] };
  against: string;
  at: string;
}
export interface Application {
  id: string;
  /** Rewrites Remy dropped because even its repair try still said more than the resume (server/ai/tailorFix.ts). */
  skippedChanges?: number;
  /** Those were left out because the AI was busy, not because they overstated (try tailoring again later). */
  skippedBusy?: boolean;
  jobId: string;
  createdAt: string;
  generatedAt?: string;
  generatedBy?: string;
  /** Remy drafted this overnight for a top match (stage 5b); nothing is used until the student approves it. */
  overnight?: string;
  strongestMatch?: { text: string; requirementQuote: string; evidence: string };
  gaps: { requirementQuote: string; note: string }[];
  changes: BulletChange[];
  letter: string;
  letterFlags: ClaimFlag[];
  letterApproved: boolean;
  personalize: PersonalizeItem[];
  ats: AtsCheck[];
  audit?: { at: string; findings: { claim: string; why: string }[] };
  versions: AppVersion[];
  staleReason?: string;
}

/** "Received" = an automatic confirmation; "Heard back" = a person replied (not yet an interview); "No reply" = the student stopped waiting. */
export type TrackStatus = "Saved" | "Applied" | "Received" | "Heard back" | "Interview" | "Offer" | "Rejected" | "No reply" | "Withdrawn";
export interface TrackEvent {
  id: string;
  at: string;
  status: TrackStatus;
  source: string; // "Manual", "Email (pasted)", "Sample email"
  evidence?: string;
}
export interface TrackItem {
  id: string;
  company: string;
  role: string;
  jobId?: string;
  applicationId?: string;
  status: TrackStatus;
  events: TrackEvent[];
  notes: string;
  /** After a rejection: the student added the recovery steps or dismissed the card. */
  recovery?: "added" | "dismissed";
  /** Home asked "Did you apply?" and the student said not yet (asked again 5 days later). */
  askedAt?: string;
  /** Two weeks after applying with no news: the student added a follow-up to-do or said it isn't needed. */
  followUp?: "added" | "dismissed";
}
export interface Suggestion {
  id: string;
  messageId: string;
  trackId?: string;
  company: string;
  role: string;
  proposed: TrackStatus;
  confidence: "high" | "medium" | "low";
  evidence: string;
  rulesSay: TrackStatus | "Unclear";
  aiSays?: TrackStatus | "Unclear";
  /** An interview's date and time (YYYY-MM-DD, HH:MM), only when the email states it: dateQuote is its exact words. */
  date?: string;
  time?: string;
  dateQuote?: string;
  /** The time zone the email's quote names ("Eastern"), so a time in another zone isn't filled in as the student's. */
  zone?: string;
  createdAt: string;
  state: "open" | "applied" | "dismissed";
}
export interface InboxMessage {
  id: string;
  from: string;
  subject: string;
  date: string;
  body: string;
  label: "Sample email" | "Pasted by student";
}

export interface Task {
  id: string;
  title: string;
  why: string;
  due: string;
  category: "Explore" | "Prepare" | "Apply" | "Connect" | "Academic";
  done: boolean;
  source: string;
  link?: string;
}
export interface CalItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM or ""
  kind: "Deadline" | "Event" | "Task" | "Interview" | "Advising";
  source: string;
  linkedId?: string;
  notes: string;
  /** An interview the student wrote a debrief for (or skipped), so Home stops asking. */
  debriefed?: boolean;
  /** The debrief itself: private, so not in `notes` (which sync to Google Calendar). */
  debrief?: string;
}
export interface Contact {
  id: string;
  name: string;
  title: string;
  org: string;
  email: string;
  why: string;
  tags: string[];
  label: Label;
  /** Where the student met them ("TCU career fair") and the date, YYYY-MM-DD (idea 18). */
  met?: string;
  metOn?: string;
}
export interface OutreachDraft {
  id: string;
  contactId: string;
  to: string;
  subject: string;
  body: string;
  /** Short LinkedIn connection note (under 200 characters). */
  linkedin?: string;
  status: "draft" | "approved" | "handed-off";
  createdAt: string;
  approvedAt?: string;
}
export interface PathPlan {
  generatedAt: string;
  generatedBy: string;
  nextAction: { title: string; why: string; link: string };
  careers: { id: string; title: string; what: string; fit: string[]; gaps: string[]; steps: string[] }[];
  skills: { id: string; name: string; type: "skill" | "certification" | "course"; why: string; verify: string }[];
  academic: { id: string; term: string; items: string[]; note: string }[];
  chosenCareerId?: string;
}
export interface AiLogEntry {
  id: string;
  at: string;
  purpose: string;
  model: string;
  ok: boolean;
  ms: number;
  note?: string;
  /** US dollars, when the provider reports it (OpenRouter). */
  cost?: number;
}
export interface SafeguardIncident {
  id: string;
  at: string;
  kind: "AI overstatement caught" | "Safeguard test" | "Letter check overridden by student";
  where: string;
  text: string;
  flags: ClaimFlag[];
}
export interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
  page?: string;
  memorySuggestions?: string[];
  /** Buttons under a reply; nothing happens until the student taps one. */
  actions?: ChatAction[];
  /** A resume change Remy drafted from the student's chat message (redesign stage 3): shown as before → after with
   *  "Use this"; nothing is saved until they tap it. Only the newest message keeps its draft. */
  resumeProposal?: { doc: ResumeDoc; summary: string; base: string };
  /** What Remy did from this reply (redesign stage 6, owners first), each with Undo (server/ai/chatDo.ts). */
  did?: ChatDid[];
}
export type ChatAction = { kind: "task"; title: string; why: string; due?: string } | { kind: "role"; title: string } | { kind: "open"; link: string; label: string }
  | { kind: "setting"; key: SettingKey; value: string | boolean } | { kind: "save"; jobId: string } | { kind: "tailor"; jobId: string }
  // Owners (server/ai/chatDo.ts): done by Remy with Undo, except "profile", which changes fits and approved versions, so the student taps it.
  | { kind: "name"; value: string } | { kind: "done"; taskId: string } | { kind: "unsave"; jobId: string }
  | { kind: "event"; title: string; date: string; time?: string } | { kind: "remember"; text: string }
  | { kind: "profile"; field: ProfileField; value: string } | MoreAction;
/** Owners: the rest of the site, done by Remy from chat (server/ai/remyTools.ts). */
export type MoreAction = { kind: "interest"; jobId: string; more: boolean } | { kind: "unhide"; jobId: string }
  | { kind: "prefs"; field: "regions" | "opportunityTypes" | "timeline" | "avoid" | "dreamEmployers" | "interests" | "goals" | "classYear" | "relocation" | "workAuth"; value: string; mode: "set" | "add" | "remove" }
  | { kind: "nudges"; value: "daily" | "weekly" | "off" } | { kind: "careerTime"; day?: number; time?: string; off?: boolean } | { kind: "textsOff" }
  | { kind: "track"; trackId?: string; company?: string; role?: string; jobId?: string; status: TrackStatus }
  | { kind: "moveEvent"; calId: string; date: string; time?: string } | { kind: "removeEvent"; calId: string } | { kind: "due"; taskId: string; due: string }
  | { kind: "hours"; activity: string; hours: number; date: string; note?: string } | { kind: "career"; careerId: string }
  | { kind: "contact"; name: string; org: string; title: string; why: string; met?: string; metOn?: string } | { kind: "forget"; factId: string }
  | { kind: "go"; link: string; label: string } | { kind: "start"; what: "resumeFix" | "interview" | "tour"; jobId?: string };
export type ProfileField = "major" | "minors" | "school" | "graduation" | "location";
export interface ChatDid {
  id: string; kind: "task" | "save" | "tailor" | "role" | "name" | "setting" | "done" | "unsave" | "event" | "remember" | MoreAction["kind"]; label: string; ref: string; link?: string; undone?: boolean;
  /** Opened a page or started something: nothing to undo. */
  noUndo?: boolean;
  /** What it was before, so Undo can put it back (a name, a setting's value). */
  old?: string | boolean;
}
export type StoryPart = "situation" | "task" | "action" | "result";
export interface Story {
  id: string; title: string; theme: string; situation: string; task: string; action: string; result: string; missing: string; source: string;
  /** For each part the resume doesn't say: one question about this experience, for the student to answer. */
  asks?: Partial<Record<StoryPart, string>>;
  /** Parts the student wrote themselves (kept when the deck is rebuilt). */
  mine?: StoryPart[];
  /** The approved fact each of the student's parts became, so an edit updates it and clearing removes it. */
  facts?: Partial<Record<StoryPart, string>>;
}
export interface Step { at: string; kind: "task" | "save" | "start" | "approve" | "outreach" | "resume"; ref: string; xp: number }
/** Settings the chat may offer to change (the student still taps to confirm). */
/** What the student said would help most on day one; it picks where setup leads. */
export type SetupFocus = "resume" | "openings" | "interview" | "direction" | "explore";
export type SettingKey = "theme" | "notify.deadlines" | "notify.statusChanges" | "notify.weeklyPlan";

// Interest in an opening (ported from Julio's interest system, Nov 6 2026). Only the student's own ratings; no shared model.
export type JobInterestRating = 1 | 2 | 3 | 4 | 5;
export const JOB_INTEREST_REASONS = ["role", "location", "format", "pay", "requirements", "company"] as const;
export type JobInterestReason = typeof JOB_INTEREST_REASONS[number];
/** Only professional search context: no name, contact details, GPA, work authorization or resume text. */
export interface JobInterestContext {
  rankingVersion: string;
  profileKey: string;
  profile: Pick<Profile, "major" | "targetRoles" | "interests" | "classYear" | "regions" | "opportunityTypes">;
  job: Pick<Job, "title" | "company" | "location" | "format" | "kind">;
  capturedAt: string;
}
export interface JobInterest { rating: JobInterestRating; reason?: JobInterestReason; createdAt: string; updatedAt: string; context: JobInterestContext }
/** How the student's own interest moved an opening, and why (shown on the card). */
export interface JobRanking { score: number; adjustment: number; reasons: string[] }

export interface Workspace {
  version: 2;
  started: boolean;
  /** options: tap-to-answer suggestions per question; exploring: the student said they're not sure what they want yet. */
  onboarding: { step: number; done: boolean; answers: { q: string; a: string; toConfirm?: boolean }[]; questions: string[]; targets?: string[]; options?: string[][]; exploring?: boolean; focus?: SetupFocus };
  profile: Profile;
  resume?: BaseResume;
  builder?: ResumeBuilder;
  imports: { id: string; kind: string; fileName: string; at: string; label: Label; factsAdded: number }[];
  memory: MemoryFact[];
  jobs: Job[]; // found by the live search, imported or added by the student
  /** When Remy last searched employers' career sites for this student (it re-searches every few hours). */
  openingsCheckedAt?: string;
  /** When Remy last read each employer's career site for this student (so "Find more" reaches new ones). */
  employersRead?: Record<string, string>;
  /** Links of old openings removed from the list (server/resume/trim.ts), so a search doesn't add them back as new. */
  droppedJobUrls?: string[];
  /** The AI's employer pick for openings searches, reused for 7 days while the profile it was made from is unchanged. */
  employerPick?: { at: string; key: string; names: string[] };
  /** How the last search went: employer sites reached out of those tried. */
  lastSearch?: { at: string; reached: number; scanned: number };
  savedJobIds: string[];
  fits: Record<string, JobFit>;
  hiddenJobIds: string[];
  /** The student's own interest per opening ("More like this" / "Not for me"). Missing = unknown. */
  jobFeedback?: Record<string, JobInterest>;
  /** Server revision, so a late response can't undo a newer rating. */
  jobFeedbackVersion?: number;
  applications: Application[];
  tracker: TrackItem[];
  inbox: InboxMessage[];
  suggestions: Suggestion[];
  tasks: Task[];
  calendar: CalItem[];
  contacts: Contact[];
  outreach: OutreachDraft[];
  /** Real career steps (server-recorded, once each), counted in the owners' north star. */
  steps?: Step[];
  /** Story Deck: true interview stories built from resume lines (STAR), with what's still missing. */
  stories?: Story[];
  /** Day and time the last weekly digest went out (one a week; new openings are counted from it). */
  lastDigest?: string;
  lastDigestAt?: string;
  /** The student's 30-second pitch (Remy's draft, then their edits). */
  pitch?: { text: string; at: string };
  /** Career quest (owners only while tested): each week's starting counts and the missions finished (shared/game.ts). */
  game?: { weeks: Record<string, { base: Record<string, number>; done: string[]; missions?: string[] }>; bestLevel?: number;
    /** Daily path (stage 7, owners first): cards finished per local day (shared/daily.ts), roles learned, rest weekdays. */
    days?: Record<string, string[]>; known?: string[]; restDays?: number[];
    /** Owner trail (Nov 23): best rank reached on the longer ladder (shared/game.ts RANKS) and the outfit Remy wears. */
    bestRank?: number; outfit?: string };
  /** Hours the student logged (volunteering, shadowing, clinical, shifts…), with running totals on Progress → Hours. */
  hours?: HoursEntry[];
  /** The text of the student's last LinkedIn PDF, for the LinkedIn coach (shared/linkedin.ts). Server-written. */
  linkedin?: { text: string; at: string };
  /** Feedback asks the student answered or skipped ("moment:resume", "checkin:2026-W46" → Central day), so each is asked once. Server-written. */
  feedbackAsked?: Record<string, string>;
  /** Day (YYYY-MM-DD, Central) of the last weekly check-in; the Home card hides for 6 days after. */
  lastCheckin?: string;
  /** Days (YYYY-MM-DD, Central) the student opened Remy, newest last; owners see only return rates from it. */
  visits?: string[];
  /** Match emails Remy sent (server/coach/nudges.ts) and the student's Yes / Not now. Server-written. */
  nudges?: { id: string; jobId: string; at: string; answer?: "yes" | "later"; answeredAt?: string }[];
  /** When Remy last drafted tailored resumes overnight (stage 5b). Server-written. */
  overnightAt?: string;
  /** Urgent texts Remy sent, or kept in test mode (server/notify/texts.ts). Server-written. */
  texts?: { key: string; day: string; at: string; to: string; body: string; mode: "twilio" | "test" }[];
  /** Deadline reminders already emailed (calendar id:date:soon|day), so each goes out once. */
  reminded?: string[];
  /** When the student last uploaded a profile photo (also busts the image cache); absent = no photo. */
  photoAt?: string;
  /** The beta terms version the student agreed to, and when (server time). */
  betaAgreed?: { version: string; at: string };
  plan?: PathPlan;
  chat: ChatMsg[];
  aiLog: AiLogEntry[];
  incidents: SafeguardIncident[];
  settings: {
    /** "system" follows the device (the default). */
    theme: "system" | "light" | "dark";
    /** Owners only: false = use Remy like a student (no owner features). Default on. */
    ownerView?: boolean;
    /** The student's fixed weekly time for career work (day 0 = Sunday, time "HH:MM"); null = removed. */
    careerTime?: { day: number; time: string } | null;
    /** True once the student picked a theme themselves (older accounts stored "light" by default). */
    themeChosen?: boolean;
    assistantOpen: boolean;
    navCollapsed: boolean;
    notify: { deadlines: boolean; statusChanges: boolean; weeklyPlan: boolean };
    /** How often Remy emails about a new opening that fits (server/coach/nudges.ts). Unset = weekly. */
    nudges?: "daily" | "weekly" | "off";
    /** Opt-in texts for urgent deadlines (server/notify/texts.ts): on/off and a US phone number. */
    texts?: { on: boolean; phone: string };
    /** Connectors shown as connected in the demo (no data is read from them yet). */
    demoConnections?: string[];
    /** When the student last opened Home (for "Since you were last here"). */
    lastSeenAt?: string;
    /** Newest "What's new" item the student has opened. */
    newsSeen?: string;
    /** Remy's tutorial through the site (components/Tour.tsx): the step reached, or done/ended. Unset = never started. */
    tour?: number | "done";
    /** Older versions (first-win box, page cards); kept so saved settings still load. */
    firstWin?: number | "done";
    introsSeen?: string[];
    /** Remy's in-page offers the student answered (shared/remyOffers.ts), so each is offered once. */
    offersSeen?: string[];
  };
  updatedAt: string;
}

export interface Me {
  id: string;
  kind: "google" | "supabase" | "guest" | "visitor" | "local";
  email: string;
  name: string;
  picture: string;
  /** A school email the student verified with a code (unlocks school-specific tools). */
  schoolEmail?: string;
  /** One of Remy's owners (OWNER_EMAILS): can open the admin dashboard. */
  owner?: boolean;
}
export interface AppConfig {
  googleClientId: string | null;
  ai: { available: boolean; model: string; via: string; ownerTrial?: string };
  hosting: "preview" | "published" | "local";
  today: string;
  /** Supabase Auth, when configured: public URL + publishable key, and which sign-in providers are switched on. */
  supabase: { url: string; anonKey: string; providers: Record<string, boolean> } | null;
  /** School email verification: whether codes can be sent, and which domains count (e.g. tcu.edu). */
  schoolEmail: { ready: boolean; domains: string[] };
  /** Remy can email its own 6-digit sign-in codes (used instead of Supabase's sign-in links). */
  emailCodes?: boolean;
  /** Google Calendar connection is set up on this server. */
  googleCalendar: boolean;
  /** Which version of Remy the server runs; when it changes, an open tab offers to reload. */
  build?: string;
  /** Founding Cohort beta: when on, only accepted emails can sign in; formUrl is the team's application form. */
  beta?: { on: boolean; formUrl: string };
}

export interface HoursEntry {
  id: string;
  activity: string;
  hours: number;
  date: string; // YYYY-MM-DD
  note?: string;
}
