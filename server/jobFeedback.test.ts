import { test } from "node:test";
import assert from "node:assert/strict";
import { keepNewerJobFeedback } from "../client/src/lib/jobFeedback";
import { emptyWorkspace } from "./platform/db";
import type { JobInterest, Workspace } from "../shared/types";

const interest = (rating: JobInterest["rating"]): JobInterest => ({
  rating, createdAt: "2026-11-03T12:00:00.000Z", updatedAt: "2026-11-03T12:00:00.000Z",
  context: { rankingVersion: "test", profileKey: "test", capturedAt: "2026-11-03T12:00:00.000Z",
    profile: { major: "", targetRoles: "", interests: "", classYear: "", regions: "", opportunityTypes: "" },
    job: { title: "Synthetic opening", company: "Synthetic employer", location: "", format: "", kind: "job" } },
});
const snapshot = (version: number, feedback: Record<string, JobInterest>): Workspace => ({
  ...emptyWorkspace(), jobFeedbackVersion: version, jobFeedback: feedback,
});

test("late rating response keeps both ratings from the newer response", () => {
  const first = snapshot(1, { a: interest(5) });
  const second = snapshot(2, { a: interest(5), b: interest(2) });
  const state = keepNewerJobFeedback(second, first, "student-a", "student-a");
  assert.equal(state.jobFeedbackVersion, 2);
  assert.deepEqual(state.jobFeedback, second.jobFeedback);
  assert.deepEqual(first.jobFeedback, { a: interest(5) });
});

test("a delayed save of another section updates that section without erasing newer interest", () => {
  const newest = snapshot(2, { a: interest(4) });
  const oldSave = snapshot(1, {});
  oldSave.profile.targetRoles = "Accounting intern";
  const state = keepNewerJobFeedback(newest, oldSave, "student-a", "student-a");
  assert.equal(state.profile.targetRoles, "Accounting intern");
  assert.equal(state.jobFeedback?.a.rating, 4);
  assert.equal(state.jobFeedbackVersion, 2);
});

test("a newer reset stays empty when a pre-reset response arrives", () => {
  const before = snapshot(3, { a: interest(5) });
  const reset = snapshot(4, {});
  assert.equal(keepNewerJobFeedback(before, reset, "student-a", "student-a"), reset);
  const state = keepNewerJobFeedback(reset, before, "student-a", "student-a");
  assert.deepEqual(state.jobFeedback, {});
  assert.equal(state.jobFeedbackVersion, 4);
});

test("another account starts with its own feedback even when its revision is lower", () => {
  const previous = snapshot(50, { privateA: interest(5) });
  const next = snapshot(1, { privateB: interest(1) });
  const state = keepNewerJobFeedback(previous, next, "student-a", "student-b");
  assert.equal(state, next);
  assert.equal(state.jobFeedback?.privateA, undefined);
  assert.equal(keepNewerJobFeedback(null, next, null, "student-b"), next);
});

test("an older workspace without feedback fields cannot undo a newer rating", () => {
  const state = keepNewerJobFeedback(snapshot(1, { a: interest(3) }), emptyWorkspace(), "student-a", "student-a");
  assert.equal(state.jobFeedbackVersion, 1);
  assert.equal(state.jobFeedback?.a.rating, 3);
});
