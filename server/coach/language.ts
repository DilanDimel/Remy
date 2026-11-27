import type { Me, Workspace } from "@shared/types";
import { accessOf } from "@shared/features";
import { chosenLanguage } from "@shared/i18n";
import * as admin from "../platform/admin";
import * as features from "../platform/features";

/** The language Remy talks to this student in: their choice (or their device's) once the `languages` switch is open
 *  for them (owners in owner view first, Admin → Beta); English otherwise. */
export async function talkLanguage(me: Pick<Me, "kind" | "email">, ws: Workspace): Promise<string> {
  const code = chosenLanguage(ws.settings);
  if (code === "en") return "en";
  const owner = ws.settings?.ownerView !== false && (await admin.isOwner(me).catch(() => false));
  return accessOf(await features.releases(), "languages", owner) === "open" ? code : "en";
}
