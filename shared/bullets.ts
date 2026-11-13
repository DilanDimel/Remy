// What makes a resume bullet strong, shared by the resume checks (server/ats.ts) and the Review tab, so both judge
// a line the same way.
export const STRONG = /^(led|built|grew|launched|managed|created|designed|developed|analyz|organized|trained|presented|drove|owned|published|surveyed|coordinated|improved|increased|reduced|negotiated|founded|directed|executed|implemented|researched|modeled|forecast|automated|streamlined|delivered|won|raised|secured|mentored|wrote|produced|planned|conducted|evaluated|optimized|spearheaded|initiated|established|collaborated|supported|prepared|assisted|served|tutored|taught|volunteered|completed|calculated|reviewed|tracked|built)/i;
// Past-tense verbs ("Organized", "Pitched") count too, minus a few that aren't actions.
export const PAST_VERB = /^(?!(?:need|interest|based|located|expected|detailed|related|used)ed\b)[A-Z][a-z]{2,}ed\b/;
// Present tense is right for a current role ("Manage…", "Provide…").
export const PRESENT = /^(lead|build|grow|launch|manage|create|design|develop|analy[sz]e|organi[sz]e|train|present|drive|own|publish|coordinate|improve|increase|reduce|negotiate|direct|execute|implement|research|model|forecast|automate|deliver|raise|mentor|write|produce|plan|conduct|evaluate|optimi[sz]e|collaborate|support|prepare|serve|tutor|teach|run|oversee|maintain|review|track|provide|advise|facilitate|recruit|schedule|process|operate|handle|assist)s?\b/i;
export const isAction = (b: string) => STRONG.test(b) || PAST_VERB.test(b) || PRESENT.test(b);
export const WEAK = /^(responsible for|helped|assisted with|worked on|duties included|tasked with|was in charge of|handled|did)\b/i;
export const QUANT = /\d|%|\$/;
/** Coursework, honors and skills lines aren't achievement bullets. */
export const isListSection = (h: string) => /educ|skill|course|honou?r|award|interest|certif|language|activit/i.test(h);
