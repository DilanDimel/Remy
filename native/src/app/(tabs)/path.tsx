import { router } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import type { Workspace } from "@shared/types";
import { CHEST_XP, RARE, chestPrize, welcomeBack } from "@shared/chest";
import { dailyStreak, dayKey, streakDays } from "@shared/daily";
import { RANKS, counters, doneThisWeek, levelReward, nextOutfit, rankOf, unlockedOutfits, weekKey, weekMissions, xpOf } from "@shared/game";
import { dailyQuests, seasonOf } from "@shared/path";
import { prepChain } from "@shared/prep";
import { YEARS, yearNumber } from "@shared/roads";
import { Office } from "@/components/Office";
import { Button, Group, Icon, Remy, Row, Screen, Sect, T, success, tap, type IconName } from "@/components/ui";
import { OUTFIT_NAME, type Outfit } from "@/components/scholarSvg";
import { api } from "@/lib/api";
import { askRemy, go } from "@/lib/nav";
import { useRefreshAll, useSession } from "@/lib/session";
import { BUTTON_RADIUS, font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

const QUEST_ICON: Record<string, IconName> = { rate: "eye", role: "compass", xp: "zap" };

// A plan stop opens where it lives on the website's My Path; a semester isn't there, so Remy helps plan it.
type Stop = { key: string; title: string; sub: string; icon: IconName; path?: string; ask?: string };

/** My Path = Remy's office (handoff P1.5), the website's PathBoard as native sections: the season and its level track,
 *  the office, an ask box, today's quests and chest, this week's big move (or interview prep), then the plan's steps. */
export default function PathTab() {
  const { ws, setWs } = useSession();
  const refresh = useRefreshAll();
  const { c } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [moment, setMoment] = useState("");
  const [err, setErr] = useState("");
  if (!ws) return null;
  const g = ws.game || { weeks: {} };
  const saveGame = async (game: Workspace["game"]) => setWs(await api<Workspace>("PUT", "/api/ws/game", { value: game }));
  const onRefresh = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };

  // The season (PathBoard.tsx Season)
  const year = Math.min(5, Math.max(1, yearNumber(ws.profile.classYear) || 1));
  const se = seasonOf(new Date(), year);
  const streak = dailyStreak(streakDays(ws));
  const xp = xpOf(ws, g), lv = rankOf(xp, g.bestRank);
  const owned = unlockedOutfits(lv.n, ws.profile.classYear), wearing = g.outfit && owned.includes(g.outfit) ? g.outfit : "suit";
  const first = Math.max(1, Math.min(lv.n - 2, RANKS.length - 7));
  const tiles = Array.from({ length: 8 }, (_, i) => first + i).filter((n) => n <= RANKS.length);
  const pct = lv.max ? 100 : Math.round((Math.max(0, xp - lv.floor) / Math.max(1, lv.next - lv.floor)) * 100);
  const bigNext = nextOutfit(lv.n);
  const wear = (o: string) => { tap(); saveGame({ ...g, outfit: o }).catch((e) => setErr(e.message)); };

  // Today's quests and chest
  const day = dayKey(), today = g.days?.[day] || [];
  const quests = dailyQuests(ws, today);
  const all = quests.every((x) => x.n >= x.of);
  const away = welcomeBack(streakDays(ws), day);
  const got = g.chests?.[day];
  const openChest = () => {
    const prize = chestPrize(day, g, away > 0);
    success(); setMoment(prize);
    saveGame({ ...g, chests: { ...(g.chests || {}), [day]: prize } }).catch((e) => { setMoment(""); setErr(e.message); });
  };
  const rareName = (k?: string) => RARE.find(([r]) => r === k)?.[1];

  // This week's big move, or the interview prep chain when an interview is close
  const prep = prepChain(ws, day);
  const wk = weekKey(), missions = weekMissions(ws, wk), done = doneThisWeek(ws, g, wk, counters(ws));
  const move = missions.find((m) => !done.includes(m.key));

  // The plan's steps
  const plan = ws.plan;
  const career = plan?.careers.find((x) => x.id === plan.chosenCareerId) || plan?.careers[0];
  const stops: Stop[] = [
    ...(career?.steps || []).slice(0, 5).map((s, i) => ({ key: "s" + i, title: s, sub: "Step", icon: "flag" as IconName, path: "/path?side=skills" })),
    ...(plan?.skills || []).slice(0, 2).map((s) => ({ key: s.id, title: s.name, sub: s.type === "certification" ? "Certification" : s.type === "course" ? "Course" : "Skill", icon: "trend" as IconName, path: s.type === "certification" ? "/path?side=certs" : "/path?side=skills" })),
    ...(plan?.academic || []).slice(0, 2).map((a) => ({ key: a.id, title: a.term, sub: "Your semester", icon: "book" as IconName, ask: `Help me plan my ${a.term} semester` })),
  ];
  const openStop = (s: Stop) => (s.ask ? askRemy(s.ask) : go(s.path || "/path", "My Path", { page: true }));
  // Empty, the arrow just opens his chat; with a question, it asks it there.
  const ask = () => { const t = q.trim(); tap(); if (!t) return void router.push("/remy"); setQ(""); askRemy(t); };

  const card = { backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 16, marginTop: 14 } as const;
  const kicker = { fontFamily: font.bold, fontSize: 11.5, letterSpacing: 0.8, textTransform: "uppercase" as const, color: c.mutedText };
  // The website's season chips: outlined pills; the level chip leads with its number in a dark circle.
  const pill = { flexDirection: "row" as const, alignItems: "center" as const, gap: 6, backgroundColor: c.surface, borderWidth: 1, borderColor: c.line, borderRadius: 16, paddingHorizontal: 11, height: 34 };
  const chip = (icon: IconName, text: string, color: string) => (
    <View style={pill}><Icon name={icon} size={16} color={color} /><Text style={{ fontFamily: font.bold, fontSize: 13.5, color: c.ink }}>{text}</Text></View>
  );
  const bar = (p: number, h = 8) => <View style={{ height: h, borderRadius: h / 2, backgroundColor: c.foxSoft, overflow: "hidden" }}><View style={{ width: `${Math.max(0, Math.min(100, p))}%`, height: h, backgroundColor: c.fox }} /></View>;

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <T kind="display" style={{ marginTop: 28 }}>My Path</T>
      <T kind="muted"><Text style={{ fontFamily: font.bold }}>Every step anywhere in Remy earns XP.</Text> Every level gives you something new.</T>
      {!!err && <T kind="small" style={{ color: c.error, marginTop: 8 }}>{err}</T>}

      <View style={card} testID="path-season">
        <Text style={{ ...kicker, color: c.foxDeep }}>{se.name} season · {YEARS[year]}</Text>
        <T kind="h2" style={{ marginTop: 2 }}>{se.goal}</T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {chip("flame", `${streak.days} day${streak.days === 1 ? "" : "s"}`, streak.days ? c.fox : c.faint)}
          {chip("snow", `${streak.freezes} ${streak.freezes === 1 ? "freeze" : "freezes"}`, c.mutedText)}
          <View style={pill} testID="chip-level"><View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c.ink, alignItems: "center", justifyContent: "center" }}><Text style={{ fontFamily: font.bold, fontSize: 12, color: c.onInk }}>{lv.n}</Text></View><Text style={{ fontFamily: font.bold, fontSize: 13.5, color: c.ink }}>{lv.name}</Text></View>
          <Pressable testID="button-all-rewards" accessibilityRole="button" onPress={() => { tap(); go("/rewards"); }} style={({ pressed }) => [pill, pressed && { backgroundColor: c.surface2 }]}><Icon name="award" size={16} color={c.ink} /><Text style={{ fontFamily: font.bold, fontSize: 13.5, color: c.ink }}>All rewards</Text></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginHorizontal: -16 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }} testID="path-level-track">
          {tiles.map((n) => {
            const r = n === 1 ? { kind: "outfit" as const, key: "suit", level: 1 } : levelReward(n);
            const isGot = n <= lv.n, isNow = n === lv.n + 1, isOutfit = r?.kind === "outfit";
            const label = !r ? rankOf(0, n).name : isOutfit ? OUTFIT_NAME[r.key] || r.key : r.label || r.key;
            const on = isOutfit && wearing === r!.key;
            return (
              <Pressable key={n} disabled={!(isOutfit && isGot)} onPress={() => wear(r!.key)} testID={isOutfit ? `button-outfit-${r!.key}` : undefined}
                accessibilityLabel={`Level ${n}: ${label}${isOutfit && isGot ? (on ? ". Remy is wearing it" : ". Put it on Remy") : isGot ? ", unlocked" : ""}`}
                style={{ width: 92, paddingTop: 11 }}>
                {/* The website's reward cards: earned ones in a bold outline, the next one ringed in orange, the rest faded. */}
                <View style={{ minHeight: 112, borderRadius: 14, borderWidth: 2, borderBottomWidth: isGot ? 4 : 2, borderColor: isNow ? c.fox : isGot ? c.ink : c.line, backgroundColor: on ? c.foxSoft : isGot || isNow ? c.surface : c.surface2, padding: 8, paddingTop: 14, alignItems: "center", justifyContent: "center", gap: 4, opacity: isGot || isNow ? 1 : 0.6 }}>
                  {isOutfit ? <Remy size={40} outfit={r!.key as Outfit} /> : <Icon name={isGot ? "award" : "lock"} size={26} color={isGot ? c.ink : c.faint} />}
                  <Text numberOfLines={2} style={{ fontFamily: font.bold, fontSize: 11.5, lineHeight: 14, color: c.ink, textAlign: "center" }}>{label}</Text>
                  {isOutfit && isGot && <Text style={{ fontFamily: font.semi, fontSize: 10.5, color: on ? c.foxDeep : c.mutedText }}>{on ? "Wearing" : "Tap to wear"}</Text>}
                </View>
                <View style={{ position: "absolute", top: 0, alignSelf: "center", width: 22, height: 22, borderRadius: 11, backgroundColor: isNow ? c.fox : isGot ? c.ink : c.surface2, borderWidth: isGot || isNow ? 0 : 1, borderColor: c.line, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 11.5, color: isNow ? c.onFox : isGot ? c.onInk : c.mutedText }}>{n}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={{ marginTop: 12 }}>{bar(pct)}</View>
        <T kind="small" style={{ marginTop: 6 }}>{lv.max ? "Top level reached." : `${Math.max(0, xp - lv.floor)} / ${lv.next - lv.floor} XP to level ${lv.n + 1}`}</T>
        <T kind="small" style={{ color: c.mutedText }}>{se.left} days left this season{bigNext ? ` · Level ${bigNext[1]} unlocks ${(OUTFIT_NAME[bigNext[0]] || bigNext[0]).toLowerCase()}` : ""}</T>
      </View>

      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 24, marginBottom: 8, marginHorizontal: 4 }}><Text style={{ ...kicker, color: c.foxDeep }}>Remy's office</Text></View>
      <Office ws={ws} />
      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        <TextInput testID="input-office-ask" value={q} onChangeText={setQ} onSubmitEditing={ask} returnKeyType="send" placeholder="Ask Remy anything" placeholderTextColor={c.faint}
          style={{ flex: 1, height: 46, borderRadius: BUTTON_RADIUS, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, paddingHorizontal: 14, fontFamily: font.body, fontSize: 15.5, color: c.ink }} />
        <Pressable testID="button-office-ask" accessibilityLabel="Ask Remy" onPress={ask} style={{ width: 46, height: 46, borderRadius: BUTTON_RADIUS, backgroundColor: c.ink, alignItems: "center", justifyContent: "center" }}><Icon name="arrow" size={20} color={c.onInk} /></Pressable>
      </View>

      <View style={card} testID="path-quests">
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={kicker}>Daily quests</Text><Text style={{ fontFamily: font.body, fontSize: 12.5, color: c.faint }}>New at 4 AM</Text></View>
        {away > 0 && !got && <T kind="small" style={{ marginTop: 8 }} ><Text style={{ fontFamily: font.bold }}>Welcome back!</Text> You were away {away} days, and that's fine. Finish today's three quests and the chest gives double XP.</T>}
        {quests.map((x) => { const ok = x.n >= x.of; return (
          <Pressable key={x.key} testID={`button-quest-${x.key}`} onPress={() => { tap(); go(x.link, x.from); }} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: ok ? c.sageBg : c.surface2, alignItems: "center", justifyContent: "center" }}><Icon name={ok ? "check" : QUEST_ICON[x.key]!} size={17} color={ok ? c.sage : c.ink} /></View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontFamily: font.bold, fontSize: 15, color: c.ink }}>{x.title}</Text>
              <Text style={{ fontFamily: font.body, fontSize: 12.5, color: c.mutedText }}>From {x.from}</Text>
              {bar((x.n / x.of) * 100, 6)}
            </View>
            <Text style={{ fontFamily: font.semi, fontSize: 13, color: c.mutedText }}>{x.n} / {x.of}</Text>
          </Pressable>); })}
        <Pressable testID={got ? "chest-prize" : "button-open-chest"} disabled={!all || !!got} onPress={openChest}
          style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16, padding: 12, borderRadius: 12, backgroundColor: all && !got ? c.fox : c.surface2 }}>
          <Icon name="gift" size={22} color={all && !got ? c.onFox : c.mutedText} />
          <Text style={{ flex: 1, fontFamily: font.semi, fontSize: 14.5, color: all && !got ? c.onFox : c.ink }}>
            {!all ? "Finish all three to open today's chest." : !got ? "All three done. Open today's chest" : rareName(got) ? `You found a ${rareName(got)} for Remy's office!` : got === "bigxp" ? `+${2 * CHEST_XP} bonus XP. Good to have you back.` : `+${CHEST_XP} bonus XP. See you tomorrow.`}
          </Text>
        </Pressable>
      </View>

      {prep ? (
        <View style={[card, { backgroundColor: c.foxSoft, borderColor: c.foxSoft }]} testID="path-prep-chain">
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={[kicker, { color: c.foxDeep }]}>{prep.event.title} {prep.days === 0 ? "today" : prep.days === 1 ? "tomorrow" : `in ${prep.days} days`}</Text><Text style={kicker}>{prep.steps.filter((s) => s.done).length} of 4 ready</Text></View>
          {prep.steps.map((s) => (
            <Pressable key={s.key} disabled={s.done} onPress={() => go(s.link)} testID={`button-prep-${s.key}`} style={{ flexDirection: "row", gap: 10, alignItems: "center", marginTop: 10 }}>
              <Icon name={s.done ? "check" : "arrow"} size={16} color={s.done ? c.sage : c.foxDeep} />
              <Text style={{ flex: 1, fontFamily: s.done ? font.body : font.semi, fontSize: 15, color: s.done ? c.mutedText : c.ink }}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={[card, { backgroundColor: c.foxSoft, borderColor: c.foxSoft }]} testID="path-big-move">
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={[kicker, { color: c.foxDeep }]}>This week's big move</Text>{move && <Text style={[kicker, { color: c.foxDeep }]}>+{move.xp} XP</Text>}</View>
          {move ? <>
            <T kind="h2" style={{ marginTop: 6 }}>{move.title}</T>
            <T kind="small" style={{ marginTop: 4 }}>{move.effect}. About {move.mins} minutes.</T>
            <Button testID="button-big-move" label="Let's do it" icon="arrow" onPress={() => go(move.link)} style={{ marginTop: 12 }} />
            {done.length > 0 && <T kind="small" style={{ marginTop: 8, color: c.mutedText }}>{done.length} of {missions.length} done this week</T>}
          </> : <T kind="small" style={{ marginTop: 6 }}><Text style={{ fontFamily: font.bold }}>All {missions.length} done this week.</Text> Next week's move comes Monday.</T>}
        </View>
      )}

      {plan ? <>
        <Sect title={career ? `Your plan · ${career.title}` : "Your plan"} />
        <Group>{stops.map((s, i) => <Row key={s.key} first={i === 0} title={s.title} sub={s.sub} left={<Icon name={s.icon} color={i === 0 ? c.fox : c.mutedText} />} onPress={() => openStop(s)} testID="row-path-step" />)}</Group>
      </> : (
        <View style={card}>
          <T kind="h2">Your plan</T>
          <T kind="muted" style={{ marginTop: 4 }}>Remy builds it from your resume and what you want: the roles that fit and the steps to get there.</T>
          <Button testID="button-build-path" label="Build my path" icon="arrow" onPress={() => go("/path", "My Path", { page: true })} style={{ marginTop: 12 }} />
        </View>
      )}

      <Modal visible={!!moment} transparent animationType="fade" onRequestClose={() => setMoment("")}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View testID="chest-moment" style={{ width: "100%", maxWidth: 360, backgroundColor: c.surface, borderRadius: 22, padding: 24, alignItems: "center", gap: 10 }}>
            <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: c.foxSoft, alignItems: "center", justifyContent: "center" }}><Icon name="gift" size={44} color={c.fox} /></View>
            <Text style={{ fontFamily: font.display, fontSize: 30, color: c.fox }}>{rareName(moment) ? "Rare find" : `+${moment === "bigxp" ? 2 * CHEST_XP : CHEST_XP} XP`}</Text>
            <T kind="h2" style={{ textAlign: "center" }}>{rareName(moment) ? `A ${rareName(moment)!.toLowerCase()}!` : moment === "bigxp" ? "Welcome back bonus" : "Bonus XP"}</T>
            <T kind="muted" style={{ textAlign: "center" }}>{rareName(moment) ? "A rare find. Only the daily chest gives it. It's in Remy's office now." : moment === "bigxp" ? "Double XP for coming back. Good to have you." : "All three quests done today. See you tomorrow for another chest."}</T>
            <Button testID="button-chest-done" label="Nice" onPress={() => setMoment("")} flex style={{ marginTop: 6 }} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
