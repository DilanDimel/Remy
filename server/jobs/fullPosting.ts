// Some job feeds give only a snippet, so Remy "couldn't read the skills this posting asks for" (tester, Nov 25), and
// fit, tailoring and the cover letter all worked from that snippet. When a student keeps or tailors such an opening,
// Remy reads the full posting page once and keeps it on their copy of the opening (not in the shared catalog, which
// stays small: jobs thread, Nov 25). Anything that fails leaves the opening as it was.
import type { Job } from "@shared/types";
import { postingSkills } from "@shared/requirements";
import { payOf } from "@shared/pay";
import { fetchPublic, htmlToText } from "../resume/parse";
import { requirementsFrom } from "./sources";

const SHORT = 1500; // characters: below this a posting is almost always a feed snippet

/** True when the opening's text is too thin to read skills from and Remy hasn't tried its page yet. */
export const needsFullPosting = (j: Job) =>
  !j.fullTextAt && j.kind !== "event" && !!(j.applyUrl || j.sourceUrl) && ((j.postingText || "").length < SHORT || !postingSkills(j.requirements).length);

/** The full posting's text and skills, or null when the page can't be read or says no more than the snippet. */
export async function readFullPosting(j: Job, fetcher = fetchPublic): Promise<Pick<Job, "postingText" | "requirements" | "pay"> | null> {
  try {
    const r = await fetcher(j.applyUrl || j.sourceUrl);
    if (r.status >= 400) return null;
    const text = htmlToText(r.html).trim();
    if (text.length < 400 || text.length <= (j.postingText || "").length + 200) return null; // a login page or a JavaScript shell
    const requirements = requirementsFrom(text);
    return { postingText: text.slice(0, 12000), requirements: requirements.length ? requirements : j.requirements, pay: j.pay || payOf(text) || undefined };
  } catch {
    return null;
  }
}
