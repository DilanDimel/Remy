import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const workspaces = sqliteTable("workspaces", {
  visitor: text("visitor").primaryKey(),
  payload: text("payload").notNull(),
  version: integer("version").notNull().default(0),
});
export const insertWorkspaceSchema = createInsertSchema(workspaces);
export type WorkspaceRow = typeof workspaces.$inferSelect;
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;

export type Experience = {
  id: string;
  title: string;
  text: string;
  skills: string[];
  source: string;
};
export type Profile = {
  name: string;
  major: string;
  year: string;
  graduation: string;
  credits: number;
  gpa: string;
  location: string;
  target: string;
  interests: string[];
  skills: string[];
  sponsorship: string;
  relocation: boolean;
  localPriority: number;
  baseResume: string;
  experiences: Experience[];
  goal: string;
};
export type Task = {
  id: string;
  title: string;
  category: string;
  semester: string;
  done: boolean;
  why: string;
  due: string;
  source: string;
};
export type Job = {
  id: string;
  company: string;
  title: string;
  location: string;
  field: string;
  type: string;
  pay: string;
  source: string;
  sourceName: string;
  status: string;
  checked: string;
  requirements: string[];
  tags: string[];
  description: string;
  minCredits: number;
  minYear: number;
  sponsorship: string;
  deadline: string;
};
export type Claim = {
  id: string;
  original: string;
  text: string;
  evidenceId: string;
  requirement: string;
  reason: string;
  approved: boolean;
  flag: string;
};
export type Application = {
  id: string;
  jobId: string;
  status: string;
  claims: Claim[];
  letter: string;
  letterApproved: boolean;
  version: number;
  mode: string;
  updated: string;
  history: { version: number; at: string; mode: string }[];
};
export type Meeting = {
  id: string;
  title: string;
  when: string;
  duration: number;
  status: string;
  notes: string;
  summary: string;
  tasks: string[];
};
export type Chat = { role: "user" | "assistant"; text: string };
export type Log = {
  id: string;
  at: string;
  kind: string;
  message: string;
  mode: string;
};
export type State = {
  version: number;
  onboarded: boolean;
  profile: Profile;
  tasks: Task[];
  savedJobs: string[];
  connections: Record<string, string>;
  notifications: Record<string, boolean>;
  frequency: string;
  applications: Application[];
  meetings: Meeting[];
  feedback: { id: string; jobId: string; reason: string; at: string }[];
  chat: Chat[];
  logs: Log[];
  customJobs: Job[];
  campusSaved: string[];
};
export const actionSchema = z.object({
  type: z.string().max(50),
  data: z.unknown().optional(),
});
export const profileEditSchema = z.object({
  name: z.string().trim().min(1).max(80),
  major: z.string().min(1).max(100),
  year: z.enum(["Freshman", "Sophomore", "Junior", "Senior"]),
  graduation: z.string().min(1).max(30),
  credits: z.coerce.number().min(0).max(300),
  gpa: z.string().max(8),
  location: z.string().min(1).max(80),
  target: z.string().min(1).max(120),
  goal: z.string().max(800),
  sponsorship: z.enum(["unknown", "needs", "not-needed"]),
  relocation: z.boolean(),
  localPriority: z.number().min(0).max(100),
  interests: z.array(z.string().max(80)).max(12),
  skills: z.array(z.string().max(60)).max(30),
  baseResume: z.string().max(20000),
});
export const experienceSchema = z.object({
  title: z.string().min(1).max(100),
  text: z.string().min(5).max(2500),
  skills: z.array(z.string().max(60)).max(12),
});
