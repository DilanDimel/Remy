import { test } from "node:test";
import assert from "node:assert/strict";
import { englishMajor, foreignDegreeField, isPresent, sectionKind } from "./langs";
import { headingOf, majorsOf, primaryEducation, verifyAiDoc } from "./resume";
import { claimCheck } from "../ai/claims";
import { fieldMatch } from "../jobs/fit";

test("langs: section headings in other languages", () => {
  assert.equal(sectionKind("Formación académica"), "education");
  assert.equal(sectionKind("教育背景："), "education");
  assert.equal(sectionKind("Kinh nghiệm làm việc"), "experience");
  assert.equal(sectionKind("الخبرة العملية"), "experience");
  assert.equal(sectionKind("Опыт работы"), "experience");
  assert.equal(sectionKind("Research Assistant"), undefined);
  assert.equal(headingOf("학력")?.heading, "학력");
  assert.equal(headingOf("Maria went to school"), null);
});

test("langs: degrees, majors and present", () => {
  assert.equal(foreignDegreeField("Licenciatura en Enfermería"), "Enfermería");
  assert.equal(foreignDegreeField("Licenciatura en Ciencias de la Computación"), "Ciencias de la Computación");
  assert.equal(foreignDegreeField("Бакалавр наук"), "");
  assert.equal(foreignDegreeField("护理学理学学士"), "护理学");
  assert.equal(foreignDegreeField("B.S. Nursing"), null);
  assert.equal(englishMajor("Điều dưỡng"), "Nursing");
  assert.equal(englishMajor("Ingeniería Mecánica"), "Mechanical Engineering");
  assert.equal(englishMajor("Nursing"), "");
  assert.ok(isPresent("至今") && isPresent("Actualidad") && !isPresent("2026"));
  const edu = primaryEducation({ contact: {} as any, skills: [], sections: [{ id: "s", heading: "Educación", entries: [{ id: "e", org: "University of Houston", role: "Licenciatura en Enfermería", location: "", dates: "may 2027", bullets: [] }] }] });
  assert.equal(majorsOf(edu), "Enfermería");
  const ws: any = { profile: { major: "Enfermería", targetRoles: "", interests: "" } };
  assert.equal(fieldMatch(ws, { kind: "job", title: "Registered Nurse", postingText: "" } as any), true);
});

test("langs: the AI reading's check and the claims check read other scripts", () => {
  const raw = "王伟\n休斯顿\n工作经历\n在沃尔格林药房服务顾客";
  const ai = { contact: { name: "王伟", location: "波士顿" }, sections: [], skills: [] };
  assert.equal(verifyAiDoc(raw, ai).doc.contact.location, "");
  assert.equal(verifyAiDoc(raw, { ...ai, contact: { name: "王伟", location: "休斯顿" } }).doc.contact.location, "休斯顿");
  const orig = "在沃尔格林药房服务顾客";
  assert.ok(claimCheck(orig + "，并负责管理公司的社交媒体账号", raw, { original: orig }).length > 0);
  assert.equal(claimCheck(orig, raw, { original: orig }).length, 0);
  const ar = "خدمة العملاء في متجر تارجت";
  assert.ok(claimCheck(ar + " وأدرت حسابات الشركة على وسائل التواصل الاجتماعي", ar, { original: ar }).length > 0);
});
