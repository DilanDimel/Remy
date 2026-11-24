import { PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold, useFonts } from "@expo-google-fonts/plus-jakarta-sans";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ConfigProvider } from "@/lib/config";
import { JobsProvider } from "@/lib/jobs";
import { SessionProvider } from "@/lib/session";
import { ThemeProvider, useTheme } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const { c, dark } = useTheme();
  const sheet = { presentation: "modal", headerShown: true, headerTintColor: c.fox, headerStyle: { backgroundColor: c.surface }, headerTitleStyle: { color: c.ink } } as const;
  return (
    <>
      {/* The status bar follows the account's theme (More → Theme), like the website. */}
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sign-in" options={{ animation: "fade" }} />
        <Stack.Screen name="beta" options={{ animation: "fade" }} />
        <Stack.Screen name="terms" options={{ animation: "fade" }} />
        <Stack.Screen name="setup" options={{ animation: "fade" }} />
        <Stack.Screen name="not-yet" options={{ animation: "fade" }} />
        {/* Remy's chat opens over any tab from the floating fox, like the website's Remy panel. */}
        <Stack.Screen name="remy" options={{ presentation: "modal" }} />
        <Stack.Screen name="soon" options={{ ...sheet, title: "" }} />
        {/* Screens not rebuilt natively yet open the website, signed in, as a sheet. */}
        <Stack.Screen name="web" options={sheet} />
      </Stack>
    </>
  );
}

export default function Layout() {
  const [loaded] = useFonts({ PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold });
  useEffect(() => { if (loaded) SplashScreen.hideAsync().catch(() => {}); }, [loaded]);
  if (!loaded) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <ConfigProvider>
            <ThemeProvider>
              <JobsProvider>
                <Root />
              </JobsProvider>
            </ThemeProvider>
          </ConfigProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
