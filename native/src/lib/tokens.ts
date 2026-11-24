// Remy design tokens for the phone app, generated from client/src/index.css on 2026-11-24 (main 3ec312b) by the lead AI's handoff.
// Website rule: colours come from these tokens only ("paper, ink, one orange"). In owner view / after The Big Upgrade,
// the light page background is --paper (#f5f5f3) (`.redesign-2:not([data-theme=dark]) { --bg: var(--paper) }`).
// Regenerate when index.css changes (see 03-design-tokens.md). Legacy names: plum = ink colour, lav = subtle fill.

/** Same in light and dark. */
export const brand = {
  white: "#ffffff",
  black: "#000000",
  stage: "#161616",
  stage2: "#1c1c1c",
  stage3: "#121212",
  stageDeep: "#111111",
  paper: "#f5f5f3",
  schFur: "#e86a2a",
  schCream: "#fff7ed",
  schInk: "#1a120b",
  schEar: "#3a2317",
  schLine: "#5a2a12",
  schSuit: "#2b2f36",
  schLapel: "#1f2328",
  schTie: "#b4471c",
  schCheek: "#f59e8b",
  schShirt: "#ffffff",
  schBlack: "#1f1f1f",
  schTweed: "#2f5d46",
  schTweed2: "#24493a",
  schBrown: "#7a4424",
  schNavy: "#22324f",
  schNavy2: "#1a2740",
  schWine: "#8e2b2b",
  schCamel: "#b88a5a",
  schCamel2: "#9c7248",
  schKnit: "#6b5b4b",
  schKnit2: "#5a4b3d",
  schOx: "#6e2a2a",
  schOx2: "#561f1f",
  schVest: "#c9b79c",
  schBulb: "#ffd66b",
  foxLight: "#ff8a4c",
  foxHot: "#e2632a",
  fox700: "#c2410c",
  fox800: "#9a3412",
  linkedin: "#0a66c2",
  online: "#22a35a",
  paperHlAction: "#fbc4b4",
  paperHlHard: "#fde0a6",
  paperHlSoft: "#fdf3a7",
  paperHlNumber: "#c9efc0",
  paperHlResult: "#c7e2fb",
} as const;

/** Light theme (day). */
export const light = {
  roomWall: "#efe8dc",
  roomWall2: "#e6ddcf",
  roomFloor: "#d8c2a2",
  roomFloor2: "#c6ab85",
  roomLine: "#2b2420",
  roomObj: "#fffdf8",
  roomObj2: "#ece4d6",
  roomWood: "#c9a57c",
  roomWood2: "#b38e64",
  roomSky: "#9fcdf0",
  roomSky2: "#e3f1fb",
  roomSun: "#ffd66b",
  roomCity: "#8fb3cf",
  roomCity2: "#c6dcec",
  roomChair: "#343a44",
  roomLeather: "#7b4f33",
  roomLabel: "#2b2420",
  roomLabel2: "#74695e",
  roomGlow: "#ffd27a",
  roomShade: "#fbe7b0",
  hlAction: "#fbc4b4",
  hlHard: "#fde0a6",
  hlSoft: "#fdf3a7",
  hlNumber: "#c9efc0",
  hlResult: "#c7e2fb",
  gemRuby: "#c8364a",
  gemGold: "#c98a0b",
  gemGreen: "#2f9e5a",
  gemTeal: "#12907f",
  gemSky: "#2b8fd6",
  gemBlue: "#3b5bdb",
  gemViolet: "#7c4dcc",
  gemPink: "#d24b8a",
  metalBronze: "#b0703c",
  metalSilver: "#a3acb5",
  metalGold: "#d9a514",
  bg: "#f5f5f3",
  surface: "#ffffff",
  surface2: "#f5f4f1",
  ink: "#161616",
  mutedText: "#5f5f5f",
  faint: "#8a8a85",
  plum: "#161616",
  plumDark: "#000000",
  plumInk: "#ffffff",
  lav: "#efefec",
  lav2: "#f5f4f1",
  line: "#e3e1dc",
  fox: "#e86a2a",
  foxDeep: "#c2410c",
  foxSoft: "#fdecdf",
  sage: "#15803d",
  sageBg: "#dcfce7",
  amber: "#8a6108",
  amberBg: "#fbf0d3",
  error: "#b42318",
  errorBg: "#fdecea",
  blue: "#1d4e89",
  blueBg: "#e8f0fa",
} as const;

/** Dark theme (night). Same keys as light. */
export const dark: Record<keyof typeof light, string> = {
  roomWall: "#1d2331",
  roomWall2: "#181d29",
  roomFloor: "#2a2a31",
  roomFloor2: "#22222a",
  roomLine: "#0a0c12",
  roomObj: "#313849",
  roomObj2: "#272c3a",
  roomWood: "#54463c",
  roomWood2: "#43382f",
  roomSky: "#0a1226",
  roomSky2: "#1c2b4d",
  roomSun: "#f2ead0",
  roomCity: "#111a2e",
  roomCity2: "#1a2540",
  roomChair: "#11141c",
  roomLeather: "#4d3426",
  roomLabel: "#ecebe6",
  roomLabel2: "#9aa0ae",
  roomGlow: "#ffcf73",
  roomShade: "#ffe2a0",
  hlAction: "#6b2f22",
  hlHard: "#6a4a15",
  hlSoft: "#5e5718",
  hlNumber: "#234f2a",
  hlResult: "#1f4462",
  gemRuby: "#e0566a",
  gemGold: "#dba22a",
  gemGreen: "#3fb36d",
  gemTeal: "#22a896",
  gemSky: "#46a3e6",
  gemBlue: "#5c7cfa",
  gemViolet: "#9670e0",
  gemPink: "#e0659f",
  metalBronze: "#c98a54",
  metalSilver: "#c3cad1",
  metalGold: "#e8b93a",
  bg: "#111111",
  surface: "#1c1c1c",
  surface2: "#181818",
  ink: "#f5f5f3",
  mutedText: "#a8a8a3",
  faint: "#85857f",
  plum: "#f5f5f3",
  plumDark: "#ffffff",
  plumInk: "#111111",
  lav: "#2a2a2a",
  lav2: "#222222",
  line: "#333331",
  fox: "#ff8a3d",
  foxDeep: "#ffa366",
  foxSoft: "#3a2114",
  sage: "#4ade80",
  sageBg: "#123524",
  amber: "#f2c14e",
  amberBg: "#3a2e10",
  error: "#ff8a80",
  errorBg: "#3d1a18",
  blue: "#8ab4f8",
  blueBg: "#1a2638",
};

export type ThemeColors = typeof light;

/** Plus Jakarta Sans (already loaded in native/src/app/_layout.tsx) and JetBrains Mono for numbers in code-like spots. */
export const font = {
  display: "PlusJakartaSans_800ExtraBold", // page titles, big numbers
  bold: "PlusJakartaSans_700Bold",         // headings, buttons, chips
  semi: "PlusJakartaSans_600SemiBold",
  body: "PlusJakartaSans_500Medium",
  regular: "PlusJakartaSans_400Regular",
};

/** Type scale in pt (the website's clamp() values at phone width, rounded). Line heights from the website. */
export const type = {
  title: { size: 34, line: 36, weight: "display", tracking: -1.1 },   // page title (website .redesign-2 .page-head h1, -0.035em)
  h1: { size: 26, line: 29, weight: "display", tracking: -0.5 },      // greeting on Home, big card titles
  h2: { size: 18, line: 23, weight: "bold", tracking: -0.27 },        // section headings (website h2 = --text-lg)
  h3: { size: 16, line: 22, weight: "bold", tracking: 0 },
  lead: { size: 18, line: 26, weight: "body", tracking: 0 },          // Remy's line under a title (website .remy-line)
  body: { size: 16, line: 24, weight: "body", tracking: 0 },          // website --text-base
  small: { size: 14, line: 20, weight: "body", tracking: 0 },         // website --text-sm
  xs: { size: 12.5, line: 17, weight: "semi", tracking: 0 },          // website --text-xs
  kicker: { size: 12, line: 16, weight: "bold", tracking: 0.8, upper: true }, // "REMY'S OFFICE", "FALL SEASON · SOPHOMORE"
} as const;

/** Spacing on a 4 pt grid. Screen side gutter 16 (website phones: 16). Gap between cards 12-16, inside cards 16-20. */
export const space = { xxs: 4, xs: 6, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, page: 16 } as const;

/** Corners, from the website. Buttons and inputs 10, cards 16, sheets/modals 18, the one-thing bubble 18, chips and pills 999. */
export const radius = { button: 10, input: 10, card: 16, sheet: 18, bubble: 18, chip: 999, tile: 12 } as const;

/** Minimum touch target (website phones: 44 px). */
export const hit = 44;

/** Shadows: the redesign uses outlines, not shadows, on cards (1 px `line` border). Only floating things get a shadow. */
export const shadow = {
  floating: { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 }, // fox button, toasts
};

/** Motion (website easings). Respect Reduce Motion: skip pops, rays, wiggles and walking. */
export const motion = {
  pop: { damping: 9, stiffness: 260 },          // ≈ cubic-bezier(.3,1.6,.5,1): Keep pop, pin moment, chest lid
  settle: { damping: 18, stiffness: 220 },      // ≈ cubic-bezier(.2,.7,.2,1): cards sliding, sheets
  fast: 150, base: 250, slow: 400,               // ms
} as const;
