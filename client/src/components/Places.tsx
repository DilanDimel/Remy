// Remy's World (Dilan, Nov 24, owners only): the places Remy goes besides his office, drawn in the office's style and
// laid over the office room (same 860x420 frame). Each place shows the student's own numbers: people met at the café,
// jobs decoded in the library, the next real date on the fridge at home. Objects carry data-it, so taps work like the office.
import type { CSSProperties, MouseEvent as RMouseEvent, Ref } from "react";
import type { PlaceKey } from "@shared/places";
import type { Workspace } from "@shared/types";
import { Remy } from "./common";

const S = 0.62; // same size as Remy in his office
const L = { stroke: "var(--place-line)", strokeWidth: 2.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const N = { ...L, stroke: "var(--home-line)" };
const P = "var(--place-paper)";

/** Where his head is in each place, for the speech bubble (room units, like SPOTS in PathBoard). */
export const PLACE_SPOT: Record<Exclude<PlaceKey, "office">, { x: number; y: number }> = {
  cafe: { x: 540, y: 244 }, library: { x: 430, y: 180 }, home: { x: 445, y: 160 },
};

type FoxProps = { x: number; y: number; sit?: boolean; outfit: string; suit: CSSProperties; mood: "idle" | "wave" | "think"; foxRef?: Ref<SVGGElement> };
/** Remy as in the office (PR #360 body): standing, or sitting with his legs behind the furniture. */
function Fox({ x, y, sit, outfit, suit, mood, foxRef }: FoxProps) {
  return (
    <g ref={foxRef} data-it="remy" className={"ps-fox" + (sit ? " sit" : "")} transform={`translate(${x - 100 * S} ${y}) scale(${S})`}>
      <g className="ps-fox-bob" style={suit}>
        <g className="ps-legs">
          <g className="ps-tail"><path d="M134 258C172 270 210 254 216 214C219 194 213 180 204 170C197 190 184 206 162 216C148 222 140 234 134 258Z" /><path className="tip" d="M204 170C213 180 219 194 216 212C207 206 199 194 196 184Z" /></g>
          {!sit && <>
            <g className="ps-leg l"><path className="ps-trouser" d="M62 248L60 296Q60 302 66 302L92 302Q98 302 98 296L99 248Z" /><path className="ps-shoe" d="M97 296L72 296Q53 297 51 308Q50 317 60 317L94 317Q100 317 100 311L100 300Q100 296 97 296Z" /></g>
            <g className="ps-leg r"><path className="ps-trouser" d="M138 248L140 296Q140 302 134 302L108 302Q102 302 102 296L101 248Z" /><path className="ps-shoe" d="M103 296L128 296Q147 297 149 308Q150 317 140 317L106 317Q100 317 100 311L100 300Q100 296 103 296Z" /></g></>}
          <path className="ps-hem" d="M31 212C32 228 36 242 40 256L95 262L100 254L105 262L160 256C164 242 168 228 169 212Z" />
          <path className="ps-hem-line" d="M100 222V253" />
        </g>
        <Remy size={200} mood={mood} outfit={outfit} />
        {!sit && <g className="ps-arms">
          <g className="ps-arm l"><path className="ps-sleeve-ol" d="M48 184Q35 212 36 244" /><path className="ps-sleeve" d="M48 184Q35 212 36 244" /><path className="ps-cuff" d="M28 245L44 246" /><ellipse className="ps-paw" cx="36" cy="255" rx="11" ry="10" /></g>
          <g className="ps-arm r"><path className="ps-sleeve-ol" d="M152 184Q165 212 164 244" /><path className="ps-sleeve" d="M152 184Q165 212 164 244" /><path className="ps-cuff" d="M156 246L172 245" /><ellipse className="ps-paw" cx="164" cy="255" rx="11" ry="10" /></g>
        </g>}
      </g>
    </g>
  );
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const BOOKS = ["var(--sch-navy)", "var(--sch-tweed)", "var(--sch-wine)", "var(--lib-brass)", "var(--fox)", "var(--sch-camel)", "var(--sch-ox)"];
const first = (name: string) => name.trim().split(/\s+/)[0] || name;

type Props = { k: Exclude<PlaceKey, "office">; w: Workspace; streakBest: number; now: Date; outfit: string; suit: CSSProperties;
  mood: "idle" | "wave" | "think"; foxRef?: Ref<SVGGElement>; onScene: (e: RMouseEvent) => void; wig: (k: string) => string };

export function PlaceScene({ k, w, streakBest, now, outfit, suit, mood, foxRef, onScene, wig }: Props) {
  const it = (key: string) => ({ "data-it": key, className: wig(key) });
  const fox = (sit = false) => <Fox x={PLACE_SPOT[k].x} y={PLACE_SPOT[k].y} sit={sit} outfit={outfit} suit={suit} mood={mood} foxRef={foxRef} />;
  const svg = (label: string, body: JSX.Element) => (
    <svg className="ps-scene ps-place" viewBox="0 40 860 420" preserveAspectRatio="xMidYMax meet" role="img" aria-label={label} onClick={onScene} data-testid={`office-place-${k}`}>{body}</svg>);

  if (k === "cafe") {
    const people = (w.contacts || []).length;
    const month = new Date(now.getTime() - 30 * 864e5).toISOString().slice(0, 10);
    const recent = (w.contacts || []).filter((c) => c.metOn && c.metOn >= month).length;
    const last = [...(w.contacts || [])].reverse()[0];
    return svg("Remy at the Corner Café", <>
      <rect x="0" y="40" width="860" height="312" fill="var(--cafe-wall)" />
      <rect x="0" y="292" width="860" height="60" fill="var(--cafe-wall-2)" /><path d="M0 292H860" {...L} />
      <rect x="0" y="352" width="860" height="108" fill="var(--cafe-floor)" />
      <path d="M0 392H860M0 432H860" stroke="var(--cafe-floor-2)" strokeWidth="2" /><path d="M0 352H860" {...L} />
      <g {...it("chalkboard")}>
        <rect x="56" y="58" width="338" height="126" rx="6" fill="var(--cafe-board)" stroke="var(--cafe-wood)" strokeWidth="7" />
        <rect x="56" y="58" width="338" height="126" rx="6" fill="none" {...L} />
        <text x="76" y="86" fontSize="13" fontWeight="800" letterSpacing="2" fill="var(--cafe-chalk-2)">AT THE CORNER</text>
        <g fontSize="14" fontWeight="600" fill="var(--cafe-chalk)">
          <text x="76" y="114">People you've met</text><text x="374" y="114" textAnchor="end">{people}</text>
          <text x="76" y="138">Met in the last 30 days</text><text x="374" y="138" textAnchor="end">{recent}</text>
          <text x="76" y="162">{last ? `Say hi to ${first(last.name)}`.slice(0, 30) : "Add someone you met"}</text><text x="374" y="162" textAnchor="end" fill="var(--cafe-chalk-2)">→</text>
        </g>
      </g>
      <rect x="30" y="238" width="440" height="14" rx="3" fill="var(--cafe-wood-2)" {...L} />
      <rect x="40" y="252" width="420" height="100" fill="var(--cafe-wood)" {...L} />
      {range(6).map((i) => <path key={i} d={`M${70 + i * 70} 258V346`} stroke="var(--cafe-wood-3)" strokeWidth="3" />)}
      <g {...it("espresso")}><rect x="66" y="188" width="104" height="50" rx="7" fill="var(--cafe-steel)" {...L} /><rect x="76" y="198" width="84" height="12" rx="3" fill="var(--cafe-steel-2)" />
        <rect x="84" y="222" width="16" height="12" rx="2" fill={P} {...L} strokeWidth="1.8" /><rect x="136" y="222" width="16" height="12" rx="2" fill={P} {...L} strokeWidth="1.8" /></g>
      <g {...it("tipjar")}><path d="M196 214h26v22a3 3 0 0 1-3 3h-20a3 3 0 0 1-3-3z" fill="var(--cafe-glass)" {...L} /><text x="209" y="232" textAnchor="middle" fontSize="8" fontWeight="800" fill="var(--place-line)">TIPS</text></g>
      <g {...it("pastry")}><rect x="300" y="194" width="146" height="46" rx="5" fill="var(--cafe-glass)" {...L} /><path d="M300 218h146" stroke="var(--place-line)" strokeWidth="1.6" />
        <path d="M314 214c4-10 20-10 24 0zM346 214c4-10 20-10 24 0z" fill="var(--cafe-pastry)" {...L} strokeWidth="1.8" />
        <circle cx="396" cy="208" r="7" fill="var(--home-pot)" {...L} strokeWidth="1.8" /><circle cx="422" cy="208" r="7" fill="var(--home-pot)" {...L} strokeWidth="1.8" /></g>
      <g {...it("cafewindow")}>
        <rect x="500" y="62" width="324" height="178" rx="6" fill="var(--cafe-glass)" {...L} />
        <rect x="500" y="170" width="324" height="70" fill="var(--cafe-grass)" />
        <rect x="540" y="96" width="90" height="80" fill="var(--cafe-brick)" {...L} strokeWidth="2" />
        <rect x="640" y="82" width="110" height="94" fill="var(--cafe-steel)" {...L} strokeWidth="2" />
        <circle cx="790" cy="150" r="26" fill="var(--cafe-tree)" {...L} strokeWidth="2" />
        <rect x="500" y="62" width="324" height="178" rx="6" fill="none" {...L} strokeWidth="3" /><path d="M662 62V240M500 150H824" {...L} />
        <text x="581" y="210" textAnchor="middle" fontSize="17" fontWeight="800" fontStyle="italic" fill="var(--cafe-gold)">Corner</text>
        <text x="743" y="210" textAnchor="middle" fontSize="17" fontWeight="800" fontStyle="italic" fill="var(--cafe-gold)">Café</text>
        <rect x="492" y="238" width="340" height="10" rx="3" fill={P} {...L} />
      </g>
      <path d="M700 40V92" {...L} /><path d="M676 108c0-14 10-18 24-18s24 4 24 18z" fill="var(--fox)" {...L} />
      {fox()}
      <g {...it("cafetable")}>
        <rect x="646" y="368" width="10" height="66" fill="var(--cafe-wood)" {...L} /><ellipse cx="651" cy="436" rx="40" ry="7" fill="var(--cafe-wood)" {...L} />
        <ellipse cx="651" cy="362" rx="104" ry="15" fill="var(--cafe-wood-2)" {...L} />
        <path d="M584 352l10-34h56l-6 34z" fill="var(--room-chair)" {...L} /><circle cx="618" cy="335" r="4" fill="var(--fox)" />
        <path d="M686 338h20v16a3 3 0 0 1-3 3h-14a3 3 0 0 1-3-3z" fill={P} {...L} /><path d="M722 338h20v16a3 3 0 0 1-3 3h-14a3 3 0 0 1-3-3z" fill="var(--fox)" {...L} />
      </g>
      <g {...it("coffeechair")}><path d="M772 300c0-22 46-22 46 0v58M772 300v58" fill="none" {...L} strokeWidth="5" stroke="var(--cafe-wood-3)" />
        <ellipse cx="795" cy="360" rx="30" ry="7" fill="var(--cafe-wood)" {...L} /><path d="M772 366l-6 70M818 366l6 70" {...L} strokeWidth="4" stroke="var(--cafe-wood-3)" /></g>
    </>);
  }

  if (k === "library") {
    const known = (w.game?.known || []).length;
    const shelf = (x: number, seed: number) => <g key={x} {...it("libshelf")}>
      <rect x={x} y="70" width="190" height="282" fill="var(--lib-shelf)" {...L} />
      {range(5).map((r) => <g key={r}><rect x={x + 6} y={80 + r * 54} width="178" height="46" fill="var(--lib-shelf-2)" />
        {range(14).map((i) => { const h = 30 + ((i * 7 + r * 5 + seed) % 14); return <rect key={i} x={x + 9 + i * 12} y={126 + r * 54 - h} width="10" height={h} fill={BOOKS[(i + r * 3 + seed) % 7]} stroke="var(--lib-shelf-2)" strokeWidth="1.2" />; })}
        <rect x={x} y={126 + r * 54} width="190" height="6" fill="var(--home-rug-2)" /></g>)}
    </g>;
    return svg("Remy reading in the campus library", <>
      <defs><linearGradient id="pl-dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: "var(--lib-sky-1)" }} /><stop offset=".55" style={{ stopColor: "var(--lib-sky-2)" }} /><stop offset="1" style={{ stopColor: "var(--lib-sky-3)" }} /></linearGradient>
        <radialGradient id="pl-lamp"><stop offset="0" style={{ stopColor: "var(--home-glow)", stopOpacity: 0.5 }} /><stop offset="1" style={{ stopColor: "var(--home-glow)", stopOpacity: 0 }} /></radialGradient></defs>
      <rect x="0" y="40" width="860" height="312" fill="var(--lib-wall)" />
      <rect x="0" y="352" width="860" height="108" fill="var(--lib-floor)" /><path d="M0 396H860M0 436H860" stroke="var(--lib-floor-2)" strokeWidth="2" /><path d="M0 352H860" {...L} />
      {shelf(24, 0)}{shelf(646, 3)}
      <g {...it("libwindow")}><path d="M320 352V150a110 110 0 0 1 220 0V352" fill="url(#pl-dusk)" {...L} />
        <circle cx="470" cy="244" r="20" fill="var(--lib-sky-3)" />
        <path d="M320 300h40v-40h34v-24h30v64h36v-50h40v50h40v52H320z" fill="var(--lib-city)" opacity=".8" />
        <path d="M430 40V352M320 230H540" {...L} /><path d="M320 352V150a110 110 0 0 1 220 0V352" fill="none" {...L} strokeWidth="3" /></g>
      <g {...it("owl")}><ellipse cx="740" cy="58" rx="16" ry="18" fill="var(--lib-owl)" {...L} strokeWidth="2" /><circle cx="734" cy="54" r="5" fill={P} /><circle cx="746" cy="54" r="5" fill={P} /><circle cx="734" cy="54" r="2" fill="var(--place-line)" /><circle cx="746" cy="54" r="2" fill="var(--place-line)" /></g>
      <ellipse cx="300" cy="330" rx="120" ry="70" fill="url(#pl-lamp)" /><ellipse cx="580" cy="330" rx="120" ry="70" fill="url(#pl-lamp)" />
      {fox(true)}
      <g {...it("libtable")}><rect x="200" y="330" width="470" height="16" rx="3" fill="var(--home-rug-2)" {...L} /><path d="M220 346v100M650 346v100" {...L} strokeWidth="6" stroke="var(--lib-shelf)" />
        <path d="M386 330l30-6 30 6v-4l-30-6-30 6z" fill={P} {...L} strokeWidth="2" />
        <rect x="490" y="320" width="56" height="10" fill="var(--sch-navy)" {...L} strokeWidth="1.8" /><rect x="494" y="310" width="48" height="10" fill="var(--lib-brass)" {...L} strokeWidth="1.8" /></g>
      {[300, 580].map((x) => <g key={x} {...it("liblamp")}><path d={`M${x} 330v-26`} {...L} /><path d={`M${x - 28} 306c0-16 56-16 56 0z`} fill="var(--lib-lamp)" {...L} /><ellipse cx={x} cy="328" rx="16" ry="3" fill="var(--lib-brass)" {...L} strokeWidth="1.6" /></g>)}
      <text x="119" y="62" textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--place-line)">{known ? `${known} jobs decoded` : "Decode a job"}</text>
    </>);
  }

  // home, at night
  const today = now.toISOString().slice(0, 10);
  const next = [...(w.calendar || [])].filter((c) => c.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
  const when = next ? new Date(next.date + "T12:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) : "";
  const leaves = Math.min(6, Math.max(1, Math.floor(streakBest / 7)));
  const clock = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M$/i, "");
  return svg("Remy at home for the night", <>
    <defs><radialGradient id="pl-glow"><stop offset="0" style={{ stopColor: "var(--home-glow)", stopOpacity: 0.35 }} /><stop offset="1" style={{ stopColor: "var(--home-glow)", stopOpacity: 0 }} /></radialGradient>
      <linearGradient id="pl-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style={{ stopColor: "var(--home-sky)" }} /><stop offset="1" style={{ stopColor: "var(--home-sky-2)" }} /></linearGradient></defs>
    <rect x="0" y="40" width="860" height="312" fill="var(--home-wall)" />
    <rect x="0" y="352" width="860" height="108" fill="var(--home-floor)" /><path d="M0 396H860M0 436H860" stroke="var(--home-floor-2)" strokeWidth="2" /><path d="M0 352H860" {...N} />
    <ellipse cx="160" cy="250" rx="230" ry="210" fill="url(#pl-glow)" />
    <g {...it("homewindow")}><rect x="44" y="70" width="206" height="160" rx="6" fill="url(#pl-night)" {...N} />
      {[[70, 92], [110, 84], [200, 96], [228, 80], [150, 112], [96, 126]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.8" fill="var(--home-moon)" />)}
      <path d="M208 104a16 16 0 1 0 14 22a12 12 0 1 1-14-22z" fill="var(--home-moon)" />
      <path d="M44 230V170h34v-24h30v84M120 230v-44h26v-30h34v74M190 230v-36h24v-20h36v56" fill="var(--home-city)" />
      {[[86, 160], [94, 176], [130, 196], [160, 170], [200, 204], [226, 190]].map(([x, y]) => <rect key={x} x={x} y={y} width="5" height="6" fill="var(--home-glow)" />)}
      <path d="M147 70V230M44 150H250" {...N} /></g>
    <path d="M30 60c14 50 14 120 0 182h30c-8-60-8-130 0-182zM264 60c-14 50-14 120 0 182h-30c8-60 8-130 0-182z" fill="var(--home-curtain)" {...N} />
    <g {...it("floorlamp")}><path d="M150 260V412" stroke="var(--home-line)" strokeWidth="4" /><ellipse cx="150" cy="414" rx="22" ry="5" fill="var(--home-wood)" {...N} /><path d="M126 262l8-30h32l8 30z" fill="var(--home-shade)" {...N} /></g>
    {/* the shelf sits right of the couch, clear of his speech bubble */}
    <rect x="612" y="206" width="108" height="8" rx="2" fill="var(--home-wood)" {...N} />
    {/* Intern the plant grows a leaf for every 7 days in a row (up to six) */}
    <g {...it("intern")}><path d="M622 206h36l-4-24h-28z" fill="var(--home-pot)" {...N} /><path d="M640 182V136" stroke="var(--home-leaf)" strokeWidth="3" />
      {range(leaves).map((i) => { const y = 178 - i * 8, d = i % 2 ? 1 : -1; return <path key={i} d={`M640 ${y}c${d * 8}-10 ${d * 22}-10 ${d * 26}-3c${d * -8} 8 ${d * -20} 8 ${d * -26} 3z`} fill="var(--home-leaf)" {...N} strokeWidth="1.6" />; })}</g>
    <g {...it("homeclock")}><rect x="664" y="180" width="52" height="26" rx="4" fill="var(--home-city)" {...N} /><text x="690" y="198" textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--fox)">{clock}</text></g>
    <ellipse cx="450" cy="420" rx="236" ry="24" fill="var(--home-rug)" {...N} /><ellipse cx="450" cy="420" rx="190" ry="15" fill="none" stroke="var(--home-rug-2)" strokeWidth="3" />
    <g {...it("couch")}><rect x="300" y="250" width="290" height="64" rx="18" fill="var(--home-couch)" {...N} /></g>
    {fox(true)}
    <g {...it("couch")}>
      <rect x="296" y="300" width="298" height="56" rx="12" fill="var(--home-couch-2)" {...N} />
      <rect x="282" y="282" width="34" height="80" rx="14" fill="var(--home-couch)" {...N} /><rect x="574" y="282" width="34" height="80" rx="14" fill="var(--home-couch)" {...N} />
      <path d="M300 362v14M590 362v14" stroke="var(--home-line)" strokeWidth="4" /></g>
    <g {...it("tea")}><rect x="382" y="374" width="160" height="12" rx="4" fill="var(--home-wood)" {...N} /><path d="M394 386v26M530 386v26" stroke="var(--home-line)" strokeWidth="4" />
      <path d="M402 356h20v16a3 3 0 0 1-3 3h-14a3 3 0 0 1-3-3z" fill="var(--home-moon)" {...N} /></g>
    <g {...it("fridge")}><rect x="726" y="132" width="116" height="226" rx="10" fill="var(--home-fridge)" {...N} /><path d="M726 206H842" {...N} /><path d="M738 150v40M738 220v50" stroke="var(--home-line)" strokeWidth="4" />
      <g transform="rotate(4 790 262)"><rect x="752" y="226" width="78" height="66" fill="var(--home-note)" {...N} strokeWidth="2" /><circle cx="791" cy="230" r="5" fill="var(--fox)" />
        <text x="791" y="254" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--place-line)">{next ? when : "Nothing due"}</text>
        <text x="791" y="270" textAnchor="middle" fontSize="9" fontWeight="600" fill="var(--place-line)">{next ? next.title.slice(0, 14) : "Rest up"}</text></g></g>
  </>);
}
