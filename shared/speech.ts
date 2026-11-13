// Practice-out-loud feedback from what the browser heard (nothing leaves the device): pace, filler words, whether the
// student recited the script word for word (sounds rigid), and which key points they skipped.
// It can't hear tone of voice; it only knows the words and the time.

// "like" counts only as a filler, not in "I'd like to" or "would like".
export const FILLERS = /\b(um+|uh+|erm+|(?<!\b(?:would|i'd|id|i|i'll|you|we|we'd|they|it's|its|looks|look|feel|feels|things|something|really|also|don't|dont)\s)like|you know|basically|kind of|sort of|i mean|literally)\b/gi;
// Conversational pace for a short pitch: roughly 130-160 words a minute. Below ~110 drags, above ~175 rushes.
export const PACE = { slow: 110, fast: 175 };
const STOP = new Set("a an and are as at be but by for from have i i'm in is it its my of on or so that the this to was we were what with you your me im about also just".split(" "));

const words = (t: string) => (t.toLowerCase().replace(/[’']/g, "").match(/[a-z0-9]+/g) || []);
const content = (t: string) => words(t).filter((w) => w.length > 2 && !STOP.has(w));

export type SpeechFeedback = {
  wpm: number | null;
  pace: "slow" | "fast" | "ok" | null;
  fillers: string[];
  /** Share of the script's words said in the same order (0-1); high means recited, not told. */
  recited: number | null;
  /** Key words from the script the student never said. */
  missed: string[];
};

/** Longest common subsequence length, for "said in the same order". */
function lcs(a: string[], b: string[]): number {
  const prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : Math.max(prev[j], prev[j - 1]);
      diag = up;
    }
  }
  return prev[b.length];
}

/** `secs`: time actually spent talking (first to last thing heard), not the stopwatch, so pauses before Stop don't count. */
export function speechFeedback(heard: string, secs: number, script = ""): SpeechFeedback {
  const said = words(heard);
  const wpm = said.length >= 15 && secs >= 5 ? Math.round((said.length / secs) * 60) : null;
  const pace = wpm === null ? null : wpm < PACE.slow ? "slow" : wpm > PACE.fast ? "fast" : "ok";
  const fillers = (heard.match(FILLERS) || []).map((f) => f.toLowerCase());
  const sw = words(script);
  // Recited = most of the script, in order, and not much else (saying it all plus a lot of your own isn't reciting).
  const recited = sw.length >= 15 && said.length >= 10 ? (said.length <= sw.length * 1.3 ? Math.min(1, lcs(sw.slice(0, 300), said.slice(0, 300)) / sw.length) : 0) : null;
  const saidSet = new Set(content(heard).concat(said));
  // Key points: names, places and numbers in the script (capitalized words that don't just start a sentence).
  const keys: string[] = [];
  (script.match(/[A-Za-z0-9][A-Za-z0-9&’'-]*|[.?!]/g) || []).reduce((start, w) => {
    if (/^[.?!]$/.test(w)) return true;
    const k = w.replace(/[’']s$/, "");
    if ((/^\d/.test(k) || (!start && /^[A-Z]/.test(k))) && !/^(I|I'm|I’m|I've|I’d|I'd)$/.test(w) && !keys.includes(k)) keys.push(k);
    return false;
  }, true);
  // Compared piece by piece the same way the transcript is split, so "Texas A&M", "AT&T" and "Co-op" count when said.
  const missed = said.length >= 10 ? keys.filter((k) => { const parts = words(k); return parts.length > 0 && parts.some((w) => w.length > 1 && !saidSet.has(w)); }).slice(0, 6) : [];
  return { wpm, pace, fillers, recited, missed };
}
