// The "Where should I look?" choices in setup, from where the student lives. They used to be Texas places for everyone,
// so a student in Columbus, OH was offered Fort Worth, Dallas and Houston (11,041-resume test, Nov 26, 2026).
const CODES = "AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY".split("|");
const NAMES = "Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|District of Columbia|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming".split("|");
export const TEXAS_REGION_OPTS = ["Fort Worth", "Dallas", "DFW area", "Houston", "Austin", "Anywhere in Texas"];
const EVERYWHERE = ["Remote", "Anywhere in the US"];

/** "Columbus, OH" → ["Columbus", "Anywhere in Ohio", "Remote", "Anywhere in the US"]. Texas or no known state: the
 *  Texas places as before, with the student's own Texas city first if it isn't one of them ("Lubbock"). */
export function regionOptions(location = ""): string[] {
  const [city = "", rest = ""] = location.split(",").map((x) => x.trim());
  const st = rest.split(/\s+/)[0]?.toUpperCase() || "";
  const k = CODES.indexOf(st) >= 0 ? CODES.indexOf(st) : NAMES.findIndex((n) => n.toLowerCase() === rest.toLowerCase());
  const name = k >= 0 ? NAMES[k] : "";
  const own = city && !/\d/.test(city) && city.length <= 40 ? city : "";
  if (!name) return [...TEXAS_REGION_OPTS, ...EVERYWHERE];
  if (name === "Texas") return [...(own && !TEXAS_REGION_OPTS.some((o) => o.toLowerCase() === own.toLowerCase()) ? [own] : []), ...TEXAS_REGION_OPTS, ...EVERYWHERE];
  return [...(own ? [own] : []), `Anywhere in ${name}`, ...EVERYWHERE];
}

/** Under "Where should I look?": picking Fort Worth or Dallas alone now means only that city (Dilan, Nov 27), so say
 *  how to get the whole area. "" when nothing needs saying. */
export function regionHint(picked: string[]): string {
  const p = picked.map((x) => x.toLowerCase());
  if (p.some((x) => x.includes("dfw")) || (p.includes("fort worth") && p.includes("dallas"))) return "";
  const city = picked.find((x) => /^(fort worth|dallas)$/i.test(x.trim()));
  return city ? `Only ${city.trim()} itself. Pick DFW area to add Dallas, Fort Worth, Arlington, Irving and Plano.` : "";
}
