import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { rankOf, nextOutfit, xpOf, WARDROBE } from "@shared/game";
import { TIER_NAME, newPins, pinsSeen, type PinState } from "@shared/pins";
import type { Workspace } from "@shared/types";
import { Button, Remy, T, success } from "@/components/ui";
import { PinArt } from "@/components/PinArt";
import { OUTFIT_NAME, type Outfit } from "@/components/scholarSvg";
import { api } from "@/lib/api";
import { go } from "@/lib/nav";
import { useOwnerView, useSession } from "@/lib/session";
import { font, useTheme, type Colors } from "@/lib/theme";

// The moments the website shows when they happen (PinMoment.tsx and PathBoard's LevelUp), for the app: a new career pin
// (or tier), a first interview or offer (Remy in his gown), and a new level with any outfit it unlocks. The first time
// this runs it only records what the student already has, so nobody gets a pile of pop-ups for old steps. Pins and the
// level are saved together, in one `game` save, so neither overwrites the other.
type Moment = { kind: "pin"; p: PinState; more: number } | { kind: "big"; big: "interview" | "offer"; company: string } | { kind: "level"; n: number; fresh: string };

/** The company of the student's first interview (or offer): the earliest such event, or the row's status. */
function companyFor(w: Workspace, status: "Interview" | "Offer") {
  const ok = (st: string) => st === status || (status === "Interview" && st === "Offer");
  const first = (t: Workspace["tracker"][number]) => t.events.filter((e) => ok(e.status)).map((e) => e.at).sort()[0] || (ok(t.status) ? "~" : "");
  return w.tracker.filter(first).sort((a, b) => first(a).localeCompare(first(b)))[0]?.company || "";
}

export function Moments() {
  const { ws, setWs } = useSession();
  const owner = useOwnerView();
  const [queue, setQueue] = useState<Moment[]>([]);
  const g = ws?.game;
  const fresh = ws ? newPins(ws) : [];
  const lv = ws ? rankOf(xpOf(ws, g || ({} as NonNullable<Workspace["game"]>)), g?.bestRank).n : 0;
  const best = g?.bestRank || 0;
  const firstPins = !!ws && !g?.pins, firstLevel = !!ws && !best;
  const sig = fresh.map((p) => p.id + p.tier).join(",") + (firstPins ? "+p" : "") + `|${lv}>${best}`;
  useEffect(() => {
    if (!ws || !owner || (!fresh.length && !firstPins && lv <= best)) return;
    const game = { ...(ws.game || { weeks: {} }), pins: { ...(ws.game?.pins || {}), ...pinsSeen(ws) }, bestRank: Math.max(best, lv) };
    api<Workspace>("PUT", "/api/ws/game", { value: game }).then(setWs).catch(() => {});
    const next: Moment[] = [];
    if (!firstPins && fresh.length) {
      // A first interview or first offer is the big one: its own celebration, ahead of any other new pins.
      const big = fresh.find((x) => x.id === "offer") || fresh.find((x) => x.id === "interview");
      if (big) next.push({ kind: "big", big: big.id as "offer" | "interview", company: companyFor(ws, big.id === "offer" ? "Offer" : "Interview") });
      else next.push({ kind: "pin", p: fresh[0]!, more: fresh.length - 1 });
    }
    if (!firstLevel && lv > best) next.push({ kind: "level", n: lv, fresh: WARDROBE.find(([, l]) => l > best && l <= lv)?.[0] || "" });
    if (next.length) { success(); setQueue((q) => [...q, ...next]); }
  }, [sig, owner]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = queue[0];
  if (!m || !ws) return null;
  const close = () => setQueue((q) => q.slice(1));
  const wear = (k: string) => { api<Workspace>("PUT", "/api/ws/game", { value: { ...(ws.game || { weeks: {} }), outfit: k } }).then(setWs).catch(() => {}); close(); };
  const then = (to: string) => { close(); setTimeout(() => go(to), 250); };
  if (m.kind === "big") {
    const offer = m.big === "offer", at = m.company ? ` ${offer ? "from" : "at"} ${m.company}` : "";
    return (
      <Card onClose={close} testID={`big-moment-${m.big}`} confetti>
        <Remy size={150} outfit="gown" />
        <T kind="title" style={{ textAlign: "center" }}>{offer ? `Your first offer${at}!` : `Your first interview${at}!`}</T>
        <T style={{ textAlign: "center" }}>{offer ? "You did this. Every resume line, every application and every interview led here. Take a breath, then ask me anything about the offer before you answer them."
          : "That's what all the work was for. You earned the First interview pin. Want to practise the questions they'll likely ask?"}</T>
        <Button testID={`button-big-moment-${m.big}`} kind="fox" label={offer ? "Look at the offer" : "Practise with Remy"} onPress={() => then(offer ? "/progress" : "/interview")} flex />
        <Button testID="button-big-moment-rewards" kind="ghost" label="See my pins" onPress={() => then("/rewards")} flex />
      </Card>
    );
  }
  if (m.kind === "pin") {
    const p = m.p, tier = p.tiers.length > 1 ? ` (${TIER_NAME[p.tier - 1]!.toLowerCase()})` : "", xp = p.xp[p.tier - 1];
    return (
      <Card onClose={close} testID="pin-moment">
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}><Remy size={96} /><PinArt p={p} size={72} /></View>
        <T kind="title" style={{ textAlign: "center" }}>New pin: {p.name}{tier}</T>
        <T style={{ textAlign: "center" }}><Text style={{ fontFamily: font.bold }}>Earned for:</Text> {p.how.charAt(0).toLowerCase() + p.how.slice(1)}.{xp ? ` That's +${xp} XP.` : ""}{m.more > 0 ? ` And ${m.more} more new pin${m.more === 1 ? "" : "s"}.` : ""}</T>
        <Button testID="button-pin-moment-rewards" label="See all rewards" onPress={() => then("/rewards")} flex />
        <Button testID="button-pin-moment-close" kind="ghost" label="Nice" onPress={close} flex />
      </Card>
    );
  }
  const after = nextOutfit(m.n);
  return (
    <Card onClose={close} testID="path-level-up" confetti={!!m.fresh}>
      <Remy size={120} outfit={(m.fresh || undefined) as Outfit | undefined} />
      <T kind="title" style={{ textAlign: "center" }}>Level {m.n}: {rankOf(0, m.n).name}</T>
      <T style={{ textAlign: "center" }}>{m.fresh ? `You unlocked ${OUTFIT_NAME[m.fresh] || m.fresh}. Want Remy to put it on?` : `Nice climbing.${after ? ` Level ${after[1]} unlocks ${OUTFIT_NAME[after[0]] || after[0]}.` : ""}`}</T>
      {!!m.fresh && <Button testID="button-wear-outfit" kind="fox" label="Put it on" onPress={() => wear(m.fresh)} flex />}
      <Button testID="button-level-up-close" kind="ghost" label={m.fresh ? "Later" : "Keep going"} onPress={close} flex />
    </Card>
  );
}

// Confetti from the palette only: a ring of small pieces around Remy.
const PIECES: (keyof Colors)[] = ["fox", "gemGold", "gemSky", "gemPink", "gemGreen", "gemViolet"];
function Card({ children, onClose, testID, confetti }: { children: React.ReactNode; onClose: () => void; testID: string; confetti?: boolean }) {
  const { c } = useTheme();
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 }}>
        <Pressable onPress={() => {}} testID={testID} style={{ backgroundColor: c.surface, borderRadius: 24, padding: 22, gap: 12, alignItems: "center", overflow: "hidden" }}>
          {confetti && <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: 190 }}>
            {Array.from({ length: 18 }, (_, i) => {
              const a = (i * 20 * Math.PI) / 180, r = 92 + (i % 3) * 14;
              return <View key={i} style={{ position: "absolute", left: "50%", top: 96, width: 8, height: i % 2 ? 8 : 14, borderRadius: 2, marginLeft: Math.cos(a) * r * 1.4 - 4, marginTop: Math.sin(a) * r * 0.85 - 4, transform: [{ rotate: `${i * 37}deg` }], backgroundColor: c[PIECES[i % PIECES.length]!] as string }} />;
            })}
          </View>}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
