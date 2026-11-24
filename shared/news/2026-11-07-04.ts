import type { NewsNote } from "../news";

export default {
  kind: "Improved",
  title: "Owners' dashboard, reorganized",
  body: "The owners' menu is now in three groups: Students (Overview, Beta, Outcomes), Data (Database, Openings, Errors, Agents) and Team. New: the Founding Cohort funnel (applied → accepted → signed in → set up → active this week, by school, year and source), Outcomes (applications that got an answer, interviews, offers, tailored vs not), Database (space used against the free plan, account sizes, each table) and Openings (every posting Remy has found, by industry, career path and company). Counts only, never what a student wrote.",
  owners: true,
} satisfies NewsNote;
