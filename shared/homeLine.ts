// Home greeting copy (owners first, Nov 22, 2026).
export const many = (n: number, one: string, more = one + "s") => `${n} ${n === 1 ? one : more}`;

/** Owners first (Dilan, Nov 22: Home "has no soul"): one line in Remy's voice under the greeting that reacts to what's
 *  actually going on, instead of a fixed subtitle. First match wins, most urgent first. */
export function remyLine(o: { day?: string; hour: number; interviewSoon: boolean; cheer: boolean; done: number; total: number; newJobs: number; deadlines: number; pending: number }) {
  if (o.interviewSoon) return "Big couple of days. We'll get you ready one small step at a time.";
  if (o.cheer) return `Nice, that's ${o.done} of ${o.total} done. You're building momentum.`;
  if (o.deadlines) return `${many(o.deadlines, "deadline")} this week. I'm keeping ${o.deadlines === 1 ? "it" : "them"} in front of you.`;
  if (o.pending) return `You're one review away from a finished application.`;
  if (o.newJobs) return `${many(o.newJobs, "new opening")} since you were last here. I already checked which ones you can apply to.`;
  if (o.hour >= 22 || o.hour < 5) return "Late one. Do the one thing below, then get some sleep.";
  if (o.done === 0) return "Let's start small. One step today is plenty.";
  if (o.done < o.total) return `${o.done} of ${o.total} getting-started steps done. ${o.total - o.done} to go, and none take long.`;
  return o.day ? tipOfDay(o.day) : "Here's where things stand. One thing at a time.";
}

// Owners ("Remy feels alive", Nov 23): when nothing urgent is going on, a different practical tip each day in Remy's
// voice, instead of the same line. Plain advice only: no quotes or numbers we can't back up.
export const TIPS = [
  "Tip of the day: apply in the first week a posting is up. Early applications get read more carefully.",
  "Tip of the day: one line of your resume with a real number beats three lines without one.",
  "Tip of the day: a two-line thank-you email within a day of an interview is still rare. Be the one who sends it.",
  "Tip of the day: before a career fair, pick three employers and one question for each. That's enough.",
  "Tip of the day: recruiters skim the top third of your resume first. Put your strongest line there.",
  "Tip of the day: 'Tell me about yourself' is your pitch. Say it out loud once today; it gets easier fast.",
  "Tip of the day: following a company on LinkedIn is free and shows you their openings first.",
  "Tip of the day: a professor who knows your work is a great reference. Ask early, and give them your resume.",
  "Tip of the day: match a few words from the posting in your resume, but only where they're true.",
  "Tip of the day: no reply after two weeks is normal. One short, friendly follow-up is fine.",
  "Tip of the day: a small, finished project you can explain beats a big one you can't.",
  "Tip of the day: ask an upperclassman in your major what they wish they'd done sooner.",
  "Tip of the day: save openings even if you're unsure. I'll learn what you like from what you keep.",
  "Tip of the day: in interviews, the result is the part people forget. End every story with what changed.",
  "Tip of the day: your school's career center can review your resume for free. Worth one visit.",
  "Tip of the day: ten focused minutes on one application beats an hour of scrolling openings.",
  "Tip of the day: 'What does success look like in this role?' is a great question to ask at the end of an interview.",
  "Tip of the day: a short LinkedIn headline that says what you study and what you want works better than a long one.",
  "Tip of the day: rejections are part of everyone's search. The ones who land offers just kept applying.",
  "Tip of the day: write down people you meet the same day. I can add them to your contacts if you tell me.",
  "Tip of the day: a clean, one-page resume is right for almost every student. Cut before you shrink the font.",
];
/** The same tip all day, a different one each day. `day` is YYYY-MM-DD. */
export const tipOfDay = (day: string) => TIPS[Math.floor(Date.parse(day + "T12:00:00Z") / 864e5) % TIPS.length];
