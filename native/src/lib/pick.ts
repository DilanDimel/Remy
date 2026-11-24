import { requireOptionalNativeModule } from "expo";

// The document and photo pickers came with the Nov 24 store build. An older build that gets this code as an update has
// no such native module, so each picker is looked up first and the screens fall back to the website when it's missing.
const OLD_BUILD = "This needs the newest version of the Remy app. Until then, upload it on remyai.org.";
export type Picked = { uri: string; name: string; type: string; size?: number };

export const canPickFiles = () => !!requireOptionalNativeModule("ExpoDocumentPicker");
export const canPickImages = () => !!requireOptionalNativeModule("ExponentImagePicker");

/** A PDF or Word resume from Files, iCloud Drive or Google Drive. null when the student cancels. */
export async function pickResume(): Promise<Picked | null> {
  if (!canPickFiles()) throw new Error(OLD_BUILD);
  const DocumentPicker = require("expo-document-picker") as typeof import("expo-document-picker");
  const r = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"], copyToCacheDirectory: true });
  const a = r.canceled ? undefined : r.assets[0];
  if (!a) return null;
  if (!/\.(pdf|docx)$/i.test(a.name)) throw new Error("Choose a PDF or Word (.docx) file.");
  if ((a.size || 0) > 5_000_000) throw new Error("That file is over 5 MB. Export a smaller PDF, or upload a Word (.docx) file.");
  return { uri: a.uri, name: a.name, type: a.mimeType || (/\.pdf$/i.test(a.name) ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"), size: a.size };
}

/** A screenshot from Photos, shrunk to JPEG so it stays under the server's 2 MB. null when the student cancels. */
export async function pickScreenshot(): Promise<Picked | null> {
  if (!canPickImages()) throw new Error(OLD_BUILD);
  const ImagePicker = require("expo-image-picker") as typeof import("expo-image-picker");
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6, allowsMultipleSelection: false });
  const a = r.canceled ? undefined : r.assets[0];
  if (!a) return null;
  const jpg = /jpe?g$/i.test(a.mimeType || "") || /\.jpe?g$/i.test(a.fileName || "");
  return { uri: a.uri, name: a.fileName || (jpg ? "screenshot.jpg" : "screenshot.png"), type: a.mimeType || (jpg ? "image/jpeg" : "image/png"), size: a.fileSize };
}
