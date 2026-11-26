import { orgKey } from "./org";

/** Web domain per employer Remy reads (server/data/employers.json), keyed by orgKey, for the company logo on opening
 *  cards. Each one was checked to return a real icon from the favicon service on 2026-11-23; "www." is kept where only
 *  that form had one. Arrowstreet, Atmos Energy, Hunt Consolidated, Richardson ISD and Lake Travis ISD had none, so
 *  they keep their initials. */
const DOMAINS: Record<string, string> = {
  morganstanley: "morganstanley.com",
  bankofamerica: "bankofamerica.com",
  citi: "citi.com",
  wellsfargo: "wellsfargo.com",
  capitalone: "capitalone.com",
  fidelityinvestments: "fidelity.com",
  blackrock: "blackrock.com",
  statestreet: "www.statestreet.com",
  sandpglobal: "spglobal.com",
  gresearch: "gresearch.com",
  visa: "visa.com",
  mastercard: "mastercard.com",
  paypal: "paypal.com",
  pwc: "pwc.com",
  boozallenhamilton: "boozallen.com",
  jll: "jll.com",
  atandt: "att.com",
  southwestairlines: "southwest.com",
  kimberlyclark: "kimberly-clark.com",
  alcon: "alcon.com",
  mckesson: "mckesson.com",
  chevron: "chevron.com",
  target: "target.com",
  nike: "nike.com",
  disney: "disney.com",
  warnerbrosdiscovery: "wbd.com",
  comcast: "comcast.com",
  tmobile: "t-mobile.com",
  salesforce: "salesforce.com",
  adobe: "adobe.com",
  workday: "workday.com",
  humana: "humana.com",
  cvshealth: "cvshealth.com",
  johnsonandjohnson: "jnj.com",
  pfizer: "pfizer.com",
  stryker: "stryker.com",
  generalmotors: "gm.com",
  northropgrumman: "northropgrumman.com",
  rtxraytheon: "rtx.com",
  geaerospace: "geaerospace.com",
  intel: "intel.com",
  nvidia: "nvidia.com",
  hewlettpackardenterprise: "hpe.com",
  zillow: "zillow.com",
  expedia: "expedia.com",
  crowdstrike: "crowdstrike.com",
  point72: "point72.com",
  robinhood: "robinhood.com",
  stripe: "stripe.com",
  coinbase: "coinbase.com",
  duolingo: "duolingo.com",
  affirm: "affirm.com",
  sofi: "sofi.com",
  chime: "chime.com",
  toast: "toasttab.com",
  squarespace: "squarespace.com",
  palantir: "palantir.com",
  plaid: "plaid.com",
  ramp: "ramp.com",
  mercury: "mercury.com",
  tenethealthcare: "tenethealth.com",
  fluor: "fluor.com",
  toyotanorthamerica: "toyota.com",
  vistra: "vistracorp.com",
  buildersfirstsource: "bldr.com",
  caterpillar: "caterpillar.com",
  celanese: "celanese.com",
  topgolf: "topgolf.com",
  matchgroup: "mtch.com",
  texascapital: "texascapitalbank.com",
  sabre: "sabre.com",
  frostbank: "frostbank.com",
  libertymutual: "libertymutual.com",
  grantthornton: "grantthornton.com",
  deloitte: "deloitte.com",
  bdo: "bdo.com",
  forvismazars: "forvismazars.us",
  rsm: "rsmus.com",
  clacliftonlarsonallen: "claconnect.com",
  protiviti: "protiviti.com",
  huronconsulting: "huronconsultinggroup.com",
  accenture: "accenture.com",
  texashealthresources: "texashealth.org",
  cookchildrens: "cookchildrens.org",
  samsungelectronicsamerica: "samsung.com",
  cencora: "cencora.com",
  hp: "hp.com",
  hilton: "hilton.com",
  marriott: "marriott.com",
  daveandbusters: "daveandbusters.com",
  torchystacos: "torchystacos.com",
  chuckecheese: "chuckecheese.com",
  athome: "athome.com",
  homedepot: "homedepot.com",
  tpgglobal: "tpg.com",
  lincolnproperty: "lpc.com",
  streamrealty: "streamrealty.com",
  invitationhomes: "invitationhomes.com",
  transwestern: "transwestern.com",
  greystar: "greystar.com",
  colliers: "colliers.com",
  hntb: "hntb.com",
  honeywell: "honeywell.com",
  emerson: "emerson.com",
  flowserve: "flowserve.com",
  ryder: "ryder.com",
  jbhunt: "jbhunt.com",
  allyfinancial: "ally.com",
  usbank: "usbank.com",
  ameriprise: "ameriprise.com",
  northwesternmutual: "www.northwesternmutual.com",
  allstate: "www.allstate.com",
  travelers: "travelers.com",
  chubb: "chubb.com",
  primerica: "primerica.com",
  metlife: "metlife.com",
  raymondjames: "raymondjames.com",
  plainscapitalbank: "plainscapital.com",
  originbank: "origin.bank",
  corelogic: "corelogic.com",
  alkamitechnology: "alkami.com",
  rackspace: "rackspace.com",
  elevancehealth: "elevancehealth.com",
  cigna: "cigna.com",
  tuesdayhealth: "tuesdayhealth.com",
  servicenow: "servicenow.com",
  netflix: "netflix.com",
  linkedin: "linkedin.com",
  iheartmedia: "iheartmedia.com",
  nexstarmedia: "nexstar.tv",
  spotify: "spotify.com",
  tegnawfaa: "wfaa.com",
  dallascollege: "dallascollege.edu",
  cityoffortworth: "fortworthtexas.gov",
  federalreservebankofdallas: "dallasfed.org",
  dallasarearapidtransit: "dart.org",
  teachforamerica: "teachforamerica.org",
  cityofdallas: "dallascityhall.com",
  ayahealthcare: "ayahealthcare.com",
  questdiagnostics: "questdiagnostics.com",
  medtronic: "medtronic.com",
  abbott: "abbott.com",
  siemenshealthineers: "siemens-healthineers.com",
  reatapharmaceuticals: "reatapharma.com",
  peloton: "onepeloton.com",
  smithandnephew: "smith-nephew.com",
  jpmorganchase: "jpmorganchase.com",
  crowe: "crowe.com",
  davita: "davita.com",
  academysports: "academy.com",
  michaels: "michaels.com",
  tranetechnologies: "tranetechnologies.com",
  pnc: "pnc.com",
  associa: "associaonline.com",
  fiserv: "fiserv.com",
  conduent: "conduent.com",
  dallasfortworthinternationalairport: "dfwairport.com",
  truist: "truist.com",
  alliancedatabreadfinancial: "breadfinancial.com",
  cisco: "cisco.com",
  labcorp: "labcorp.com",
  gehealthcare: "gehealthcare.com",
  raytheonrtx: "rtx.com",
  zimmerbiomet: "zimmerbiomet.com",
  bnsfrailway: "bnsf.com",
  dhl: "dhl.com",
  baylorscottandwhitehealth: "bswhealth.com",
  planoisd: "pisd.edu",
  lewisvilleisd: "lisd.net",
  garlandisd: "garlandisd.net",
  mesquiteisd: "mesquiteisd.org",
  carrolltonfarmersbranchisd: "cfbisd.edu",
  cityofarlington: "arlingtontx.gov",
  fortworthisd: "fwisd.org",
  dallasisd: "dallasisd.org",
  irvingisd: "irvingisd.net",
  kellerisd: "kellerisd.net",
  austinisd: "austinisd.org",
  leanderisd: "leanderisd.org",
  pflugervilleisd: "pfisd.net",
  hayscisd: "hayscisd.net",
  kleinisd: "kleinisd.net",
  humbleisd: "humbleisd.net",
  pasadenaisd: "pasadenaisd.org",
  clearcreekisd: "ccisd.net",
  aldineisd: "aldineisd.org",
  galenaparkisd: "galenaparkisd.com",
  pearlandisd: "pearlandisd.org",
  springbranchisd: "springbranchisd.com",
  cypressfairbanksisd: "cfisd.net",
  plainsallamerican: "plains.com",
  selffinancial: "self.inc",
  virtufinancial: "virtu.com",
  q2: "q2.com",
  chevronstudents: "chevron.com",
  globalfoundries: "gf.com",
  bakerhughes: "bakerhughes.com",
  siliconlabs: "silabs.com",
  pipersandler: "pipersandler.com",
  hntbstudents: "hntb.com",
  axiomspace: "axiomspace.com",
  corient: "corient.com",
};

// Hosts that belong to job boards and applicant systems, not the employer, so their icon would be the wrong logo.
const BOARD = /(^|\.)(myworkdayjobs|workday|greenhouse|lever|ashbyhq|smartrecruiters|oraclecloud|eightfold|applitrack|schoolspring|taleo|usajobs|careeronestop|linkedin|indeed|handshake|joinhandshake|glassdoor|ziprecruiter|icims|jobvite|successfactors|brassring|ultipro|ukg|paylocity|adp|bamboohr|recruitee|workable|jazzhr|breezy|dayforcehcm|phenompeople|simplyhired|monster|careerbuilder|wellfound|angel|applytojob|paycomonline|rippling|trakstar|teamtailor|personio|pinpointhq|zohorecruit|freshteam|applicantpro|applicantstack|hrmdirect|clearcompany|isolvedhire|catsone|comeet|avature|careerplug|hireology|talentreef|workatastartup|builtin|google|bing|remy|remyai|localhost)\.[a-z.]+$/;

/** The employer's web domain: from the list above, else the posting's own site when it's the employer's (not a job board). */
export function logoDomain(company: string, url = ""): string {
  const known = DOMAINS[orgKey(company || "")];
  if (known) return known;
  let host = "";
  try { host = new URL(url).hostname.toLowerCase(); } catch { return ""; }
  if (!host.includes(".") || BOARD.test(host) || /^\d+(\.\d+)+$/.test(host)) return "";
  const parts = host.split(".");
  const n = parts.length > 2 && /^(co|com|org|net|ac|gov|edu)$/.test(parts[parts.length - 2]) && parts[parts.length - 1].length === 2 ? 3 : 2;
  return parts.slice(-n).join(".");
}

/** The logo image for a company ("" means show initials). For a domain it doesn't know, the favicon service answers
 *  with a 16px globe (status 404, which browsers still load), so `sure` is false when the domain came from the posting
 *  link and callers should treat a 16px image as no logo. Listed employers were checked, so their 16px icons are real. */
export function logoFor(company: string, url = ""): { src: string; sure: boolean } {
  const known = !!DOMAINS[orgKey(company || "")], d = logoDomain(company, url);
  return { src: d ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64` : "", sure: known };
}

/** The words of a company name that matter ("Cain Watters & Associates, LLC" → ["cain", "watters"]). */
export function nameWords(company: string): string[] {
  return company.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " ").split(/[^a-z0-9]+/)
    .filter((w) => w && !/^(inc|llc|llp|ltd|corp|corporation|company|co|the|and|of|group|associates|holdings|usa|us|plc|lp|pllc|pc|na)$/.test(w));
}

/** The registrable part of a host ("careers.acme.co.uk" → "acme.co.uk"). */
export function baseDomain(host: string): string {
  const parts = host.toLowerCase().replace(/^www\./, "").split(".");
  const n = parts.length > 2 && /^(co|com|org|net|ac|gov|edu)$/.test(parts[parts.length - 2]) && parts[parts.length - 1].length === 2 ? 3 : 2;
  return parts.slice(-n).join(".");
}

/** Does this domain's name read as the company ("opensesame.com" for OpenSesame, "cainwatters.com" for Cain Watters)? */
export function domainFits(domain: string, company: string): boolean {
  const label = domain.split(".")[0].replace(/[^a-z0-9]/g, "");
  const w = nameWords(company);
  if (!label || !w.length) return false;
  const joined = w.join("");
  return label === joined || label === w[0] && w[0].length >= 4 || (joined.length >= 5 && label.startsWith(joined)) || (w.length > 1 && label === w.slice(0, 2).join(""));
}

/** The domain Remy lists for this employer, or "". */
export const knownDomain = (company: string) => DOMAINS[orgKey(company || "")] || "";

/** Like logoFor, but a company with no known domain asks Remy's server (GET /api/logo, server/jobs/logo.ts), which
 *  finds the employer's own site behind applicant-system links and answers 404 when it has no real icon. `apiBase` is
 *  the server's origin for the phone app ("" on the website). */
export function logoSrc(company: string, url = "", apiBase = ""): { src: string; sure: boolean } {
  const own = logoFor(company, url);
  // Only a listed employer or a posting site named like the company loads straight away; anything else (a job board
  // Remy doesn't know, a staffing agency's site) goes through the server, so a card never wears another company's logo.
  if (!(company || "").trim() || own.sure || (own.src && domainFits(logoDomain(company, url), company))) return own;
  return { src: `${apiBase}/api/logo?company=${encodeURIComponent(company)}${url ? `&url=${encodeURIComponent(url)}` : ""}`, sure: true };
}
