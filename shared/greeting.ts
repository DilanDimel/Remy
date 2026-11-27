/** The greeting for a local hour. Late at night (10 PM to 4 AM) it's a plain "Hey": "Good evening" at 11 PM felt off,
 *  and "Good night" sounds like goodbye (Dilan, Nov 27). Used on Home, the owners' board and Remy's chat, web and app. */
export function greetingFor(h: number): string {
  return h >= 22 || h < 4 ? "Hey" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
