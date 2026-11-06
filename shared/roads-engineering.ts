// Engineering specialty roads (Nov 5, 2026): drafted by a research agent from official sources, audited by a second agent, fixes applied.
// Shape matches Road/RoadStep/Credential in shared/roads.ts, plus skills/skillsSource per road.
// Placement: these must sit BEFORE the generic "engineering" road (/engineer/i) and before "tech" and "health",
// or the generic road wins. Keep the generic road as the fallback for "Engineering" with no specialty.
// Every source below was fetched on 2026-11-05 unless marked UNVERIFIED.
import type { Road } from "./roads";
import { SEASON_SOURCE } from "./seasons";

type EngRoad = Road & { skills: string[]; skillsSource: string };

// --- Sources (fetched 2026-11-05) ---
const NCEES_FE = "https://ncees.org/exams/fe-exam/"; // 7 FE exams: Chemical, Civil, Electrical & Computer, Environmental, Industrial & Systems, Mechanical, Other Disciplines; $225; 110 questions; year-round
const NCEES_PE = "https://ncees.org/exams/pe-exam/"; // PE list: no aerospace or biomedical exam; Petroleum, Industrial & Systems, Computer are once a year
const TX_FE = "https://pels.texas.gov/lic_exams.htm"; // students may take the FE within two full-time semesters of graduating (EAC/ABET program); Texas Ethics of Engineering exam
const TX_EIT = "https://pels.texas.gov/lic_eit_exinfo.htm"; // EIT = degree + FE + $15 application; Texas EITs may take the PE exam before the 4 years
const TX_PE = "https://pels.texas.gov/lic_basic.htm"; // 4 years experience (accredited degree); supervision by a PE recommended, NOT required; 3 PE references
const TX_EXEMPT = "https://statutes.capitol.texas.gov/Docs/OC/htm/OC.1001.htm"; // Sec. 1001.057 industrial exemption
const TCU_ENGR = "https://cse.tcu.edu/engineering/academics/engineering-major.php"; // BS Engineering, electrical or mechanical emphasis, chosen before the 4th semester; 3-semester design sequence
const TCU_ABET = "https://cse.tcu.edu/engineering/academics/accreditation.php"; // EAC/ABET accredited (search snippet; page not opened)
const BLS_ME = "https://www.bls.gov/ooh/architecture-and-engineering/mechanical-engineers.htm";
const BLS_EE = "https://www.bls.gov/ooh/architecture-and-engineering/electrical-and-electronics-engineers.htm";
const BLS_CIVIL = "https://www.bls.gov/ooh/architecture-and-engineering/civil-engineers.htm";
const BLS_CHE = "https://www.bls.gov/ooh/architecture-and-engineering/chemical-engineers.htm";
const BLS_AERO = "https://www.bls.gov/ooh/architecture-and-engineering/aerospace-engineers.htm";
const BLS_BME = "https://www.bls.gov/ooh/architecture-and-engineering/biomedical-engineers.htm";
const BLS_IE = "https://www.bls.gov/ooh/architecture-and-engineering/industrial-engineers.htm";
const BLS_ENV = "https://www.bls.gov/ooh/architecture-and-engineering/environmental-engineers.htm";
const BLS_PET = "https://www.bls.gov/ooh/architecture-and-engineering/petroleum-engineers.htm";
const CSWA = "https://www.solidworks.com/solidworks-certification-program"; // CSWA/CSWP $99, no prerequisites, free voucher via academic provider schools or student edition
const IISE_STUDENT = "https://www.iise.org/TrainingCenter/details.aspx?id=53621"; // IISE University Student Training Program: Lean / Six Sigma green belt
const ASQ_GB = "https://www.asq.org/cert/six-sigma-green-belt"; // ASQ CSSGB needs 3 years paid work experience
const CAPM = "https://www.pmi.org/certifications/certified-associate-capm"; // already used in roads.ts
const HAZWOPER = "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-XVII/part-1910/subpart-H/section-1910.120"; // 40 hours off-site + 3 days field for general site workers
const LEED_GA = "https://www.usgbc.org/credentials/leed-green-associate";
const CLEARANCE = "https://www.dcsa.mil/Industrial-Security/Entity-Vetting-Facility-Clearances-FOCI/Facility-Clearances/FAQs-Facility-Security-Officers/"; // individuals can't apply on their own; company decides
const RAC = "https://www.raps.org/certify-advance/credentials/rac.html"; // bachelor's + 3 years regulatory experience
const SAE = "https://www.sae.org/events/student"; // Baja SAE, Formula SAE, SAE Aero Design
const AIAA_DBF = "https://aiaa.org/get-involved/university-students/dbf/";
const CHEMECAR = "https://www.aiche.org/students/chem-e-car-competitionr";
const ASCE_COMP = "https://www.asce.org/communities/student-members/conferences"; // Concrete Canoe, Student Steel Bridge, etc.
const ONET = (code: string) => `https://www.onetonline.org/link/summary/${code}`;

// --- Shared credential cards (Texas). Wording fixes vs current roads.ts: Texas does NOT require experience
// "under a licensed engineer" (it's recommended; you need 3 PE references), and Texas EITs can take the PE exam early.
const fe = (exam: string, who: string) => ({ name: `FE exam (${exam}), then Texas EIT`, need: "depends" as const, who, why: "It's the first step to a PE license and easiest while school is fresh. Pass it and you can apply to be an Engineer in Training (EIT); Texas EITs may sit for the PE exam early.", learn: "A 110-question review of your degree's core topics for that discipline.", when: "Texas lets you take it within your last two full-time semesters (ABET program) or after graduating; $225 to NCEES, offered year-round", source: TX_FE });
const pe = (who: string, src: string) => ({ name: "PE license (Professional Engineer)", need: "depends" as const, who, why: "A PE can sign and seal plans, offer engineering to the public and oversee other engineers; it often means more responsibility and pay.", learn: "Your discipline in depth, through the NCEES PE exam plus 4 years of engineering work.", when: "About 4 years after graduating (Texas: 4 years of experience with an accredited degree, 3 PE references, and an open-book Texas ethics exam)", source: src });
const feStep = (exam: string, many: boolean) => ({ year: 4 as const, what: many ? `Take the FE (${exam}) in your last two semesters or soon after, if you want a PE later` : `If a PE is in your plans, take the FE (${exam}) in your last two semesters; many in this field skip it`, source: TX_FE, optional: true });
const peStep = { year: 5 as const, what: "PE license after 4 years of engineering work, if your job needs one (Texas EITs can take the PE exam sooner)", source: TX_PE, optional: true };

export const ENG_ROADS: EngRoad[] = [
  // Aerospace before mechanical so "mechanical and aerospace engineering" lands here (see collision notes).
  { parent: "engineering", key: "eng-aerospace", label: "Aerospace engineering",
    field: /\baero(space|nautical|nautics)?\b[\w &/-]{0,25}\beng|\bastronautic|aerospace (eng|emphasis|concentration)|\baero ?e\b/i,
    not: /aerospace studies|\brotc\b|technolog|technician/i,
    credentials: [
      fe("Mechanical or Other Disciplines; there's no aerospace FE", "Not needed for most aerospace jobs: BLS says entry-level aerospace jobs don't require a license. NCEES has no aerospace FE or PE, so the few who want a PE take the closest exam."),
      pe("Rare in aerospace. Texas exempts engineers working on products their own company designs and builds (Occupations Code 1001.057), which covers most aircraft and spacecraft work.", TX_EXEMPT),
      { name: "Security clearance", need: "job", who: "Many defense and space jobs (often listed as 'must be able to obtain a clearance').", why: "You can't apply for one yourself; the company that hires you sponsors it. Keep your record clean and be honest on forms.", learn: "", when: "After you're hired, for jobs that need it", source: CLEARANCE },
    ],
    steps: [
      { year: 1, what: "Join a design team like AIAA Design/Build/Fly, SAE Aero Design or a rocketry club", source: AIAA_DBF, optional: true },
      { year: 2, what: "Apply for co-ops or internships early; defense and space companies hire students too", source: BLS_AERO },
      { year: 3, what: "Apply for junior-summer aerospace internships (engineering recruiting peaks in the fall)", source: SEASON_SOURCE },
      feStep("Mechanical or Other Disciplines", false),
      peStep,
    ],
    skills: ["MATLAB", "Simulink", "CATIA", "SolidWorks", "C and C++", "LabVIEW", "IBM DOORS (requirements)", "Linux", "Microsoft Excel"],
    skillsSource: ONET("17-2011.00") },

  { parent: "engineering", key: "eng-mechanical", label: "Mechanical engineering",
    field: /\bmechanical\b[\w &/-]{0,25}\beng|\bmech\.? ?e(ng)?\b|\bmeche\b|\bbsme\b|^\s*m\.?e\.?\s*$|\bengineering\b[^;]{0,30}\bmechanical\b/i,
    not: /technolog|technician|\bmechanic\b|mechanical (contractor|trades?)/i,
    credentials: [
      fe("Mechanical", "Most mechanical engineers at manufacturers never need it; it matters for HVAC and building-systems design (MEP) work, where engineers seal plans."),
      pe("Needed mainly in building systems (HVAC, plumbing, fire protection) at consulting firms. BLS says entry-level jobs don't require a license, and Texas exempts engineers working on their own company's products.", TX_EXEMPT),
      { name: "CSWA or CSWP (SolidWorks certification)", need: "optional", who: "Nice to have for design and manufacturing internships that use SolidWorks; rarely required.", why: "Shows you can actually model parts. $99 each with no prerequisites, and free at schools that are SolidWorks certification providers or with the student edition.", learn: "Modeling parts and assemblies in SolidWorks (CSWP is the harder, professional level).", when: "Anytime after a CAD class", source: CSWA },
    ],
    steps: [
      { year: 1, what: "Join a design team like Baja SAE or Formula SAE for hands-on design and build experience", source: SAE, optional: true },
      { year: 2, what: "A CSWA certification once you've had a CAD class", source: CSWA, optional: true },
      { year: 3, what: "Apply for mechanical internships or co-ops; most fill in the fall for the next summer", source: SEASON_SOURCE },
      feStep("Mechanical", false),
      peStep,
    ],
    skills: ["SolidWorks", "AutoCAD", "MATLAB", "Python", "C++", "Microsoft Excel", "Microsoft Project", "SAP (ERP)"],
    skillsSource: ONET("17-2141.00") },

  { parent: "engineering", key: "eng-electrical", label: "Electrical engineering",
    // Requires "eng", an EE abbreviation or TCU's "electrical emphasis" so electrician trades never match.
    field: /\belectrical\b[\w &/-]{0,25}\beng|\belectronics? eng|^\s*(bs)?e\.?e\.?\s*$|\bbsee\b|\bece\b|\bengineering\b[^;]{0,30}\belectrical\b|electrical (emphasis|concentration)/i,
    not: /technolog|technician|electrician|apprentic|lineworker|\blinem[ae]n\b|journeyman/i,
    credentials: [
      fe("Electrical and Computer", "Matters most in power, utilities and building electrical design, where a PE is common. Most electronics, chip and controls jobs at companies never ask for it."),
      pe("Mainly power systems and building electrical design (consulting firms, utilities). BLS says entry-level jobs don't need it; Texas exempts engineers working on their own company's products, including hardware and semiconductors.", TX_EXEMPT),
    ],
    steps: [
      { year: 1, what: "Join your IEEE student branch or a robotics/electronics team", source: "", optional: true },
      { year: 3, what: "Apply for electrical internships or co-ops (utilities, semiconductors, defense, energy); engineering recruiting peaks in the fall", source: SEASON_SOURCE },
      feStep("Electrical and Computer", false),
      peStep,
    ],
    skills: ["MATLAB", "C and C++", "Python", "AutoCAD", "ETAP (power systems)", "Microsoft Visio", "Linux/UNIX shell", "Microsoft Excel"],
    skillsSource: ONET("17-2071.00") },

  { parent: "engineering", key: "eng-computer", label: "Computer engineering",
    // "computer eng" only; "computer science", "CS" and "computer science and engineering" are left to other roads.
    field: /\bcomputer (systems |hardware )?eng|\bcomp\.? ?e(ng)?\b|\bcompe\b|\bbscpe\b|^\s*cpe\s*$/i,
    not: /technolog|technician|computer engineering tech/i,
    credentials: [
      { name: "No license needed for most jobs", need: "optional", who: "Hardware, embedded and chip jobs at companies don't ask for a license; Texas exempts work on a company's own software, firmware, hardware and semiconductors.", why: "Projects (boards you built, firmware on GitHub) count more.", learn: "", when: "", source: TX_EXEMPT },
      fe("Electrical and Computer", "Rare in computer engineering. Only worth it if you might do work that needs a PE; NCEES offers a Computer Engineering PE once a year."),
    ],
    steps: [
      { year: 1, what: "Build things: a microcontroller project, a robot or a hackathon entry you can show", source: "" },
      { year: 3, what: "Apply for hardware, embedded or software internships; big tech and chip companies recruit in the fall", source: SEASON_SOURCE },
      feStep("Electrical and Computer", false),
    ],
    skills: ["C", "C++", "Python", "Linux", "Git", "MATLAB", "Perl", "PCI Express (PCIe)", "SQL"],
    skillsSource: ONET("17-2061.00") },

  { parent: "engineering", key: "eng-civil", label: "Civil engineering",
    field: /\bcivil\b[\w &/-]{0,25}\beng|\bstructural eng|\bgeotechnical eng|\btransportation eng|\bconstruction eng|^\s*(bs)?c\.?e\.?\s*\(civil\)/i,
    not: /technolog|technician|civil (rights|law|litigation|service)/i,
    credentials: [
      fe("Civil", "Civil engineers who design public work (roads, water, buildings) usually need a PE, and the FE is the first step."),
      pe("Needed to seal plans and offer services to the public; BLS says civil engineers typically must be licensed for that, though not for entry-level jobs.", BLS_CIVIL),
      { name: "LEED Green Associate", need: "optional", who: "Optional for building, construction and sustainability roles.", why: "Shows you know green-building basics; it's the first step to a LEED AP.", learn: "Green building and the LEED rating system (100 questions, 2 hours).", when: "Anytime; $250, or $100 for students", source: LEED_GA },
    ],
    steps: [
      { year: 1, what: "Join your ASCE student chapter; Concrete Canoe and Steel Bridge teams are common", source: ASCE_COMP, optional: true },
      { year: 3, what: "Apply for civil internships with firms, cities or TxDOT-type agencies; engineering recruiting peaks in the fall", source: SEASON_SOURCE },
      { year: 4, what: "If you'll design or seal plans (common in civil), take the FE Civil in your last two semesters or soon after", source: TX_FE, optional: true },
      { year: 5, what: "A Texas EIT certificate isn't required, but it lets you take the PE exam early; the PE itself needs 4 years of engineering work", source: TX_EIT, optional: true },
    ],
    skills: ["AutoCAD Civil 3D", "Autodesk Revit", "Bentley MicroStation", "ESRI ArcGIS", "HEC-HMS", "Procore", "Primavera or Microsoft Project", "Microsoft Excel", "MATLAB"],
    skillsSource: ONET("17-2051.00") },

  { parent: "engineering", key: "eng-chemical", label: "Chemical engineering",
    field: /\bchemical\b[\w &/-]{0,25}\beng|^\s*che\s*$|\bchem\.? ?e(ng)?\b|chemical (and|&) biomolecular/i,
    not: /technolog|technician/i,
    credentials: [
      fe("Chemical", "Not needed for most plant, process or product jobs. Some take it to keep the PE option open (consulting, process safety, environmental work)."),
      pe("Uncommon in chemical engineering; BLS says entry-level jobs don't require it. Texas exempts engineers working on their own company's products and oil and gas production.", TX_EXEMPT),
    ],
    steps: [
      { year: 1, what: "Join your AIChE chapter; Chem-E-Car is a common team", source: CHEMECAR, optional: true },
      { year: 2, what: "Undergraduate research in a lab", source: "", optional: true },
      { year: 3, what: "Apply for process or plant internships or co-ops (refining, chemicals, pharma, food); engineering recruiting peaks in the fall", source: SEASON_SOURCE },
      feStep("Chemical", false),
      peStep,
    ],
    skills: ["MATLAB", "Minitab", "AutoCAD", "LabVIEW", "SCADA", "SAP (ERP)", "Microsoft Excel", "R"],
    skillsSource: ONET("17-2041.00") },

  { parent: "engineering", key: "eng-biomedical", label: "Biomedical engineering",
    field: /\bbiomedical\b[\w &/-]{0,15}\beng|\bbioengineer|\bbiomed eng|\bbme\b/i,
    not: /technolog|technician|equipment tech/i,
    credentials: [
      fe("Other Disciplines or the closest one; there's no biomedical FE", "Rarely needed. NCEES has no biomedical FE or PE."),
      { name: "No license needed for most jobs", need: "optional", who: "Medical device and research jobs don't ask for a PE. Some positions want a graduate degree (BLS).", why: "Research, co-ops with device or pharma companies, and design projects count more.", learn: "", when: "", source: BLS_BME },
      { name: "RAC (Regulatory Affairs Certification)", need: "optional", who: "Only for people going into regulatory affairs (getting devices or drugs cleared by FDA).", why: "Respected in regulatory work, but you can't take it in school: it needs a bachelor's plus 3 years of regulatory work.", learn: "FDA and global rules for devices (RAC-Devices) or drugs (RAC-Drugs).", when: "At least 3 years after graduating", source: RAC },
    ],
    steps: [
      { year: 1, what: "Join BMES or a research lab; research experience helps if you might go to grad school", source: "", optional: true },
      { year: 3, what: "Apply for co-ops or internships with medical device makers, research labs or hospitals", source: "" },
      { year: 4, what: "Decide on grad school: some biomedical jobs require a master's or PhD", source: BLS_BME, optional: true },
    ],
    skills: ["MATLAB", "SolidWorks", "Python", "R", "LabVIEW", "Minitab", "SAS", "ImageJ"],
    skillsSource: ONET("17-2031.00") },

  { parent: "engineering", key: "eng-industrial", label: "Industrial engineering",
    field: /\bindustrial\b[\w &/-]{0,25}\beng|\bmanufacturing eng|\bisye\b/i,
    not: /technolog|technician|industrial (design|distribution)|organizational/i,
    credentials: [
      fe("Industrial and Systems", "Rare; BLS says entry-level industrial jobs don't need a license. NCEES offers the Industrial and Systems PE only once a year."),
      pe("Uncommon in industrial engineering (BLS).", BLS_IE),
      { name: "Lean or Six Sigma green belt", need: "optional", who: "Common in manufacturing, operations and quality jobs.", why: "Shows you can run improvement projects. IISE has a university student program; the ASQ green belt needs 3 years of work, so students can't take it.", learn: "Lean, DMAIC, process data and statistics.", when: "Anytime through a student program", source: IISE_STUDENT },
      { name: "CAPM (project management)", need: "optional", who: "Optional for operations or project roles.", why: "No work experience needed, just 23 hours of project management education.", learn: "How projects are planned, scheduled and run.", when: "Anytime after the 23 hours", source: CAPM },
    ],
    steps: [
      { year: 1, what: "Join your IISE student chapter", source: "", optional: true },
      { year: 2, what: "Learn Excel and SQL well; O*NET lists both among the tools industrial engineers use", source: ONET("17-2112.00") },
      { year: 3, what: "Apply for manufacturing, operations or supply chain internships; engineering recruiting peaks in the fall", source: SEASON_SOURCE },
      { year: 4, what: "A Lean or Six Sigma green belt through a student program, if you want one before you start", source: IISE_STUDENT, optional: true },
    ],
    skills: ["Microsoft Excel", "Minitab", "SQL", "Python", "R", "SAP (ERP)", "ProModel (simulation)", "AutoCAD", "Microsoft Visio"],
    skillsSource: ONET("17-2112.00") },

  { parent: "engineering", key: "eng-environmental", label: "Environmental engineering",
    // Requires "eng" so TCU's Environmental & Sustainability Science and environmental studies don't match.
    field: /\benvironmental\b[\w &/-]{0,25}\beng|\benve\b/i,
    not: /technolog|technician/i,
    credentials: [
      fe("Environmental", "Worth it if you'll design or sign off on projects (consulting firms, agencies), where a PE is needed."),
      pe("Needed to sign off on projects and offer services to the public; BLS says entry-level jobs don't require it.", BLS_ENV),
      { name: "HAZWOPER (40-hour)", need: "depends", who: "Only for work on hazardous waste or cleanup sites; BLS notes some states require it of environmental engineers.", why: "Federal OSHA rules require 40 hours of training plus 3 days in the field for regular site workers (24 hours plus 1 day for occasional ones), then refreshers. Employers usually pay for it.", learn: "Site hazards, protective equipment and decontamination.", when: "Usually after you're hired, before your first site job", source: HAZWOPER },
    ],
    steps: [
      { year: 1, what: "Join an environmental or water-resources student group, or Engineers Without Borders", source: "", optional: true },
      { year: 3, what: "Apply for internships with consulting firms, utilities or agencies like TCEQ; some employers prefer students with co-op or internship experience", source: BLS_ENV },
      { year: 4, what: "Take the FE Environmental in your last two semesters or soon after, if you want a PE", source: TX_FE, optional: true },
      peStep,
    ],
    skills: ["AutoCAD and Civil 3D", "ESRI ArcGIS", "MODFLOW (groundwater)", "MATLAB", "Python", "Bentley MicroStation", "Microsoft Excel", "Regulatory compliance software"],
    skillsSource: ONET("17-2081.00") },

  { parent: "engineering", key: "eng-petroleum", label: "Petroleum engineering",
    field: /\bpetroleum\b[\w &/-]{0,15}\beng|^\s*pete\s*$|\bnatural gas eng|\breservoir eng/i,
    not: /technolog|technician|landm|land management/i,
    credentials: [
      fe("Chemical, Mechanical or Other Disciplines; there's no petroleum FE", "Rare; BLS says entry-level petroleum jobs don't need a license. NCEES has a Petroleum PE (once a year) but no petroleum FE."),
      pe("Uncommon. Texas exempts company engineers working on the production, exploration and transport of oil and gas (Occupations Code 1001.057).", TX_EXEMPT),
    ],
    steps: [
      { year: 1, what: "Join your SPE (Society of Petroleum Engineers) student chapter", source: "", optional: true },
      { year: 3, what: "Apply for internships or co-ops with operators or service companies; some employers prefer a master's for advanced roles", source: BLS_PET },
      feStep("Chemical, Mechanical or Other Disciplines", false),
    ],
    skills: ["TIBCO Spotfire", "ARIES (reserves and economics)", "MATLAB", "SQL", "SAS", "AutoCAD", "R", "Microsoft Excel"],
    skillsSource: ONET("17-2171.00") },
];

// TCU note: TCU offers ONE engineering major, the BS in Engineering with an electrical or mechanical emphasis,
// picked before the 4th semester (TCU_ENGR), EAC/ABET accredited (TCU_ABET). A TCU student who types
// "Engineering (mechanical emphasis)" hits eng-mechanical; plain "Engineering" stays on the generic road.
// Suggested generic-road step for TCU: { year: 2, what: "Pick your emphasis (electrical or mechanical) before your 4th semester", source: TCU_ENGR }.
export const TCU_SOURCES = { TCU_ENGR, TCU_ABET, NCEES_FE, NCEES_PE, ASQ_GB };
