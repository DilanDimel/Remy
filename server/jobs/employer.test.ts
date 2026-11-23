import { test } from "node:test";
import assert from "node:assert/strict";
import { hospitalFirst } from "@shared/employer";

test("hospital in the title becomes the employer", () => {
  const j = hospitalFirst({ title: "Palm Beach Health Network – Nurse Extern Opportunities", company: "Tenet Healthcare" });
  assert.deepEqual(j, { title: "Nurse Extern", company: "Palm Beach Health Network" });
  assert.equal(hospitalFirst({ title: "Delray Medical Center - Nurse Extern Opportunities", company: "Tenet Healthcare" }).company, "Delray Medical Center");
});

test("ordinary titles are left alone", () => {
  for (const title of ["Cath Lab Tech Extern", "Analyst - Corporate Finance", "Software Engineer – Backend"]) {
    assert.equal(hospitalFirst({ title, company: "Acme" }).title, title);
  }
});
