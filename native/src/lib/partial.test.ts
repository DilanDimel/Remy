import { test } from "node:test";
import assert from "node:assert/strict";
import { tidyPartial } from "./partial.ts";

test("tidyPartial hides an unfinished bold marker while the reply is written", () => {
  assert.equal(tidyPartial("• **Highlight your Poly"), "• Highlight your Poly");
  assert.equal(tidyPartial("• **Lead** with it. • **Show"), "• **Lead** with it. • Show");
  assert.equal(tidyPartial("Done **bold**"), "Done **bold**");
  assert.equal(tidyPartial("Start *"), "Start ");
  assert.equal(tidyPartial("Plain text"), "Plain text");
});
