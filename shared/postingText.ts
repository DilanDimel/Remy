// Job-board text arrives with HTML entities, sometimes encoded twice ("&amp;#xa;" shows up as a literal "&#xa;").
const NAMED: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", bull: "•", middot: "·", hellip: "…", copy: "©", reg: "®", trade: "™", deg: "°" };

/** "&bull;" → •, "&#8217;" → ’, "&#xa;" → newline. Unknown names stay as they are. */
export function decodeEntity(e: string): string | undefined {
  if (e[0] === "#") { const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n > 0 && n < 0x110000 && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : undefined; }
  return NAMED[e.toLowerCase()];
}

/** Decodes entities, twice for double-encoded text. "&nbsp" without its ";" counts, but not "?a=1&copy=2" in a link. */
export function decodeEntities(s: string): string {
  const once = (t: string) => t.replace(/&(#x?[0-9a-f]+|[a-z]+)(;|(?![=a-z0-9]))/gi, (m, e: string) => decodeEntity(e) ?? m);
  return once(once(s));
}

/** Posting text as readable lines: entities decoded, spaces tidied, blank lines dropped. */
export function postingLines(s: string): string[] {
  const lines = decodeEntities(s || "").replace(/\r\n?/g, "\n").replace(/ /g, " ").split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim()).filter(Boolean);
  // Some boards put a label and its value on separate lines ("Date Posted:" then "2026-11-24"); join them.
  return lines.reduce<string[]>((out, l) => {
    const prev = out[out.length - 1];
    if (prev && /^[A-Z][^:]{1,40}:$/.test(prev) && l.length <= 90 && !/:$/.test(l) && !l.startsWith("\u2022")) out[out.length - 1] = `${prev} ${l}`;
    else out.push(l);
    return out;
  }, []);
}

/** A short "Label: value" line ("Date Posted: 2026-11-24") split for display; null for an ordinary sentence. */
export function postingField(line: string): [string, string] | null {
  const m = line.match(/^([A-Z][A-Za-z ./&()-]{1,40}):\s+(.{1,90})$/);
  return m && m[1].split(" ").length <= 6 ? [m[1], m[2]] : null;
}
