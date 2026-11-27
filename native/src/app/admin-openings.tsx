import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Loading, Sect, Segmented, T, tap } from "@/components/ui";
import { Input } from "@/components/setup/common";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { font, useTheme } from "@/lib/theme";
import { radius } from "@/lib/tokens";

// Owners' Openings, native (the website's Admin → Openings, client/src/pages/Admin.tsx OpeningsTab): every public posting
// Remy found or re-checked, with counts, filters by status, company, industry and career path. No student data.
type Opening = { url: string; title: string; company: string; location: string; industry: string; career_path: string; last_seen: string; times_seen: number; check_result: string | null };
type Data = { summary: { total: number; closed: number; unchecked: number; companies: number; keepDays: number; byIndustry: { industry: string; n: number }[]; byPath: { career_path: string; n: number }[] }; openings: Opening[]; catalog?: { employers: number; partsRead: number; reached: number; studentLevel: number; oldest: string | null } | null };
type Filter = { industry: string; path: string; status: "" | "open" | "unchecked" | "closed"; company: string };
const NONE: Filter = { industry: "", path: "", status: "", company: "" };
const plural = (n: number, one: string, many = one + "s") => `${n.toLocaleString()} ${n === 1 ? one : many}`;
const ago = (iso: string) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000); return m < 60 ? `${Math.max(1, m)} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

export default function AdminOpenings() {
  const { me } = useSession();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [f, setF] = useState<Filter>(NONE);
  const [company, setCompany] = useState("");
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [shown, setShown] = useState(30);
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
  useEffect(() => {
    if (!me?.owner) return;
    let on = true;
    setErr("");
    api<Data>("GET", `/api/admin/openings${qs ? "?" + qs : ""}` as `/api/${string}`).then((r) => { if (on) { setD(r); setShown(30); } }).catch((e) => on && setErr(e.message));
    return () => { on = false; };
  }, [qs, me?.owner]);
  if (!me?.owner) return null;
  if (!d) return err ? <View style={{ flex: 1, backgroundColor: c.bg, padding: 20 }}><T style={{ color: c.error }}>{err}</T></View> : <Loading />;
  const s = d.summary;
  const open = Math.max(0, s.total - s.closed - s.unchecked);
  const filtered = Object.values(f).some(Boolean);
  const card = { backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 14, gap: 8 } as const;
  const Tile = ({ n, label, sub }: { n: number; label: string; sub: string }) => (
    <View style={{ ...card, flexBasis: "47%", flexGrow: 1, gap: 2 }}>
      <Text style={{ fontFamily: font.display, fontSize: 22, color: c.ink }}>{n.toLocaleString()}</Text>
      <T kind="label">{label}</T><T kind="small">{sub}</T>
    </View>
  );
  const bars = (rows: { name: string; n: number }[], on: string, pick: (v: string) => void, id: string, top = 6) => {
    const max = Math.max(1, ...rows.map((r) => r.n));
    return rows.slice(0, top).map((r) => (
      <Pressable key={r.name} testID={`${id}-${r.name || "none"}`} accessibilityRole="button" accessibilityState={{ selected: on === r.name }} onPress={() => { tap(); pick(on === r.name ? "" : r.name); }} style={{ gap: 4, paddingVertical: 2 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <T kind="small" numberOfLines={1} style={{ flex: 1, color: c.ink, fontFamily: on === r.name ? font.bold : undefined }}>{r.name || "(none)"}</T>
          <T kind="small" style={{ fontFamily: font.semi }}>{r.n}</T>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: c.line }}><View style={{ width: `${(r.n / max) * 100}%`, height: 6, borderRadius: 3, backgroundColor: on === r.name ? c.ink : c.fox }} /></View>
      </Pressable>
    ));
  };

  return (
    <ScrollView testID="admin-openings" style={{ flex: 1, backgroundColor: c.bg }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: insets.bottom + 32 }}>
      <T kind="muted"><Text style={{ fontFamily: font.bold, color: c.ink }}>{plural(s.total, "opening")} from {plural(s.companies, "employer")}.</Text> Public postings only, kept {s.keepDays} days after last seen.</T>
      {d.catalog ? <T kind="small">Employer catalog: {d.catalog.studentLevel.toLocaleString()} student-level US postings from {d.catalog.reached.toLocaleString()} of {d.catalog.employers.toLocaleString()} employers' boards ({d.catalog.partsRead} of 24 parts read{d.catalog.oldest ? `, oldest ${ago(d.catalog.oldest)}` : ""}).</T> : null}
      {err ? <T style={{ color: c.error }}>{err}</T> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <Tile n={s.total} label="Openings" sub="shared across students" />
        <Tile n={open} label="Checked, not closed" sub="re-checked at least once" />
        <Tile n={s.unchecked} label="Not re-checked yet" sub="link not opened since found" />
        <Tile n={s.closed} label="Look closed" sub="posting seems taken down" />
      </View>

      <Sect title="By industry" />
      <View style={card}>{s.byIndustry.length ? bars(s.byIndustry.map((r) => ({ name: r.industry, n: r.n })), f.industry, (v) => setF({ ...f, industry: v }), "openings-industry") : <T kind="small">No openings yet.</T>}</View>
      <Sect title="By career path" />
      <View style={card}>{s.byPath.length ? bars(s.byPath.map((r) => ({ name: r.career_path, n: r.n })), f.path, (v) => setF({ ...f, path: v }), "openings-path", 5) : <T kind="small">No openings yet.</T>}</View>

      <Sect title={filtered ? plural(d.openings.length, "match", "matches") : "Latest openings"} />
      <Segmented testID="openings-status" value={f.status || "all"} onChange={(v) => setF({ ...f, status: v === "all" ? "" : v })} options={[{ key: "all", label: "All" }, { key: "open", label: "Open" }, { key: "unchecked", label: "Unchecked" }, { key: "closed", label: "Closed" }]} />
      <Input testID="input-openings-company" value={company} onChangeText={setCompany} placeholder="Search a company" returnKeyType="search" onSubmitEditing={() => setF({ ...f, company: company.trim() })} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button testID="button-openings-search" kind="ghost" label="Search" onPress={() => { tap(); setF({ ...f, company: company.trim() }); }} flex />
        {filtered ? <Button testID="button-openings-clear" kind="ghost" label="Clear filters" onPress={() => { tap(); setCompany(""); setF(NONE); }} flex /> : null}
      </View>
      {d.openings.slice(0, shown).map((o) => (
        <Pressable key={o.url} testID="row-opening" accessibilityRole="link" onPress={() => Linking.openURL(o.url)} style={card}>
          <T style={{ fontFamily: font.semi }} numberOfLines={2}>{o.title}</T>
          <T kind="small" numberOfLines={1}>{o.company}{o.location ? ` · ${o.location}` : ""} · {[o.industry, o.career_path].filter(Boolean).join(" / ") || "untagged"}</T>
          <T kind="small">{o.check_result === "closed-signal" ? "Looks closed" : o.check_result === "reachable" ? "Open" : o.check_result || "Not checked"} · seen {o.times_seen}× · {ago(o.last_seen)}</T>
        </Pressable>
      ))}
      {!d.openings.length && <T kind="small">Nothing matches. Try another filter, or Clear filters.</T>}
      {d.openings.length > shown && <Button testID="button-more-openings" kind="ghost" label="Show more" onPress={() => setShown(shown + 30)} flex />}
    </ScrollView>
  );
}
