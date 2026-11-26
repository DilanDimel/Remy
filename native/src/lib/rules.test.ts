import { test } from "node:test";
import assert from "node:assert/strict";
import { accessFor, canGoFor, gateFor, redesignFor, themeOf } from "./rules.ts";
import { BETA_TERMS_VERSION, OPEN_TERMS_VERSION } from "../../../shared/beta.ts";

const me = (owner = false) => ({ id: "u1", email: "a@b.edu", owner }) as any;
const ws = (over: any = {}, settings: any = {}) => ({ betaAgreed: { version: BETA_TERMS_VERSION, at: "" }, onboarding: { done: true }, settings: { theme: "system", ...settings }, ...over }) as any;
const config = (over: any = {}) => ({ beta: { on: true, formUrl: "", open: false }, features: {}, ...over }) as any;

test("gate: the website's order", () => {
  assert.equal(gateFor("loading", null, null, null), "loading");
  assert.equal(gateFor("signed-out", null, null, config()), "sign-in");
  assert.equal(gateFor("error", null, null, config()), "sign-in");
  assert.equal(gateFor("beta-blocked", me(true), null, config()), "beta");
  assert.equal(gateFor("ready", me(true), ws(), null), "loading");
  assert.equal(gateFor("ready", me(true), ws({ betaAgreed: undefined }), config()), "terms");
  assert.equal(gateFor("ready", me(true), ws({ onboarding: { done: false } }), config()), "setup");
  assert.equal(gateFor("ready", me(true), ws(), config()), "tabs");
});

test("gate: open access has its own terms version", () => {
  assert.equal(gateFor("ready", me(true), ws(), config({ beta: { on: true, formUrl: "", open: true } })), "terms");
  assert.equal(gateFor("ready", me(true), ws({ betaAgreed: { version: OPEN_TERMS_VERSION, at: "" } }), config({ beta: { on: true, formUrl: "", open: true } })), "tabs");
});

test("gate: the app follows its own release switch; owners always get in", () => {
  // Owners only (the default): students see "The new app is almost here", even after The Big Upgrade is released.
  assert.equal(gateFor("ready", me(false), ws(), config()), "not-yet");
  assert.equal(gateFor("ready", me(false), ws(), config({ features: { redesign: "released", app: "owners" } })), "not-yet");
  assert.equal(gateFor("ready", me(true), ws({}, { ownerView: false }), config()), "tabs");
  // Released: students get in and go through terms and setup like everyone else.
  assert.equal(gateFor("ready", me(false), ws(), config({ features: { app: "released" } })), "tabs");
  assert.equal(gateFor("ready", me(false), ws({ onboarding: { done: false } }), config({ features: { app: "released" } })), "setup");
});

test("redesign and feature access follow releases like the website", () => {
  assert.equal(redesignFor(me(false), ws(), config()), false);
  assert.equal(redesignFor(me(false), ws(), config({ features: { redesign: "released" } })), true);
  assert.equal(redesignFor(me(true), ws(), config()), true);
  assert.equal(accessFor(me(false), ws(), config(), "interview"), "locked");
  assert.equal(accessFor(me(false), ws(), config(), "rewards"), "hidden");
  assert.equal(accessFor(me(false), ws(), config({ features: { community: "released" } }), "community"), "open");
  assert.equal(accessFor(me(true), ws(), config(), "interview"), "open");
  assert.equal(accessFor(me(true), ws({}, { ownerView: false }), config(), "interview"), "locked");
});

test("theme follows the account, else the phone", () => {
  assert.equal(themeOf({ theme: "system" }, true), "dark");
  assert.equal(themeOf({ theme: "system" }, false), "light");
  assert.equal(themeOf({ theme: "light", themeChosen: true }, true), "light");
  assert.equal(themeOf({ theme: "dark" }, false), "dark");
  assert.equal(themeOf(undefined, true), "dark");
});

test("canGo: students are never sent to a locked page; owners in owner view are", () => {
  assert.equal(canGoFor(me(false), ws(), config(), "/interview?job=j1"), false);
  assert.equal(canGoFor(me(false), ws(), config(), "/community"), false);
  assert.equal(canGoFor(me(false), ws(), config({ features: { interview: "released" } }), "/interview"), true);
  assert.equal(canGoFor(me(true), ws(), config(), "/interview"), true);
  assert.equal(canGoFor(me(true), ws({}, { ownerView: false }), config(), "/interview"), false);
  assert.equal(canGoFor(me(false), ws(), config(), "/resume?tab=base"), true);
});
