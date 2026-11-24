// My Path's season and daily quests, shared by the website (client/src/components/PathBoard.tsx) and the phone app.
import type { Workspace } from "./types";
import { CARD_XP, dayKey } from "./daily";

/** The semester we're in, the day it ends, and what this season is for at the student's year. */
export function seasonOf(now: Date, year: number) {
  const y = now.getFullYear(), m = now.getMonth(), day = now.getDate();
  const [name, end] = (m > 7 || (m === 7 && day > 15)) && !(m === 11 && day > 15) ? ["Fall", new Date(y, 11, 15)]
    : m === 11 ? ["Spring", new Date(y + 1, 4, 15)]
    : m < 4 || (m === 4 && day <= 15) ? ["Spring", new Date(y, 4, 15)] : ["Summer", new Date(y, 7, 15)];
  const left = Math.max(0, Math.ceil((+end - +now) / 864e5));
  const goal = ["", "Find the jobs that fit you", "Get your first interview", "Land a summer internship", "Turn it into a job offer", "Grow in your first job"][year] || "Find the jobs that fit you";
  return { name: name as string, left, goal };
}

export type Quest = { key: "rate" | "role" | "xp"; title: string; n: number; of: number; from: string; link: string };

/** Today's three quests (new at 4 AM with the day). `today` is the cards done today (game.days[dayKey()]). */
export function dailyQuests(w: Pick<Workspace, "jobFeedback">, today: string[], now = dayKey()): Quest[] {
  const rated = Object.values(w.jobFeedback || {}).filter((f) => f.createdAt && dayKey(new Date(f.createdAt)) === now).length;
  return [
    { key: "rate", title: "Keep or pass 3 openings", n: Math.min(3, rated), of: 3, from: "Opportunities", link: "/opportunities" },
    { key: "role", title: "Decode one job", n: today.includes("role") ? 1 : 0, of: 1, from: "My Path", link: "/path?play=1" },
    { key: "xp", title: `Earn ${3 * CARD_XP} XP`, n: Math.min(3 * CARD_XP, today.length * CARD_XP), of: 3 * CARD_XP, from: "Anywhere in Remy", link: "/path?play=1" },
  ];
}
