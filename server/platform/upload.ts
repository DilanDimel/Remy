/** Largest upload Remy takes, the same cap as multer's. */
export const MAX_UPLOAD = 5 * 1024 * 1024;

/** A file the phone app sent as JSON ({ name, type, data: base64 }) in multer's shape. undefined when there is none or it's
 *  malformed (the route then says "Choose a file"), null when it's over MAX_UPLOAD. */
export function fileFromJson(f: unknown): { buffer: Buffer; originalname: string; mimetype: string; size: number } | null | undefined {
  if (!f || typeof f !== "object") return undefined;
  const { name, type, data } = f as Record<string, unknown>;
  if (typeof name !== "string" || typeof data !== "string" || !name.trim() || !data) return undefined;
  if (data.length > Math.ceil(MAX_UPLOAD / 3) * 4 + 4) return null;
  const buffer = Buffer.from(data, "base64");
  if (!buffer.length) return undefined;
  if (buffer.length > MAX_UPLOAD) return null;
  return { buffer, originalname: name.slice(0, 200), mimetype: typeof type === "string" ? type.slice(0, 120) : "application/octet-stream", size: buffer.length };
}
