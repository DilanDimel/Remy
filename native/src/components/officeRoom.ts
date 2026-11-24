import { brand } from "@/lib/tokens";
import type { Colors } from "@/lib/theme";

/** What the room shows, from the same workspace fields the website's office reads (client/src/components/PathBoard.tsx). */
export type RoomState = {
  night: boolean;
  level: number; // unlocks OFFICE items (shared/game.ts) at their level
  items: string[]; // OFFICE keys unlocked at this level
  books: number; // jobs decoded, up to 8 books on the shelf
  resume: boolean;
  applied: boolean;
  cert: boolean;
  pins: string[]; // corkboard pin colours, best first
  rare: Set<string>; // rare finds from the daily chest
  streakDays: number;
  streakBest: number;
  now: Date;
  /** The filing cabinet, Remy's notes on you (AI memory), shown while his office guide is on. */
  notes?: boolean;
};

const hex = (h: string) => { const n = h.replace("#", ""); return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)); };
/** CSS `color-mix(in srgb, a p%, b)`, which react-native-svg can't read. */
export const mix = (a: string, b: string, p: number) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, i) => Math.round(v * p + y[i]! * (1 - p))).join(",")})`; };

/** Remy's office as two SVG layers in the website's room units (viewBox 0 40 860 420): the room behind him (`back`,
 *  up to his chair) and the furniture in front of him (`front`: desk, plant, lamp, laptop, mug, tall plant, briefcase).
 *  The fox sits between the two as his own view. A port of PathBoard.tsx's drawing with the colours resolved from the
 *  theme (day in light, night in dark); earned things appear in their slot, the rest show a dashed outline. */
export function roomXml(s: RoomState, c: Colors, part: "back" | "front") {
  const has = (k: string) => s.items.includes(k);
  const L = `stroke="${c.roomLine}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"`;
  const ghost = `fill="none" stroke="${c.roomLabel2}" stroke-opacity="0.7" stroke-width="2" stroke-dasharray="4 5"`;
  const O = c.roomObj, O2 = c.roomObj2, WOOD = c.roomWood, WOOD2 = c.roomWood2;
  const svg = (body: string) => `<svg viewBox="0 40 860 420" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

  if (part === "front") {
    return svg([
      `<rect x="322" y="350" width="296" height="56" rx="3" fill="${WOOD2}" ${L}/>`,
      `<path d="M532 362v32M542 378h40" stroke="${c.roomLine}" stroke-opacity=".45" stroke-width="2"/><circle cx="562" cy="378" r="3" fill="${c.roomLine}"/>`,
      `<rect x="310" y="334" width="320" height="16" rx="5" fill="${WOOD}" ${L}/>`,
      // the plant grows with the streak and blooms at 7 days in a row
      `<g transform="translate(2 34)"><path d="M330 300h36l-5-26h-26z" fill="${brand.schCamel}" ${L}/>`,
      s.streakDays > 0 ? `<path d="M348 274C348 250 334 240 326 232M348 270C352 248 366 238 376 236M348 262C346 244 348 228 350 218" stroke="${brand.schTweed}" stroke-width="4" fill="none" stroke-linecap="round"/>` : "",
      s.streakDays > 0 && s.streakBest >= 7 ? [[326, 230], [377, 235], [350, 215]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="${c.foxSoft}" stroke="${c.fox}" stroke-width="3"/>`).join("") : "",
      `</g>`,
      has("lamp") ? `<g transform="translate(370 282)">${s.night ? `<path d="M9 22L-6 52H52L37 22Z" fill="${c.roomGlow}" opacity=".22"/>` : ""}<path d="M10 52h26M23 52V22" ${L}/><path d="M8 22l8-16h14l6 16z" fill="${c.roomShade}" ${L}/></g>` : "",
      `<path d="M498 334l10-46h82l-10 46z" fill="${c.roomChair}" ${L}/>`,
      s.night ? `<path d="M508 288h82l-10 46h-82z" fill="${c.roomSky2}" opacity=".35"/>` : "",
      `<circle cx="544" cy="310" r="4" fill="${c.fox}"/><path d="M470 334h120" ${L} stroke-width="3"/>`,
      has("mug") ? `<g transform="translate(598 314)"><path d="M0 0h16v16a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4z" fill="${c.fox}" ${L}/><path d="M16 4h3a4 4 0 0 1 0 8h-3" fill="none" ${L}/><path d="M5-4q-3-5 0-9M11-4q3-5 0-9" stroke="${c.roomLabel2}" stroke-width="2" fill="none" stroke-linecap="round"/></g>` : "",
      has("bigplant") ? `<g transform="translate(806 368)"><path d="M0 70h40l-6-36H6z" fill="${O2}" ${L}/><path d="M20 34C20 10 2 0-6-10M20 34C20 10 38 0 46-10M20 34V-20" stroke="${brand.schTweed}" stroke-width="5" fill="none" stroke-linecap="round"/><ellipse cx="-6" cy="-12" rx="8" ry="4" fill="${brand.schTweed}" transform="rotate(-30 -6 -12)"/><ellipse cx="46" cy="-12" rx="8" ry="4" fill="${brand.schTweed}" transform="rotate(30 46 -12)"/><ellipse cx="20" cy="-22" rx="4" ry="8" fill="${brand.schTweed}"/></g>` : "",
      s.applied
        ? `<g transform="translate(60 386)"><path d="M26 0v-12h34v12" fill="none" ${L} stroke-width="4"/><rect width="86" height="60" rx="8" fill="${c.roomLeather}" ${L}/><path d="M0 22h86" stroke="${c.roomLine}" stroke-opacity=".5" stroke-width="2"/><rect x="37" y="16" width="12" height="12" rx="2" fill="${brand.schBulb}" ${L} stroke-width="1.5"/></g>`
        : `<g transform="translate(60 386)"><rect width="86" height="60" rx="8" ${ghost}/><path d="M26 0v-12h34v12" ${ghost}/></g>`,
    ].join(""));
  }

  const stars = [[578, 70], [636, 64], [704, 76], [748, 66], [764, 98], [690, 104], [596, 116], [728, 118], [654, 92]];
  const lit = [[576, 178], [584, 192], [600, 150], [604, 166], [599, 184], [638, 138], [648, 152], [640, 168], [650, 184], [678, 176], [686, 192], [718, 194]];
  const bookColors = [brand.schNavy, brand.schTweed, brand.schWine, brand.schCamel, c.fox, brand.schOx, brand.schKnit, brand.schBrown];
  const heights = [62, 54, 66, 58, 62, 52, 60, 56];
  const hh = ((s.now.getHours() % 12) + s.now.getMinutes() / 60) * 30, mm = s.now.getMinutes() * 6;
  return svg([
    `<defs><clipPath id="ps-win"><rect x="560" y="56" width="220" height="152" rx="6"/></clipPath>`,
    `<linearGradient id="ps-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.roomSky}"/><stop offset="1" stop-color="${c.roomSky2}"/></linearGradient>`,
    `<radialGradient id="ps-glow"><stop offset="0" stop-color="${c.roomGlow}" stop-opacity="0.5"/><stop offset="1" stop-color="${c.roomGlow}" stop-opacity="0"/></radialGradient>`,
    `<linearGradient id="ps-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.roomSky2}" stop-opacity="0.7"/><stop offset="1" stop-color="${c.roomSky2}" stop-opacity="0"/></linearGradient></defs>`,
    // the wall, a panel along the bottom, the wood floor
    `<rect x="0" y="40" width="860" height="312" fill="${c.roomWall}"/><rect x="0" y="296" width="860" height="56" fill="${c.roomWall2}"/>`,
    `<path d="M0 296H860" stroke="${c.roomLine}" stroke-opacity=".16" stroke-width="2"/><rect x="0" y="352" width="860" height="118" fill="${c.roomFloor}"/>`,
    `<path d="M0 386H860M0 424H860M0 460H860M120 352v34M380 386v38M610 352v34M250 424v36M720 424v36M520 460v10" stroke="${c.roomFloor2}" stroke-width="2"/>`,
    `<rect x="0" y="346" width="860" height="8" fill="${O2}" stroke="${c.roomLine}" stroke-width="2"/>`,
    s.night ? `<circle cx="393" cy="300" r="190" fill="url(#ps-glow)"/>` : `<path d="M560 354H780L736 470H500Z" fill="url(#ps-beam)"/>`,
    // the window: sun and clouds by day; moon, stars and lit windows at night
    `<rect x="552" y="48" width="236" height="168" rx="8" fill="${O}" ${L}/><rect x="560" y="56" width="220" height="152" rx="6" fill="url(#ps-sky)"/>`,
    `<g clip-path="url(#ps-win)">`,
    s.night
      ? stars.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 1.4 : 2}" fill="${c.roomSun}"/>`).join("") + `<path d="M606 76a14 14 0 1 0 0 28a6 14 0 1 1 0-28z" fill="${c.roomSun}"/>`
      : `<circle cx="606" cy="92" r="20" fill="${c.roomSun}" opacity=".3"/><circle cx="606" cy="92" r="14" fill="${c.roomSun}"/>`
        + `<path transform="translate(70 0)" d="M560 96a11 11 0 0 1 20-6a13 13 0 0 1 24 4a9 9 0 0 1 0 18h-40a8 8 0 0 1-4-16z" fill="${O}" opacity=".92"/>`
        + `<path transform="translate(150 0)" d="M560 74a8 8 0 0 1 14-4a10 10 0 0 1 18 3a7 7 0 0 1 0 14h-30a6 6 0 0 1-2-13z" fill="${O}" opacity=".8"/>`
        + `<path transform="translate(120 0)" d="M560 110q4-5 8 0q4-5 8 0" stroke="${c.roomLine}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    `<path d="M560 208V152h18v-14h16v30h14v-40h22v50h16v-24h20v34h18v-58h14v58h22v-30h16v30h24V208z" fill="${c.roomCity2}"/>`,
    `<path d="${has("skyline") ? "M570 208V140h24v-40h20v108h18V82h26v126h14v-80h22v80h20v-50h16v50h20V208z" : "M570 208V170h24v-30h20v68h18v-80h26v80h14v-40h22v40h20v-20h16v20h20V208z"}" fill="${c.roomCity}"/>`,
    s.night ? lit.map(([x, y]) => `<rect x="${x}" y="${y}" width="4" height="5" rx="1" fill="${c.roomGlow}"/>`).join("") : "",
    `</g>`,
    `<rect x="560" y="56" width="220" height="152" rx="6" fill="none" ${L}/>`,
    `<path d="M670 56V208M560 132H780" ${L} stroke-width="5" stroke="${O}"/><path d="M670 56V208M560 132H780" ${L} fill="none" stroke-width="1.5"/>`,
    `<rect x="544" y="204" width="252" height="10" rx="3" fill="${O}" ${L}/>`,
    // shelves: decoded jobs on top, the certificate frame, the trophy and the bonsai below
    heights.map((h, i) => {
      const x = 52 + i * 22;
      if (i >= s.books) return `<rect x="${x}" y="${178 - h}" width="18" height="${h}" rx="2" ${ghost}/>`;
      const tilt = i === 5 && s.books > 6 ? ` transform="rotate(-8 ${x + 18} 178)"` : "";
      return `<g${tilt}><rect x="${x}" y="${178 - h}" width="18" height="${h}" rx="2" fill="${bookColors[i]}" ${L}/><path d="M${x + 4} ${186 - h}h10M${x + 4} 170h10" stroke="${O}" stroke-opacity=".55" stroke-width="2"/></g>`;
    }).join(""),
    `<rect x="40" y="178" width="200" height="10" rx="3" fill="${WOOD}" ${L}/><rect x="40" y="268" width="200" height="10" rx="3" fill="${WOOD}" ${L}/>`,
    s.cert
      ? `<rect x="56" y="226" width="40" height="42" rx="3" fill="${WOOD2}" ${L}/><rect x="62" y="232" width="28" height="30" rx="1" fill="${O}"/><circle cx="76" cy="254" r="4" fill="${c.fox}"/><path d="M68 240h16M68 246h12" stroke="${c.roomLabel2}" stroke-width="2"/>`
      : `<rect x="56" y="226" width="40" height="42" rx="3" ${ghost}/>`,
    has("trophy") ? `<g transform="translate(130 228)"><path d="M14 6h16v8a8 8 0 0 1-16 0z" fill="${brand.schBulb}" ${L}/><path d="M14 9H9a5 5 0 0 0 5 6M30 9h5a5 5 0 0 1-5 6" fill="none" ${L}/><path d="M22 22v10M14 38h16" ${L}/></g>` : "",
    // streak milestones: a framed photo at 30 days in a row, gold at 100
    s.streakBest >= 30 ? `<g transform="translate(796 120)"><rect width="52" height="64" rx="3" fill="${s.streakBest >= 100 ? brand.schBulb : WOOD2}" ${L}/><rect x="7" y="7" width="38" height="50" rx="2" fill="${O}" stroke="${c.roomLine}" stroke-width="1.5"/><text x="26" y="34" text-anchor="middle" font-size="17" font-weight="800" fill="${c.fox}">${s.streakBest >= 100 ? 100 : 30}</text><text x="26" y="48" text-anchor="middle" font-size="9" font-weight="700" fill="${c.roomLabel2}">days</text></g>` : "",
    // rare finds from the daily chest
    s.rare.has("bonsai") ? `<g transform="translate(184 230)"><path d="M6 30h32l-4 8H10z" fill="${brand.schOx}" ${L}/><path d="M22 30c0-8-6-10-9-15M22 30c1-9 7-11 10-15" fill="none" ${L}/><circle cx="12" cy="13" r="8" fill="${brand.schTweed}"/><circle cx="32" cy="12" r="9" fill="${brand.schTweed}"/><circle cx="22" cy="6" r="7" fill="${brand.schTweed}"/></g>` : "",
    s.rare.has("pennant") ? `<g transform="translate(494 74)"><path d="M0 0v62" ${L}/><path d="M1 2l46 14-46 16z" fill="${c.fox}" ${L}/><path d="M9 11l20 6-20 7z" fill="${O}"/></g>` : "",
    s.rare.has("goldmug") ? `<g transform="translate(736 182)"><path d="M0 0h18v18a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4z" fill="${brand.schBulb}" ${L}/><path d="M18 5h4a4 4 0 0 1 0 8h-4" fill="none" ${L}/></g>` : "",
    s.rare.has("record") ? `<g transform="translate(670 372)"><rect width="78" height="30" rx="5" fill="${WOOD2}" ${L}/><ellipse cx="32" cy="2" rx="26" ry="7" fill="${brand.schBlack}" ${L}/><circle cx="32" cy="2" r="3" fill="${c.fox}"/><path d="M68-8l-12 12" ${L}/></g>` : "",
    // the framed resume
    s.resume
      ? `<g transform="translate(0 16)"><rect x="282" y="70" width="92" height="116" rx="4" fill="${WOOD2}" ${L}/><rect x="290" y="78" width="76" height="100" rx="2" fill="${O}"/><circle cx="304" cy="94" r="7" fill="${O2}" stroke="${c.roomLabel2}" stroke-width="1.5"/><path d="M316 90h36M316 98h24M298 114h56M298 124h48M298 134h54M298 146h40M298 156h50" stroke="${c.roomLabel2}" stroke-width="3" stroke-linecap="round"/></g>`
      : `<g transform="translate(0 16)"><rect x="282" y="70" width="92" height="116" rx="4" ${ghost}/></g>`,
    // the corkboard: every career pin earned, best first
    s.pins.length
      ? `<rect x="404" y="150" width="136" height="64" rx="4" fill="${mix(WOOD, O, 0.75)}" ${L}/>` + s.pins.slice(0, 8).map((col, i) => `<circle cx="${424 + (i % 4) * 32}" cy="${168 + Math.floor(i / 4) * 28}" r="9" fill="${col}" ${L}/>`).join("")
      : `<rect x="404" y="150" width="136" height="64" rx="4" ${ghost}/>`,
    has("painting") ? `<g transform="translate(410 50)"><rect width="70" height="54" rx="3" fill="${WOOD2}" ${L}/><rect x="6" y="6" width="58" height="42" fill="${c.roomSky2}"/><circle cx="48" cy="18" r="5" fill="${brand.schBulb}"/><path d="M6 48l18-22 14 16 9-9 17 15z" fill="${brand.schTweed}"/></g>` : "",
    has("clock") ? `<g transform="translate(818 64)"><circle r="20" cx="0" cy="20" fill="${O}" ${L}/><circle r="1.6" cx="0" cy="4" fill="${c.roomLine}"/><circle r="1.6" cx="0" cy="36" fill="${c.roomLine}"/><circle r="1.6" cx="16" cy="20" fill="${c.roomLine}"/><circle r="1.6" cx="-16" cy="20" fill="${c.roomLine}"/><path d="M0 20V11" ${L} transform="rotate(${hh} 0 20)"/><path d="M0 20V6" ${L} stroke-width="1.8" transform="rotate(${mm} 0 20)"/><circle r="2.2" cx="0" cy="20" fill="${c.fox}"/></g>` : "",
    has("rug") ? `<ellipse cx="470" cy="432" rx="230" ry="30" fill="${mix(brand.schNavy, c.roomFloor, 0.6)}" stroke="${c.roomLine}" stroke-width="2.5"/><ellipse cx="470" cy="432" rx="200" ry="20" fill="none" stroke="${O}" stroke-opacity=".5" stroke-width="2" stroke-dasharray="6 6"/>` : "",
    has("globe") ? `<g transform="translate(724 358) scale(1.4)"><path d="M10 56h24M22 44v12" ${L}/><path d="M4 22a18 18 0 0 0 36 0" fill="none" ${L} stroke="${WOOD2}" stroke-width="4"/><circle cx="22" cy="22" r="18" fill="${c.roomSky}" ${L}/><path d="M10 12c4-3 9-2 10 2s-3 5-1 8-2 6-5 5-6-6-5-10z" fill="${brand.schTweed}"/><path d="M27 9c4 1 8 5 8 9-3 1-5-1-7 1s-3 4-5 2 0-5 1-7-1-4 3-5z" fill="${brand.schTweed}"/><path d="M26 30c3-1 6-1 7 1-1 3-5 4-7 3z" fill="${brand.schTweed}"/><circle cx="22" cy="22" r="18" fill="none" ${L}/></g>` : "",
    // the filing cabinet: Remy's notes on you (AI memory); his quick questions about your account live here
    s.notes ? `<rect x="642" y="274" width="62" height="78" rx="4" fill="${WOOD2}" ${L}/><rect x="650" y="282" width="46" height="28" rx="2" fill="${O}" ${L} stroke-width="2"/><rect x="650" y="316" width="46" height="28" rx="2" fill="${O}" ${L} stroke-width="2"/><path d="M666 296h14M666 330h14" ${L} stroke-width="3"/><rect x="654" y="256" width="36" height="18" rx="2" fill="${c.foxSoft}" ${L} stroke-width="2"/>` : "",
    // his chair
    `<path d="M398 340V262c0-22 14-34 57-34s57 12 57 34v78z" fill="${c.roomChair}" ${L}/>`,
    `<path d="M414 330V266c0-12 10-22 41-22s41 10 41 22v64" fill="none" stroke="${O}" stroke-opacity=".22" stroke-width="2.5"/><path d="M430 256h50" stroke="${O}" stroke-opacity=".22" stroke-width="2.5" stroke-linecap="round"/>`,
  ].join(""));
}
