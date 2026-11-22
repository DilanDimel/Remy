import { PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold, useFonts } from "@expo-google-fonts/plus-jakarta-sans";
import { Stack, type ErrorBoundaryProps } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { JobsProvider } from "@/lib/jobs";
import { SessionProvider } from "@/lib/session";
import { ThemeProvider, useTheme } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const { c, dark } = useTheme();
  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.paper } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sign-in" options={{ animation: "fade" }} />
        <Stack.Screen name="not-yet" options={{ animation: "fade" }} />
        {/* Screens not rebuilt natively yet open the website, signed in, as a sheet. */}
        <Stack.Screen name="web" options={{ presentation: "modal", headerShown: true, headerTintColor: c.fox, headerStyle: { backgroundColor: c.surface }, headerTitleStyle: { color: c.ink } }} />
      </Stack>
    </>
  );
}

export default function Layout() {
  const [loaded, fontError] = useFonts({ PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold });
  // Never stay on the splash: go on with system fonts if the brand font fails or is slow (Dilan saw a frozen splash, Nov 22).
  const [waited, setWaited] = useState(false);
  useEffect(() => { const t = setTimeout(() => setWaited(true), 3000); return () => clearTimeout(t); }, []);
  const ready = loaded || !!fontError || waited;
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  if (!ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SessionProvider>
            <JobsProvider>
              <Root />
            </JobsProvider>
          </SessionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** A startup error shows on screen (with Try again) instead of leaving the splash up. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => { SplashScreen.hideAsync().catch(() => {}); }, []);
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, gap: 12, backgroundColor: "#fbf7f2" }}>
      <Text style={{ fontSize: 24, fontWeight: "800", color: "#161616" }}>Remy hit a snag</Text>
      <Text selectable style={{ fontSize: 14, color: "#5f5f5f" }}>{error.message}</Text>
      <Pressable testID="button-retry" onPress={retry} style={{ height: 48, borderRadius: 12, backgroundColor: "#161616", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 16 }}>Try again</Text>
      </Pressable>
    </ScrollView>
  );
}
