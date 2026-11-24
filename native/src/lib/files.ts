import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { API_BASE } from "./api";

/** A file a website page inside the app handed over (resume PDF/Word, .ics, data export).
 * Sent by the site's download() as {type:"remy-download", name, mime, base64}. */
export type SiteDownload = { type: "remy-download"; name: string; mime?: string; base64: string };

export function isSiteDownload(m: unknown): m is SiteDownload {
  const d = m as SiteDownload;
  return !!d && d.type === "remy-download" && typeof d.name === "string" && typeof d.base64 === "string";
}

/** Saves the file to the app's cache and opens the share sheet (Save to Files, AirDrop, Mail, Drive…). */
export async function shareSiteDownload(d: SiteDownload) {
  const name = d.name.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 120) || "download";
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(d.base64, { encoding: "base64" });
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this phone.");
  await Sharing.shareAsync(file.uri, { mimeType: d.mime || undefined, dialogTitle: name });
}

/** Downloads one of the student's files from Remy (signed in, like api()) and opens the share sheet. */
export async function shareFromServer(path: `/api/${string}`, name: string, mime: string) {
  const r = await fetch(API_BASE + path, { credentials: "include", headers: { "X-Remy-App": "native" } });
  if (!r.ok) { let m = ""; try { m = (await r.json())?.message; } catch {} throw new Error(m || "That download didn't work. Please try again."); }
  const file = new File(Paths.cache, name.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 120));
  if (file.exists) file.delete();
  file.create();
  await file.write(await r.arrayBuffer());
  if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this phone.");
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: name });
}
