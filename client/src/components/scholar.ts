// Scholar Remy (owner view): the fox's drawing, outfits and the little things he does on his own.
// Plain DOM so the same code runs in the app and in the stand-alone mascot demo. Styles: scholar.css.
import "./scholar.css";

type Outfit = { name: string; vars: string; v?: number; neck: "tie" | "bow" | "turtle"; lapels?: boolean; vest?: boolean; knit?: boolean; gown?: boolean; pocket?: boolean };
const v = (o: Record<string, string>) => Object.entries(o).map(([k, c]) => `--o-${k}:var(--sch-${c})`).join(";");
export const OUTFITS: Record<string, Outfit> = {
  suit: { name: "Business suit", vars: v({ jacket: "suit", lapel: "lapel", tie: "tie", shirt: "shirt" }), neck: "tie", lapels: true, pocket: true },
  tweed: { name: "Green tweed", vars: v({ jacket: "tweed", lapel: "tweed-2", tie: "brown", shirt: "cream" }), neck: "tie", lapels: true },
  navy: { name: "Navy + bow tie", vars: v({ jacket: "navy", lapel: "navy-2", tie: "wine", shirt: "cream" }), neck: "bow", lapels: true, pocket: true },
  camel: { name: "Camel + turtleneck", vars: v({ jacket: "camel", lapel: "camel-2", shirt: "black" }), neck: "turtle", lapels: true },
  cardigan: { name: "Cardigan", vars: v({ jacket: "knit", lapel: "knit-2", tie: "tweed", shirt: "cream" }), neck: "tie", v: 205, knit: true },
  oxblood: { name: "Oxblood + vest", vars: v({ jacket: "ox", lapel: "ox-2", tie: "navy", shirt: "cream", vest: "vest" }), neck: "tie", v: 205, lapels: true, vest: true },
  gown: { name: "Graduation", vars: v({ jacket: "black", lapel: "black", tie: "brown", shirt: "cream" }), neck: "tie", v: 190, gown: true },
};

const M = (s: string) => `<g transform="translate(200 0) scale(-1 1)">${s}</g>`;
const HEAD = "M100 52 C133 52 153 70 157 96 L171 119 C157 122 147 130 139 140 C128 152 114 158 100 158 C86 158 72 152 61 140 C53 130 43 122 29 119 L43 96 C47 70 67 52 100 52 Z";
const MASK = "M29 119 C43 122 53 130 61 140 C72 152 86 158 100 158 C114 158 128 152 139 140 C147 130 157 122 171 119 C162 107 148 103 134 107 C122 111 111 119 100 119 C89 119 78 111 66 107 C52 103 38 107 29 119 Z";
const EAR = `<path class="s-fur s-ol" d="M54 90 C46 66 43 42 49 25 C51 19 57 18 61 21 C75 33 87 45 97 60 Z"/><path class="s-ear-in" d="M60 76 C56 60 55 46 57 35 C66 43 74 51 82 61 Z"/>`;
const eye = (x: number) => `<g class="s-look"><ellipse class="s-pupil s-ink" cx="${x}" cy="103" rx="5.5" ry="7"/><circle class="s-pupil s-white" cx="${x + 2}" cy="100" r="1.8"/><path class="s-smiley s-stroke" d="M${x - 6} 105 Q${x} 97 ${x + 6} 105"/></g>`;
// An arm reaching up from below the frame; the paw sits at the group's origin.
const arm = (side: string, extra = "") => `<g class="s-arm s-arm-${side}"><path class="s-sleeve-ol" d="M0 8 L0 120"/><path class="s-sleeve" d="M0 8 L0 120"/><path class="s-cuff" d="M-6 13 L6 13"/>${extra}<ellipse class="s-fur s-ol s-thin" cx="0" cy="0" rx="9" ry="8.5"/><path class="s-toe" d="M-3.5 -6 L-3.5 -2 M3.5 -6 L3.5 -2"/></g>`;
const MUG = `<g class="s-mug" transform="translate(-15 -2)"><path class="s-none s-ol s-thin" d="M9 -6 Q17 -6 16 2 Q15 8 8 7"/><path class="s-white s-ol s-thin" d="M-10 -12 L10 -12 L8 12 L-8 12 Z"/><path class="s-trim" d="M-9.5 -3 L9.5 -3 L9 2 L-9 2 Z"/><path class="s-steam" d="M-4 -17 q-4 -6 0 -11 M4 -17 q4 -6 0 -11"/></g>`;
const CLOTH = `<path class="s-cloth s-white s-ol s-thin" d="M-12 -14 L8 -16 L10 2 L-10 4 Z"/>`;

function bust(o: Outfit) {
  const vd = o.v || 177, deep = vd > 180;
  const lap = `<path class="s-lapel s-ol" d="M84 157 L68 171 L80 177 L${deep ? 75 : 72} ${deep ? 200 : 196} L100 ${vd} Z"/>`;
  const bow = `<path class="s-tie s-ol" d="M100 166 L85 158 Q82 166 85 174 Z"/>`;
  const neck = o.neck === "tie" ? `<g class="s-tiegrp"><path class="s-tie s-ol" d="M95 165 L105 165 L107 173 L104 ${deep ? 212 : 203} L100 ${deep ? 216 : 208} L96 ${deep ? 212 : 203} L93 173 Z"/></g>`
    : o.neck === "bow" ? `<g class="s-tiegrp">${bow}${M(bow)}<circle class="s-tie s-ol" cx="100" cy="166" r="4.5"/></g>` : "";
  const shirt = o.neck === "turtle"
    ? `<path class="s-shirt" d="M84 160 L116 160 L116 214 L84 214 Z"/><path class="s-shirt s-ol" d="M78 150 Q100 164 122 150 L124 163 Q100 177 76 163 Z"/>`
    : `<path class="s-shirt" d="M86 158 L114 158 L114 214 L86 214 Z"/>${o.vest ? `<path class="s-vest s-ol" d="M80 172 L100 196 L120 172 L126 214 L74 214 Z"/>` : ""}<path class="s-shirt s-ol" d="M84 157 L100 177 L116 157 L108 152 L100 160 L92 152 Z"/>`;
  const gownTrim = `<path class="s-trim" d="M84 157 L100 ${vd} L92 ${vd} L76 162 Z"/>`;
  return shirt + neck + `<path class="s-suit s-ol" d="M30 214 C34 182 56 164 84 157 L100 ${vd} L116 157 C144 164 166 182 170 214 Z"/>`
    + (o.lapels ? lap + M(lap) : "")
    + (o.knit ? `<circle class="s-line" cx="91" cy="196" r="2.3"/><circle class="s-line" cx="88" cy="208" r="2.3"/>` : "")
    + (o.gown ? gownTrim + M(gownTrim) : "")
    + (o.pocket ? `<path class="s-lapel s-ol s-thin" d="M128 190 L146 192 L145 198 L127 196 Z"/><path class="s-white" d="M134 190 L136 184 L139 185 L139 191 Z"/>` : "");
}
const CAP = `<g class="s-cap"><path class="s-black s-ol" d="M76 58 Q100 70 124 58 L122 70 Q100 80 78 70 Z"/><path class="s-black s-ol" d="M56 54 L100 38 L144 54 L100 70 Z"/><path class="s-tassel" d="M100 54 L138 58 L140 78"/><circle class="s-trim" cx="100" cy="54" r="3"/></g>`;

/** The inside of the fox's <svg viewBox="0 -8 200 222">. */
export function scholarMarkup(outfit = "suit") {
  const o = OUTFITS[outfit] || OUTFITS.suit;
  return `<g class="s-all" style="${o.vars}">
  <g class="s-spark"><path d="M26 58 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z"/><path d="M172 46 l2.4 5.6 5.6 2.4 -5.6 2.4 -2.4 5.6 -2.4 -5.6 -5.6 -2.4 5.6 -2.4z"/><path d="M178 134 l2 4.5 4.5 2 -4.5 2 -2 4.5 -2 -4.5 -4.5 -2 4.5 -2z"/></g>
  <g class="s-hop"><g class="s-breathe">${bust(o)}</g>
  <g class="s-book"><path class="s-tie s-ol" d="M66 176 L134 176 L132 212 L68 212 Z"/><path class="s-white s-ol s-thin" d="M70 178 L100 182 L100 210 L71 207 Z"/><path class="s-white s-ol s-thin" d="M130 178 L100 182 L100 210 L129 207 Z"/><path class="s-page s-white s-ol s-thin" d="M130 178 L100 182 L100 210 L129 207 Z"/><path class="s-line-s" d="M76 188 l17 2 M76 194 l17 2 M107 190 l17 -2 M107 196 l17 -2"/></g>
  <g class="s-head"><g class="s-bob">
    <g class="s-ear-l">${EAR}</g><g class="s-ear-r">${M(EAR)}</g>
    <path class="s-fur s-ol" d="${HEAD}"/><path class="s-cream" d="${MASK}"/><path class="s-none s-ol" d="${HEAD}"/>
    <ellipse class="s-cheek" cx="58" cy="126" rx="8" ry="4.5"/><ellipse class="s-cheek" cx="142" cy="126" rx="8" ry="4.5"/>
    ${eye(75)}${eye(125)}
    <g class="s-glasses"><circle class="s-lens" cx="75" cy="102" r="17"/><circle class="s-lens" cx="125" cy="102" r="17"/><path class="s-stroke" d="M92 100 Q100 95 108 100 M58 99 L46 95 M142 99 L154 95"/></g>
    <path class="s-ink" d="M91 124 Q100 119 109 124 Q107 132 100 134 Q93 132 91 124 Z"/>
    <path class="s-mouth s-stroke" d="M91 140 Q100 147 109 140"/><path class="s-yawn s-ink" d="M93 139 Q100 158 107 139 Q100 135 93 139 Z"/>
    ${o.gown ? CAP : ""}
  </g></g>
  <g class="s-bulb"><g transform="translate(166 30) scale(1.6) translate(-166 -28)"><circle class="s-bulb-glow" cx="166" cy="30" r="15"/><path class="s-white s-ol s-thin" d="M166 18 a10 10 0 0 1 6 18 l0 5 -12 0 0 -5 a10 10 0 0 1 6 -18z"/><path class="s-line-s" d="M161 45 l10 0 M162 49 l8 0"/></g></g>
  ${arm("l")}${arm("r", MUG + CLOTH)}
  </g></g>`;
}

// What he does on his own, with how long each takes (ms). "change" swaps the outfit halfway through.
export const ACTS: Record<string, { label: string; ms: number; weight: number }> = {
  coffee: { label: "Sip coffee", ms: 3600, weight: 3 },
  clean: { label: "Clean glasses", ms: 3800, weight: 3 },
  read: { label: "Read", ms: 4200, weight: 2 },
  tie: { label: "Fix tie", ms: 2000, weight: 2 },
  push: { label: "Push up glasses", ms: 1400, weight: 3 },
  look: { label: "Look around", ms: 2400, weight: 3 },
  grin: { label: "Big smile", ms: 1700, weight: 3 },
  wave: { label: "Wave", ms: 2100, weight: 1 },
  yawn: { label: "Yawn", ms: 2500, weight: 1 },
  idea: { label: "Idea!", ms: 2200, weight: 2 },
  change: { label: "Change outfit", ms: 1000, weight: 1 },
};

const live = new Set<SVGSVGElement>();
function lookAt(e: PointerEvent) {
  live.forEach((el) => {
    const r = el.getBoundingClientRect(), c = (n: number) => Math.max(-1, Math.min(1, n)).toFixed(2);
    el.style.setProperty("--lx", c((e.clientX - (r.left + r.width / 2)) / (innerWidth / 2)));
    el.style.setProperty("--ly", c((e.clientY - (r.top + r.height * 0.45)) / (innerHeight / 2)));
  });
}

type Opts = { outfit?: string; auto?: boolean; outfits?: string[]; onOutfit?: (o: string) => void };
/** Brings a Scholar <svg> to life: eyes follow the pointer, and while idle he does something every 8 to 16 s. */
export function startScholar(el: SVGSVGElement, opts: Opts = {}) {
  let outfit = opts.outfit || "suit", busy = false, last = "", timer = 0;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!live.size) addEventListener("pointermove", lookAt, { passive: true });
  live.add(el);
  const setOutfit = (o: string) => { outfit = o; el.innerHTML = scholarMarkup(o); opts.onOutfit?.(o); };
  const play = (act: string, force = false) => {
    const a = ACTS[act];
    if (!a || still || (busy && !force)) return;
    Object.keys(ACTS).forEach((k) => el.classList.remove("act-" + k));
    void el.getBoundingClientRect(); // restart the CSS animation if the same act plays twice
    busy = true; last = act; el.classList.add("act-" + act);
    if (act === "change") {
      const pool = (opts.outfits || Object.keys(OUTFITS)).filter((o) => o !== outfit);
      setTimeout(() => setOutfit(outfit !== "suit" && Math.random() < 0.5 ? "suit" : pool[Math.floor(Math.random() * pool.length)]), a.ms * 0.45);
    }
    setTimeout(() => { el.classList.remove("act-" + act); busy = false; }, a.ms);
  };
  const pick = () => {
    const opts2 = Object.entries(ACTS).filter(([k]) => k !== last);
    let n = Math.random() * opts2.reduce((s, [, a]) => s + a.weight, 0);
    for (const [k, a] of opts2) if ((n -= a.weight) < 0) return k;
    return "grin";
  };
  const loop = () => {
    timer = window.setTimeout(() => {
      if (el.isConnected && !document.hidden && el.classList.contains("idle")) play(pick());
      loop();
    }, 8000 + Math.random() * 8000);
  };
  if (opts.auto !== false) loop();
  return {
    play, setOutfit, get outfit() { return outfit; },
    stop() { clearTimeout(timer); live.delete(el); if (!live.size) removeEventListener("pointermove", lookAt); },
  };
}
