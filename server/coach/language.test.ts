import { test } from "node:test";
import assert from "node:assert/strict";
import { chosenLanguage, deviceLanguage, hasScreens, replyIn, translate } from "@shared/i18n";

test("device language picks the first one Remy speaks", () => {
  assert.equal(deviceLanguage(["es-MX", "en-US"]), "es");
  assert.equal(deviceLanguage(["de-DE", "zh-Hant-TW"]), "zh");
  assert.equal(deviceLanguage(["fil-PH"]), "tl");
  assert.equal(deviceLanguage(["de-DE"]), "en");
  assert.equal(deviceLanguage(undefined), "en");
});

test("auto follows the device, a pick wins, bad codes fall back to English", () => {
  assert.equal(chosenLanguage({ deviceLanguage: "vi" }), "vi");
  assert.equal(chosenLanguage({ language: "auto", deviceLanguage: "vi" }), "vi");
  assert.equal(chosenLanguage({ language: "ko", deviceLanguage: "vi" }), "ko");
  assert.equal(chosenLanguage({ language: "xx" }), "en");
  assert.equal(chosenLanguage(undefined), "en");
});

test("screens translate with a word list and keep English otherwise", () => {
  assert.equal(translate("es", "Home"), "Inicio");
  assert.equal(translate("es", "Best {n}", { n: 4 }), "Récord 4");
  assert.equal(translate("es", "No such string"), "No such string");
  assert.equal(translate("zh", "Home"), "Home");
  assert.ok(hasScreens("es") && hasScreens("en") && !hasScreens("zh"));
});

test("Remy's prompt asks for the language but keeps resume words in English", () => {
  assert.equal(replyIn("en"), "");
  assert.match(replyIn("es"), /Spanish/);
  assert.match(replyIn("ar"), /exactly as written/);
});
