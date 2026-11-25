import test from "node:test";
import assert from "node:assert/strict";
import { fileFromJson, MAX_UPLOAD } from "./upload";

test("reads a base64 file from the phone app", () => {
  const f = fileFromJson({ name: "resume.pdf", type: "application/pdf", data: Buffer.from("%PDF-1.4 hi").toString("base64") });
  assert.equal(f?.originalname, "resume.pdf");
  assert.equal(f?.mimetype, "application/pdf");
  assert.equal(f?.buffer.toString(), "%PDF-1.4 hi");
  assert.equal(f?.size, 11);
});

test("ignores missing or malformed files and refuses big ones", () => {
  assert.equal(fileFromJson(undefined), undefined);
  assert.equal(fileFromJson("x"), undefined);
  assert.equal(fileFromJson({ name: "a.pdf" }), undefined);
  assert.equal(fileFromJson({ name: "", data: "aGk=" }), undefined);
  assert.equal(fileFromJson({ name: "a.pdf", data: Buffer.alloc(MAX_UPLOAD + 1).toString("base64") }), null);
});
