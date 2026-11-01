// Requirement "keywords" that are really eligibility labels or headings ("Minimum GPA", "Eligible majors", "Core skills"):
// eligibility is checked separately, so these are never shown as skills or counted as gaps.
const LABEL = /\b(gpa|grade point|majors?|academic standing|class (year|standing)|graduat\w*|enroll\w*|degree|work authori[sz]ation|citizenship|sponsorship|eligib\w*)\b|^(core|key|required|preferred|minimum|basic)?\s*(skills|qualifications|requirements)$/i;
export const isSkill = (keyword: string) => !LABEL.test(keyword.trim());
