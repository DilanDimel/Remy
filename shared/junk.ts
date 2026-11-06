// Gentle checks on what students type (Dilan, Nov 6: someone could type "daddy" as their name, or silly resume bullets).
// They flag, never block: real names and real work vary too much for a filter to decide. shortcut: small fixed word lists.

// Profanity and slurs, as whole words (so "Cassandra", "Dickens" or "Scunthorpe" pass).
const RUDE = /\b(fuck\w*|shit\w*|bitch\w*|asshole\w*|dick(head)?s?|cock(s|sucker)?|pussy|cunt\w*|nigg\w*|fag(got)?s?|slut\w*|whore\w*|retard(ed)?s?|penis\w*|vagina\w*|boobs?|tits?|porn\w*|sexy|horny|milf|dildo\w*|cum|wank\w*|twat\w*|bastard\w*)\b/i;
// Joke or placeholder "names"
const NOT_A_NAME = /^(daddy|mommy|mummy|baby|babe|bae|big ?daddy|sugar ?daddy|your ?mom|ur ?mom|deez ?nuts|joe ?mama|ligma|sugma|ben ?dover|mike ?hunt|hugh ?jass|test|testing|tester|user|username|student|anonymous|anon|none|null|undefined|n\/?a|idk|no ?name|asdf\w*|qwerty\w*|lol\w*|lmao\w*|xd|hello|hi|me|myself|nobody|someone|god|jesus|satan|batman|superman|spiderman|elon ?musk|donald ?trump|joe ?biden|taylor ?swift)$/i;

/** A short note when a name doesn't look like a real one, else "". */
export function nameConcern(raw: string): string {
  const name = raw.trim();
  if (!name) return "";
  const letters = name.match(/\p{L}/gu) || [];
  const odd =
    RUDE.test(name) || NOT_A_NAME.test(name.replace(/[^\p{L} \/]/gu, "").trim()) ||
    /\d|https?:|www\.|@|\.(com|net|org)\b/i.test(name) ||
    /\p{Extended_Pictographic}/u.test(name) ||
    letters.length < 2 ||
    /(\p{L})\1{3,}/iu.test(name) || // "aaaaa"
    /[^\p{L}\p{M} .,'’\-]/u.test(name); // symbols other than the ones real names use
  return odd ? "This doesn't look like a real name. It goes on your resume and on emails to employers, so use the name you want them to see." : "";
}

/** A short note when a resume line or other text has language employers would reject, else "". */
export function textConcern(text: string): string {
  return RUDE.test(text) ? "This has language most employers would reject. Reword it before you use it." : "";
}
