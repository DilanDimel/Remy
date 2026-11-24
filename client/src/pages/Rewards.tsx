// Rewards (owners only, Nov 23 2026). Dilan: "I didn't even know we had a title system... they should know what they
// can [earn], what they have... it shouldn't be hidden behind My Path." One page with every reward in Remy: career pins,
// levels and titles, Remy's outfits and office, streak and quests, each with what the student has, what's locked and
// exactly what unlocks it. Everything is read from the same code that awards it (shared/game.ts, pins.ts, daily.ts).
import { useState } from "react";
import { ArrowRight, Award, BookOpen, Briefcase, Check, Compass, FileText, Flame, Gift, Hash, Heart, Linkedin, Lock, Mic, Moon, Mountain, RotateCcw, Scissors, Shield, Snowflake, Sprout, Star, Sun, Trophy, Users, Zap, type LucideIcon } from "lucide-react";
import { RANKS, OFFICE, WARDROBE, levelReward, rankOf, unlockedOutfits, xpOf, ALL_DONE_BONUS } from "@shared/game";
import { CARD_XP, FREEZE_EVERY, FREEZE_MAX, dailyStreak, streakDays } from "@shared/daily";
import { KIND_LABEL, TIER_NAME, pinsOf, type PinKind, type PinState } from "@shared/pins";
import { useStore } from "../lib/store";
import { go } from "../lib/router";
import { Modal, Remy } from "../components/common";
import { OUTFITS } from "../components/scholar";
import { OfficeThing } from "../components/PathBoard";
import { stateOf } from "../components/DailyPath";
import { CHEST_XP, RARE, rareOwned } from "@shared/chest";

type Tab = "pins" | "levels" | "wardrobe" | "streak";
const ICON: Record<string, LucideIcon> = { resume: FileText, pitch: Mic, linkedin: Linkedin, applied: Briefcase, interview: Users, offer: Trophy,
  tailor: Scissors, story: BookOpen, practice: Mic, network: Users, numbers: Hash, explorer: Compass, steady: Flame, hours: Heart,
  thickskin: Shield, bounce: RotateCcw, comeback: Mountain, nightowl: Moon, earlybird: Sun, allround: Star };

/** One enamel pin: the ring shows the tier reached (bronze, silver, gold); locked pins are drawn as an outline. */
export function PinArt({ p, size = 44 }: { p: PinState; size?: number }) {
  const I = p.kind === "secret" && !p.earned ? Lock : ICON[p.id] || Award;
  const tier = p.tiers.length === 1 ? (p.earned ? "one" : "") : ["", "bronze", "silver", "gold"][p.tier];
  return <span className={"rw-pin " + (tier || "lock")} style={{ width: size, height: size }} aria-hidden="true"><I size={Math.round(size * 0.45)} /></span>;
}

const status = (p: PinState) => {
  if (p.kind === "secret" && !p.earned) return "Secret";
  if (p.tiers.length === 1) return p.earned ? "Earned" : "Not yet";
  if (p.next === null) return "Gold. Every tier done";
  return `${p.tier ? TIER_NAME[p.tier - 1] + " · " : ""}${p.n} / ${p.next} for ${TIER_NAME[p.tier].toLowerCase()}`;
};

function PinTile({ p, onOpen }: { p: PinState; onOpen: () => void }) {
  const hidden = p.kind === "secret" && !p.earned;
  const pct = p.tiers.length > 1 && p.next !== null ? Math.min(100, (p.n / p.next) * 100) : p.earned ? 100 : 0;
  return (
    <button className={"rw-tile" + (p.earned ? " got" : "")} onClick={onOpen} data-testid={`button-pin-${p.id}`}>
      <PinArt p={p} />
      <span className="rw-tile-main">
        <b>{hidden ? "???" : p.name}</b>
        <small className={hidden ? "hint" : undefined}>{hidden ? p.hint : status(p)}</small>
        {p.tiers.length > 1 && <span className="rw-bar"><i style={{ width: `${pct}%` }} /></span>}
      </span>
    </button>
  );
}

function PinDetail({ p, onClose }: { p: PinState; onClose: () => void }) {
  const hidden = p.kind === "secret" && !p.earned;
  return (
    <Modal title={hidden ? "A secret pin" : p.name} onClose={onClose}>
      <div className="rw-detail" data-testid="pin-detail">
        <PinArt p={p} size={72} />
        <p>{hidden ? <>Hint: {p.hint} You'll see what it is once you earn it.</> : <><b>{p.earned ? "You earned it: " : "How to earn it: "}</b>{p.how.charAt(0).toLowerCase() + p.how.slice(1)}.</>}</p>
        {!hidden && p.tiers.length > 1 && <ol className="rw-tiers">
          {p.tiers.map((t, i) => <li key={t} className={p.tier > i ? "got" : ""}>{p.tier > i ? <Check size={14} strokeWidth={3} /> : <Lock size={13} />}<b>{TIER_NAME[i]}</b><span>{t} {p.unit}</span><em>+{p.xp[i]} XP</em></li>)}
        </ol>}
        {!hidden && p.tiers.length === 1 && <p className="pm-faint">{p.xp[0] ? `Worth ${p.xp[0]} XP.` : "Its XP is counted with the step itself (see Levels and titles)."}</p>}
        {p.tiers.length > 1 && <p className="pm-faint">You have {p.n} {p.unit} so far.</p>}
        <div className="row">
          {!hidden && p.next !== null && <button className="btn btn-primary" onClick={() => { onClose(); go(p.link); }} data-testid="button-pin-go">Go do it <ArrowRight size={15} /></button>}
          <button className="btn btn-ghost" onClick={onClose} data-testid="button-pin-close">Close</button>
        </div>
      </div>
    </Modal>
  );
}

function Pins({ pins }: { pins: PinState[] }) {
  const [open, setOpen] = useState("");
  const col = (k: PinKind) => <section className={"rw-col " + k} aria-label={KIND_LABEL[k]}>
    <h3 className="pm-kicker dark">{KIND_LABEL[k]} <span>{pins.filter((p) => p.kind === k && p.earned).length} / {pins.filter((p) => p.kind === k).length}</span></h3>
    <div className="rw-tiles">{pins.filter((p) => p.kind === k).map((p) => <PinTile key={p.id} p={p} onOpen={() => setOpen(p.id)} />)}</div>
  </section>;
  const shown = pins.find((p) => p.id === open);
  return (
    <div className="rw-pins" data-testid="rewards-pins">
      {col("first")}{col("craft")}
      <div className="rw-stack">{col("grit")}{col("secret")}</div>
      {shown && <PinDetail p={shown} onClose={() => setOpen("")} />}
    </div>
  );
}

function Levels({ xp, lv }: { xp: number; lv: ReturnType<typeof rankOf> }) {
  const earn: [string, string][] = [
    ["Daily cards and quests on My Path", `+${CARD_XP} each`], ["Weekly big move", "+35 to 80"], ["All of the week's moves", `+${ALL_DONE_BONUS} bonus`],
    ["Confirm your resume", "+100"], ["Send an application", "+120 each"], ["Get an interview", "+250 each"], ["Get an offer", "+500"], ["Earn or upgrade a pin", "+25 to 150"],
  ];
  return (
    <div className="rw-levels" data-testid="rewards-levels">
      <section className="rw-card" aria-label="Levels and titles">
        <div className="rw-card-head"><h3 className="pm-kicker dark">Levels and titles</h3><span className="pm-faint">Your title is the name of your level. Levels never go down.</span></div>
        <ol className="rw-ladder">
          {RANKS.map(([name, at], i) => {
            const n = i + 1, r = n === 1 ? { kind: "outfit" as const, key: "suit" } : levelReward(n);
            const reward = !r ? "" : r.kind === "outfit" ? `Remy's ${OUTFITS[r.key].name.toLowerCase()}` : `${r.label} for his office`;
            return <li key={n} className={n < lv.n ? "got" : n === lv.n ? "now" : ""} data-testid={`rank-${n}`}>
              <i>{n}</i><b>{name}</b><span>{at.toLocaleString("en-US")} XP</span><em>{reward}</em>{n === lv.n && <strong>You're here</strong>}
            </li>;
          })}
        </ol>
      </section>
      <section className="rw-card" aria-label="How to earn XP">
        <div className="rw-card-head"><h3 className="pm-kicker dark">How you earn XP</h3></div>
        <p className="rw-big"><b>{xp.toLocaleString("en-US")} XP</b> so far{lv.max ? "" : <>, {(lv.next - xp).toLocaleString("en-US")} to level {lv.n + 1}</>}</p>
        <ul className="rw-earn">{earn.map(([what, n]) => <li key={what}><span>{what}</span><b>{n}</b></li>)}</ul>
        <p className="pm-faint">XP only comes from real steps. Opening the app or clicking around earns nothing.</p>
      </section>
    </div>
  );
}

function Wardrobe({ lv }: { lv: ReturnType<typeof rankOf> }) {
  const { ws, save } = useStore();
  const w = ws!, g = stateOf(w);
  const owned = unlockedOutfits(Math.max(g.bestRank || 0, lv.n), w.profile.classYear), wearing = g.outfit && owned.includes(g.outfit) ? g.outfit : "suit";
  const outfits: [string, string][] = [...WARDROBE.map(([k, l]) => [k, `Level ${l}`] as [string, string]), ["gown", "When you graduate"]];
  // null: Remy works it out from your path in the office itself, so here it only says how.
  const steps: [LucideIcon, string, string, boolean | null][] = [
    [BookOpen, "Books on the shelf", "One for every job you decode", (g.known || []).length > 0],
    [FileText, "Your resume on file", "Add your resume", !!w.resume],
    [Award, "Certificate frames", "Earn a certificate on your path", null],
    [Briefcase, "Briefcase", "Tailor or send an application", w.applications.length > 0],
    [Sprout, "A plant that grows", "Grows with your daily streak", dailyStreak(streakDays(w)).days > 0],
  ];
  return (
    <div className="rw-wardrobe" data-testid="rewards-wardrobe">
      <section className="rw-card" aria-label="Remy's outfits">
        <div className="rw-card-head"><h3 className="pm-kicker dark">Remy's outfits</h3><span className="pm-faint">Unlock them by leveling up. Tap one you own to put it on Remy.</span></div>
        <div className="rw-grid outfits">
          {outfits.map(([k, when]) => { const got = owned.includes(k); return (
            <button key={k} className={"rw-item" + (got ? " got" : "") + (wearing === k ? " on" : "")} disabled={!got} aria-pressed={wearing === k} onClick={() => save("game", { ...g, outfit: k }).catch(() => {})} data-testid={`button-wear-${k}`}>
              <span className={"rw-art" + (got ? "" : " locked")}><Remy size={58} outfit={k} /></span>
              <b>{OUTFITS[k].name}</b><small>{wearing === k ? "Wearing" : got ? "Tap to wear" : <><Lock size={11} /> {when}</>}</small>
            </button>); })}
        </div>
      </section>
      <section className="rw-card" aria-label="Remy's office">
        <div className="rw-card-head"><h3 className="pm-kicker dark">Remy's office</h3><a className="btn btn-ghost btn-sm" href="/path" data-testid="link-rewards-office">See the office <ArrowRight size={14} /></a></div>
        <div className="rw-grid items">
          {OFFICE.map(([k, label, l]) => { const got = lv.n >= l; return (
            <div key={k} className={"rw-item" + (got ? " got" : "")}><span className={"rw-art" + (got ? "" : " locked")}><OfficeThing k={k} /></span><b>{label}</b><small>{got ? "In the office" : <><Lock size={11} /> Level {l}</>}</small></div>); })}
        </div>
        <h4 className="rw-sub">Rare finds from the daily chest</h4>
        <div className="rw-grid items">
          {RARE.map(([k, label]) => { const got = rareOwned(g).has(k); return (
            <div key={k} className={"rw-item" + (got ? " got" : "")} data-testid={`rare-${k}`}><span className={"rw-art" + (got ? "" : " locked")}><OfficeThing k={k} /></span><b>{label}</b><small>{got ? "In the office" : <><Lock size={11} /> Chest only</>}</small></div>); })}
        </div>
        <h4 className="rw-sub">From your real steps</h4>
        <ul className="rw-steps">{steps.map(([I, name, how, got]) => <li key={name} className={got ? "got" : ""}><I size={16} /><b>{name}</b><span>{got ? "In the office" : how}</span></li>)}</ul>
      </section>
    </div>
  );
}

function Streak() {
  const { ws } = useStore();
  const s = dailyStreak(streakDays(ws!));
  const rules: [LucideIcon, string, string][] = [
    [Flame, "Daily streak", "Any real step in Remy counts for the day: rating an opening, a career step, or a message to Remy. Days start at 4 AM."],
    [Snowflake, "Streak freezes", `You earn one every ${FREEZE_EVERY} days in a row, up to ${FREEZE_MAX}. A freeze covers a missed day by itself.`],
    [Zap, "Daily quests", `Three small quests on My Path every day, new at 4 AM. Each one is worth XP.`],
    [Gift, "Daily chest", `Finish all three quests to open the day's chest. Most days it holds ${CHEST_XP} bonus XP; now and then a rare item for Remy's office that only the chest gives.`],
    [Trophy, "Weekly big move", "One bigger step each week, worth extra XP. A new one comes every Monday."],
  ];
  return (
    <div className="rw-streak" data-testid="rewards-streak">
      <section className="rw-card rw-now" aria-label="Your streak">
        <Flame size={34} className={"pt-flame" + (s.days ? " lit" : "")} fill="currentColor" aria-hidden="true" />
        <p className="rw-big"><b>{s.days} day{s.days === 1 ? "" : "s"}</b> in a row</p>
        <ul className="rw-earn"><li><span>Best streak</span><b>{s.best} days</b></li><li><span>Freezes saved</span><b>{s.freezes} of {FREEZE_MAX}</b></li><li><span>Today</span><b>{s.todayDone ? "Done" : "Not yet"}</b></li></ul>
        <button className="btn btn-primary" onClick={() => go("/path")} data-testid="button-rewards-quests">Today's quests <ArrowRight size={15} /></button>
      </section>
      <section className="rw-card" aria-label="How it works">
        <div className="rw-card-head"><h3 className="pm-kicker dark">How it works</h3></div>
        <ul className="rw-rules">{rules.map(([I, t, d]) => <li key={t}><span className="rw-ri"><I size={17} /></span><div><b>{t}</b><p>{d}</p></div></li>)}</ul>
        <p className="pm-faint">The Steady pin rewards long streaks: 7, 30 and 100 days.</p>
      </section>
    </div>
  );
}

export default function Rewards({ query }: { query: URLSearchParams }) {
  const { ws } = useStore();
  const w = ws!, g = stateOf(w);
  const xp = xpOf(w, g), lv = rankOf(xp, g.bestRank);
  const pins = pinsOf(w), earned = pins.filter((p) => p.earned).length;
  const s = dailyStreak(streakDays(w));
  const tab = (["pins", "levels", "wardrobe", "streak"].includes(query.get("tab") || "") ? query.get("tab") : "pins") as Tab;
  const pct = lv.max ? 100 : Math.round(((xp - lv.floor) / Math.max(1, lv.next - lv.floor)) * 100);
  const tabs: [Tab, string][] = [["pins", `Pins ${earned}/${pins.length}`], ["levels", "Levels and titles"], ["wardrobe", "Outfits and office"], ["streak", "Streak and quests"]];
  return (
    <div className="rw" data-testid="rewards-page">
      <div className="page-head rw-head">
        <div>
          <span className="eyebrow">Rewards</span>
          <h1>Rewards</h1>
          <p>Everything you can earn in Remy, what you have, and exactly what unlocks the rest.</p>
        </div>
        <div className="rw-sum">
          <span className="ps-chip"><i className="pt-badge">{lv.n}</i>{lv.name}</span>
          <span className="rw-xp" title={lv.max ? "Top level" : `${lv.next - xp} XP to level ${lv.n + 1}`}><b>{xp.toLocaleString("en-US")} XP</b><span className="rw-bar"><i style={{ width: `${pct}%` }} /></span></span>
          <span className="ps-chip"><Award size={16} aria-hidden="true" /><b>{earned}</b> pins</span>
          <span className="ps-chip"><Flame size={16} className={"pt-flame" + (s.days ? " lit" : "")} fill="currentColor" aria-hidden="true" /><b>{s.days}</b> day{s.days === 1 ? "" : "s"}</span>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {tabs.map(([k, l]) => <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => go(`/rewards?tab=${k}`)} data-testid={`tab-rewards-${k}`}>{l}</button>)}
      </div>
      {tab === "pins" && <Pins pins={pins} />}
      {tab === "levels" && <Levels xp={xp} lv={lv} />}
      {tab === "wardrobe" && <Wardrobe lv={lv} />}
      {tab === "streak" && <Streak />}
    </div>
  );
}
