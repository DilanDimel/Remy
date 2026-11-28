import { test } from "node:test";
import assert from "node:assert/strict";
import { inAppBrowser } from "../../shared/inAppBrowser";

test("in-app browser: spots social apps' built-in browsers, not normal ones", () => {
  assert.equal(inAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22B83 Instagram 356.0.0.28.109 (iPhone15,3; iOS 18_1; en_US)"), "Instagram");
  assert.equal(inAppBrowser("Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0 Mobile Safari/537.36 Instagram 356.0.0.40.109 Android"), "Instagram");
  assert.equal(inAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22B83 [FBAN/FBIOS;FBAV/489.0.0.40.109;FBBV/1]"), "Facebook");
  assert.equal(inAppBrowser("Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/489.0.0.44.109;]"), "Facebook");
  assert.equal(inAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_37.5.0 JsSdk/2.0"), "TikTok");
  assert.equal(inAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"), null);
  assert.equal(inAppBrowser("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"), null);
  assert.equal(inAppBrowser(""), null);
});
