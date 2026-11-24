import type { ReactNode, RefObject } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View, type TextInputProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Workspace } from "@shared/types";
import { Button, Pill, Remy, T } from "@/components/ui";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { BUTTON_RADIUS, font, useTheme } from "@/lib/theme";

/** Save one workspace section the way the website's `save()` does (PUT /api/ws/:section) and take the server's copy. */
export function useSave() {
  const { setWs } = useSession();
  return async <K extends keyof Workspace>(section: K, value: Workspace[K]) => {
    const w = await api<Workspace>("PUT", `/api/ws/${String(section)}` as `/api/${string}`, { value });
    setWs(w);
    return w;
  };
}

/** A setup page: scrolls, keeps the field being typed in above the keyboard, and has room for the status bar. */
export function Page({ children, testID, scrollRef }: { children: ReactNode; testID?: string; scrollRef?: RefObject<any> }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView ref={scrollRef} testID={testID} style={{ flex: 1 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: insets.bottom + 32, gap: 18 }}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** The step dots across the top: the website's six steps (goal, resume, review, preferences, questions, plan). */
export const STEPS = ["Your goal", "Your resume", "Review", "Preferences", "Questions", "Your plan"];
export function Dots({ shown }: { shown: number }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 8 }} accessibilityLabel={`Step ${shown + 1} of ${STEPS.length}: ${STEPS[shown]}`}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {STEPS.map((s, i) => <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= shown ? c.fox : c.line }} />)}
      </View>
      <T kind="label">{`Step ${shown + 1} of ${STEPS.length} · ${STEPS[shown]}`}</T>
    </View>
  );
}

/** Remy beside what he says, like the website's `remy-prompt`. */
export function Say({ title, children, size = 64 }: { title?: string; children?: ReactNode; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
      <Remy size={size} />
      <View style={{ flex: 1, gap: 6 }}>
        {!!title && <T kind="title">{title}</T>}
        {typeof children === "string" ? <T kind="muted">{children}</T> : children}
      </View>
    </View>
  );
}

const slug = (s: string) => s.toLowerCase().replace(/\W+/g, "-");

/** Tap-to-pick chips (the website's `pref-chips`): several, or one when `multi` is false. */
export function Chips({ options, value, onChange, multi = true, testID }: { options: string[]; value: string[]; onChange: (v: string[]) => void; multi?: boolean; testID: string }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => {
        const on = value.includes(o);
        return <Pill key={o} label={o} on={on} testID={`${testID}-${slug(o)}`} onPress={() => onChange(multi ? (on ? value.filter((x) => x !== o) : [...value, o]) : [o])} />;
      })}
    </View>
  );
}

/** A numbered question with its answers under it (the website's `Q`). */
export function Q({ n, title, optional, children }: { n?: number; title: string; optional?: boolean; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontFamily: font.bold, fontSize: 16, color: c.ink }}>
        {n ? <Text style={{ color: c.foxDeep }}>{n}. </Text> : null}{title}{optional ? <Text style={{ fontFamily: font.body, fontSize: 13.5, color: c.mutedText }}> (optional)</Text> : null}
      </Text>
      {children}
    </View>
  );
}

export function Input({ label, style, ...props }: TextInputProps & { label?: string; testID: string }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {!!label && <T kind="small" style={{ fontFamily: font.semi, color: c.ink }}>{label}</T>}
      <TextInput placeholderTextColor={c.faint} accessibilityLabel={label || props.placeholder}
        style={[{ minHeight: 46, borderRadius: BUTTON_RADIUS, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, paddingHorizontal: 12, paddingVertical: 10, fontFamily: font.body, fontSize: 16, color: c.ink, textAlignVertical: props.multiline ? "top" : "center" }, style]}
        {...props} />
    </View>
  );
}

/** Back on the left, the step's main button on the right; a short note above says what's still missing. */
export function Nav({ note, onBack, next }: { note?: string; onBack?: () => void; next: ReactNode }) {
  return (
    <View style={{ gap: 10, marginTop: 4 }}>
      {!!note && <T kind="small">{note}</T>}
      {next}
      {onBack && <Button testID="button-setup-back" kind="ghost" label="Back" onPress={onBack} flex />}
    </View>
  );
}
