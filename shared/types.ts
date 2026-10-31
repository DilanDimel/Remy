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
  /** Skills and tools found on the resume, matched against posting requirements. */
  skills?: string[];
  /** The uploaded file itself is kept server-side for preview and download. */
  original?: { name: string; mime: string; size: number };
  style?: ResumeStyle;
  quality?: ResumeQuality;
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
}

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
  checks: JobCheck[];
  origin: "imported" | "manual";
  postingText?: string;
}

export interface JobFit {
  at: string;
  by: "rules" | "ai";
  /** Version of the fit rules this verdict came from (server/fit.ts FIT_RULES_VERSION). */
  v?: number;
  eligibility: "likely" | "check" | "unlikely" | "unknown";
  eligibilityNote: string;
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
  score: number; // out of 100
  categories: { name: string; max: number; score: number; items: { ok: boolean; earned: number; max: number; text: string }[] }[];
  fixes: { category: string; text: string; gain: number; examples?: string[] }[];
  keywords: { matched: string[]; missing: string[] };
  against: string;
  at: string;
}
export interface Application {
  id: string;
  jobId: string;
  createdAt: string;
  generatedAt?: string;
  generatedBy?: string;
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

export type TrackStatus = "Saved" | "Applied" | "Received" | "Interview" | "Offer" | "Rejected" | "Withdrawn";
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
}
export type ChatAction = { kind: "task"; title: string; why: string } | { kind: "role"; title: string } | { kind: "open"; link: string; label: string }
  | { kind: "setting"; key: SettingKey; value: string | boolean };
export interface Story { id: string; title: string; theme: string; situation: string; task: string; action: string; result: string; missing: string; source: string }
export interface Step { at: string; kind: "task" | "save" | "start" | "approve" | "outreach" | "resume"; ref: string; xp: number }
/** Settings the chat may offer to change (the student still taps to confirm). */
export type SettingKey = "theme" | "notify.deadlines" | "notify.statusChanges" | "notify.weeklyPlan";

export interface Workspace {
  version: 2;
  started: boolean;
  /** options: tap-to-answer suggestions per question; exploring: the student said they're not sure what they want yet. */
  onboarding: { step: number; done: boolean; answers: { q: string; a: string }[]; questions: string[]; targets?: string[]; options?: string[][]; exploring?: boolean };
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
  /** How the last search went: employer sites reached out of those tried. */
  lastSearch?: { at: string; reached: number; scanned: number };
  savedJobIds: string[];
  fits: Record<string, JobFit>;
  hiddenJobIds: string[];
  applications: Application[];
  tracker: TrackItem[];
  inbox: InboxMessage[];
  suggestions: Suggestion[];
  tasks: Task[];
  calendar: CalItem[];
  contacts: Contact[];
  outreach: OutreachDraft[];
  /** Real career steps, for weekly momentum and points (server-recorded, once each). */
  steps?: Step[];
  /** Story Deck: true interview stories built from resume lines (STAR), with what's still missing. */
  stories?: Story[];
  /** Week (Monday date) the Friday weekly-goal email was last sent. */
  lastNudge?: string;
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
    /** Active days per week the student aims for (2–4; default 3). */
    weeklyGoal?: number;
    /** Hide points (the weekly days and streak still show). */
    hidePoints?: boolean;
    /** True once the student picked a theme themselves (older accounts stored "light" by default). */
    themeChosen?: boolean;
    assistantOpen: boolean;
    navCollapsed: boolean;
    notify: { deadlines: boolean; statusChanges: boolean; weeklyPlan: boolean };
    /** Connectors shown as connected in the demo (no data is read from them yet). */
    demoConnections?: string[];
    /** Newest "What's new" item the student has opened. */
    newsSeen?: string;
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
  ai: { available: boolean; model: string; via: string };
  hosting: "preview" | "published" | "local";
  today: string;
  /** Supabase Auth, when configured: public URL + publishable key, and which sign-in providers are switched on. */
  supabase: { url: string; anonKey: string; providers: Record<string, boolean> } | null;
  /** School email verification: whether codes can be sent, and which domains count (e.g. tcu.edu). */
  schoolEmail: { ready: boolean; domains: string[] };
  /** Google Calendar connection is set up on this server. */
  googleCalendar: boolean;
}
