import fs from "node:fs";
import path from "node:path";
import type { Workspace } from "@shared/types";

// TCU Neeley alumni networking list (Fall 2026 update), converted from the
// career office's spreadsheet into server/data/alumni.json. It stays on the
// server: each student only ever receives their own top matches.

export type Alum = {
  id: string; year: number | null; name: string; email: string; employer: string; industry: string; role: string;
  title: string; location: string; majors: string[]; intl: boolean; vet: boolean; transfer: boolean; firstGen: boolean;
};
export type AlumMatch = Omit<Alum, "intl" | "vet" | "transfer" | "firstGen"> & { score: number; why: string[] };

let cache: { source: string; alumni: Alum[] } | null = null;
export function alumniList() {
  if (!cache) {
    const p = path.resolve(process.cwd(), "server", "data", "alumni.json");
    cache = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : { source: "", alumni: [] };
  }
  return cache!;
}

const MAJOR_CODES: [RegExp, string][] = [
  [/financ/i, "FINA"], [/account/i, "ACCT"], [/market/i, "MARK"], [/real estate|fire\b/i, "FIRE"], [/supply chain|svcm/i, "SVCM"],
  [/information systems|\bbis\b/i, "BIS"], [/manage(ment)?\b/i, "MANA"], [/entrepreneur/i, "ENTR"], [/econom/i, "ECON"],
];
const MAJOR_NAMES: Record<string, string> = { FINA: "Finance", ACCT: "Accounting", MARK: "Marketing", FIRE: "Real Estate", SVCM: "Supply Chain", BIS: "Information Systems", MANA: "Management", ENTR: "Entrepreneurship", ECON: "Economics" };

// The student's interests → words that appear in alumni industry/role/title.
const FIELD_WORDS: [RegExp, string[]][] = [
  [/investment bank|\bib\b|m&a/i, ["investment banking"]],
  [/financ|bank/i, ["finance", "financial", "banking", "investment", "credit"]],
  [/private equity|asset|portfolio|wealth|invest/i, ["portfolio", "investment", "wealth", "asset"]],
  [/account|audit|tax/i, ["accounting", "audit", "tax"]],
  [/consult/i, ["consulting"]],
  [/market|brand|advertis|social media/i, ["marketing", "advertising", "brand"]],
  [/sales|business development/i, ["sales", "business development"]],
  [/data|analytic/i, ["data", "analytics"]],
  [/tech|software|product|fintech/i, ["software", "internet", "information technology", "product"]],
  [/supply chain|logistic|operations/i, ["logistics", "supply chain", "operations", "purchasing"]],
  [/real estate/i, ["real estate"]],
  [/sport/i, ["sports"]],
  [/energy|oil|gas/i, ["oil & gas", "energy"]],
  [/health/i, ["healthcare", "medical"]],
];
const METRO: [RegExp, RegExp][] = [
  [/fort worth|dfw/i, /fort worth|arlington|dfw/i],
  [/dallas|dfw/i, /dallas|irving|plano|frisco|richardson|addison|las colinas/i],
  [/houston/i, /houston/i], [/austin/i, /austin/i],
  [/texas/i, /\btx\b|texas/i], [/new york/i, /new york|\bny\b/i], [/chicago/i, /chicago/i],
];

/** Top alumni for this student, each with the reasons they were picked. */
export function matchAlumni(ws: Workspace, companies: string[], limit = 12): AlumMatch[] {
  const p = ws.profile;
  const myMajors = new Set(MAJOR_CODES.filter(([re]) => re.test(p.major)).map(([, c]) => c));
  const interests = [p.targetRoles, p.interests, p.goals, p.major].join(" ");
  const fieldWords = Array.from(new Set(FIELD_WORDS.filter(([re]) => re.test(interests)).flatMap(([, w]) => w)));
  const wantsRegions = p.regions.trim() && !/anywhere/i.test(p.regions);
  const metros = METRO.filter(([want]) => want.test(p.regions)).map(([, there]) => there);
  const companyKeys = companies.map((c) => c.toLowerCase().replace(/[^a-z0-9]/g, "")).filter((c) => c.length > 2);
  const thisYear = new Date().getFullYear();

  return alumniList().alumni
    .map((a) => {
      let score = 0;
      const why: string[] = [];
      const shared = a.majors.filter((m) => myMajors.has(m));
      if (shared.length) { score += 30; why.push(`${MAJOR_NAMES[shared[0]] || shared[0]} major like you`); }
      const work = `${a.industry} ${a.role} ${a.title}`.toLowerCase();
      const hits = fieldWords.filter((w) => work.includes(w));
      if (hits.length) { score += 25 + Math.min(10, hits.length * 3); why.push(`works in ${a.industry || a.role}`); }
      const emp = a.employer.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (companyKeys.some((c) => emp.includes(c) || c.includes(emp))) { score += 35; why.push(`at ${a.employer}, an opening you saved`); }
      if (wantsRegions && metros.some((re) => re.test(a.location))) { score += 15; why.push(`based in ${a.location.split(",")[0]}`); }
      else if (/remote/i.test(p.regions) && /remote/i.test(a.location)) score += 5;
      if (a.year && thisYear - a.year <= 4) { score += 8; why.push(`Class of ${a.year} — recent grad`); }
      return { ...a, score, why };
    })
    .filter((a) => a.score >= 30 && a.email)
    .sort((x, y) => y.score - x.score || (y.year || 0) - (x.year || 0))
    .slice(0, limit)
    .map(({ intl, vet, transfer, firstGen, ...rest }) => rest);
}
