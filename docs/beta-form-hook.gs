/**
 * Remy Founding Cohort form → Remy's Admin page, the moment someone submits.
 *
 * One-time setup (about 2 minutes, done by whoever owns the form, ideally remy.careercoach@gmail.com):
 *  1. Open the form in edit mode → ⋮ (top right) → "Apps Script".
 *  2. Delete what's there, paste this whole file, click Save.
 *  3. Left sidebar → ⚙ Project Settings → Script Properties → Add:
 *       REMY_HOOK_URL     https://remyai.org/api/beta/form-hook
 *       REMY_HOOK_SECRET  (the same long random value as OR_BETA_HOOK_SECRET on Render; ask Dilan)
 *  4. Left sidebar → ⏰ Triggers → Add Trigger → function "onSubmit", event source "From form",
 *     event type "On form submit" → Save, and allow the permissions Google asks for.
 *  5. Submit a test answer; it shows up on remyai.org/admin → Beta list within seconds.
 *
 * The secret stays in Script Properties (not in this code), so sharing the form or the script doesn't leak it.
 */
function onSubmit(e) {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty("REMY_HOOK_URL");
  var secret = props.getProperty("REMY_HOOK_SECRET");
  if (!url || !secret) throw new Error("Set REMY_HOOK_URL and REMY_HOOK_SECRET in Script Properties.");
  var answers = {};
  e.response.getItemResponses().forEach(function (r) {
    answers[r.getItem().getTitle()] = r.getResponse(); // checkbox answers arrive as a list
  });
  var res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { "x-beta-secret": secret },
    payload: JSON.stringify({ answers: answers }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) console.error("Remy didn't take the application: " + res.getResponseCode() + " " + res.getContentText());
}

/** Optional: run once by hand (▶ Run → sendAllExisting) to send answers that came in before the script was added. */
function sendAllExisting() {
  FormApp.getActiveForm().getResponses().forEach(function (response) { onSubmit({ response: response }); });
}
