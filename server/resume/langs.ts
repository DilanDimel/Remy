// Resume words in the languages most spoken in the US after English (ACS 2023: Spanish, Chinese, Tagalog, Vietnamese,
// Arabic, French, Korean, Portuguese, Hindi, Russian, Haitian Creole). Lets the readers below find sections, months,
// "present", degrees and majors on a resume that isn't in English. Matched after `fold` (lower case, accents off).
import { fold } from "./parse";

type Kind = "education" | "experience" | "skills" | "languages" | "summary" | "activities" | "projects" | "awards" | "volunteer";
const SECTIONS: Record<Kind, string> = {
  education: "educación|formación académica|formación|estudios|教育背景|教育经历|教育|学历|edukasyon|pinag-aralan|học vấn|trình độ học vấn|giáo dục|التعليم|المؤهلات العلمية|المؤهل العلمي|formation|éducation|études|parcours académique|학력|학력사항|교육|formação|formação acadêmica|educação|escolaridade|शिक्षा|शैक्षिक योग्यता|शैक्षणिक योग्यता|образование|edikasyon|fòmasyon",
  experience: "experiencia|experiencia laboral|experiencia profesional|工作经历|工作经验|实习经历|实习经验|karanasan|karanasan sa trabaho|kinh nghiệm|kinh nghiệm làm việc|الخبرة|الخبرات|الخبرة العملية|الخبرة المهنية|expérience|expériences|expérience professionnelle|expériences professionnelles|경력|경력사항|경험|근무 경력|experiência|experiência profissional|अनुभव|कार्य अनुभव|опыт|опыт работы|eksperyans|eksperyans travay|eksperyans pwofesyonèl",
  skills: "habilidades|competencias|技能|专业技能|技能特长|kasanayan|mga kasanayan|kỹ năng|المهارات|compétences|기술|보유 기술|역량|스킬|competências|कौशल|навыки|ключевые навыки|konpetans|ladrès",
  languages: "idiomas|语言|语言能力|wika|mga wika|ngôn ngữ|ngoại ngữ|اللغات|langues|언어|외국어|línguas|भाषाएँ|भाषाएं|языки|знание языков|lang",
  summary: "resumen|perfil|objetivo|个人简介|自我评价|简介|个人总结|buod|layunin|tungkol sa akin|giới thiệu|mục tiêu|tóm tắt|نبذة شخصية|نبذة عني|الملخص|الهدف الوظيفي|profil|résumé|objectif|자기소개|소개|요약|resumo|सारांश|उद्देश्य|о себе|цель|резюме|rezime|objektif",
  activities: "actividades|课外活动|社团活动|校园活动|gawain|mga gawain|hoạt động|hoạt động ngoại khóa|الأنشطة|activités|vie associative|대외활동|활동|동아리|atividades|गतिविधियाँ|गतिविधियां|внеучебная деятельность|деятельность|aktivite",
  projects: "proyectos|项目经历|项目|mga proyekto|dự án|المشاريع|projets|프로젝트|projetos|परियोजनाएँ|проекты|pwojè",
  awards: "premios|获奖情况|荣誉奖项|奖项|mga parangal|giải thưởng|الجوائز|distinctions|prix|수상 경력|수상|prêmios|पुरस्कार|награды|prim",
  volunteer: "voluntariado|志愿者经历|boluntaryo|tình nguyện|التطوع|bénévolat|봉사활동|स्वयंसेवा|волонтерство|volontè",
};
const words = (s: string) => fold(s).split(/[\s&/+,]+/).map((w) => w.replace(/[^\p{L}-]/gu, "")).filter(Boolean).join(" ");
const KIND_OF = new Map<string, Kind>();
for (const [k, list] of Object.entries(SECTIONS) as [Kind, string][]) for (const p of list.split("|")) KIND_OF.set(words(p), k);
const CJK = /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Hangul}]/u;

/** "Formación académica", "教育背景：", "الخبرة العملية" → the kind of section; undefined for anything else. */
export function sectionKind(heading: string): Kind | undefined {
  const w = words(heading);
  if (!w || /\d/.test(heading)) return undefined;
  const hit = KIND_OF.get(w);
  if (hit) return hit;
  // A known heading inside a longer one: "工作与实习经历" has no spaces, "Experiencia laboral relevante" does.
  for (const [p, k] of KIND_OF) if (p.length > 1 && (CJK.test(p) ? w.includes(p) && w.length <= p.length + 4 : ` ${w} `.includes(` ${p} `) && w.split(" ").length <= p.split(" ").length + 2)) return k;
  return undefined;
}

// Month names and short forms by month (1 to 12), after fold. Chinese and Korean write months as numbers (6月, 6월).
export const MONTHS: string[][] = [
  "enero ene janvier janv janeiro jan enero enero ene thang1 th1 يناير كانون जनवरी январь января янв janvye",
  "febrero feb fevrier fevr fevereiro fev pebrero peb th2 فبراير شباط फरवरी февраль февраля февр фев fevriye",
  "marzo mar mars marco marso th3 مارس آذار मार्च март марта mas",
  "abril abr avril avr th4 أبريل ابريل نيسان अप्रैल апрель апреля апр avril",
  "mayo mai maio th5 مايو أيار ايار मई май мая me",
  "junio jun juin junho hunyo hun th6 يونيو حزيران जून июнь июня jen",
  "julio jul juillet juil julho hulyo hul th7 يوليو تموز जुलाई июль июля jiye jiy",
  "agosto ago aout th8 أغسطس اغسطس آب अगस्त август августа авг out",
  "septiembre setiembre sep sept septembre setembro set setyembre th9 سبتمبر أيلول सितंबर сентябрь сентября сент сен septanm",
  "octubre oct octobre outubro out oktubre okt th10 أكتوبر اكتوبر تشرين अक्टूबर октябрь октября окт oktob",
  "noviembre nov novembre novembro nobyembre nob th11 نوفمبر नवंबर ноябрь ноября нояб noyanm",
  "diciembre dic decembre dez dezembro disyembre dis th12 ديسمبر दिसंबर декабрь декабря дек desanm",
].map((m) => m.split(" ").map(fold));

// "Present" in a date range ("2024 – Actualidad", "2025年6月 – 至今").
const PRESENT = ["aujourd'hui", "a ce jour", "en cours", "actuel", "actuelle", "atual", "atualmente", "presente", "actualidad", "actual", "kasalukuyan", "hiện tại", "nay", "至今", "现在", "目前", "현재", "재직중", "حتى الآن", "الآن", "حاليا", "वर्तमान", "अब तक", "по настоящее время", "настоящее время", "по н.в.", "наст. вр.", "сейчас", "jodi a", "kounye a"].map(fold);
export const isPresent = (s: string) => { const f = fold(s).trim().replace(/[.\s]+$/, ""); return PRESENT.includes(f); };

// Degree words around the major: "Licenciatura en Enfermería", "Cử nhân Kế toán", "护理学理学学士", "간호학 학사".
const DEGREE_BEFORE = /^(?:licenciatura|licenciad[oa]|grado|maestr[ií]a|t[ií]tulo|bachiller(?:ato)?|licence|dipl[oô]me|bacharelado|mestrado|gradua[çc][ãa]o|batsilyer|c[ửu] nh[âa]n|th[ạa]c s[ĩi]|k[ỹy] s[ưu]|lisans|metriz|диплом|бакалавр|магистр|специалист|بكالوريوس|ماجستير|دبلوم)(?![\p{L}])(?:\s+(?:en|em|de|ng|sa|nan|du|des|da|do|ès|es)(?![\p{L}]))?(?:\s+(?:ciencias?|sciences?|ci[eê]ncias|agham|arts?|artes|lettres|syans|наук|العلوم|الآداب)\s*(?:,|(?:en|em|in|sa|nan|ès|по|في)(?![\p{L}])))?[\s,:]+/iu;
const DEGREE_AFTER = /(?:\s*(?:理学|文学|工学|管理学|经济学|医学|教育学|法学)?(?:学士|硕士|博士)(?:学位)?|\s*(?:학사|석사|박사)(?:\s*학위)?|\s+में\s+(?:बैचलर|स्नातक|मास्टर)(?:\s+ऑफ\s+\S+)?)\s*$/u;
const SCIENCE_ONLY = /^(?:ciencias?|sciences?|ci[eê]ncias|agham|arts?|artes|lettres|syans|наук|العلوم|الآداب)$/iu;
/** The major in a degree line written in another language; "" for a degree with no major ("Бакалавр наук"); null when the line isn't one. */
export function foreignDegreeField(p: string): string | null {
  const t = p.trim();
  if (DEGREE_BEFORE.test(t + " ") && (t + " ").match(DEGREE_BEFORE)![0].length >= t.length) return "";
  const before = t.match(DEGREE_BEFORE);
  if (before) { const rest = t.slice(before[0].length).trim(); return SCIENCE_ONLY.test(rest) ? "" : rest; }
  const after = t.match(DEGREE_AFTER);
  if (after) return t.slice(0, after.index).trim();
  return null;
}

// Majors in other languages → the English name Remy's matching knows. Each key matches at a word start.
const MAJORS: [string, string][] = [
  ["enfermeria|enfermagem|narsing|soins infirmiers|swen enfimye|dieu duong|护理|간호|التمريض|नर्सिंग|сестринск", "Nursing"],
  ["informatica|ciencias de la computacion|ciencia de la computacion|ciencia da computacao|ciencias da computacao|computacion|agham pangkompyuter|informatique|syans enfomatik|khoa hoc may tinh|cong nghe thong tin|计算机|컴퓨터|علوم الحاسوب|علوم الحاسب|कंप्यूटर विज्ञान|информатик|программн", "Computer Science"],
  ["contabilidad|contabilidade|ciencias contabeis|contaduria|accountancy|comptabilite|kontablite|ke toan|会计|회계|المحاسبة|लेखा|бухгалтер", "Accounting"],
  ["mercadotecnia|mercadeo|pagmemerkado|maketing|tiep thi|市场营销|营销|마케팅|التسويق|विपणन|маркетинг", "Marketing"],
  ["ingenieria mecanica|engenharia mecanica|inhinyeriyang mekanikal|genie mecanique|jeni mekanik|ky thuat co khi|机械工程|기계공학|الهندسة الميكانيكية|मैकेनिकल इंजीनियरिंग|машиностроен", "Mechanical Engineering"],
  ["psicologia|sikolohiya|psychologie|sikoloji|tam ly hoc|心理学|심리학|علم النفس|मनोविज्ञान|психолог", "Psychology"],
  ["biologia|biyolohiya|biologie|byoloji|sinh hoc|生物|생물|الأحياء|जीव विज्ञान|биолог", "Biology"],
  ["educacion primaria|educacao basica|pedagogia|edukasyong elementarya|enseignement primaire|edikasyon prime|giao duc tieu hoc|小学教育|초등교육|التعليم الابتدائي|प्राथमिक शिक्षा|начальное образование|педагог", "Elementary Education"],
  ["administracion de empresas|administracao de empresas|administracao|negocios|gestion des entreprises|quan tri kinh doanh|工商管理|경영학|إدارة الأعمال|व्यवसाय प्रशासन|менеджмент", "Business Administration"],
  ["finanzas|financas|tai chinh|金融|재무|المالية|वित्त|финанс", "Finance"],
  ["economia|economie|ekonomiks|kinh te|经济|경제|الاقتصاد|अर्थशास्त्र|экономик", "Economics"],
  ["ingenieria civil|engenharia civil|genie civil|ky thuat xay dung|土木工程|토목공학|الهندسة المدنية|सिविल इंजीनियरिंग|строительств", "Civil Engineering"],
  ["ingenieria electrica|engenharia eletrica|genie electrique|ky thuat dien|电气工程|전기공학|الهندسة الكهربائية|इलेक्ट्रिकल इंजीनियरिंग|электротехник", "Electrical Engineering"],
  ["comunicacion|comunicacao|komunikasyon|truyen thong|传播|커뮤니케이션|الاتصال|संचार|коммуникац", "Communication"],
  ["derecho|direito|droit|luat|法学|법학|القانون|कानून|юриспруденц", "Law"],
  ["medicina|medecine|y khoa|医学|의학|الطب|चिकित्सा|медицин", "Medicine"],
  ["quimica|kimika|chimie|hoa hoc|化学|화학|الكيمياء|रसायन|химия", "Chemistry"],
  ["matematicas|matematica|matematika|mathematiques|toan hoc|数学|수학|الرياضيات|गणित|математик", "Mathematics"],
  ["trabajo social|servico social|trabalho social|travail social|cong tac xa hoi|社会工作|사회복지|الخدمة الاجتماعية|समाज कार्य|социальн", "Social Work"],
  ["salud publica|saude publica|sante publique|y te cong cong|公共卫生|보건|الصحة العامة|सार्वजनिक स्वास्थ्य|общественное здоровье", "Public Health"],
];
const MAJOR_KEYS: [string[], string][] = MAJORS.map(([keys, en]) => [keys.split("|").map(fold), en]);

/** "Enfermería" → "Nursing", "Ingeniería Mecánica" → "Mechanical Engineering"; "" when Remy doesn't know it. */
export function englishMajor(major: string): string {
  const f = ` ${fold(major).replace(/đ/g, "d").replace(/[^\p{L}\s]/gu, " ").replace(/\s+/g, " ").trim()} `;
  if (f.trim().length < 2) return "";
  let best = "", len = 0;
  for (const [keys, en] of MAJOR_KEYS)
    for (const k of keys) {
      const hit = CJK.test(k) || /[^\p{sc=Latin}\s]/u.test(k) ? f.includes(k) : f.includes(` ${k}`);
      if (hit && k.length > len) { best = en; len = k.length; }
    }
  return f.includes(fold(best)) ? "" : best; // already English
}
