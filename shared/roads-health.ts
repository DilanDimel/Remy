// Health roads (Nov 5-6, 2026): research-agent draft, second-agent audit against official sources, fixes applied.
// Replaced the combined "health" road in roads.ts. Every claim links to the page it came from; claims I could not confirm are marked UNVERIFIED in a comment.
// AUDITED Nov 6, 2026 (backup of the pre-audit draft: health-roads-draft.pre-audit.ts). Sources re-fetched Nov 6 unless a
// comment says "search snippet" (the page blocked direct fetching, so the fact comes from a search result quoting that page).
// Audit changes: counseling road no longer matches plain "Psychology" (Dilan's decision); CRNA doctorate wording, NP "500 clinical hours" left off the road (BON's page states it as a program requirement, not a step for students); sonography/MLS/PA/pharmacy/OT/PT/kinesiology claims re-sourced or softened.
//
// Where they go in ROADS (order matters, first match wins):
//   crna, nurse-practitioner           → BEFORE "nursing" (specialties before parent, so "Nurse Anesthesia" doesn't stop at nursing)
//   radiologic … counseling            → where "health" is now (after nutrition, before teaching). Internal order below matters:
//     radiologic, mls, pre-pa, pre-pharmacy, pre-dental, pre-vet, pre-optometry, pre-pt, pre-ot, athletic-training, slp,
//     pre-med, kinesiology, public-health, health-admin, counseling, respiratory (last: its majors often name another field too)
//   (PA before pre-med so "physician assistant" isn't pre-med; pre-PT/AT before kinesiology so "Pre-PT Kinesiology" gets PT;
//    pre-med before kinesiology/public health/psychology so "Kinesiology (Pre-Med)" gets pre-med; public health before teaching
//    so "Health Education" gets CHES, not teacher certification.)
//   (athletic-training before kinesiology also sends TCU's "Movement Science 3+2" (BS Kinesiology + MSAT) to athletic training.)
//
// Tests that must change in server/fit.test.ts (they encode the old combined road / the old "no dental road" rule):
//   roadFor("Biochemistry (Pre-Dental)") → "pre-dental" (was null);  roadFor("dentistry") → "pre-dental" (was null)
//   roadFor("Pre-Med Biology") → "pre-med";  roadFor("Pre-PT Kinesiology") → "pre-pt";  roadFor("Pharmacy") → "pre-pharmacy"
//   "second review: lookalike fields get no road" (line ~409): "Veterinary Medicine" now → "pre-vet" (was null); take it out of that list.
//   Still null there: "Sports Medicine", "Pharmacy Technician", "Pharmaceutical Sciences".
// Unchanged: "Biology", "Medical Assistant", "Economics" → null; "Nursing" → nursing.
// New expectations worth adding (checked against these regexes Nov 6):
//   "Psychology" → null (NOT counseling: Dilan's decision); "Clinical Mental Health Counseling", "Counseling" → "counseling";
//   "Genetic Counseling", "Addiction Counseling", "Industrial-Organizational Psychology" → not counseling;
//   "Communication Sciences and Disorders", "Speech-Language Pathology" → "slp"; "Athletic Training", "Movement Science 3+2" → "athletic-training";
//   "Kinesiology", "Exercise Science", "Health & Fitness" → "kinesiology"; "Kinesiology (Pre-Med)", "Biology (Pre-Med)" → "pre-med";
//   "Pre-Physical Therapy" → "pre-pt"; "Public Health", "Health Education" → "public-health"; "Health Administration" → "health-admin";
//   "Nutritional Sciences" → nutrition (existing road); "Library Science (MLS)" → not "mls"; "Medical Laboratory Technology" → not "mls".
// Applied in roads.ts on merge (Nov 6): nursing skips veterin|home admin|facility admin; tech skips veterinary, medicine, biotech,
// surgical, respiratory, cytotech, histotech, dental lab and ophthalmic names. "Physical Education: Strength & Conditioning" → kinesiology
// (Dilan let the council decide); counseling skips legal/camp/admissions/peer/resident counselors, social work and criminal justice.
import type { Road } from "./roads";

// Same values as in roads.ts (kept here so this file stands on its own, like roads-business.ts).
const MCAT = "https://students-residents.aamc.org/prepare-mcat-exam/when-right-time-take-mcat-exam-three-questions-ask-yourself";
const BON = "https://www.bon.texas.gov/licensure_examination.asp.html";
const TEXES = "https://tea.texas.gov/texas-educators/certification";

// New sources (all fetched Nov 5, 2026 unless marked).
const AAMC_EXP = "https://students-residents.aamc.org/getting-experience/get-experience-medical-field";
const AACOM = "https://www.aacom.org/become-a-doctor/apply-to-medical-school/admissions-requirements";
const TMDSAS = "https://www.tmdsas.com/"; // Texas public medical, dental, podiatry and veterinary schools
const TMB_MD = "https://www.tmb.texas.gov/file/physician-eligibility-checklist"; // US grads: 1 year of residency + Texas jurisprudence exam
const USMLE = "https://www.usmle.org/";
const COMLEX = "https://www.nbome.org/assessments/comlex-usa/"; // DO licensing exam, Levels 1-3 (fetched Nov 6)
const AAPA = "https://www.aapa.org/career-central/become-a-pa/"; // 403 to fetchers; search snippet Nov 6: ~27 months, ~3 years health care experience, prerequisite list
const PAEA = "https://paeaonline.org/our-programs"; // CASPA program directory: each program's test rule (GRE, PA-CAT, some accept MCAT)
const TX_PA = "https://www.tmb.texas.gov/file/physician-assistant-eligibility-checklist"; // ARC-PA program, PANCE, NCCPA, Texas JP exam (75+)
const AACP_PCAT = "https://www.aacp.org/resource/pharmacy-college-admission-test";
const AACP_STRUCT = "https://www.aacp.org/resource/pharmd-program-structures"; // minimum 2, 3 or 4 years of pre-pharmacy, or a bachelor's, by program
const TSBP = "https://www.pharmacy.texas.gov/applicants/pharmacist-exam.asp";
const DAT = "https://www.ada.org/education/testing/exams/dental-admission-test-dat";
const AADSAS = "https://www.adea.org/godental/Apply/apply-to-adea-aadsas";
const ADEA_SHADOW = "https://www.adea.org/godental/discover-dentistry/dental-blogs/tips-from-current-d.d.s.-d.h.students/tips-from-current-d.d.s.-and-dental-hygiene-students/2021/09/28/building-your-application--shadowing-and-beyond";
const TSBDE = "https://tsbde.texas.gov/licensing/dentists/dentist-license-by-exam/";
const TAMU_DVM = "https://vetmed.tamu.edu/dvm/admissions/eligibility/";
const TAMU_DVM_LIC = "https://vetmed.tamu.edu/dvm/resources/licensing/";
const TBVME_SBE = "https://veterinary.texas.gov/licensing/requirements/state-board-exam/";
const OAT = "https://oat.ada.org/";
const OPTOMCAS = "https://www.optomcas.org/";
const TOB = "https://tob.texas.gov/for-applicants/applicants-get-started/";
const APTA = "https://www.apta.org/your-career/careers-in-physical-therapy/becoming-a-pt";
const TX_PT = "https://ptot.texas.gov/apply-by-exam/";
const ACOTE = "https://acoteonline.org/all-schools/"; // entry at master's or doctoral level (search snippet Nov 6; AOTA's page returned nothing)
const NBCOT = "https://www.nbcot.org/get-certified/eligibility";
const TX_OT = "https://ptot.texas.gov/ot-application/";
const ASHA = "https://www.asha.org/certification/2020-slp-certification-standards/";
const TX_SLP_INTERN = "https://www.tdlr.texas.gov/slpa/slp-intern-apply.htm";
const TX_SLP = "https://www.tdlr.texas.gov/slpa/slp-license-apply.htm";
const TX_SLPA = "https://www.tdlr.texas.gov/slpa/slp-assistant-apply.htm";
const CAATE = "https://caate.net/Programs/Professional";
const TX_AT = "https://www.tdlr.texas.gov/at/atapply.htm";
const TCU_UG = "https://harriscollege.tcu.edu/academics/undergraduate/index.php";
const TCU_GRAD = "https://harriscollege.tcu.edu/academics/graduate/index.php";
const CSCS = "https://www.nsca.com/certification/cscs/cscs-exam-prerequisites/"; // 403 to fetchers; search snippet Nov 6: bachelor's or college senior + CPR/AED (snippet only, UNVERIFIED on the page). CASCE date moved (NSCA press release unread), so the card gives no date
const ACSM_EP = "https://acsm.org/certification/get-certified/exercise-physiologist/"; // Nov 6: exercise science/physiology/kinesiology bachelor's + CPR/AED; CAAHEP-accredited degree for degrees awarded from Aug 15, 2027, temporary exemption through Aug 14, 2029; no "last semester" claim (unconfirmed)
const CHES = "https://www.nchec.org/ches-exam-eligibility";
const CPH = "https://www.nbphe.org/certified-in-public-health/cph-eligibility-requirements/";
const BLS_EPI = "https://www.bls.gov/ooh/life-physical-and-social-science/epidemiologists.htm"; // "typically need at least a master's degree" (fetched Nov 6)
const BLS_MHSM = "https://www.bls.gov/ooh/management/medical-and-health-services-managers.htm"; // bachelor's typical; some prefer a master's; top executives may need one (fetched Nov 6)
const TX_NFA = "https://www.hhs.texas.gov/business/licensing-credentialing-regulation/long-term-care-credentialing/nf-administrators-licensing-enforcement/nfa-faqs";
const ASCP_MLS = "https://www.ascp.org/boc/explore-credentials/view-all-credentials/MLS"; // 403 to fetchers; search snippet Nov 6: Route 1 = bachelor's + NAACLS MLS program within 5 years
const ASCLS = "https://ascls.org/licensure/"; // 10 licensure states; Texas not one (fetched Nov 6)
const TX_MRT = "https://www.tmb.texas.gov/apply-renew/medical-radiologic-technologist/medical-radiologic-technologist-certificate-application"; // "A radiologic technologist license is not required to practice MR in Texas"
const TX_MRT_CHECK = "https://www.tmb.texas.gov/file/mrt-documentation-checklist-eligibility-requirements"; // program transcript + current ARRT or NMTCB certification (Dec 2025 checklist)
const ARDMS = "https://www.inteleos.org/about/community/ardms/";
const SDMS_LIC = "https://www.sdms.org/advocacy/state-licensure"; // 4 states license sonographers (NH, NM, ND, OR); Texas not one
const LPC = "https://bhec.texas.gov/texas-state-board-of-examiners-of-professional-counselors/faqs-lpc/professional-counselors-applying-for-a-license/";
const TX_PSY = "https://bhec.texas.gov/texas-state-board-of-examiners-of-psychologists/applying-for-a-psychology-license/how-to-become-a-licensed-psychologist/"; // doctoral degree in psychology + EPPP + JP exam
const COA = "https://www.coacrna.org/how-did-the-coa-determine-the-entrance-requirements-for-applicants-to-nurse-anesthesia-educational-programs-including-the-requirement-for-a-minimum-of-one-year-of-critical-care-experience/";
const COA_DOC = "https://www.coacrna.org/about-coa/position-statements/"; // from Jan 1, 2022 all students starting an accredited program must be enrolled in a doctoral program
const NBCRNA = "https://www.nbcrna.com/";
const TX_APRN = "https://www.bon.texas.gov/applications_advanced_practice_registered_nurse.asp.html"; // TLS error to fetchers; search snippet Nov 6: RN license, accredited APRN program, national certification in role + population focus
const AAVMC = "https://www.aavmc.org/wp-content/uploads/2024/11/AAVMC-Advisor-Guide-04.pdf"; // "most veterinary medical colleges participate in VMCAS" (search snippet)
const ONET = (soc: string) => `https://www.onetonline.org/link/summary/${soc}`;
const TCU_DNP_ADMIT = "https://graduate.catalog.tcu.edu/colleges/harris/dnp/postbaccbsntodnp"; // FNP, PMHNP: preferred 1 yr full-time RN; AGACNP: required 1 yr RN in inpatient acute care
const ARRT_PRIMARY = "https://www.arrt.org/pages/earn-arrt-credentials/initial-requirements/primary-requirements"; // associate's or higher + ARRT-approved program in the same discipline (radiography, sonography, MRI…)
const ARRT_HANDBOOK = "https://www.arrt.org/docs/default-source/handbooks/arrt-primary-handbook.pdf"; // 2026 handbook: didactic + program clinical requirements + ARRT's clinical competencies
const ASCO_PREREQ = "https://optometriceducation.org/wp-content/uploads/2024/04/ASCO-Prerequisites-2024.pdf"; // ASCO chart (April 2024) with a SHADOWING column per school
const OTCAS_OBS = "https://help.liaisonedu.com/OTCAS_Applicant_Help_Center/Filling_Out_Your_OTCAS_Application/Supporting_Information/02_Observation_Hours"; // OTCAS doesn't verify hours; programs set any minimum or documentation rule
const OTCAS_PROG = "https://help.liaisonedu.com/OTCAS_Applicant_Help_Center/Filling_Out_Your_OTCAS_Application/Program_Materials/OTCAS_Program_Materials"; // "Each program's requirements may vary"
// Respiratory therapy (draft Nov 6, 2026). Sources read Nov 6 unless marked.
const NBRC_RRT = "https://www.nbrc.org/examinations/rrt/"; // CoARC program + associate degree minimum; TMC/CSE; RT Exam from Jan 2027; "CRT and/or RRT ... basis for the licensure in all 49 states that regulate"
const NBRC_2027 = "https://www.nbrc.org/examination-changes-coming-in-2027-new-details-added/"; // single Respiratory Therapy Examination from Jan 2027: low cut = CRT, high cut = RRT; CSE through Dec 31, 2027 only for TMC high-cut passers before Dec 31, 2026
const COARC_REPORT = "https://coarc.com/wp-content/uploads/2026/03/Master-2025-CoARC-Report-on-Accreditation-2.23.26-TA-src.pdf"; // entry programs at associate, bachelor's, master's; 82% associate, 17% bachelor's, 7 master's (Dec 31, 2025)
const TX_RCP = "https://www.tmb.texas.gov/apply-renew/respiratory-care-practitioner/respiratory-care-practitioner-certificate-application"; // RCP certificate, temporary RCP, jurisprudence exam in fee
const TX_RCP_CHECK = "https://www.tmb.texas.gov/file/respiratory-care-practitioner-documentation-checklist-eligibility-requirements"; // certified program transcript, NBRC certificate, fingerprints
const TX_RCP_RULE = "https://www.law.cornell.edu/regulations/texas/22-Tex-Admin-Code-SS-187-10"; // 22 TAC 187.10: Texas Jurisprudence exam score of at least 75; 187.12: temporary permit before the national exam
const BLS_RT = "https://www.bls.gov/ooh/healthcare/respiratory-therapists.htm"; // associate's typical, some employers prefer bachelor's; supervised clinical training; some employers require RRT before hiring

// ---------- Nursing specialties: go BEFORE the "nursing" road ----------
export const NURSING_SPECIALTIES: Road[] = [
  { key: "crna", label: "Nurse anesthesia (CRNA)", parent: "nursing", field: /nurse anesthe|\bcrna\b|\bdnap\b/i, credentials: [
    { name: "RN license (NCLEX-RN)", need: "required", who: "Every nurse anesthetist is a registered nurse first.", why: "Nurse anesthesia programs only take licensed RNs.", learn: "Safe patient care across all of nursing.", when: "Right after your BSN", source: BON },
    { name: "National Certification Exam (NCE, from NBCRNA)", need: "required", who: "Every CRNA. Texas needs national certification before it gives you an APRN license.", why: "There is no separate state exam for APRNs; national certification is the test.", learn: "Anesthesia: pharmacology, airway, physiology, equipment.", when: "After you finish a doctoral nurse anesthesia program", source: NBCRNA },
    { name: "Texas APRN license (nurse anesthetist)", need: "required", who: "Anyone practicing as a CRNA in Texas.", why: "It's the state license for advanced practice nurses.", learn: "Texas APRN rules.", when: "After national certification", source: TX_APRN },
  ], steps: [
    { year: 4, what: "Finish your BSN and pass the NCLEX-RN", source: BON },
    { year: 5, what: "Work at least 1 year full-time as an RN in critical care (ICU); that's the accreditor's minimum, and many programs want more", source: COA },
    { year: 5, what: "Apply to a doctoral nurse anesthesia program: since Jan 1, 2022 every student starting an accredited program must be in a doctoral program. TCU offers one (DNAP)", source: COA_DOC },
    { year: 5, what: "Pass the NCE, then apply for your Texas APRN license", source: TX_APRN },
  ],
  skills: ["Anesthesia pharmacology", "Patient monitoring", "Critical thinking under pressure", "Airway management", "Physiology and chemistry", "Electronic health records (Epic)", "Clear communication with surgical teams"],
  skillsSource: ONET("29-1151.00") },

  { key: "nurse-practitioner", label: "Nurse practitioner (NP)", parent: "nursing", field: /nurse practitioner|\bfnp\b|\bnp\b|\baprn\b|\bpmhnp\b|\bagacnp\b/i, credentials: [
    { name: "RN license (NCLEX-RN)", need: "required", who: "Every NP is a registered nurse first.", why: "Texas only gives APRN licenses to RNs.", learn: "Safe patient care across all of nursing.", when: "Right after your BSN", source: BON },
    { name: "National NP certification (in your population: family, adult-gero, psych-mental health…)", need: "required", who: "Every NP. Texas requires national certification in the role and population you studied.", why: "Texas licenses APRNs on national certification; that exam is the test.", learn: "Diagnosis, treatment and prescribing for your population.", when: "After your NP program (master's or DNP)", source: TX_APRN },
    { name: "Texas APRN license (+ prescriptive authority)", need: "required", who: "Anyone practicing as an NP in Texas. Prescriptive authority is applied for with it.", why: "It's the state license; prescribing needs the added authority.", learn: "Texas APRN rules.", when: "After national certification", source: TX_APRN },
  ], steps: [
    { year: 4, what: "Finish your BSN and pass the NCLEX-RN", source: BON },
    { year: 5, what: "NP programs can ask for RN work experience first; check each one. TCU's BSN-to-DNP prefers a year as an RN for family and psych-mental health, and requires a year in inpatient acute care for adult-gero acute care", source: TCU_DNP_ADMIT },
    { year: 5, what: "NP program (master's or DNP) in your population focus. TCU offers BSN-to-DNP in family, adult-gero acute care and psych-mental health", source: TCU_GRAD },
    { year: 5, what: "Pass your national certification exam, then apply for the Texas APRN license", source: TX_APRN },
  ],
  skills: ["Patient assessment and diagnosis", "Pharmacology and prescribing", "Active listening", "Critical thinking", "Electronic health records (Epic, eClinicalWorks)", "Patient education", "Medical coding basics"],
  skillsSource: ONET("29-1171.00") },
];

// The nursing-road fix was applied in roads.ts. Not done yet: an optional year-5 nursing step, "Later: advanced practice (NP, CRNA)
// needs a graduate degree" (source TX_APRN).

// ---------- Replace the combined "health" road with these, in this order ----------
export const HEALTH_ROADS: Road[] = [
  { key: "radiologic", label: "Radiography and sonography", field: /radiolog(ic|y) (tech|science)|radiograph|sonograph|ultrasound tech|medical imaging|imaging science/i, credentials: [
    { name: "Texas Medical Radiologic Technologist certificate (GMRT)", need: "depends", who: "Needed to take X-rays (radiography) in Texas. Texas says no radiologic technologist license is needed for MRI, and it isn't one of the states that license sonographers.", why: "It's the state credential for doing radiologic procedures.", learn: "Radiation safety, positioning, imaging.", when: "After a radiologic technology program, once you hold ARRT (or NMTCB) certification", source: TX_MRT_CHECK },
    { name: "ARDMS sonography credential (RDMS, RDCS, RVT or RMSKS)", need: "depends", who: "Sonographers. Only 4 states license sonography and Texas isn't one, so this certification is what you can show; many employers hire only certified sonographers.", why: "It's the main proof you can do ultrasound.", learn: "Ultrasound physics plus a specialty (abdomen, OB/GYN, cardiac, vascular…).", when: "After a sonography program", source: SDMS_LIC }, // ARDMS credential names from ARDMS; "many employers hire only certified" from SDMS (search snippet)
  ], steps: [
    { year: 2, what: "Apply to a radiography or sonography program. For ARRT (radiography, or ARRT's sonography exam) it must be ARRT-approved and you need an associate degree or higher; ARDMS sets its own rules", source: ARRT_PRIMARY },
    { year: 4, what: "Clinical training inside the program. For ARRT you must pass the program's clinical requirements and ARRT's list of clinical competencies", source: ARRT_HANDBOOK },
    { year: 5, what: "Pass the ARRT exam (radiography) or an ARDMS exam (sonography); radiographers then apply for the Texas certificate", source: TX_MRT_CHECK },
  ],
  skills: ["Patient positioning and care", "Radiation safety", "Anatomy", "Imaging equipment operation", "Physics basics", "Electronic health records", "Clear communication with patients"],
  skillsSource: ONET("29-2034.00") },

  { key: "mls", label: "Medical laboratory science", field: /medical lab|clinical lab|laborator(y|ies) science/i, /* cytotechnology and MLT are separate ASCP credentials: no road */ not: /technician|technolog(y|ist)\b|\bmlt\b|librar/i, credentials: [
    { name: "ASCP Board of Certification: MLS(ASCP)", need: "depends", who: "Texas has no state license for lab scientists (10 states have one), so whether you need it is up to each employer; check the postings you want.", why: "It's the national certification for medical laboratory scientists.", learn: "Clinical chemistry, hematology, microbiology, blood banking, immunology.", when: "After your bachelor's and a NAACLS-accredited MLS program (finished within the last 5 years)", source: ASCP_MLS },
  ], steps: [
    { year: 2, what: "Chemistry and biology prerequisites; plan for a NAACLS-accredited MLS program", source: ASCP_MLS },
    { year: 4, what: "Clinical rotations in a hospital lab", source: "" },
    { year: 5, what: "Take the ASCP MLS exam; Texas doesn't add a state license", source: ASCLS },
  ],
  skills: ["Lab test procedures and quality control", "Chemistry and biology", "Microscopy", "Attention to detail", "Lab information systems", "Critical thinking", "Lab safety"],
  skillsSource: ONET("29-2011.00") },

  { key: "pre-pa", label: "Pre-PA", field: /\bpre-?p\.?a\.?\b|physicians?'?s?\.? (assist|asst|associate)|\bpa studies|\bpa school/i, credentials: [
    { name: "Hands-on patient care hours", need: "depends", who: "Many PA programs require them, and the hour rule differs by program. Most PA students had about three years of health care experience before starting.", why: "Programs want proof you've worked with patients.", learn: "Real patient care, as a CNA, EMT, medical assistant, scribe, phlebotomist or tech.", when: "Start early; it takes years to build", source: AAPA },
    { name: "GRE or PA-CAT", need: "depends", who: "Test rules differ by PA program: some want the GRE, some the PA-CAT, some take either (a few accept the MCAT). The PAEA program directory lists each one's rule.", why: "Programs that require it use it to compare applicants.", learn: "Reasoning and writing (GRE) or prerequisite science (PA-CAT).", when: "Before you apply, if a program on your list needs it", source: PAEA },
    { name: "PANCE (from NCCPA)", need: "required", who: "Every PA. Texas requires a passing PANCE and current NCCPA certification.", why: "It's the national certification exam.", learn: "Everything from PA school.", when: "After PA school", source: TX_PA },
    { name: "Texas PA license + jurisprudence exam", need: "required", who: "Anyone practicing as a PA in Texas: an accredited (ARC-PA) program, the PANCE, and a 75+ on the Texas jurisprudence exam.", why: "It's the state license.", learn: "Texas medical law.", when: "After the PANCE", source: TX_PA },
  ], steps: [
    { year: 1, what: "Typical prerequisites: anatomy, physiology, biochemistry, biology, microbiology, chemistry, organic chemistry, genetics, medical terminology, psychology, statistics, English composition; each program sets its own list", source: AAPA },
    { year: 1, what: "Start a hands-on patient care job (CNA, EMT, scribe, medical assistant) and shadow PAs", source: AAPA },
    { year: 3, what: "Apply through CASPA once your patient care hours are strong; most PA students had about three years of health care experience before starting", source: AAPA },
    { year: 5, what: "PA school, most about 27 months for a master's (TCU has one: Physician Associate Studies), then the PANCE and Texas license", source: AAPA },
  ],
  skills: ["Patient assessment", "Medical knowledge (biology, chemistry)", "Critical thinking", "Active listening", "Clinical documentation", "Electronic health records (Epic, eClinicalWorks)", "Medical terminology", "Team communication"],
  skillsSource: ONET("29-1071.00") },

  { key: "pre-pharmacy", label: "Pre-pharmacy", field: /pharmacy|pharmacist|\bpre-?pharm\b|\bpharm\.?d\b/i, not: /tech/i, credentials: [
    { name: "NAPLEX + Texas MPJE", need: "required", who: "Every pharmacist licensed in Texas.", why: "They're the national and state law exams for a pharmacist license.", learn: "Drug therapy (NAPLEX) and pharmacy law (MPJE).", when: "After your PharmD", source: TSBP },
    { name: "Pharmacist intern hours (1,740)", need: "required", who: "Every Texas pharmacist license by exam.", why: "Texas certifies a minimum of internship hours before licensing.", learn: "Real pharmacy practice, mostly inside PharmD rotations.", when: "During pharmacy school", source: TSBP },
  ], steps: [
    { year: 1, what: "Pharmacy prerequisites: each PharmD program asks for at least 2, 3 or 4 years of pre-pharmacy courses, and only some require a finished bachelor's, so check your target schools", source: AACP_STRUCT },
    { year: 2, what: "Some students work as pharmacy technicians to get experience", source: "", optional: true },
    { year: 2, what: "Apply through PharmCAS. The PCAT was retired on Jan 10, 2024, so ignore older advice to take it", source: AACP_PCAT },
    { year: 5, what: "PharmD, then the NAPLEX and the Texas MPJE", source: TSBP },
  ],
  skills: ["Pharmacology and drug interactions", "Chemistry", "Attention to detail", "Patient counseling", "Pharmacy software and records", "Math and dosage calculation", "Pharmacy law"],
  skillsSource: ONET("29-1051.00") },

  { key: "pre-dental", label: "Pre-dental", field: /\bdent(al|ist)|\bpre-?dent\b|\bd\.?d\.?s\b|\bd\.?m\.?d\b/i, not: /hygien|assist|lab(oratory)? tech|technician/i, credentials: [
    { name: "DAT (Dental Admission Test)", need: "required", who: "The dental school admission test, accepted by every U.S. dental school, and all of them ask for it.", why: "Schools use it to compare applicants.", learn: "Biology, general and organic chemistry, perceptual ability (spatial reasoning), reading and quantitative reasoning.", when: "Spring of junior year or the summer right after", source: DAT },
    { name: "INBDE + regional clinical exam + Texas jurisprudence assessment", need: "required", who: "Every dentist licensed in Texas. TSBDE currently validates clinical exam scores from ADEX and CRDTS-SRTA.", why: "They're the national board, the hands-on clinical exam and the state law test.", learn: "Everything from dental school, plus Texas dental law.", when: "During and after dental school", source: TSBDE },
  ], steps: [
    { year: 1, what: "Science prerequisites: biology, general and organic chemistry (what the DAT tests), plus whatever else your target schools list", source: DAT },
    { year: 2, what: "Shadow dentists; dental applicants typically report a lot of shadowing hours", source: ADEA_SHADOW }, // ADEA blog by dental students, not a rule page
    { year: 3, what: "Take the DAT in spring or summer", source: DAT },
    { year: 3, what: "Apply through ADEA AADSAS; Texas residents applying to Texas dental schools use TMDSAS", source: AADSAS },
    { year: 5, what: "Dental school (DDS or DMD), then the INBDE, a clinical exam and the Texas jurisprudence assessment", source: TSBDE },
  ],
  skills: ["Manual dexterity and spatial skill", "Biology and chemistry", "Patient communication", "Critical thinking", "Attention to detail", "Running a practice (staff, billing)", "Dental practice software"],
  skillsSource: ONET("29-1021.00") },

  { key: "pre-vet", label: "Pre-veterinary", field: /veterin|\bpre-?vet\b|\bd\.?v\.?m\b/i, not: /technician|technolog|\btech\b|assistant|nurs/i, credentials: [
    { name: "GRE", need: "depends", who: "Texas A&M's DVM program doesn't require it right now. Other vet schools set their own rules; check each one.", why: "Schools that require it use it to compare applicants.", learn: "Verbal and quantitative reasoning, writing.", when: "Before you apply, if a school on your list needs it", source: TAMU_DVM },
    { name: "Veterinary experience hours", need: "required", who: "Texas A&M won't interview you without more than 100 hours working under a veterinarian.", why: "Schools want proof you know the work.", learn: "Animal handling, clinic routines, what vets actually do.", when: "Start early; animal experience (4-H, shelters) counts separately", source: TAMU_DVM },
    { name: "NAVLE + Texas State Board Exam", need: "required", who: "Every veterinarian licensed in Texas.", why: "NAVLE is the national license exam; Texas adds its own State Board Exam (SBE).", learn: "Everything from vet school, plus Texas rules.", when: "During and after vet school", source: TBVME_SBE }, // NAVLE: TAMU_DVM_LIC
  ], steps: [
    { year: 1, what: "Prerequisite courses (Texas A&M lists 46 hours) and start animal and veterinary experience", source: "https://vetmed.tamu.edu/dvm/admissions/prerequisites/" },
    { year: 3, what: "Apply: Texas's two vet schools (including Texas A&M) use TMDSAS; most other vet schools use VMCAS", source: TMDSAS }, // VMCAS: AAVMC advisor guide (search snippet)
    { year: 5, what: "Vet school (DVM), then the NAVLE and Texas State Board Exam", source: TAMU_DVM_LIC },
  ],
  skills: ["Animal handling", "Biology and medicine", "Diagnosis and critical thinking", "Communicating with owners", "Surgery and lab work", "Practice software (IDEXX, AVImark)", "Calm under pressure"],
  skillsSource: ONET("29-1131.00") },

  { key: "pre-optometry", label: "Pre-optometry", field: /optometr|\bpre-?opt(om)?\b/i, not: /technician|assistant/i, credentials: [
    { name: "OAT (Optometry Admission Test)", need: "depends", who: "The usual optometry admission test, accepted by every U.S. optometry school. Check each school's rule for whether it's required.", why: "Schools use it to compare applicants.", learn: "Biology, general and organic chemistry, physics, reading, quantitative reasoning.", when: "Second semester of junior year or the summer after", source: OAT },
    { name: "NBEO Parts I–III + TMOD + Texas jurisprudence exam", need: "required", who: "Every optometrist licensed in Texas.", why: "They're the national boards and the state law exam.", learn: "Everything from optometry school, plus Texas rules.", when: "During and after optometry school", source: TOB },
  ], steps: [
    { year: 1, what: "Science prerequisites, including physics", source: OAT },
    { year: 2, what: "Shadow optometrists: some schools require a set number of hours and others strongly recommend it; ASCO's prerequisites chart lists each school's rule", source: ASCO_PREREQ },
    { year: 3, what: "Take the OAT, then apply through OptomCAS", source: OPTOMCAS },
    { year: 5, what: "Optometry school (OD), NBEO boards, Texas license", source: TOB },
  ],
  skills: ["Eye anatomy and optics", "Patient communication", "Diagnostic equipment", "Critical thinking", "Attention to detail", "Practice software (scheduling, billing)", "Science and math"],
  skillsSource: ONET("29-1041.00") },

  { key: "pre-pt", label: "Pre-physical therapy", field: /\bpre-?pt\b|physical therap|\bd\.?p\.?t\b/i, not: /assistant|\bpta\b/i, credentials: [
    { name: "GRE and observation hours", need: "depends", who: "Each DPT program sets its own rules for the GRE and PT observation hours; the PTCAS directory lists them.", why: "Programs that require them use them to compare applicants.", learn: "What PTs do in different settings (hospital, outpatient, rehab).", when: "Before you apply (junior year)", source: APTA },
    { name: "NPTE + Texas Jurisprudence Assessment Module (TX JAM)", need: "required", who: "Every physical therapist licensed in Texas.", why: "The NPTE is the national license exam; the JAM covers Texas rules.", learn: "Everything from your DPT, plus Texas PT law.", when: "After your DPT", source: TX_PT },
  ], steps: [
    { year: 1, what: "Take the prerequisites your DPT programs list (the PTCAS directory has each one's); most programs want a finished bachelor's", source: APTA },
    { year: 2, what: "Observe PTs, ideally in more than one setting; the PTCAS directory shows each program's observation-hour rule", source: APTA },
    { year: 3, what: "Apply through PTCAS", source: APTA },
    { year: 5, what: "DPT (usually three years), then the NPTE and TX JAM", source: TX_PT },
  ],
  skills: ["Anatomy and movement", "Exercise prescription", "Patient motivation and communication", "Active listening", "Clinical documentation", "Electronic health records", "Physical stamina"],
  skillsSource: ONET("29-1123.00") },

  { key: "pre-ot", label: "Pre-occupational therapy", field: /\bpre-?ot\b|occupational therap|\bo\.?t\.?d\b/i, not: /assistant|\bota\b/i, credentials: [
    { name: "Observation hours", need: "depends", who: "Some OT programs set a minimum number of observation hours or want them documented; OTCAS doesn't check them, so look up each program's rule.", why: "Programs want proof you know the work.", learn: "How OTs help people do daily tasks after injury, illness or disability.", when: "Sophomore and junior years", source: OTCAS_OBS },
    { name: "NBCOT exam (OTR)", need: "required", who: "Every occupational therapist. You need an entry-level OT degree (master's or doctorate) from an ACOTE-accredited program, with at least 960 fieldwork hours.", why: "It's the national certification exam.", learn: "Everything from your OT program.", when: "After your OT program", source: NBCOT },
    { name: "Texas OT license + jurisprudence exam", need: "required", who: "Every OT working in Texas.", why: "It's the state license; the 20-question open-book exam covers Texas OT rules.", learn: "Texas OT law.", when: "After the NBCOT exam", source: TX_OT },
  ], steps: [
    { year: 1, what: "Take the prerequisites your target OT programs list; each sets its own (OTCAS's Program Materials section shows them)", source: OTCAS_PROG },
    { year: 2, what: "Observe OTs; check whether your programs require a minimum number of hours or a signed form", source: OTCAS_OBS, optional: true },
    { year: 3, what: "Apply to a master's or doctorate (OTD); both are accredited entry routes to the same NBCOT exam. TCU offers an OTD", source: ACOTE },
    { year: 5, what: "OT program with fieldwork, then the NBCOT exam and Texas license", source: NBCOT },
  ],
  skills: ["Activity analysis and treatment planning", "Patient communication", "Psychology", "Active listening", "Clinical documentation", "Assistive technology", "Problem solving"],
  skillsSource: ONET("29-1122.00") },

  { key: "athletic-training", label: "Athletic training", field: /athletic train|\bmsat\b|movement science 3\s*\+\s*2/i, credentials: [
    { name: "Master's in athletic training (CAATE-accredited)", need: "depends", who: "The usual route: national BOC certification needs a CAATE-accredited program, and most employers want BOC-certified athletic trainers. Texas also still lists an apprenticeship route (a degree plus 1,800 hours under a licensed athletic trainer).", why: "It's how most athletic trainers get in now.", learn: "Injury prevention, evaluation, rehab, emergency care.", when: "After your bachelor's, or a 3+2 (TCU has one)", source: CAATE },
    { name: "Texas athletic trainer license (TDLR)", need: "required", who: "Anyone working as an athletic trainer in Texas. Passing the national BOC exam may let you skip Texas's own written and practical exams; everyone takes the Texas jurisprudence exam.", why: "It's the state license.", learn: "Athletic training practice plus Texas rules.", when: "After your master's", source: TX_AT },
  ], steps: [
    { year: 1, what: "Kinesiology or movement science coursework; TCU's Movement Science 3+2 leads to the MSAT", source: TCU_UG },
    { year: 3, what: "Apply to a CAATE master's (or move into the 3+2)", source: CAATE },
    { year: 5, what: "Clinical rotations, then the BOC exam and Texas license", source: TX_AT },
  ],
  skills: ["Injury evaluation", "Emergency care and CPR", "Rehab and taping", "Communicating with athletes and coaches", "Injury tracking software", "Concussion testing (ImPACT)", "Calm under pressure"],
  skillsSource: ONET("29-9091.00") },

  { key: "slp", label: "Speech-language pathology", field: /speech[- ]?language|speech,? language|speech pathol|speech (and|&) hearing|communication (sciences|disorders)|communicative disorders|\bslp\b|\bcosd\b/i, credentials: [
    { name: "Master's in speech-language pathology", need: "required", who: "Every SLP. A bachelor's in communication sciences alone doesn't make you an SLP.", why: "ASHA certification and the Texas license both need a graduate degree.", learn: "Language, speech, voice, fluency and swallowing disorders, with 400 supervised clinical hours.", when: "After your bachelor's", source: ASHA },
    { name: "Praxis exam in speech-language pathology", need: "required", who: "Needed for the full Texas SLP license and for ASHA certification.", why: "It's the national exam ASHA and Texas use.", learn: "Everything from your master's.", when: "Near the end of your master's", source: ASHA },
    { name: "Texas intern license, then SLP license (TDLR)", need: "required", who: "Texas requires the intern license (with the Texas jurisprudence exam) for your 36-week internship, then the full license.", why: "It's the state license. ASHA approving your Clinical Fellowship is not a license to practice in Texas.", learn: "Supervised practice: at least 36 weeks and 1,260 hours.", when: "After your master's", source: TX_SLP_INTERN },
    { name: "ASHA CCC-SLP", need: "depends", who: "ASHA's national certification; you can earn it with the same master's, Praxis and fellowship. Texas doesn't require it for the license.", why: "It's the national credential; Texas may waive its internship and Praxis rules for people who already hold it.", learn: "Same as above.", when: "After your clinical fellowship", source: ASHA }, // waiver: TX_SLP
    { name: "Texas SLP Assistant license", need: "optional", who: "For bachelor's grads who want to work in the field before (or instead of) a master's. Needs a communicative sciences or disorders bachelor's with at least 24 SLP/audiology hours, plus 25 observation and 25 assisting hours.", why: "It lets you work under a licensed SLP.", learn: "Therapy under supervision.", when: "After your bachelor's", source: TX_SLPA },
  ], steps: [
    { year: 2, what: "Get 25 hours of guided clinical observation (undergrad hours count); they're part of ASHA's 400 clinical hours", source: ASHA },
    { year: 3, what: "Apply to master's programs (TCU has an MS in Speech-Language Pathology and an MS in Bilingual Speech-Language Pathology)", source: TCU_GRAD },
    { year: 5, what: "Master's with clinical hours, then the Praxis", source: ASHA },
    { year: 5, what: "36-week internship (clinical fellowship) on a Texas intern license, then the full license and, if you want it, the ASHA CCC", source: TX_SLP },
  ],
  skills: ["Language and speech assessment", "Treatment planning", "Active listening", "Patient and family communication", "Clinical documentation", "Speech analysis software", "Patience and teaching skill"],
  skillsSource: ONET("29-1127.00") },

  { key: "pre-med", label: "Pre-med (MD or DO)", field: /\bpre-?med(ical)?\b|medical school|\bmedicine\b|physician|osteopath/i, not: /sports medicine|nuclear medicine|veterin|physicians?'?s?\.? (assist|asst|associate)|\bdent(al|ist)|\bpre-?dent|pharm|chinese medicine|integrative medicine|medicine,? health,? and society|humanit/i, credentials: [
    { name: "MCAT", need: "required", who: "Nearly all U.S. MD schools require it, and osteopathic (DO) schools use it too.", why: "Schools use it to compare applicants.", learn: "Biology, chemistry, physics, psychology and reading reasoning.", when: "Usually junior year, if you want to start right after graduating", source: MCAT }, // "nearly all": AAMC "What you need to know about the MCAT" (search snippet); DO: AACOM reports entering students' mean MCAT
    { name: "Clinical experience and shadowing", need: "depends", who: "Not a written rule everywhere, but medical schools look for clinical experience, and DO schools look for shadowing a DO. AAMC says shadowing helps but isn't the only way to get experience.", why: "It shows you know what doctors actually do.", learn: "Patient contact through volunteering, scribing or clinical jobs.", when: "Start in your first two years", source: AACOM },
    { name: "USMLE (MD) or COMLEX (DO) + Texas jurisprudence exam", need: "required", who: "Every doctor licensed in Texas. U.S. grads also need 1 continuous year of accredited residency first.", why: "They're the license exams.", learn: "Everything from medical school and residency, plus Texas medical law.", when: "During and after medical school", source: TMB_MD },
  ], steps: [
    { year: 1, what: "Prerequisites vary by school but usually include a year of biology, a year of physics, a year of English and two years of chemistry", source: AACOM },
    { year: 1, what: "Start clinical volunteering or a clinical job", source: AAMC_EXP },
    { year: 2, what: "Shadow physicians (DO schools look for a DO)", source: AACOM },
    { year: 2, what: "Research with a professor", source: "", optional: true },
    { year: 3, what: "MCAT, then apply: TMDSAS for Texas public medical schools, AMCAS or AACOMAS for others", source: TMDSAS },
    { year: 5, what: "Medical school, USMLE or COMLEX, at least 1 year of residency, then the Texas license", source: TMB_MD },
  ],
  skills: ["Biology and chemistry", "Critical thinking", "Active listening", "Patient communication", "Electronic health records (Epic)", "Medical reading and research", "Teamwork under pressure"],
  skillsSource: ONET("29-1215.00") },

  { key: "kinesiology", label: "Kinesiology and exercise science", field: /kinesiolog|exercise (science|physiology)|movement science|health (and|&) fitness|strength (and|&) conditioning|sport science|human performance/i, not: /teach|physical education(?!.*strength)/i, credentials: [
    { name: "CSCS (NSCA)", need: "optional", who: "For strength and conditioning coaching. You need a bachelor's in any field (college seniors can test) and CPR/AED. NSCA plans to eventually require a degree from a CASCE-accredited program; the start date has moved, so check NSCA's prerequisites page before you register.", why: "NSCA's strength and conditioning coach certification.", learn: "Program design, exercise technique, testing.", when: "Senior year or after", source: CSCS },
    { name: "ACSM Certified Exercise Physiologist (or Certified Personal Trainer)", need: "optional", who: "Fitness and clinical exercise jobs. The exercise physiologist exam needs a bachelor's in exercise science, exercise physiology or kinesiology, plus CPR/AED. From Aug 15, 2027, ACSM requires the degree to come from a CAAHEP-accredited program (graduates of other programs may qualify under a temporary exemption through Aug 14, 2029), so check whether yours is accredited.", why: "It shows you know safe exercise testing and programming.", learn: "Exercise testing and prescription.", when: "After your bachelor's", source: ACSM_EP },
  ], steps: [
    { year: 2, what: "Decide your direction: PT, OT, PA, athletic training and medicine all need graduate school (each has its own road); fitness and coaching jobs don't", source: "" },
    { year: 3, what: "Internship or job in a gym, clinic or athletics", source: "" },
    { year: 4, what: "Take the CSCS if you want strength and conditioning work", source: CSCS, optional: true },
  ],
  skills: ["Exercise testing and programming", "Anatomy and physiology", "Coaching and motivating clients", "CPR/AED", "Fitness and scheduling software", "Clear communication", "Microsoft Excel"],
  skillsSource: ONET("29-1128.00") },

  { key: "public-health", label: "Public health", field: /public health|epidemiolog|community health|global health|health promotion|health education/i, not: /teach|certif/i, credentials: [
    { name: "CHES (Certified Health Education Specialist)", need: "optional", who: "For health education jobs. You need a health education major, or at least 25 semester credits of qualifying health education coursework.", why: "It's the health education specialist certification from NCHEC.", learn: "Planning, running and evaluating health programs.", when: "Students can test if they'll graduate within 90 days of the exam date", source: CHES },
    { name: "Master of Public Health (MPH)", need: "depends", who: "Epidemiologists typically need at least a master's, often an MPH. Not every public health job needs one.", why: "It opens research, epidemiology and leadership roles.", learn: "Biostatistics, epidemiology, policy.", when: "After your bachelor's", source: BLS_EPI },
    { name: "CPH (Certified in Public Health)", need: "optional", who: "Students and grads of CEPH-accredited graduate programs, or anyone with a bachelor's plus 5 years of public health work.", why: "Shows broad public health knowledge.", learn: "All core areas of public health.", when: "During or after an MPH", source: CPH },
  ], steps: [
    { year: 2, what: "Statistics and a data tool (Excel, then R, SAS or Stata)", source: ONET("19-1041.00") },
    { year: 3, what: "Internship with a health department, hospital or nonprofit", source: "" },
    { year: 4, what: "The CHES, if you're going into health education; you can test when you're within 90 days of graduating", source: CHES, optional: true },
    { year: 5, what: "MPH if you want epidemiology or research", source: BLS_EPI, optional: true },
  ],
  skills: ["Program planning and evaluation", "Statistics (Excel, SAS, Stata, R)", "Writing and presenting", "Community outreach", "Data from CDC WONDER / Epi Info", "Survey design", "Public speaking"],
  skillsSource: ONET("21-1091.00") },

  { key: "health-admin", label: "Health administration", field: /health ?care (administration|management|admin)|health (services )?(administration|management|admin)|hospital admin|long-term care admin|nursing home admin|\bm\.?h\.?a\b/i, not: /information/i, credentials: [
    { name: "Texas Nursing Facility Administrator license", need: "depends", who: "Only to run a nursing home in Texas: a bachelor's, 12 credit hours in long-term care administration, a 1,000-hour administrator-in-training internship (some routes allow 500), and the national (NAB) and Texas exams.", why: "Texas HHSC requires it for that job (every state licenses nursing home administrators).", learn: "Long-term care rules, operations, finance.", when: "After college", source: TX_NFA },
    { name: "Master's in health administration (MHA, MBA or MPH)", need: "depends", who: "Entry jobs usually need a bachelor's; some employers prefer a master's, and top executive jobs may require one.", why: "It's a common path to senior leadership.", learn: "Health finance, operations, policy.", when: "After some work experience or right after college", source: BLS_MHSM },
  ], steps: [
    { year: 2, what: "Learn Excel and basic accounting; health management jobs work with budgets and data", source: ONET("11-9111.00") },
    { year: 3, what: "Internship in a hospital, clinic or health system office", source: "" },
    { year: 5, what: "Coordinator or analyst roles; a master's later if you want senior leadership", source: BLS_MHSM, optional: true },
  ],
  skills: ["Microsoft Excel", "Budgeting and finance", "Health care regulations and billing", "Electronic health records", "Leading teams", "Data analysis (SAS, SPSS, Tableau)", "Written communication"],
  skillsSource: ONET("11-9111.00") },

  // Plain "Psychology" does NOT get this road (Dilan's decision, Nov 6): most psychology majors don't become LPCs.
  // Only counseling and mental-health-counseling majors match. Addiction/substance-abuse counseling (Texas LCDC) and
  // school counseling (TEA certification) take different licenses, so they're excluded.
  { key: "counseling", label: "Counseling (LPC)", field: /counseling|counselor|\blpc\b/i, not: /industrial|organizational|genetic|financ|marriage|family therap|school (counsel|psych)|counseling psychology|addiction|substance|chemical dependency|\blcdc\b|career counsel|legal|general counsel|camp|admission|peer|resident|social work|criminal|pastoral|technician/i, credentials: [
    { name: "Master's degree in counseling", need: "required", who: "Needed to become a licensed counselor. A bachelor's alone doesn't lead to a counseling license.", why: "Texas requires a graduate degree in counseling or a counseling-related field for the LPC.", learn: "Counseling theory, ethics, assessment, supervised practicum.", when: "After your bachelor's", source: LPC },
    { name: "NCE or NCMHCE + Texas LPC jurisprudence exam", need: "required", who: "Everyone applying to be an LPC Associate in Texas.", why: "They're the national counseling exam and the state law exam.", learn: "Counseling practice and Texas rules.", when: "Near or after the end of your master's", source: LPC },
    { name: "LPC Associate → full LPC", need: "required", who: "Texas counselors work as LPC Associates first: 3,000 supervised hours over at least 18 months, 1,500 of them counseling clients directly.", why: "Only a full LPC can practice independently.", learn: "Real counseling under supervision.", when: "After your master's (about 2 years)", source: LPC },
    { name: "Licensed psychologist", need: "depends", who: "Only if you want to be a psychologist instead of a counselor: Texas requires a doctoral degree in psychology (with an internship), the EPPP and a jurisprudence exam.", why: "It's a different license from the LPC.", learn: "Research, assessment, therapy.", when: "After a PhD or PsyD", source: TX_PSY },
  ], steps: [
    { year: 2, what: "Statistics and research methods; join a professor's lab if you're considering a doctorate", source: "", optional: true },
    { year: 3, what: "Volunteer or work in a helping role (crisis line, case aide, behavior tech)", source: "" },
    { year: 4, what: "Apply to counseling master's programs; school counselors get a separate certification from TEA", source: TEXES },
    { year: 5, what: "Master's, NCE, jurisprudence exam, then LPC Associate hours toward the full LPC", source: LPC },
  ],
  skills: ["Active listening", "Counseling and therapy techniques", "Psychology", "Writing case notes", "Ethics and confidentiality", "Assessment tools", "Empathy and patience"],
  skillsSource: ONET("21-1014.00") },
  { key: "respiratory", label: "Respiratory therapy", field: /respiratory (therap|care)|cardio-?(pulmonary|respiratory) (science|care|therap|technolog)|\brrt\b/i, not: /physical therap|nurs|perfusion|virolog|microbio|pathogen|epidemiolog|public health/i, credentials: [
    { name: "CoARC-accredited respiratory therapy program", need: "required", who: "Every respiratory therapist. The NBRC exam is only open to graduates of a CoARC-accredited program with at least an associate degree.", why: "No accredited program, no national exam, and Texas needs both.", learn: "Anatomy and physiology, ventilators, oxygen and airway care, with supervised clinical training on patients.", when: "Usually 2 years (associate) or 4 (bachelor's)", source: NBRC_RRT }, // clinical training: BLS_RT
    { name: "NBRC Respiratory Therapy Exam (earns the CRT or the RRT)", need: "required", who: "Every respiratory therapist. From January 2027 it's one exam: the lower passing score earns the CRT, the higher one the RRT.", why: "It's the national credential for respiratory therapists.", learn: "Patient assessment, ventilator and oxygen therapy, airway care, clinical judgment.", when: "After you graduate from your program", source: NBRC_2027 }, // older two-exam system (TMC + Clinical Simulation Exam) ends Dec 31, 2026; CSE stays open through 2027 only for people who passed the TMC at the high cut score before then
    { name: "RRT (Registered Respiratory Therapist)", need: "depends", who: "Some employers require the RRT before hiring or within a set time after.", why: "It's the higher of the two NBRC credentials.", learn: "Same exam: it takes the higher passing score.", when: "On the NBRC exam (the higher passing score)", source: BLS_RT },
    { name: "Texas Respiratory Care Practitioner (RCP) certificate + jurisprudence exam", need: "required", who: "Anyone working as a respiratory therapist in Texas. The Texas Medical Board needs your program transcript (sent by the program), your NBRC certificate, fingerprints, and a passing score on the Texas jurisprudence exam.", why: "It's the state credential. A temporary certificate (good for up to a year, only after you graduate) can cover you before you pass the national exam.", learn: "Texas respiratory care law and rules.", when: "Right after the NBRC exam (or a temporary certificate just before)", source: TX_RCP }, // documents: TX_RCP_CHECK; 75 score: TX_RCP_RULE; temporary permit: 22 TAC 187.12
  ], steps: [
    { year: 1, what: "Apply to a CoARC-accredited respiratory therapy program: about 4 in 5 are associate degrees, about 1 in 6 bachelor's, and a few master's", source: COARC_REPORT },
    { year: 2, what: "Supervised clinical training with patients inside the program", source: BLS_RT },
    { year: 4, what: "Take the NBRC Respiratory Therapy Exam: the lower passing score earns the CRT, the higher one the RRT", source: NBRC_2027 },
    { year: 4, what: "Apply for the Texas RCP certificate: program transcript, NBRC certificate, fingerprints, and a 75 or better on the Texas jurisprudence exam", source: TX_RCP_RULE },
    { year: 5, what: "Started with an associate degree? Some employers prefer a bachelor's", source: BLS_RT, optional: true },
  ],
  skills: ["Ventilator and oxygen equipment setup", "Arterial blood gas testing", "Patient monitoring", "Emergency care and CPR", "Pulmonary function testing", "Patient and family education", "Electronic health records (MEDITECH, eClinicalWorks)", "Teamwork with physicians and nurses"],
  skillsSource: ONET("29-1126.00") },
];
