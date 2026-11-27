// The lead AI's own key (REMY_AI_KEY, set in DigitalOcean): lets the project's Claude read the owners' board and mark
// errors fixed without anyone's sign-in. Read-only everywhere else: it can't change members, hours, beta or features.
import { timingSafeEqual } from "crypto";
import type { Me } from "@shared/types";

export const AI_ME: Me = { id: "lead-ai", kind: "google", email: "lead-ai@remyai.org", name: "Remy's lead AI", picture: "", owner: true };

/** GET on any owners' route except feedback screenshots (they can show a student's resume), plus "Mark fixed" and the
 *  team library its nightly sync fills (server/platform/library.ts). */
export function aiAllowed(method: string, path: string) {
  return (method === "GET" && path.startsWith("/api/admin/") && !path.endsWith("/screenshot")) || (method === "POST" && path === "/api/admin/errors/fix")
    || ((method === "GET" || method === "POST") && path === "/api/team/library");
}

/** AI_ME for a request carrying the key on an allowed route, "denied" for the key on any other route, else null. */
export function aiKeyMe(auth: string | undefined, method: string, path: string, key = process.env.REMY_AI_KEY || ""): Me | "denied" | null {
  const given = /^Bearer (.+)$/.exec(auth || "")?.[1] || "";
  if (key.length < 32 || given.length !== key.length || !timingSafeEqual(Buffer.from(given), Buffer.from(key))) return null;
  return aiAllowed(method, path) ? AI_ME : "denied";
}
