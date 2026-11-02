// How an employer's application system handles a resume, so students know what to watch for. Only what these
// systems are documented to do in general; Remy can't see any one employer's settings, and says so.
export type Screening = { system: string; steps: string[]; tips: string[] };

const GUIDE: Record<string, Screening> = {
  workday: { system: "Workday", steps: ["You create an account on the employer's Workday site.", "Workday reads your uploaded resume and pre-fills the form (jobs, dates, school).", "Employers can add screening questions, like work authorization or graduation date, that can sort applications before a person reads them.", "Recruiters can search applicants by keywords."],
    tips: ["Check every pre-filled field: columns, tables and text boxes are often read wrong.", "Use the same job titles and skill words as the posting where they're true for you.", "Answer screening questions exactly; they matter more than formatting."] },
  greenhouse: { system: "Greenhouse", steps: ["You usually apply without making an account.", "Your resume file is attached as you uploaded it, and recruiters typically open that file.", "Employers can add their own questions, and many use interview scorecards."],
    tips: ["Your real layout is what people see, so a clean design is fine.", "Use the posting's own words for skills you really have; recruiters search by them.", "Fill in optional questions; they're often read."] },
  lever: { system: "Lever", steps: ["You apply without an account.", "Lever reads your resume to fill in your profile, and recruiters can also open the original file.", "Employers can add custom questions."],
    tips: ["Keep contact details in the body, not a header, so they're picked up.", "Mirror the posting's wording for skills you really have."] },
  ashby: { system: "Ashby", steps: ["You apply on a short form with your resume attached.", "Recruiters review applications in Ashby; some employers turn on AI-assisted features, and Remy can't tell which."],
    tips: ["Answer every form question; short forms make each answer count.", "Keep your resume one column so it reads cleanly either way."] },
  smartrecruiters: { system: "SmartRecruiters", steps: ["You can fill the form from your resume or LinkedIn.", "Employers can add screening questions that sort applications."],
    tips: ["Check what was pulled in from your resume before you submit.", "Answer screening questions exactly."] },
  oracle: { system: "Oracle Recruiting", steps: ["You usually create an account.", "Your resume is read into the form, and employers can add questions that can screen applications out."],
    tips: ["Re-check dates and titles after the form fills in.", "Answer yes/no eligibility questions carefully; they can end an application."] },
  taleo: { system: "Taleo", steps: ["You create an account and fill a longer form.", "Your resume is read into fields, and screening questions can rank or filter applications."],
    tips: ["Plan 20–30 minutes; save as you go.", "Keep your resume simple (one column, standard headings) so the fields fill correctly."] },
  icims: { system: "iCIMS", steps: ["You create an account; your resume is read into a profile.", "Employers can add screening questions."],
    tips: ["Check the profile iCIMS builds from your resume before submitting."] },
  usajobs: { system: "USAJOBS", steps: ["Federal applications follow their own rules, written in each posting's “How to apply” section.", "A questionnaire and the details in your resume decide whether you're rated qualified."],
    tips: ["Give month/year dates and hours per week for every job.", "Follow the posting's resume length and document rules exactly.", "Only rate yourself “expert” in the questionnaire where your resume shows it."] },
};

/** Which system an opening uses, from where Remy found it or its apply link. */
export function screeningFor(job: { sourceName?: string; applyUrl?: string; sourceUrl?: string }): Screening | null {
  const hay = `${job.sourceName || ""} ${job.applyUrl || ""} ${job.sourceUrl || ""}`.toLowerCase();
  const key = /myworkdayjobs|\bworkday\b/.test(hay) ? "workday" : /greenhouse/.test(hay) ? "greenhouse" : /lever\.co|\blever\b/.test(hay) ? "lever"
    : /ashby/.test(hay) ? "ashby" : /smartrecruiters/.test(hay) ? "smartrecruiters" : /taleo/.test(hay) ? "taleo" : /oraclecloud|\boracle\b/.test(hay) ? "oracle"
    : /icims/.test(hay) ? "icims" : /usajobs/.test(hay) ? "usajobs" : "";
  return key ? GUIDE[key] : null;
}
