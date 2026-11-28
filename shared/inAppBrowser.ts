// Social apps open links in their own built-in browser, where Google refuses to sign anyone in
// ("Error 403: disallowed_useragent", since Sept 2021). Remy spots them so the sign-in page can lead with email.
const APPS: [RegExp, string][] = [
  [/Instagram/i, "Instagram"],
  [/FBAN|FBAV|FB_IAB|FBIOS|MessengerForiOS|Orca-Android/i, "Facebook"],
  [/musical_ly|Bytedance|TikTok/i, "TikTok"],
  [/Snapchat/i, "Snapchat"],
  [/LinkedInApp/i, "LinkedIn"],
];

/** The app whose built-in browser this is ("Instagram"), or null in a normal browser. */
export function inAppBrowser(ua: string): string | null {
  return APPS.find(([re]) => re.test(ua))?.[1] ?? null;
}
