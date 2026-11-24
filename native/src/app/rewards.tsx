import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ALL_DONE_BONUS, OFFICE, RANKS, WARDROBE, levelReward, rankOf, unlockedOutfits, xpOf } from "@shared/game";
import { CARD_XP, FREEZE_EVERY, FREEZE_MAX, dailyStreak, streakDays } from "@shared/daily";
import { TIER_NAME, pinsOf, type PinKind, type PinState } from "@shared/pins";
import { CHEST_XP, RARE, rareOwned } from "@shared/chest";
import type { Workspace } from "@shared/types";
import { Button, Card, Chip, Group, Icon, Pill, Row, Sect, Segmented, T, tap, type IconName } from "@/components/ui";
import { OUTFITS, OUTFIT_NAME, type Outfit } from "@/components/scholarSvg";
import { SvgXml } from "react-native-svg";
import { api } from "@/lib/api";
import { brand } from "@/lib/tokens";
import { go } from "@/lib/nav";
import { useSession } from "@/lib/session";
import { font, useTheme, type Colors } from "@/lib/theme";

// Rewards, the website's page (client/src/pages/Rewards.tsx), native: career pins, levels and titles, Remy's outfits and
// office, and the streak. Everything is read from the same shared code that awards it (shared/game.ts, pins.ts, daily.ts).
type Tab = "pins" | "levels" | "wardrobe" | "streak";
const ICON: Record<string, IconName> = { resume: "doc", pitch: "chat", linkedin: "you", applied: "jobs", interview: "you", offer: "award",
  tailor: "doc", story: "book", practice: "chat", network: "you", numbers: "list", explorer: "compass", steady: "flame", hours: "heart",
  thickskin: "check", bounce: "undo", comeback: "up", nightowl: "moon", earlybird: "sun", allround: "award", insider: "eye" };
// Each pin's own enamel colour; the rim shows the tier (bronze, silver, gold).
type Gem = "gemRuby" | "gemGold" | "gemGreen" | "gemTeal" | "gemSky" | "gemBlue" | "gemViolet" | "gemPink";
const HUE: Record<string, Gem> = { resume: "gemSky", pitch: "gemViolet", linkedin: "gemBlue", applied: "gemTeal", interview: "gemPink", offer: "gemGold",
  tailor: "gemRuby", story: "gemViolet", practice: "gemSky", network: "gemBlue", numbers: "gemGreen", explorer: "gemTeal", steady: "gemRuby", hours: "gemPink",
  thickskin: "gemTeal", bounce: "gemGreen", comeback: "gemViolet", nightowl: "gemBlue", earlybird: "gemGold", insider: "gemViolet", allround: "gemPink" };
const LEVEL_HUE: Gem[] = ["gemGreen", "gemTeal", "gemSky", "gemBlue", "gemViolet", "gemPink", "gemRuby", "gemGreen", "gemTeal", "gemSky", "gemBlue", "gemViolet", "gemPink", "gemRuby", "gemGold"];
const lvHue = (c: Colors, n: number) => c[LEVEL_HUE[(n - 1) % LEVEL_HUE.length]!];
const hiddenPin = (p: PinState) => p.kind === "secret" && !p.earned;
const status = (p: PinState) => {
  if (hiddenPin(p)) return "Secret";
  if (p.tiers.length === 1) return p.earned ? "Earned" : "Not yet";
  if (p.next === null) return "Gold. Every tier done";
  return `${p.tier ? TIER_NAME[p.tier - 1] + " · " : ""}${p.n} / ${p.next} for ${TIER_NAME[p.tier]!.toLowerCase()}`;
};

/** One enamel pin: the rim shows the tier reached; a pin not earned yet is a dashed outline. */
function PinArt({ p, size = 44 }: { p: PinState; size?: number }) {
  const { c } = useTheme();
  const rim = p.tiers.length === 1 ? (p.earned ? c.foxDeep : "") : ["", c.metalBronze, c.metalSilver, c.metalGold][p.tier];
  const fill = c[HUE[p.id] || "gemSky"] || c.fox;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: rim ? fill : c.surface, borderWidth: rim ? 4 : 2, borderStyle: rim ? "solid" : "dashed", borderColor: rim || c.line }}>
      <Icon name={hiddenPin(p) ? "lock" : ICON[p.id] || "award"} size={Math.round(size * 0.45)} color={rim ? brand.white : c.faint} strokeWidth={2.2} />
    </View>
  );
}

function PinDetail({ p, onClose }: { p: PinState; onClose: () => void }) {
  const { c } = useTheme();
  const hidden = hiddenPin(p);
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 20 }}>
        <Pressable onPress={() => {}} testID="pin-detail" style={{ backgroundColor: c.surface, borderRadius: 20, padding: 20, gap: 12 }}>
          <PinArt p={p} size={72} />
          <T kind="title">{hidden ? "A secret pin" : p.name}</T>
          <T>{hidden ? `Hint: ${p.hint} You'll see what it is once you earn it.` : `${p.earned ? "You earned it: " : "How to earn it: "}${p.how.charAt(0).toLowerCase() + p.how.slice(1)}.`}</T>
          {!hidden && p.tiers.length > 1 && p.tiers.map((t, i) => (
            <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Icon name={p.tier > i ? "check" : "lock"} size={16} color={p.tier > i ? c.sage : c.faint} />
              <T style={{ fontFamily: font.bold, width: 60 }}>{TIER_NAME[i]}</T>
              <T kind="small" style={{ flex: 1 }}>{`${t} ${p.unit}`}</T>
              <T kind="small">{`+${p.xp[i]} XP`}</T>
            </View>
          ))}
          {!hidden && p.tiers.length === 1 && <T kind="small">{p.xp[0] ? `Worth ${p.xp[0]} XP.` : "Its XP is counted with the step itself (see Levels)."}</T>}
          {p.tiers.length > 1 && <T kind="small">{`You have ${p.n} ${p.unit} so far.`}</T>}
          {!hidden && p.next !== null && <Button testID="button-pin-go" label="Go do it" icon="arrow" onPress={() => { onClose(); router.back(); setTimeout(() => go(p.link), 250); }} flex />}
          <Button testID="button-pin-close" kind="ghost" label="Close" onPress={onClose} flex />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const FILTERS: [PinKind | "all", string][] = [["all", "All"], ["first", "Firsts"], ["craft", "Craft"], ["grit", "Grit"], ["secret", "Secret"]];

function Pins({ pins }: { pins: PinState[] }) {
  const { c } = useTheme();
  const [open, setOpen] = useState("");
  const [f, setF] = useState<PinKind | "all">("all");
  const list = pins.filter((p) => f === "all" || p.kind === f);
  const near = pins.filter((p) => p.next !== null && !hiddenPin(p))
    .map((p, i) => ({ p, r: p.tiers.length > 1 ? p.n / p.next! : 0, i })).sort((a, b) => b.r - a.r || a.i - b.i).slice(0, 3).map((x) => x.p);
  const shown = pins.find((p) => p.id === open);
  return (
    <View testID="rewards-pins">
      <Sect title="Closest to earning" />
      <Group>
        {near.map((p, i) => (
          <Row key={p.id} first={i === 0} title={p.name} sub={status(p)} left={<PinArt p={p} size={36} />} onPress={() => setOpen(p.id)} testID={`button-near-${p.id}`} />
        ))}
      </Group>
      <Sect title={`Your pin case · ${pins.filter((p) => p.earned).length} of ${pins.length}`} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
        {FILTERS.map(([k, l]) => <Pill key={k} testID={`button-pin-filter-${k}`} on={f === k} onPress={() => setF(k)}
          label={k === "all" ? l : `${l} ${pins.filter((p) => p.kind === k && p.earned).length}/${pins.filter((p) => p.kind === k).length}`} />)}
      </ScrollView>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {list.map((p) => (
          <Pressable key={p.id} testID={`button-pin-${p.id}`} onPress={() => { tap(); setOpen(p.id); }}
            style={({ pressed }) => ({ width: "31%", flexGrow: 1, alignItems: "center", gap: 6, paddingVertical: 14, paddingHorizontal: 6, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: pressed ? c.surface2 : c.surface })}>
            <PinArt p={p} size={52} />
            <Text numberOfLines={2} style={{ fontFamily: p.earned ? font.bold : font.semi, fontSize: 13, textAlign: "center", color: p.earned ? c.ink : c.mutedText }}>{hiddenPin(p) ? "???" : p.name}</Text>
            {p.tiers.length > 1
              ? <View style={{ flexDirection: "row", gap: 4 }}>{p.tiers.map((_, i) => <View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: p.tier > i ? [c.metalBronze, c.metalSilver, c.metalGold][i] : c.line }} />)}</View>
              : <T kind="small" style={{ fontSize: 12 }}>{hiddenPin(p) ? "Secret" : p.earned ? "Earned" : "Not yet"}</T>}
          </Pressable>
        ))}
      </View>
      <T kind="small" style={{ marginTop: 12 }}>Craft pins grow from bronze to gold with real steps. Secret pins stay hidden until you find them.</T>
      {shown && <PinDetail p={shown} onClose={() => setOpen("")} />}
    </View>
  );
}

const rewardOf = (n: number) => { const r = n === 1 ? { kind: "outfit" as const, key: "suit" } : levelReward(n); return !r ? "" : r.kind === "outfit" ? `Remy's ${(OUTFIT_NAME[r.key] || r.key).toLowerCase()}` : `${r.label} for his office`; };

function Levels({ xp, lv }: { xp: number; lv: ReturnType<typeof rankOf> }) {
  const { c } = useTheme();
  const [all, setAll] = useState(false);
  const earn: [string, string][] = [
    ["Daily cards and quests on My Path", `+${CARD_XP} each`], ["Weekly big move", "+35 to 80"], ["All of the week's moves", `+${ALL_DONE_BONUS} bonus`],
    ["Confirm your resume", "+100"], ["Send an application", "+120 each"], ["Get an interview", "+250 each"], ["Get an offer", "+500"], ["Earn or upgrade a pin", "+25 to 150"],
  ];
  const pct = lv.max ? 100 : Math.round((Math.max(0, xp - lv.floor) / Math.max(1, lv.next - lv.floor)) * 100);
  const rows = RANKS.map(([name, at], i) => ({ n: i + 1, name, at })).filter((r) => all || (r.n > lv.n && r.n <= lv.n + 3));
  const hue = lvHue(c, lv.n);
  return (
    <View testID="rewards-levels">
      <Sect title="Your level" right={<T kind="small">Levels never go down.</T>} />
      <Card testID="rewards-my-level" style={{ flexDirection: "row", alignItems: "center", gap: 14, borderColor: hue, borderWidth: 2 }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: hue, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: font.display, fontSize: 20, color: brand.white }}>{lv.n}</Text></View>
        <View style={{ flex: 1, gap: 6 }}>
          <T style={{ fontFamily: font.display, fontSize: 18 }}>{lv.name}</T>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: c.surface2, overflow: "hidden" }}><View style={{ width: `${pct}%`, height: 8, backgroundColor: hue }} /></View>
          <T kind="small">{lv.max ? "Top level reached." : `${Math.max(0, xp - lv.floor).toLocaleString("en-US")} / ${(lv.next - lv.floor).toLocaleString("en-US")} XP to level ${lv.n + 1}`}</T>
        </View>
      </Card>
      <Sect title={all ? "Every level" : "Coming up"} />
      <Group>
        {rows.map(({ n, name, at }, i) => (
          <Row key={n} first={i === 0} subLines={2} testID={`rank-${n}`} title={`${name}${n === lv.n ? " · You're here" : ""}`} sub={`${at.toLocaleString("en-US")} XP${rewardOf(n) ? ` · ${rewardOf(n)}` : ""}`}
            left={<View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: n <= lv.n ? lvHue(c, n) : c.surface2, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: font.bold, fontSize: 13, color: n <= lv.n ? brand.white : c.mutedText }}>{n}</Text></View>}
            right={<View />} />
        ))}
        {!rows.length && <Row first title="Top level reached" right={<View />} />}
      </Group>
      <Button testID="button-levels-all" kind="ghost" label={all ? "Show less" : `See all ${RANKS.length} levels`} onPress={() => setAll(!all)} style={{ marginTop: 10 }} flex />
      <Sect title="How you earn XP" />
      <Card style={{ gap: 10 }}>
        <T><Text style={{ fontFamily: font.bold }}>{xp.toLocaleString("en-US")} XP</Text>{` so far${lv.max ? "" : `, ${(lv.next - xp).toLocaleString("en-US")} to level ${lv.n + 1}`}`}</T>
        {earn.map(([what, n]) => <View key={what} style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}><T kind="small" style={{ color: c.ink, flex: 1 }}>{what}</T><T kind="small" style={{ fontFamily: font.bold, color: c.ink }}>{n}</T></View>)}
        <T kind="small">XP only comes from real steps. Opening the app or tapping around earns nothing.</T>
      </Card>
    </View>
  );
}

function Wardrobe({ ws, lv }: { ws: Workspace; lv: ReturnType<typeof rankOf> }) {
  const { c } = useTheme();
  const { setWs } = useSession();
  const g = ws.game || { weeks: {} };
  const owned = unlockedOutfits(Math.max(g.bestRank || 0, lv.n), ws.profile.classYear), wearing = g.outfit && owned.includes(g.outfit) ? g.outfit : "suit";
  const outfits: [string, string][] = [...WARDROBE.map(([k, l]) => [k, `Level ${l}`] as [string, string]), ["gown", "When you graduate"]];
  const [err, setErr] = useState("");
  const wear = async (k: string) => { tap(); setErr(""); try { setWs(await api<Workspace>("PUT", "/api/ws/game", { value: { ...g, outfit: k } })); } catch (e: any) { setErr(e.message); } };
  const rare = rareOwned(g);
  const steps: [IconName, string, string, boolean | null][] = [
    ["book", "Books on the shelf", "One for every job you decode", (g.known || []).length > 0],
    ["doc", "Your resume on file", "Add your resume", !!ws.resume],
    ["award", "Certificate frames", "Earn a certificate on your path", null],
    ["jobs", "Briefcase", "Tailor or send an application", ws.applications.length > 0],
    ["heart", "A plant that grows", "Grows with your daily streak", dailyStreak(streakDays(ws)).days > 0],
  ];
  return (
    <View testID="rewards-wardrobe">
      <Sect title="Remy's outfits" />
      <T kind="small" style={{ marginHorizontal: 4, marginBottom: 10 }}>Unlock them by leveling up. Tap one you own to put it on Remy.</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {outfits.map(([k, when]) => { const got = owned.includes(k); return (
          <Pressable key={k} testID={`button-wear-${k}`} disabled={!got} onPress={() => wear(k)} accessibilityState={{ selected: wearing === k, disabled: !got }}
            style={{ width: "31.5%", alignItems: "center", gap: 4, padding: 10, borderRadius: 16, borderWidth: wearing === k ? 2 : 1, borderColor: wearing === k ? c.fox : c.line, backgroundColor: c.surface }}>
            <View style={{ opacity: got ? 1 : 0.35 }}><SvgXml xml={OUTFITS[k as Outfit] || OUTFITS.suit} width={58} height={64} /></View>
            <Text numberOfLines={2} style={{ fontFamily: font.bold, fontSize: 12.5, textAlign: "center", color: got ? c.ink : c.mutedText }}>{OUTFIT_NAME[k] || k}</Text>
            <T kind="small" style={{ fontSize: 12, color: wearing === k ? c.foxDeep : c.mutedText }}>{wearing === k ? "Wearing" : got ? "Tap to wear" : when}</T>
          </Pressable>); })}
      </View>
      {!!err && <T kind="small" style={{ color: c.error, marginTop: 8 }}>{err}</T>}
      <Sect title="Remy's office" right={<Pressable testID="link-rewards-office" hitSlop={8} onPress={() => { router.back(); setTimeout(() => router.navigate("/path" as any), 250); }}><T kind="small" style={{ color: c.foxDeep, fontFamily: font.semi }}>See the office</T></Pressable>} />
      <Group>
        {OFFICE.map(([k, label, l], i) => { const got = lv.n >= l; return <Row key={k} first={i === 0} title={label} sub={got ? "In the office" : `Level ${l}`} left={<Icon name={got ? "check" : "lock"} size={18} color={got ? c.sage : c.faint} />} right={<View />} />; })}
      </Group>
      <Sect title="Rare finds from the daily chest" />
      <Group>
        {RARE.map(([k, label], i) => { const got = rare.has(k); return <Row key={k} first={i === 0} testID={`rare-${k}`} title={label} sub={got ? "In the office" : "Chest only"} left={<Icon name={got ? "check" : "gift"} size={18} color={got ? c.sage : c.faint} />} right={<View />} />; })}
      </Group>
      <Sect title="From your real steps" />
      <Group>
        {steps.map(([icon, name, how, got], i) => <Row key={name} first={i === 0} title={name} sub={got ? "In the office" : how} left={<Icon name={icon} size={18} color={got ? c.sage : c.mutedText} />} right={<View />} />)}
      </Group>
    </View>
  );
}

function Streak({ ws }: { ws: Workspace }) {
  const { c } = useTheme();
  const s = dailyStreak(streakDays(ws));
  const rules: [IconName, string, string][] = [
    ["flame", "Daily streak", "Any real step in Remy counts for the day: rating an opening, a career step, or a message to Remy. Days start at 4 AM."],
    ["snow", "Streak freezes", `You earn one every ${FREEZE_EVERY} days in a row, up to ${FREEZE_MAX}. A freeze covers a missed day by itself.`],
    ["zap", "Daily quests", "Three small quests on My Path every day, new at 4 AM. Each one is worth XP."],
    ["gift", "Daily chest", `Finish all three quests to open the day's chest. Most days it holds ${CHEST_XP} bonus XP; now and then a rare item for Remy's office that only the chest gives. Coming back after a week or more away? That day's chest gives double XP.`],
    ["award", "Weekly big move", "One bigger step each week, worth extra XP. A new one comes every Monday."],
  ];
  const milestones: [number, string][] = [[7, "The desk plant blooms"], [30, "A framed “30 days” photo"], [100, "The photo turns gold: “100 days”"]];
  return (
    <View testID="rewards-streak">
      <Card style={{ marginTop: 20, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Icon name="flame" size={30} color={s.days ? c.fox : c.faint} />
          <T style={{ fontFamily: font.display, fontSize: 22 }}>{`${s.days} day${s.days === 1 ? "" : "s"} in a row`}</T>
        </View>
        {([["Best streak", `${s.best} days`], ["Freezes saved", `${s.freezes} of ${FREEZE_MAX}`], ["Today", s.todayDone ? "Done" : "Not yet"]] as [string, string][]).map(([k, v]) =>
          <View key={k} style={{ flexDirection: "row", justifyContent: "space-between" }}><T kind="small" style={{ color: c.ink }}>{k}</T><T kind="small" style={{ fontFamily: font.bold, color: c.ink }}>{v}</T></View>)}
        <Button testID="button-rewards-quests" label="Today's quests" icon="arrow" onPress={() => { router.back(); setTimeout(() => router.navigate("/path" as any), 250); }} flex />
      </Card>
      <Sect title="How it works" />
      <Group>{rules.map(([icon, t, d], i) => <Row key={t} first={i === 0} title={t} sub={d} subLines={5} left={<Icon name={icon} size={18} color={c.mutedText} />} right={<View />} />)}</Group>
      <Sect title="Streak milestones in Remy's office" />
      <Group>{milestones.map(([n, t], i) => <Row key={n} first={i === 0} title={`${n} days in a row`} sub={t} left={<Icon name={s.best >= n ? "check" : "lock"} size={18} color={s.best >= n ? c.sage : c.faint} />} right={<View />} />)}</Group>
      <T kind="small" style={{ marginTop: 10, marginHorizontal: 4 }}>Counts your best streak, so a milestone stays once you reach it. The Steady pin rewards the same 7, 30 and 100 days.</T>
    </View>
  );
}

/** More → Rewards: everything you can earn in Remy, what you have, and exactly what unlocks the rest. */
export default function Rewards() {
  const { ws } = useSession();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>((["pins", "levels", "wardrobe", "streak"].includes(params.tab || "") ? params.tab : "pins") as Tab);
  if (!ws) return null;
  const g = ws.game || { weeks: {} };
  const xp = xpOf(ws, g), lv = rankOf(xp, g.bestRank);
  const pins = pinsOf(ws), earned = pins.filter((p) => p.earned).length;
  const s = dailyStreak(streakDays(ws));
  return (
    <ScrollView testID="rewards-page" style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
      <T kind="muted">Everything you can earn in Remy, what you have, and exactly what unlocks the rest.</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 14 }}>
        <Chip text={`Level ${lv.n} · ${lv.name}`} tone="soon" />
        <Chip text={`${xp.toLocaleString("en-US")} XP`} />
        <Chip text={`${earned} pin${earned === 1 ? "" : "s"}`} />
        <Chip text={`${s.days} day${s.days === 1 ? "" : "s"}`} tone={s.days ? "soon" : "plain"} />
      </View>
      <Segmented testID="tabs-rewards" value={tab} onChange={setTab}
        options={[{ key: "pins", label: "Pins" }, { key: "levels", label: "Levels" }, { key: "wardrobe", label: "Outfits" }, { key: "streak", label: "Streak" }]} />
      {tab === "pins" && <Pins pins={pins} />}
      {tab === "levels" && <Levels xp={xp} lv={lv} />}
      {tab === "wardrobe" && <Wardrobe ws={ws} lv={lv} />}
      {tab === "streak" && <Streak ws={ws} />}
    </ScrollView>
  );
}
