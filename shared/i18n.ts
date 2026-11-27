// Remy in the student's language (Dilan, Nov 27: proposal https://claude.ai/artifact/4MQ2pibNmDg7RRjj3V944V).
// The 12 most spoken languages in the US (ACS 2023). Remy talks to the student in any of them; screens are translated
// where a word list exists (Spanish first). Resumes, letters and emails to employers stay in English (the claims check
// can't yet compare a translated line with the student's own words), and job postings stay as the company wrote them.
import { ES } from "./i18n/es";

export type Lang = { code: string; name: string; english: string; rtl?: boolean };
export const LANGUAGES: Lang[] = [
  { code: "en", name: "English", english: "English" },
  { code: "es", name: "Español", english: "Spanish" },
  { code: "zh", name: "中文", english: "Chinese" },
  { code: "tl", name: "Tagalog", english: "Tagalog (Filipino)" },
  { code: "vi", name: "Tiếng Việt", english: "Vietnamese" },
  { code: "ar", name: "العربية", english: "Arabic", rtl: true },
  { code: "fr", name: "Français", english: "French" },
  { code: "ko", name: "한국어", english: "Korean" },
  { code: "pt", name: "Português", english: "Portuguese" },
  { code: "hi", name: "हिन्दी", english: "Hindi" },
  { code: "ru", name: "Русский", english: "Russian" },
  { code: "ht", name: "Kreyòl", english: "Haitian Creole" },
];
const CODES = new Set(LANGUAGES.map((l) => l.code));
export const langOf = (code: string) => LANGUAGES.find((l) => l.code === code) || LANGUAGES[0];

/** The first of the device's languages ("es-MX", "fil", "zh-Hant-TW") that Remy speaks; English otherwise. */
export function deviceLanguage(list: readonly string[] | undefined): string {
  for (const tag of list || []) {
    const base = tag.toLowerCase().split(/[-_]/)[0];
    const code = base === "fil" ? "tl" : base;
    if (CODES.has(code)) return code;
  }
  return "en";
}

/** "auto" (or nothing chosen) follows the device language the client last reported. */
export type LangSettings = { language?: string; deviceLanguage?: string };
export function chosenLanguage(s: LangSettings | undefined): string {
  const pick = s?.language && s.language !== "auto" ? s.language : s?.deviceLanguage;
  return pick && CODES.has(pick) ? pick : "en";
}

/** Screens with a word list. Other languages get Remy's own words (chat, tips) in their language, screens in English. */
const WORDS: Record<string, Record<string, string>> = { es: ES };
export const hasScreens = (code: string) => code === "en" || !!WORDS[code];

/** The screen text in the student's language, or the English text when there's no translation for it. */
export function translate(code: string, text: string, vars?: Record<string, string | number>): string {
  const out = WORDS[code]?.[text] ?? text;
  return vars ? out.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : out;
}

/** The line added to Remy's prompts so he answers in the student's language; "" for English. */
export function replyIn(code: string): string {
  if (code === "en") return "";
  const l = langOf(code);
  return ` The student chose ${l.english} as the language Remy talks to them in: write your reply in ${l.english}, unless they write to you in another language, then use theirs. Keep company names, job titles, resume lines and skill names exactly as written (usually English), since US employers read them in English.`;
}
