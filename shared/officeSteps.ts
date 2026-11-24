import type { ChatAction, Workspace } from "./types";
import { remyAsks } from "./remyAsks";
import { remyOffers } from "./remyOffers";

// Team meeting (Nov 24): Remy is the center of My Path. From his office he tells the student the next thing to do and
// points at the thing in his room that does it: his computer (openings), the resume frame (resume) and the filing
// cabinet (his notes on you, AI memory). Pure and cheap: built from his quick questions, his offers and the resume.

export type OfficeSpot = "computer" | "frame" | "notes";
export interface OfficeStep {
  id: string;
  spot: OfficeSpot;
  say: string;
  cta: string;
  /** Where the button goes, or what Remy does himself (POST /api/remy/act, with Undo in his chat). */
  link?: string;
  action?: ChatAction;
  offerId?: string;
  /** His quick questions: the banner shows the question with its answers. */
  ask?: boolean;
}

/** Up to three steps, most urgent first, one per spot. `fresh` = openings found for them since their last visit. */
export function officeSteps(ws: Workspace, today: string, hour: number, fresh: number, later: string[] = []): OfficeStep[] {
  const offers = remyOffers(ws, today, hour);
  const asks = remyAsks(ws, today);
  const offer = (o: (typeof offers)[number], spot: OfficeSpot): OfficeStep => ({ id: o.id, spot, say: o.text, cta: o.label, action: o.action, offerId: o.id });
  const out: OfficeStep[] = [];
  // A saved opening closing soon, or a dream employer hiring, beats everything.
  const urgent = offers.find((o) => o.id.startsWith("close:") || o.id.startsWith("dream:"));
  if (urgent) out.push(offer(urgent, "computer"));
  if (asks.length) out.push({ id: "asks", spot: "notes", ask: true, cta: "", say: `I have ${asks.length === 1 ? "a quick question" : `${asks.length} quick questions`} about your account. They're in my notes.` });
  const fix = offers.find((o) => o.id.startsWith("fix:"));
  if (!ws.resume) out.push({ id: "resume:add", spot: "frame", say: "Your resume frame is empty. Tap it and add your resume. I'll read it and tell you what to fix.", cta: "Add my resume", link: "/resume?tab=base" });
  else if (!ws.resume.confirmedAt) out.push({ id: "resume:confirm", spot: "frame", say: "Check that I read your resume right. Everything I suggest is built on it.", cta: "Check my resume", link: "/resume?tab=base" });
  else if (fix) out.push(offer(fix, "frame"));
  if (!urgent && fresh > 0) out.push({ id: `openings:${today}`, spot: "computer", say: `Click my computer. ${fresh === 1 ? "A new opening fits" : `${fresh} new openings fit`} you.`, cta: "Open my computer", link: "/opportunities" });
  else if (!urgent && !ws.savedJobIds.length) out.push({ id: "openings:first", spot: "computer", say: "Click my computer to see openings that fit you. Keep the ones you like.", cta: "Open my computer", link: "/opportunities" });
  return out.filter((s) => !later.includes(s.id)).slice(0, 3);
}
