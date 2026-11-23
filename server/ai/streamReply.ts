/** The "reply" text written so far inside a JSON object the model is still streaming, e.g. `{"reply":"Hi Ma` → "Hi Ma".
 * Escapes are decoded; a half-written escape at the end is left out until the rest of it arrives. Empty until the
 * model has started the reply field. Used to show Remy's chat answer as it is written (owners first). */
export function partialReply(raw: string): string {
  const m = /"reply"\s*:\s*"/.exec(raw);
  if (!m) return "";
  let out = "";
  for (let i = m.index + m[0].length; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') return out;
    if (ch !== "\\") { out += ch; continue; }
    const n = raw[i + 1];
    if (n === undefined) return out;
    if (n === "u") {
      const hex = raw.slice(i + 2, i + 6);
      if (hex.length < 4) return out;
      out += String.fromCharCode(parseInt(hex, 16) || 0);
      i += 5;
      continue;
    }
    out += ({ n: "\n", t: "\t", r: "", b: "", f: "" } as Record<string, string>)[n] ?? n;
    i += 1;
  }
  return out;
}
