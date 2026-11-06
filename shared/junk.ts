// Gentle checks on what students type (Dilan, Nov 6: someone could type "daddy" as their name, or silly resume bullets).
// They flag, never block: real names and real work vary too much for a filter to decide. shortcut: small fixed word lists.
// Whole words only, except a few swears that are never part of a real word (so "magna cum laude", "Dick's Sporting
// Goods", "Shiitake", "Pornthip", "Wankhede", "Niggemann", "Slutsky" and nursing words like "vaginal" all pass).

const SWEAR_INSIDE = /fuck|f\*ck|motherf|bullshit|dipshit|batshit|horseshit|shitty|shitshow/i;
const RUDE_WORDS = /\b(shit|shits|sh1t|fuk|fck|bitch|bitches|bitchy|b1tch|asshole|assholes|dumbass|jackass|cunt|cunts|nigger|niggers|nigga|niggas|faggot|faggots|fag|fags|slut|sluts|whore|whores|retard|retarded|retards|dildo|dildos|wanker|wankers|twat|wtf|stfu|sexy|horny|titties|cumshot|cocksucker|dickhead|dickheads|pussy)\b/i;
const rude = (s: string) => SWEAR_INSIDE.test(s) || RUDE_WORDS.test(s);

// Joke or placeholder "names" (the whole field). Real names that are also words (Dick, Gay, King, Jesus, Baby, Lola) pass.
const NOT_A_NAME = /^(daddy|mommy|mummy|big ?daddy|sugar ?daddy|bae|your ?mom|ur ?mom|deez ?nuts|joe ?mama|ligma|sugma|ben ?dover|mike ?hunt|hugh ?jass|bigdick|test|testing|tester|user|username|student|anonymous|anon|none|null|undefined|n\/?a|idk|no ?name|name|your ?name|first ?name|last ?name|first ?last|firstname ?lastname|john ?doe|jane ?doe|asdf\w*|qwerty\w*|sdf\w*|lol|lmao|xd|kkk|xxx|zzz+|poop|butt|hello|hi there|nobody|someone|satan|batman|superman|spiderman|elon ?musk|donald ?trump|joe ?biden|taylor ?swift)$/i;

/** A short note when a name doesn't look like a real one, else "". `called` = the "What should Remy call you?" field. */
export function nameConcern(raw: string, called = false): string {
  const name = raw.trim();
  if (!name) return "";
  const odd =
    rude(name) || NOT_A_NAME.test(name.replace(/[^\p{L} /]/gu, "").trim()) ||
    /\d|https?:|www\.|@|\.(com|net|org)\b/i.test(name) ||
    /\p{Extended_Pictographic}/u.test(name) ||
    /(\p{L})\1{3,}/iu.test(name) || // "aaaaa"
    /[_#$%^*=+<>{}[\]|\\~]/.test(name); // symbols no real name uses (quotes, brackets, slashes and dots are fine)
  if (!odd) return "";
  return called
    ? "This doesn't look like a name. Remy uses it when it talks to you and in emails it drafts for you."
    : "This doesn't look like a real name. It goes on your resume and on emails to employers, so use the name you want them to see.";
}

/** A short note when a resume line or other text has language employers would reject, else "". */
export function textConcern(text: string): string {
  return rude(text) ? "This has language most employers would reject. Reword it before you use it." : "";
}
