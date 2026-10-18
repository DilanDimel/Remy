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
}
export interface BaseResume {
  fileName: string;
  uploadedAt: string;
  rawText: string;
  parsedBy: "ai" | "rules";
  doc: ResumeDoc;
  confirmedAt?: string;
  /** Skills and tools found on the resume, matched against posting requirements. */
  skills?: string[];
  /** The uploaded file itself is kept server-side for preview and download. */
  original?: { name: string; mime: string; size: number };
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
}

export interface MemoryFact {
  id: string;
  text: string;
  category: "background" | "goal" | "preference" | "skill" | "experience" | "constraint" | "other";
  source: string; // e.g. "Resume upload", "LinkedIn PDF", "Assistant chat", "Onboarding answer"
  status: "approved" | "suggested";
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
  origin: "verified-catalog" | "imported" | "manual";
  postingText?: string;
}

export interface JobFit {
  at: string;
  by: "rules" | "ai";
  eligibility: "likely" | "check" | "unlikely" | "unknown";
  eligibilityNote: string;
  matched: string[];
  gaps: string[];
  why: string;
  /** The posting definitely rules this student out (e.g. "must be a current sophomore"). Hidden by default. */
  excluded?: boolean;
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
  fixes: { category: string; text: string; gain: number }[];
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
}

export interface Workspace {
  version: 2;
  started: boolean;
  onboarding: { step: number; done: boolean; answers: { q: string; a: string }[]; questions: string[] };
  profile: Profile;
  resume?: BaseResume;
  imports: { id: string; kind: string; fileName: string; at: string; label: Label; factsAdded: number }[];
  memory: MemoryFact[];
  jobs: Job[]; // imported + manual (catalog lives server-side)
  savedJobIds: string[];
  jobChecks: Record<string, JobCheck[]>;
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
  plan?: PathPlan;
  chat: ChatMsg[];
  aiLog: AiLogEntry[];
  incidents: SafeguardIncident[];
  settings: {
    theme: "light" | "dark";
    assistantOpen: boolean;
    navCollapsed: boolean;
    notify: { deadlines: boolean; statusChanges: boolean; weeklyPlan: boolean };
    /** Connectors shown as connected in the demo (no data is read from them yet). */
    demoConnections?: string[];
  };
  updatedAt: string;
}

export interface Me {
  id: string;
  kind: "google" | "supabase" | "guest" | "visitor" | "local";
  email: string;
  name: string;
  picture: string;
}
export interface AppConfig {
  googleClientId: string | null;
  ai: { available: boolean; model: string; via: string };
  hosting: "preview" | "published" | "local";
  today: string;
  /** Supabase Auth, when configured: public URL + publishable key, and which sign-in providers are switched on. */
  supabase: { url: string; anonKey: string; providers: Record<string, boolean> } | null;
}
